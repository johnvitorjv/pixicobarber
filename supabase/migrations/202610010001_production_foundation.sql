-- Run only after preflight, backup and explicit approval. Entire change is atomic.
-- Compatible with the repository's schema.sql, with or without fix_definitivo.sql.
begin;
-- This file has never been applied remotely by this task. Do not replay a changed
-- foundation over an installed release: that requires a separate incremental plan.
do $$ begin
  if to_regclass('public.business_settings') is not null or to_regclass('public.schedule_config') is not null then
    raise exception 'Foundation já instalada ou schema incompatível. Não reaplique; prepare migration incremental após revisão.';
  end if;
  if not exists(select 1 from pg_trigger where tgrelid=to_regclass('auth.users')
    and tgfoid=to_regprocedure('public.handle_new_user()') and not tgisinternal
    and (tgtype & 5)=5 and (tgtype & 2)=0 and tgenabled in ('O','A')) then
    raise exception 'Trigger de cadastro legado ausente ou desativado. Revise o preflight antes de migrar.';
  end if;
end $$;
create extension if not exists btree_gist;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

alter table public.profiles add column if not exists favorito boolean not null default false;
alter table public.profiles add column if not exists apelido text;
alter table public.profiles add column if not exists blacklist boolean not null default false;
alter table public.profiles add column if not exists blacklist_motivo text;
alter table public.profiles add column if not exists tags text[] not null default '{}';
alter table public.profiles add column if not exists observacoes_admin text not null default '';
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, nome, sobrenome, whatsapp, role, foto_url, nascimento, observacoes, email)
  values(new.id, coalesce(new.raw_user_meta_data->>'nome',''),
    coalesce(new.raw_user_meta_data->>'sobrenome',''), new.raw_user_meta_data->>'whatsapp',
    'client', new.raw_user_meta_data->>'fotoUrl',
    nullif(new.raw_user_meta_data->>'nascimento','')::date,
    coalesce(new.raw_user_meta_data->>'observacoes',''), new.email);
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function private.protect_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    if new.role is distinct from old.role or new.id is distinct from old.id or new.email is distinct from old.email then
      raise exception 'Dados de autorização só podem ser alterados por operação confiável' using errcode = '42501';
    end if;
    if not private.is_admin() and
      (new.favorito, new.apelido, new.blacklist, new.blacklist_motivo, new.tags, new.observacoes_admin, new.criado_em)
      is distinct from (old.favorito, old.apelido, old.blacklist, old.blacklist_motivo, old.tags, old.observacoes_admin, old.criado_em) then
      raise exception 'Campos administrativos protegidos' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger protect_profile before update on public.profiles for each row execute function private.protect_profile();

create table public.business_settings (
  id boolean primary key default true check(id),
  data jsonb not null default '{"nomeNegocio":"PIXICO Barber","whatsappNumero":"5571994096863","endereco":"R. da Palestina, 297c - Itacaranha, Salvador - BA, 40713-660","blacklistBehavior":"approval","notifSom":false,"templateOverrides":{}}',
  check (data->>'blacklistBehavior' in ('block','approval'))
);
insert into public.business_settings(id) values(true);
create table public.schedule_config (
  id boolean primary key default true check(id),
  data jsonb not null default '{"diasFuncionamento":[2,3,4,5,6],"horarioInicio":"09:00","horarioFim":"20:00","intervaloAlmoco":{"inicio":"13:00","fim":"15:30"},"duracaoSlot":15,"bloqueiosEspeciais":[],"ferias":[]}'
);
insert into public.schedule_config(id) values(true);
create table public.day_overrides (data date primary key, value jsonb not null);
create table public.expenses (
  id uuid primary key default gen_random_uuid(), descricao text not null check(length(trim(descricao)) between 1 and 500),
  valor numeric(10,2) not null check(valor > 0), categoria text not null default 'despesa',
  criado_em timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), destinatario uuid references public.profiles(id) on delete cascade,
  para_admin boolean not null default false, tipo text not null, titulo text not null, mensagem text not null,
  nivel text not null default 'info', lida boolean not null default false,
  criado_em timestamptz not null default now(), check(para_admin <> (destinatario is not null))
);
create table public.appointment_events (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments(id), actor_id uuid,
  status_anterior text, status_novo text not null, criado_em timestamptz not null default now()
);

alter table public.appointments add column if not exists preco_reservado numeric(10,2);
alter table public.appointments add column if not exists servico_nome_reservado text;
alter table public.appointments add column if not exists valor_cobrado numeric(10,2);
alter table public.appointments add column if not exists forma_pagamento text;
alter table public.appointments add column if not exists motivo_rejeicao text;
alter table public.appointments add column if not exists sugestao_data date;
alter table public.appointments add column if not exists sugestao_inicio time;
alter table public.appointments add column if not exists sugestao_fim time;
-- Preserve original appointment dates/times and all data. Abort if legacy data violates constraints.
update public.appointments a set preco_reservado = coalesce(a.preco_reservado,s.preco_promocional,s.preco), servico_nome_reservado = coalesce(a.servico_nome_reservado,s.nome)
from public.services s where s.id = a.servico_id and (a.preco_reservado is null or a.servico_nome_reservado is null);
-- Snapshot legacy prices BEFORE updating the catalog. Keep UUIDs, images and history.
alter table public.services add column if not exists dias_permitidos integer[] not null default '{0,1,2,3,4,5,6}';
alter table public.services add column if not exists confirmacao_manual boolean not null default false;
alter table public.services add column if not exists aplicacao_minutos integer;
alter table public.services alter column duracao drop not null;
alter table public.services add constraint services_weekdays_check check
 (cardinality(dias_permitidos) > 0 and dias_permitidos <@ array[0,1,2,3,4,5,6] and array_position(dias_permitidos,null) is null);
create or replace function private.catalog_name(v text) returns text
language sql immutable set search_path = '' as $$
 select regexp_replace(translate(lower(trim(v)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]', '', 'g');
$$;
do $$ declare r record; ids uuid[]; target uuid; begin
 for r in select * from (values
 ('Corte',30,30,'corte',false,array[0,1,2,3,4,5,6],array['corte']),
 ('Barba',20,15,'barba',false,array[0,1,2,3,4,5,6],array['barba']),
 ('Pezinho / Acabamento',15,15,'corte',false,array[0,1,2,3,4,5,6],array['pezinhoacabamento','pezinho','acabamento']),
 ('Navalhado',32,30,'corte',false,array[0,1,2,3,4,5,6],array['navalhado']),
 ('Pigmentação',20,15,'tratamento',false,array[0,1,2,3,4,5,6],array['pigmentacao']),
 ('Tesoura e máquina',35,30,'corte',false,array[0,1,2,3,4,5,6],array['tesouraemaquina','tesouramaquina']),
 ('Tesoura',40,30,'corte',false,array[0,1,2,3,4,5,6],array['tesoura']),
 ('Navalhado + tesoura',35,30,'corte',false,array[0,1,2,3,4,5,6],array['navalhadotesoura']),
 ('Freestyle',5,30,'corte',false,array[0,1,2,3,4,5,6],array['freestyle']),
 ('Bigodin',5,5,'barba',false,array[0,1,2,3,4,5,6],array['bigodin']),
 ('Platinado',100,null,'tratamento',true,array[0,1,2,3,4,5,6],array['platinado']),
 ('Luzes',80,null,'tratamento',true,array[0,1,2,3,4,5,6],array['luzes']),
 ('Corte criança',50,45,'corte',false,array[2,3,4],array['cortecrianca','corteinfantil']),
 ('Corte + bigodin + sobrancelha',35,30,'combo',false,array[0,1,2,3,4,5,6],array['cortebigodinsobrancelha']),
 ('Corte + barba + sobrancelha',50,30,'combo',false,array[0,1,2,3,4,5,6],array['cortebarbasobrancelha']),
 ('Cabelo + barba',45,45,'combo',false,array[0,1,2,3,4,5,6],array['cabelobarba','cortebarba']),
 ('Pé + barba + sobrancelha',35,30,'combo',false,array[0,1,2,3,4,5,6],array['pebarbasobrancelha']),
 ('Corte + barba + sobrancelha + pigmentação',60,45,'combo',false,array[0,1,2,3,4,5,6],array['cortebarbasobrancelhapigmentacao'])
 ) as catalog(nome,preco,duracao,categoria,manual,dias,aliases) loop
   select array_agg(id) into ids from public.services where private.catalog_name(nome) = any(r.aliases);
   if cardinality(ids) > 1 then raise exception 'Catálogo ambíguo: %. Revise duplicatas sem excluir histórico.', r.nome; end if;
   target := ids[1];
   if target is null then
     insert into public.services(nome,preco,duracao,categoria,confirmacao_manual,dias_permitidos,aplicacao_minutos)
       values(r.nome,r.preco,r.duracao,r.categoria,r.manual,r.dias,case when r.manual then 15 end);
   else
     update public.services set nome=r.nome,preco=r.preco,preco_promocional=null,duracao=r.duracao,
       categoria=r.categoria,confirmacao_manual=r.manual,dias_permitidos=r.dias,
       aplicacao_minutos=case when r.manual then 15 end,status='ativo',visivel_agendamento=true where id=target;
   end if;
 end loop;
end $$;
alter table public.appointments add column if not exists confirmacao_manual boolean not null default false;
update public.appointments a set confirmacao_manual=s.confirmacao_manual from public.services s where s.id=a.servico_id;
-- Unknown legacy chemical occupancy must be reviewed, never silently shortened/released.
do $$ begin
 if exists(select 1 from public.appointments where confirmacao_manual
   and status in ('pendente','confirmado','aguardando_cliente','remarcado')
   and data + faixa_fim > timezone('America/Bahia',now())) then
   raise exception 'Atendimento químico legado futuro: revise a ocupação total antes da migração';
 end if;
end $$;
alter table public.appointments alter column faixa_fim drop not null;
alter table public.appointments alter column cliente_id set not null;
alter table public.appointments alter column servico_id set not null;
alter table public.appointments alter column status set not null;
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check check(status in
 ('solicitado','pendente','confirmado','concluido','cancelado_cliente','cancelado_admin','ausente','rejeitado','aguardando_cliente','remarcado'));
alter table public.appointments add constraint appointments_time_check check((status in ('solicitado','rejeitado','cancelado_cliente','cancelado_admin') and confirmacao_manual and faixa_fim is null) or (status <> 'solicitado' and faixa_fim is not null and faixa_inicio < faixa_fim));
alter table public.appointments add constraint appointments_payment_check check
 (valor_cobrado is null or valor_cobrado >= 0);
alter table public.appointments add constraint appointments_payment_method_check check
 (forma_pagamento is null or forma_pagamento in ('dinheiro','pix','debito','credito'));
alter table public.appointments add constraint appointments_single_barber check(recurso_id is null or recurso_id = 'pixico');
alter table public.appointments add constraint appointments_no_overlap exclude using gist
 (tsrange(data + faixa_inicio, data + faixa_fim, '[)') with &&)
 where (status in ('pendente','confirmado','aguardando_cliente','remarcado'));
alter table public.services add constraint services_price_check check(preco >= 0 and (preco_promocional is null or preco_promocional >= 0));
alter table public.services add constraint services_duration_check check((confirmacao_manual and duracao is null and aplicacao_minutos is not null and aplicacao_minutos = 15) or (not confirmacao_manual and duracao is not null and duracao between 5 and 480));

-- Global lock coordinates booking and rule changes. Rules cannot race reservations.
create or replace function private.lock_schedule() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(7102026);
  return null;
end $$;
create trigger lock_schedule_rules before insert or update or delete on public.schedule_config
for each statement execute function private.lock_schedule();
create trigger lock_day_rules before insert or update or delete on public.day_overrides
for each statement execute function private.lock_schedule();
create trigger lock_business_rules before insert or update or delete on public.business_settings
for each statement execute function private.lock_schedule();
create trigger lock_service_rules before insert or update or delete on public.services
for each statement execute function private.lock_schedule();
create trigger lock_booking_rules before insert or update or delete on public.appointments
for each statement execute function private.lock_schedule();

create or replace function private.validate_schedule() returns trigger
language plpgsql set search_path = '' as $$
declare c jsonb := new.data; d jsonb;
begin
  if jsonb_typeof(c) <> 'object' or
    jsonb_typeof(c->'diasFuncionamento') is distinct from 'array' or
    jsonb_typeof(c->'duracaoSlot') is distinct from 'number' or
    jsonb_typeof(c->'horarioInicio') is distinct from 'string' or
    jsonb_typeof(c->'horarioFim') is distinct from 'string' or
    jsonb_typeof(c->'intervaloAlmoco'->'inicio') is distinct from 'string' or
    jsonb_typeof(c->'intervaloAlmoco'->'fim') is distinct from 'string' or
    jsonb_typeof(c->'ferias') is distinct from 'array' or
    jsonb_typeof(c->'bloqueiosEspeciais') is distinct from 'array' then
    raise exception 'Regras de expediente inválidas';
  end if;
  if (c->>'duracaoSlot')::numeric <> trunc((c->>'duracaoSlot')::numeric) or
     (c->>'duracaoSlot')::int <> 15 or
     (c->>'horarioInicio')::time >= (c->>'horarioFim')::time or
     (c->'intervaloAlmoco'->>'inicio')::time >= (c->'intervaloAlmoco'->>'fim')::time or
     (c->'intervaloAlmoco'->>'inicio')::time < (c->>'horarioInicio')::time or
     (c->'intervaloAlmoco'->>'fim')::time > (c->>'horarioFim')::time or
     jsonb_typeof(c->'diasFuncionamento') <> 'array' or
     not (c ?& array['duracaoSlot','horarioInicio','horarioFim','intervaloAlmoco','diasFuncionamento','ferias','bloqueiosEspeciais']) then
    raise exception 'Regras de expediente inválidas';
  end if;
  for d in select value from jsonb_array_elements(c->'diasFuncionamento') loop
    if jsonb_typeof(d) <> 'number' or d::text::numeric <> trunc(d::text::numeric) or d::text::int not between 0 and 6 then raise exception 'Dia da semana inválido'; end if;
  end loop;
  for d in select value from jsonb_array_elements(c->'ferias') loop
    if jsonb_typeof(d->'inicio') is distinct from 'string' or jsonb_typeof(d->'fim') is distinct from 'string' or (d->>'inicio')::date > (d->>'fim')::date then raise exception 'Férias inválidas'; end if;
  end loop;
  for d in select value from jsonb_array_elements(c->'bloqueiosEspeciais') loop
    if jsonb_typeof(d->'data') is distinct from 'string' then raise exception 'Data de bloqueio inválida'; end if;
    perform (d->>'data')::date;
  end loop;
  return new;
end $$;
create trigger validate_schedule before insert or update on public.schedule_config
for each row execute function private.validate_schedule();

create or replace function private.validate_business() returns trigger
language plpgsql set search_path = '' as $$
declare c jsonb := new.data;
begin
  if jsonb_typeof(c) <> 'object' or
     jsonb_typeof(c->'nomeNegocio') is distinct from 'string' or
     jsonb_typeof(c->'endereco') is distinct from 'string' or
     jsonb_typeof(c->'whatsappNumero') is distinct from 'string' or
     jsonb_typeof(c->'blacklistBehavior') is distinct from 'string' or
     length(trim(c->>'nomeNegocio')) not between 1 and 120 or
     length(trim(c->>'endereco')) not between 1 and 500 or
     (c->>'whatsappNumero') !~ '^[0-9]{10,15}$' or
     c->>'blacklistBehavior' not in ('block','approval') then
    raise exception 'Dados do negócio inválidos';
  end if;
  return new;
end $$;
create trigger validate_business before insert or update on public.business_settings
for each row execute function private.validate_business();
-- Overrides fully replace defaults, vacations and global date closures.
create or replace function private.validate_day() returns trigger
language plpgsql set search_path = '' as $$
declare c jsonb := new.value; f jsonb; previous_end time;
begin
  if jsonb_typeof(c) <> 'object' or jsonb_typeof(c->'disponivel') is distinct from 'boolean' or
     jsonb_typeof(c->'intervalos') is distinct from 'array' or jsonb_typeof(c->'bloqueios') is distinct from 'array'
     then raise exception 'Disponibilidade inválida'; end if;
  if (c->>'disponivel')::boolean and jsonb_array_length(c->'intervalos')=0 then raise exception 'Informe intervalos de trabalho'; end if;
  for f in select value from jsonb_array_elements((c->'intervalos') || (c->'bloqueios')) loop
    if coalesce(f->>'inicio','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or
       coalesce(f->>'fim','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or
       (f->>'inicio')::time >= (f->>'fim')::time then raise exception 'Faixa inválida'; end if;
  end loop;
  for f in select value from jsonb_array_elements(c->'intervalos') order by value->>'inicio' loop
    if previous_end >= (f->>'inicio')::time then raise exception 'Una intervalos contíguos e remova sobreposições'; end if;
    previous_end := (f->>'fim')::time;
  end loop;
  return new;
end $$;
create trigger validate_day before insert or update on public.day_overrides
for each row execute function private.validate_day();

-- Calendar validity is separate from booking horizon/overlap, so rule edits also
-- protect future appointments outside the current 60-day customer window.
create or replace function private.schedule_allows(p_date date,p_start time,p_end time)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare c jsonb; o jsonb;
begin
  if p_date is null or p_start is null or p_end is null or p_start >= p_end
     or mod(extract(epoch from p_start)::numeric,900) <> 0 then return false; end if;
  select data into c from public.schedule_config where id;
  select value into o from public.day_overrides where data=p_date;
  if o is not null then
    return (o->>'disponivel')::boolean and exists(select 1 from jsonb_array_elements(o->'intervalos') f
      where p_start >= (f->>'inicio')::time and p_end <= (f->>'fim')::time)
      and not exists(select 1 from jsonb_array_elements(o->'bloqueios') f
      where p_start < (f->>'fim')::time and p_end > (f->>'inicio')::time);
  end if;
  return c is not null and c->'diasFuncionamento' @> to_jsonb(array[extract(dow from p_date)::int])
    and not exists(select 1 from jsonb_array_elements(c->'ferias') f where p_date between (f->>'inicio')::date and (f->>'fim')::date)
    and not exists(select 1 from jsonb_array_elements(c->'bloqueiosEspeciais') f where p_date=(f->>'data')::date)
    and p_start >= (c->>'horarioInicio')::time and p_end <= (c->>'horarioFim')::time
    and not (p_start < (c->'intervaloAlmoco'->>'fim')::time and p_end > (c->'intervaloAlmoco'->>'inicio')::time);
end $$;
create or replace function private.slot_allowed(p_date date, p_start time, p_end time, p_ignore uuid default null)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_date + p_start <= timezone('America/Bahia', now())
    or p_date > timezone('America/Bahia', now())::date + 59
    or not private.schedule_allows(p_date,p_start,p_end) then return false; end if;
  return not exists(select 1 from public.appointments where data = p_date
    and status in ('pendente','confirmado','aguardando_cliente','remarcado')
    and (p_ignore is null or id <> p_ignore) and faixa_inicio < p_end and faixa_fim > p_start);
end $$;
revoke all on function private.slot_allowed(date,time,time,uuid) from public, anon, authenticated;

create or replace function private.assert_existing_schedule() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare a record;
begin
  select b.id,b.data into a from public.appointments b join public.services s on s.id=b.servico_id
    where b.status in ('pendente','confirmado','aguardando_cliente','remarcado')
    and b.data + b.faixa_fim > timezone('America/Bahia',now())
    and (not private.schedule_allows(b.data,b.faixa_inicio,b.faixa_fim)
      or not extract(dow from b.data)::int = any(s.dias_permitidos)) limit 1;
  if found then raise exception 'Regra invalida agendamento % em %. Remarque ou cancele antes de alterar.',a.id,a.data; end if;
end $$;
create or replace function private.protect_existing_schedule() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_existing_schedule();
  return null;
end $$;
create trigger protect_existing_schedule after insert or update or delete on public.schedule_config
for each statement execute function private.protect_existing_schedule();
create trigger protect_existing_days after insert or update or delete on public.day_overrides
for each statement execute function private.protect_existing_schedule();
create trigger protect_existing_services after insert or update or delete on public.services
for each statement execute function private.protect_existing_schedule();
-- Abort atomically for incompatible legacy appointments; never erase them.
select private.assert_existing_schedule();

create or replace function private.validate_appointment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.services; admin boolean := private.is_admin(); expected_end time; occupied_duration interval;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  select * into s from public.services where id = new.servico_id;
  occupied_duration := make_interval(mins => s.duracao);
  if tg_op = 'UPDATE' and not old.confirmacao_manual then
    occupied_duration := old.faixa_fim-old.faixa_inicio;
  end if;
  if tg_op = 'INSERT' then
    if not admin and (new.cliente_id <> auth.uid() or new.status <> case when s.confirmacao_manual then 'solicitado' else 'pendente' end) then raise exception 'Pedido inválido' using errcode = '42501'; end if;
    if new.status <> (case when s.confirmacao_manual then 'solicitado' else 'pendente' end) then raise exception 'Crie o pedido antes de confirmar'; end if;
    if s.status <> 'ativo' or not s.visivel_agendamento then raise exception 'Serviço indisponível'; end if;
    if not admin and exists(select 1 from public.profiles where id = auth.uid() and blacklist)
       and (select data->>'blacklistBehavior' from public.business_settings where id) = 'block' then
      raise exception 'Entre em contato com a barbearia para agendar' using errcode = '42501';
    end if;
    new.confirmacao_manual := s.confirmacao_manual;
    new.preco_reservado := coalesce(s.preco_promocional, s.preco);
    new.servico_nome_reservado := s.nome;
    new.valor_cobrado := null; new.forma_pagamento := null;
    new.notas_admin := null; new.motivo_rejeicao := null;
    new.sugestao_data := null; new.sugestao_inicio := null; new.sugestao_fim := null;
    new.criado_em := now();
  else
    if old.status in ('concluido','ausente','rejeitado','cancelado_cliente','cancelado_admin') and
       (new.data,new.faixa_inicio,new.faixa_fim) is distinct from (old.data,old.faixa_inicio,old.faixa_fim) then
      raise exception 'Horário histórico protegido';
    end if;
    if (new.id,new.cliente_id,new.servico_id,new.preco_reservado,new.servico_nome_reservado,new.criado_em,new.confirmacao_manual)
      is distinct from (old.id,old.cliente_id,old.servico_id,old.preco_reservado,old.servico_nome_reservado,old.criado_em,old.confirmacao_manual) then
      raise exception 'Identidade e preço histórico protegidos' using errcode = '42501';
    end if;
    if not admin then
      if old.cliente_id <> auth.uid() then raise exception 'Acesso negado' using errcode = '42501'; end if;
      if new.status = 'cancelado_cliente' and old.status in ('solicitado','pendente','confirmado','remarcado','aguardando_cliente') then
        new := old; new.status := 'cancelado_cliente';
      elsif old.status = 'aguardando_cliente' and new.status = 'confirmado' and old.sugestao_data is not null then
        new := old; new.status := 'confirmado';
        new.data := old.sugestao_data; new.faixa_inicio := old.sugestao_inicio; new.faixa_fim := old.sugestao_fim;
        new.sugestao_data := null; new.sugestao_inicio := null; new.sugestao_fim := null;
      else raise exception 'Transição não permitida' using errcode = '42501'; end if;
      if old.status <> 'solicitado' and old.data + old.faixa_inicio <= timezone('America/Bahia',now()) then raise exception 'Horário já iniciado'; end if;
    elsif new.status is distinct from old.status then
      if old.status in ('concluido','ausente','rejeitado','cancelado_cliente','cancelado_admin') then raise exception 'Agendamento encerrado'; end if;
      if new.status in ('concluido','ausente') and old.status not in ('confirmado','remarcado') then raise exception 'Confirme o atendimento primeiro'; end if;
      if new.status in ('concluido','ausente') and old.data + old.faixa_inicio > timezone('America/Bahia',now()) then raise exception 'Atendimento ainda não iniciado'; end if;
    end if;
  end if;
  if tg_op='UPDATE' and old.status='solicitado' and new.status not in ('solicitado','confirmado','rejeitado','cancelado_cliente','cancelado_admin') then
    raise exception 'Defina a ocupação total e confirme primeiro';
  end if;
  if tg_op='UPDATE' and old.status <> 'solicitado' and new.status='solicitado' then raise exception 'Não é permitido liberar ocupação como solicitação'; end if;
  if new.status = 'solicitado' then
    if not new.confirmacao_manual or new.faixa_fim is not null then raise exception 'Solicitação química não possui término nem reserva garantida'; end if;
    if not private.slot_allowed(new.data,new.faixa_inicio,(new.faixa_inicio + interval '15 minutes')::time,new.id) then raise exception 'Horário indisponível'; end if;
  end if;
  if new.status = 'aguardando_cliente' then
    if new.sugestao_data is null or new.sugestao_inicio is null or new.sugestao_fim is null then raise exception 'Preencha a proposta de remarcação'; end if;
    if not private.slot_allowed(new.sugestao_data,new.sugestao_inicio,new.sugestao_fim,new.id) then raise exception 'Proposta indisponível'; end if;
    if not extract(dow from new.sugestao_data)::int = any(s.dias_permitidos) then raise exception 'Serviço não permitido neste dia da semana'; end if;
    if (not new.confirmacao_manual and new.sugestao_fim - new.sugestao_inicio <> occupied_duration) or
       (new.confirmacao_manual and new.sugestao_fim - new.sugestao_inicio not between interval '30 minutes' and interval '8 hours') then raise exception 'Duração da proposta inválida'; end if;
  end if;
  if new.status = 'concluido' and (new.valor_cobrado is null or new.forma_pagamento is null) then raise exception 'Informe cobrança e pagamento'; end if;
  if length(coalesce(new.notas_cliente,'')) > 2000 then raise exception 'Observação muito longa'; end if;
  if new.status in ('solicitado','pendente','confirmado','aguardando_cliente','remarcado') and
     (tg_op='INSERT' or (new.data,new.faixa_inicio,new.faixa_fim,new.status) is distinct from (old.data,old.faixa_inicio,old.faixa_fim,old.status)) then
    if not extract(dow from new.data)::int = any(s.dias_permitidos) then raise exception 'Serviço não permitido neste dia da semana'; end if;
    if new.status <> 'solicitado' then
      if new.confirmacao_manual then
        if new.faixa_fim is null or new.faixa_fim - new.faixa_inicio not between interval '30 minutes' and interval '8 hours' then
          raise exception 'Informe ocupação química total de 30 a 480 minutos, incluindo processamento e lavagem';
        end if;
      elsif tg_op='INSERT' or (new.data,new.faixa_inicio,new.faixa_fim) is distinct from (old.data,old.faixa_inicio,old.faixa_fim) then
        expected_end := (new.faixa_inicio + occupied_duration)::time;
        if new.faixa_fim is null or new.faixa_fim <> expected_end or new.faixa_fim <= new.faixa_inicio then raise exception 'Duração inválida'; end if;
      end if;
      if not private.slot_allowed(new.data,new.faixa_inicio,new.faixa_fim,new.id) then raise exception 'Horário indisponível' using errcode = '23P01'; end if;
    end if;
  end if;
  new.atualizado_em := now();
  return new;
end $$;
create trigger validate_appointment before insert or update on public.appointments
for each row execute function private.validate_appointment();

create or replace function public.get_available_slots(p_date date, p_service uuid)
returns table(id text, inicio text, fim text, disponivel boolean)
language plpgsql stable security definer set search_path = '' as $$
declare s public.services; duration int; t timestamp;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  select * into s from public.services where public.services.id=p_service and status='ativo' and visivel_agendamento;
  if s.id is null or not extract(dow from p_date)::int = any(s.dias_permitidos) then return; end if;
  duration := case when s.confirmacao_manual then 15 else s.duracao end;
  t := p_date::timestamp;
  while t + make_interval(mins => duration) < p_date + interval '1 day' loop
    if private.schedule_allows(p_date,t::time,(t+make_interval(mins=>duration))::time) then
      id := to_char(t,'HH24:MI'); inicio := id;
      fim := case when s.confirmacao_manual then null else to_char(t + make_interval(mins => duration),'HH24:MI') end;
      disponivel := private.slot_allowed(p_date,t::time,(t + make_interval(mins => duration))::time);
      return next;
    end if;
    t := t + interval '15 minutes';
  end loop;
end $$;
revoke all on function public.get_available_slots(date,uuid) from public, anon;
grant execute on function public.get_available_slots(date,uuid) to authenticated;

create or replace function private.appointment_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.appointment_events(appointment_id,actor_id,status_anterior,status_novo)
    values(new.id,auth.uid(),case when tg_op = 'UPDATE' then old.status end,new.status);
    insert into public.notifications(para_admin,tipo,titulo,mensagem,nivel)
    values(true,'agendamento','Atualização de agendamento',new.servico_nome_reservado || ' — ' || new.data || ' ' || new.faixa_inicio || ': ' || new.status,'info');
    insert into public.notifications(destinatario,tipo,titulo,mensagem,nivel)
    values(new.cliente_id,'agendamento','Seu agendamento',new.servico_nome_reservado || ' — ' || new.data || ' ' || new.faixa_inicio || ': ' || new.status,'info');
  end if;
  return new;
end $$;
create trigger appointment_changed after insert or update on public.appointments for each row execute function private.appointment_changed();

-- Replace existing policies on application tables, including unsafe legacy ones.
do $$ declare p record; t text; begin
  for p in select schemaname,tablename,policyname from pg_policies where schemaname = 'public'
    and tablename in ('profiles','services','appointments','schedule_config','business_settings','day_overrides','expenses','notifications','appointment_events') loop
    execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  end loop;
  foreach t in array array['profiles','services','appointments','schedule_config','business_settings','day_overrides','expenses','notifications','appointment_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
  end loop;
end $$;
grant update on public.profiles to authenticated;
grant select(id,nome,sobrenome,whatsapp,role,foto_url,nascimento,observacoes,email,ultima_atividade,criado_em)
 on public.profiles to authenticated;
grant select on public.services,public.schedule_config,public.business_settings,public.day_overrides to anon,authenticated;
grant insert,update,delete on public.services,public.day_overrides to authenticated;
grant update on public.schedule_config,public.business_settings to authenticated;
grant insert,update on public.appointments to authenticated;
grant select(id,cliente_id,servico_id,data,faixa_inicio,faixa_fim,status,confirmacao_manual,notas_cliente,recurso_id,criado_em,atualizado_em,preco_reservado,servico_nome_reservado,valor_cobrado,forma_pagamento,motivo_rejeicao,sugestao_data,sugestao_inicio,sugestao_fim) on public.appointments to authenticated;
grant select,insert,delete on public.expenses to authenticated;
grant select,update,delete on public.notifications to authenticated;
grant select on public.appointment_events to authenticated;
create policy profiles_read on public.profiles for select to authenticated using(id = auth.uid() or private.is_admin());
create policy profiles_update on public.profiles for update to authenticated using(id = auth.uid() or private.is_admin()) with check(id = auth.uid() or private.is_admin());
-- Administrative notes/tags/blacklist are never readable by a client, including
-- through a handcrafted REST query. Only this checked RPC exposes those fields.
create or replace function public.get_admin_clients() returns setof public.profiles
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Acesso negado' using errcode = '42501'; end if;
  return query select * from public.profiles where role = 'client' order by criado_em desc;
end $$;
revoke all on function public.get_admin_clients() from public,anon;
grant execute on function public.get_admin_clients() to authenticated;
create policy services_read on public.services for select using(status = 'ativo' or private.is_admin());
create policy services_admin on public.services for all to authenticated using(private.is_admin()) with check(private.is_admin());
create or replace function public.get_admin_appointments() returns setof public.appointments
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Acesso negado' using errcode = '42501'; end if;
  return query select * from public.appointments order by criado_em desc;
end $$;
revoke all on function public.get_admin_appointments() from public,anon;
grant execute on function public.get_admin_appointments() to authenticated;
create policy appointments_read on public.appointments for select to authenticated using(cliente_id = auth.uid() or private.is_admin());
create policy appointments_insert on public.appointments for insert to authenticated with check((cliente_id = auth.uid() and status in ('pendente','solicitado')) or private.is_admin());
create policy appointments_update on public.appointments for update to authenticated using(cliente_id = auth.uid() or private.is_admin()) with check(cliente_id = auth.uid() or private.is_admin());
create policy schedule_read on public.schedule_config for select using(true);
create policy schedule_admin on public.schedule_config for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy business_read on public.business_settings for select using(true);
create policy business_admin on public.business_settings for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy days_read on public.day_overrides for select using(true);
create policy days_admin on public.day_overrides for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy expenses_admin on public.expenses for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy notifications_read on public.notifications for select to authenticated using(destinatario = auth.uid() or (para_admin and private.is_admin()));
create policy notifications_update on public.notifications for update to authenticated using(destinatario = auth.uid() or (para_admin and private.is_admin())) with check(destinatario = auth.uid() or (para_admin and private.is_admin()));
create policy notifications_delete on public.notifications for delete to authenticated using(destinatario = auth.uid() or (para_admin and private.is_admin()));
-- Only read-state may be updated. Grants additionally constrain columns.
revoke update on public.notifications from authenticated;
grant update(lida) on public.notifications to authenticated;
create policy events_read on public.appointment_events for select to authenticated using(private.is_admin() or exists(select 1 from public.appointments where id = appointment_id and cliente_id = auth.uid()));

create index appointments_client_date on public.appointments(cliente_id,data);
create index appointments_date_status on public.appointments(data,status);
create index notifications_recipient on public.notifications(destinatario,criado_em desc);
create index notifications_admin on public.notifications(criado_em desc) where para_admin;
create index events_appointment on public.appointment_events(appointment_id);

-- Storage legacy policies: remove only policies named by the original schema.
drop policy if exists "Admins podem gerenciar imagens" on storage.objects;
drop policy if exists "Clientes podem upar foto de perfil" on storage.objects;
create policy pixico_media_admin on storage.objects for all to authenticated
 using(bucket_id = 'pixico-media' and private.is_admin()) with check(bucket_id = 'pixico-media' and private.is_admin());
create policy pixico_profile_upload on storage.objects for insert to authenticated
 with check(bucket_id = 'pixico-media' and (storage.foldername(name))[1] = 'profiles' and (storage.foldername(name))[2] = auth.uid()::text);
create policy pixico_profile_update on storage.objects for update to authenticated
 using(bucket_id = 'pixico-media' and (storage.foldername(name))[1] = 'profiles' and (storage.foldername(name))[2] = auth.uid()::text)
 with check(bucket_id = 'pixico-media' and (storage.foldername(name))[1] = 'profiles' and (storage.foldername(name))[2] = auth.uid()::text);

-- Revoke only PIXICO internals; an existing private schema may contain other apps.
revoke all on function private.is_admin(),private.protect_profile(),private.catalog_name(text),
 private.lock_schedule(),private.validate_schedule(),private.validate_business(),private.validate_day(),
 private.schedule_allows(date,time,time),private.slot_allowed(date,time,time,uuid),
 private.assert_existing_schedule(),private.protect_existing_schedule(),private.validate_appointment(),
 private.appointment_changed() from public,anon,authenticated;
grant execute on function private.is_admin() to anon,authenticated;

do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Private columns must not be streamed to clients. Notifications invalidate
    -- bookings; profiles use explicit refresh/polling and checked admin RPCs.
    foreach t in array array['profiles','appointments'] loop
      if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime drop table public.%I',t);
      end if;
    end loop;
    foreach t in array array['services','schedule_config','business_settings','day_overrides','expenses','notifications'] loop
      if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;

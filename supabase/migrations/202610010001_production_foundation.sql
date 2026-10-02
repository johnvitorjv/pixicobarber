-- Run only after preflight, backup and explicit approval. Entire change is atomic.
-- Compatible with the repository's schema.sql, with or without fix_definitivo.sql.
begin;
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
  data jsonb not null default '{"nomeNegocio":"PIXICO Barber","whatsappNumero":"5571994096863","endereco":"R. Ten. Aragão, 121 — Itacaranha, Salvador — BA","blacklistBehavior":"approval","notifSom":false,"templateOverrides":{}}',
  check (data->>'blacklistBehavior' in ('block','approval'))
);
insert into public.business_settings(id) values(true);
create table public.schedule_config (
  id boolean primary key default true check(id),
  data jsonb not null default '{"diasFuncionamento":[2,3,4,5,6],"horarioInicio":"09:00","horarioFim":"18:00","intervaloAlmoco":{"inicio":"12:00","fim":"14:00"},"duracaoSlot":30,"limiteClientesDia":16,"limiteClientesTurno":8,"bloqueiosEspeciais":[],"ferias":[]}'
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
update public.appointments a set preco_reservado = s.preco, servico_nome_reservado = s.nome
from public.services s where s.id = a.servico_id and a.preco_reservado is null;
alter table public.appointments alter column cliente_id set not null;
alter table public.appointments alter column servico_id set not null;
alter table public.appointments alter column status set not null;
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check check(status in
 ('pendente','confirmado','concluido','cancelado_cliente','cancelado_admin','ausente','rejeitado','aguardando_cliente','remarcado'));
alter table public.appointments add constraint appointments_time_check check(faixa_inicio < faixa_fim);
alter table public.appointments add constraint appointments_payment_check check
 (valor_cobrado is null or valor_cobrado >= 0);
alter table public.appointments add constraint appointments_payment_method_check check
 (forma_pagamento is null or forma_pagamento in ('dinheiro','pix','debito','credito'));
alter table public.appointments add constraint appointments_single_barber check(recurso_id is null or recurso_id = 'pixico');
alter table public.appointments add constraint appointments_no_overlap exclude using gist
 (tsrange(data + faixa_inicio, data + faixa_fim, '[)') with &&)
 where (status in ('pendente','confirmado','aguardando_cliente','remarcado'));
alter table public.services add constraint services_price_check check(preco >= 0 and (preco_promocional is null or preco_promocional >= 0));
alter table public.services add constraint services_duration_check check(duracao between 5 and 480);

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
create trigger lock_booking_rules before insert or update or delete on public.appointments
for each statement execute function private.lock_schedule();

create or replace function private.validate_schedule() returns trigger
language plpgsql set search_path = '' as $$
declare c jsonb := new.data; d jsonb;
begin
  if jsonb_typeof(c) <> 'object' or
    jsonb_typeof(c->'diasFuncionamento') is distinct from 'array' or
    jsonb_typeof(c->'duracaoSlot') is distinct from 'number' or
    jsonb_typeof(c->'limiteClientesDia') is distinct from 'number' or
    jsonb_typeof(c->'limiteClientesTurno') is distinct from 'number' or
    jsonb_typeof(c->'horarioInicio') is distinct from 'string' or
    jsonb_typeof(c->'horarioFim') is distinct from 'string' or
    jsonb_typeof(c->'intervaloAlmoco'->'inicio') is distinct from 'string' or
    jsonb_typeof(c->'intervaloAlmoco'->'fim') is distinct from 'string' or
    jsonb_typeof(c->'ferias') is distinct from 'array' or
    jsonb_typeof(c->'bloqueiosEspeciais') is distinct from 'array' then
    raise exception 'Regras de expediente inválidas';
  end if;
  if (c->>'duracaoSlot')::numeric <> trunc((c->>'duracaoSlot')::numeric) or
     (c->>'limiteClientesDia')::numeric <> trunc((c->>'limiteClientesDia')::numeric) or
     (c->>'limiteClientesTurno')::numeric <> trunc((c->>'limiteClientesTurno')::numeric) or
     (c->>'duracaoSlot')::int not between 5 and 120 or
     (c->>'limiteClientesDia')::int not between 1 and 100 or
     (c->>'limiteClientesTurno')::int not between 1 and 100 or
     (c->>'horarioInicio')::time >= (c->>'horarioFim')::time or
     (c->'intervaloAlmoco'->>'inicio')::time >= (c->'intervaloAlmoco'->>'fim')::time or
     (c->'intervaloAlmoco'->>'inicio')::time < (c->>'horarioInicio')::time or
     (c->'intervaloAlmoco'->>'fim')::time > (c->>'horarioFim')::time or
     jsonb_typeof(c->'diasFuncionamento') <> 'array' or
     not (c ?& array['duracaoSlot','limiteClientesDia','limiteClientesTurno','horarioInicio','horarioFim','intervaloAlmoco','diasFuncionamento','ferias','bloqueiosEspeciais']) then
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
create or replace function private.validate_day() returns trigger
language plpgsql set search_path = '' as $$
declare c jsonb := new.value; f jsonb;
begin
  if jsonb_typeof(c) <> 'object' or jsonb_typeof(c->'disponivel') is distinct from 'boolean' or
     jsonb_typeof(c->'faixas') is distinct from 'array' then raise exception 'Disponibilidade inválida'; end if;
  for f in select value from jsonb_array_elements(c->'faixas') loop
    if jsonb_typeof(f->'disponivel') is distinct from 'boolean' or
       jsonb_typeof(f->'inicio') is distinct from 'string' or jsonb_typeof(f->'fim') is distinct from 'string' or
       (f->>'inicio')::time >= (f->>'fim')::time then raise exception 'Faixa inválida'; end if;
  end loop;
  return new;
end $$;
create trigger validate_day before insert or update on public.day_overrides
for each row execute function private.validate_day();

create or replace function private.slot_allowed(p_date date, p_start time, p_end time, p_ignore uuid default null)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare c jsonb; o jsonb; n int; turn_n int; b jsonb;
begin
  select data into c from public.schedule_config where id;
  select value into o from public.day_overrides where data = p_date;
  if p_date is null or p_start is null or p_end is null or p_start >= p_end
    or p_date + p_start <= timezone('America/Bahia', now())
    or p_date > timezone('America/Bahia', now())::date + 59 then return false; end if;
  if c is null then return false; end if;
  if o is not null then
    if coalesce((o->>'disponivel')::boolean,false) = false then return false; end if;
  elsif not (c->'diasFuncionamento' @> to_jsonb(array[extract(dow from p_date)::int])) then return false;
  end if;
  if exists(select 1 from jsonb_array_elements(c->'ferias') f where p_date between (f->>'inicio')::date and (f->>'fim')::date)
    or exists(select 1 from jsonb_array_elements(c->'bloqueiosEspeciais') f where p_date = (f->>'data')::date) then return false; end if;
  if p_start < (c->>'horarioInicio')::time or p_end > (c->>'horarioFim')::time
    or (p_start < (c->'intervaloAlmoco'->>'fim')::time and p_end > (c->'intervaloAlmoco'->>'inicio')::time)
    or mod(extract(epoch from (p_start - (c->>'horarioInicio')::time))::int, (c->>'duracaoSlot')::int * 60) <> 0 then return false; end if;
  if o is not null then
    for b in select value from jsonb_array_elements(coalesce(o->'faixas','[]')) loop
      if coalesce((b->>'disponivel')::boolean,false) = false and p_start < (b->>'fim')::time and p_end > (b->>'inicio')::time then return false; end if;
    end loop;
  end if;
  select count(*), count(*) filter(where
    (faixa_inicio < (c->'intervaloAlmoco'->>'inicio')::time) = (p_start < (c->'intervaloAlmoco'->>'inicio')::time))
  into n, turn_n from public.appointments
  where data = p_date and status in ('pendente','confirmado','aguardando_cliente','remarcado') and (p_ignore is null or id <> p_ignore);
  if n >= (c->>'limiteClientesDia')::int or turn_n >= (c->>'limiteClientesTurno')::int then return false; end if;
  return not exists(select 1 from public.appointments where data = p_date
    and status in ('pendente','confirmado','aguardando_cliente','remarcado')
    and (p_ignore is null or id <> p_ignore) and faixa_inicio < p_end and faixa_fim > p_start);
end $$;
revoke all on function private.slot_allowed(date,time,time,uuid) from public, anon, authenticated;

create or replace function private.validate_appointment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.services; admin boolean := private.is_admin(); expected_end time;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  select * into s from public.services where id = new.servico_id;
  if tg_op = 'INSERT' then
    if not admin and (new.cliente_id <> auth.uid() or new.status <> 'pendente') then raise exception 'Pedido inválido' using errcode = '42501'; end if;
    if s.status <> 'ativo' or not s.visivel_agendamento then raise exception 'Serviço indisponível'; end if;
    if not admin and exists(select 1 from public.profiles where id = auth.uid() and blacklist)
       and (select data->>'blacklistBehavior' from public.business_settings where id) = 'block' then
      raise exception 'Entre em contato com a barbearia para agendar' using errcode = '42501';
    end if;
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
    if (new.id,new.cliente_id,new.servico_id,new.preco_reservado,new.servico_nome_reservado,new.criado_em)
      is distinct from (old.id,old.cliente_id,old.servico_id,old.preco_reservado,old.servico_nome_reservado,old.criado_em) then
      raise exception 'Identidade e preço histórico protegidos' using errcode = '42501';
    end if;
    if not admin then
      if old.cliente_id <> auth.uid() then raise exception 'Acesso negado' using errcode = '42501'; end if;
      if new.status = 'cancelado_cliente' and old.status in ('pendente','confirmado','remarcado','aguardando_cliente') then
        new := old; new.status := 'cancelado_cliente';
      elsif old.status = 'aguardando_cliente' and new.status = 'confirmado' and old.sugestao_data is not null then
        new := old; new.status := 'confirmado';
        new.data := old.sugestao_data; new.faixa_inicio := old.sugestao_inicio; new.faixa_fim := old.sugestao_fim;
        new.sugestao_data := null; new.sugestao_inicio := null; new.sugestao_fim := null;
      else raise exception 'Transição não permitida' using errcode = '42501'; end if;
      if old.data + old.faixa_inicio <= timezone('America/Bahia',now()) then raise exception 'Horário já iniciado'; end if;
    elsif new.status is distinct from old.status then
      if old.status in ('concluido','ausente','rejeitado','cancelado_cliente','cancelado_admin') then raise exception 'Agendamento encerrado'; end if;
      if new.status in ('concluido','ausente') and old.status not in ('confirmado','remarcado') then raise exception 'Confirme o atendimento primeiro'; end if;
      if new.status in ('concluido','ausente') and old.data + old.faixa_inicio > timezone('America/Bahia',now()) then raise exception 'Atendimento ainda não iniciado'; end if;
    end if;
  end if;
  if new.status = 'aguardando_cliente' then
    if new.sugestao_data is null or new.sugestao_inicio is null or new.sugestao_fim is null then raise exception 'Preencha a proposta de remarcação'; end if;
    if not private.slot_allowed(new.sugestao_data,new.sugestao_inicio,new.sugestao_fim,new.id) then raise exception 'Proposta indisponível'; end if;
    if new.sugestao_fim - new.sugestao_inicio <> make_interval(mins => s.duracao) then raise exception 'Duração da proposta inválida'; end if;
  end if;
  if new.status = 'concluido' and (new.valor_cobrado is null or new.forma_pagamento is null) then raise exception 'Informe cobrança e pagamento'; end if;
  if length(coalesce(new.notas_cliente,'')) > 2000 then raise exception 'Observação muito longa'; end if;
  if tg_op = 'INSERT' or (new.data,new.faixa_inicio,new.faixa_fim) is distinct from (old.data,old.faixa_inicio,old.faixa_fim) then
    expected_end := (new.faixa_inicio + make_interval(mins => s.duracao))::time;
    if new.faixa_fim <> expected_end or new.faixa_fim <= new.faixa_inicio then raise exception 'Duração inválida'; end if;
    if not private.slot_allowed(new.data,new.faixa_inicio,new.faixa_fim,new.id) then raise exception 'Horário indisponível' using errcode = '23P01'; end if;
  end if;
  new.atualizado_em := now();
  return new;
end $$;
create trigger validate_appointment before insert or update on public.appointments
for each row execute function private.validate_appointment();

create or replace function public.get_available_slots(p_date date, p_service uuid)
returns table(id text, inicio text, fim text, disponivel boolean)
language plpgsql stable security definer set search_path = '' as $$
declare c jsonb; duration int; t timestamp; end_t timestamp;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  select s.duracao into duration from public.services s where s.id = p_service and s.status = 'ativo' and s.visivel_agendamento;
  select data into c from public.schedule_config where public.schedule_config.id;
  if duration is null or c is null then return; end if;
  t := p_date + (c->>'horarioInicio')::time;
  end_t := p_date + (c->>'horarioFim')::time;
  while t + make_interval(mins => duration) <= end_t loop
    id := to_char(t,'HH24:MI'); inicio := id; fim := to_char(t + make_interval(mins => duration),'HH24:MI');
    disponivel := private.slot_allowed(p_date,t::time,(t + make_interval(mins => duration))::time);
    return next;
    t := t + make_interval(mins => (c->>'duracaoSlot')::int);
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
grant select(id,cliente_id,servico_id,data,faixa_inicio,faixa_fim,status,notas_cliente,recurso_id,criado_em,atualizado_em,preco_reservado,servico_nome_reservado,valor_cobrado,forma_pagamento,motivo_rejeicao,sugestao_data,sugestao_inicio,sugestao_fim) on public.appointments to authenticated;
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
create policy appointments_insert on public.appointments for insert to authenticated with check((cliente_id = auth.uid() and status = 'pendente') or private.is_admin());
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

revoke all on all functions in schema private from public,anon,authenticated;
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

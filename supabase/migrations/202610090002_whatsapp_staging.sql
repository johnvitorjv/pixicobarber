-- PIXICO WhatsApp staging: additive, delivery is OFF by default.
-- Never backfill historical appointments; only new changes after explicit activation.
alter table public.profiles
  add column if not exists whatsapp_opt_in boolean not null default false;

create table if not exists private.whatsapp_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  admin_whatsapp text,
  admin_opt_in boolean not null default false,
  secret_hash text,
  updated_at timestamptz not null default now(),
  check (admin_whatsapp is null or admin_whatsapp ~ '^[0-9+ ()-]{10,24}$')
);
alter table private.whatsapp_settings enable row level security;
revoke all on private.whatsapp_settings from public, anon, authenticated;
insert into private.whatsapp_settings(id) values (true) on conflict (id) do nothing;

create table if not exists private.whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  recipient_kind text not null check (recipient_kind in ('admin','client')),
  recipient_phone text not null,
  event_type text not null,
  body text not null,
  status text not null default 'pending'
    check (status in ('pending','sending','sent','failed','cancelled')),
  attempts smallint not null default 0 check (attempts between 0 and 5),
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table private.whatsapp_outbox enable row level security;
revoke all on private.whatsapp_outbox from public, anon, authenticated;
create index if not exists whatsapp_outbox_dispatch_idx on private.whatsapp_outbox(status,available_at,created_at);
create index if not exists whatsapp_outbox_appointment_idx on private.whatsapp_outbox(appointment_id,created_at desc);
create unique index if not exists whatsapp_one_pending_reminder
 on private.whatsapp_outbox(appointment_id,recipient_kind,event_type)
 where event_type='client_reminder_24h' and status in ('pending','sending');

create or replace function private.queue_appointment_whatsapp()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  cfg private.whatsapp_settings%rowtype;
  client public.profiles%rowtype;
  actor uuid := auth.uid();
  admin_event text;
  client_event text;
  description text;
  day_label text;
  base_message text;
  client_message text;
  admin_message text;
  start_at timestamptz;
  important_change boolean;
begin
  select * into cfg from private.whatsapp_settings s where s.id=true;
  if not found or not cfg.enabled then return new; end if;
  select * into client from public.profiles where id=new.cliente_id;
  if not found then return new; end if;
  important_change := tg_op='INSERT';
  if tg_op='UPDATE' then
    important_change := new.status is distinct from old.status
      or new.data is distinct from old.data
      or new.faixa_inicio is distinct from old.faixa_inicio
      or new.faixa_fim is distinct from old.faixa_fim
      or new.servico_id is distinct from old.servico_id
      or new.sugestao_data is distinct from old.sugestao_data
      or new.sugestao_inicio is distinct from old.sugestao_inicio;
  end if;
  if not important_change then return new; end if;

  description := coalesce(nullif(new.servico_nome_reservado,''),'Serviço');
  day_label := to_char(new.data,'DD/MM/YYYY');
  base_message := description || ' — ' || day_label || ' às ' || to_char(new.faixa_inicio,'HH24:MI');
  if tg_op='INSERT' then
    admin_event := 'admin_new_request';
    client_event := 'client_request_received';
  else
    if new.status is distinct from old.status then
      case new.status
        when 'confirmado' then client_event := 'client_approved';
        when 'rejeitado' then client_event := 'client_rejected';
        when 'cancelado_admin' then client_event := 'client_cancelled_by_shop';
        when 'cancelado_cliente' then client_event := 'client_cancelled_confirm';
        when 'aguardando_cliente' then client_event := 'client_reschedule_proposed';
        when 'remarcado' then client_event := 'client_rescheduled';
        when 'pendente' then client_event := 'client_request_received';
        else client_event := null;
      end case;
      if actor=new.cliente_id or new.status='cancelado_cliente' then
        admin_event := case when new.status='cancelado_cliente' then 'admin_client_cancelled'
          when new.status='remarcado' then 'admin_client_rescheduled'
          else 'admin_client_update' end;
      end if;
    elsif actor=new.cliente_id then
      admin_event := 'admin_client_update';
    elsif new.status in ('confirmado','remarcado') then
      client_event := 'client_rescheduled';
    end if;
  end if;

  if client_event is not null and client.whatsapp_opt_in
    and not coalesce(client.blacklist,false)
    and nullif(trim(client.whatsapp),'') is not null then
    client_message := case client_event
      when 'client_request_received' then 'Recebemos sua solicitação e vamos analisar.'
      when 'client_approved' then 'Seu agendamento foi aprovado!'
      when 'client_rejected' then 'Seu horário não pôde ser aprovado.'
      when 'client_cancelled_by_shop' then 'A barbearia cancelou seu agendamento.'
      when 'client_cancelled_confirm' then 'Seu cancelamento foi registrado.'
      when 'client_reschedule_proposed' then 'O barbeiro sugeriu outro horário.'
      when 'client_rescheduled' then 'Seu horário foi atualizado.'
      else 'Seu agendamento foi atualizado.' end;
    if client_event='client_rejected' and nullif(trim(new.motivo_rejeicao),'') is not null then
      client_message := client_message || E'\nMotivo: ' || left(trim(new.motivo_rejeicao),240);
    end if;
    if client_event='client_reschedule_proposed' and new.sugestao_data is not null then
      client_message := client_message || E'\nSugestão: ' || to_char(new.sugestao_data,'DD/MM/YYYY')
        || ' às ' || to_char(new.sugestao_inicio,'HH24:MI');
    end if;
    insert into private.whatsapp_outbox(appointment_id,recipient_kind,recipient_phone,event_type,body)
    values(new.id,'client',trim(client.whatsapp),client_event,
      'PIXICO BARBER' || E'\nOlá, ' || left(coalesce(nullif(trim(client.nome),''),'cliente'),80)
      || '! ' || client_message || E'\nServiço: ' || left(base_message,180)
      || E'\nAcompanhe em: https://pixicobarber.site/painel'
    );
  end if;

  if admin_event is not null and cfg.admin_opt_in
    and nullif(trim(cfg.admin_whatsapp),'') is not null then
    admin_message := case admin_event
      when 'admin_new_request' then 'Nova solicitação de agendamento.'
      when 'admin_client_cancelled' then 'Cliente cancelou o agendamento.'
      when 'admin_client_rescheduled' then 'Cliente confirmou uma remarcação.'
      else 'Cliente alterou um agendamento.' end;
    insert into private.whatsapp_outbox(appointment_id,recipient_kind,recipient_phone,event_type,body)
    values(new.id,'admin',trim(cfg.admin_whatsapp),admin_event,
      'PIXICO BARBER — AVISO' || E'\n' || admin_message
      || E'\nCliente: ' || left(trim(concat_ws(' ',client.nome,client.sobrenome)),100)
      || E'\n' || left(base_message,180)
      || E'\nGerenciar: https://pixicobarber.site/admin/agendamentos'
    );
  end if;

  -- Cancel stale 24h reminders on every important edit.
  if tg_op='UPDATE' then
    update private.whatsapp_outbox set status='cancelled'
    where appointment_id=new.id and event_type='client_reminder_24h'
      and status in ('pending','failed');
  end if;
  if new.status in ('confirmado','remarcado') and client.whatsapp_opt_in
    and not coalesce(client.blacklist,false) and nullif(trim(client.whatsapp),'') is not null then
    start_at := (new.data + new.faixa_inicio) at time zone 'America/Bahia';
    if start_at > now() + interval '24 hours' then
      insert into private.whatsapp_outbox(appointment_id,recipient_kind,recipient_phone,event_type,body,available_at)
      values(new.id,'client',trim(client.whatsapp),'client_reminder_24h',
        'PIXICO BARBER — LEMBRETE' || E'\nSeu atendimento será em cerca de 24 horas.'
          || E'\n' || left(base_message,180) || E'\nhttps://pixicobarber.site/painel',
        start_at - interval '24 hours')
      on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.queue_appointment_whatsapp() from public,anon,authenticated;
drop trigger if exists appointment_whatsapp_queue on public.appointments;
create trigger appointment_whatsapp_queue
 after insert or update on public.appointments
 for each row execute function private.queue_appointment_whatsapp();

-- A worker cannot obtain jobs until the operator enables it and provisions a
-- randomly generated bearer token hash. These functions never expose the full DB key.
create or replace function public.whatsapp_worker_claim(p_token text,p_limit integer default 3)
returns table(id uuid,recipient_phone text,body text,lease_token uuid)
language plpgsql security definer set search_path=''
as $$
declare cfg private.whatsapp_settings%rowtype;
begin
 select * into cfg from private.whatsapp_settings s where s.id=true;
 if not found or not cfg.enabled or cfg.secret_hash is null or length(p_token)<32
    or cfg.secret_hash <> encode(sha256(convert_to(p_token,'UTF8')),'hex') then
    raise exception 'Worker não autorizado' using errcode='42501';
 end if;
 return query
 with selected as (
   select o.id from private.whatsapp_outbox o
   where ((o.status in ('pending','failed') and o.available_at<=now())
       or (o.status='sending' and o.lease_until<now()))
     and o.attempts<5
   order by o.available_at,o.created_at
   for update skip locked limit greatest(1,least(coalesce(p_limit,3),5))
 )
 update private.whatsapp_outbox o
    set status='sending', attempts=o.attempts+1,
        lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds'
 from selected s where o.id=s.id
 returning o.id,o.recipient_phone,o.body,o.lease_token;
end $$;

create or replace function public.whatsapp_worker_ack(
 p_token text,p_id uuid,p_lease uuid,p_success boolean,p_error text default null)
returns boolean language plpgsql security definer set search_path=''
as $$
declare cfg private.whatsapp_settings%rowtype;
begin
 select * into cfg from private.whatsapp_settings s where s.id=true;
 if not found or not cfg.enabled or cfg.secret_hash is null or length(p_token)<32
    or cfg.secret_hash <> encode(sha256(convert_to(p_token,'UTF8')),'hex') then
    raise exception 'Worker não autorizado' using errcode='42501';
 end if;
 update private.whatsapp_outbox o
 set status=case when p_success then 'sent' else 'failed' end,
     sent_at=case when p_success then now() else null end,
     available_at=case when p_success then o.available_at
       else now() + make_interval(mins=>least(60,2*o.attempts*o.attempts)) end,
     last_error=case when p_success then null else left(coalesce(p_error,'Falha no envio'),300) end,
     lease_token=null,lease_until=null
 where o.id=p_id and o.lease_token=p_lease and o.status='sending';
 return found;
end $$;
revoke all on function public.whatsapp_worker_claim(text,integer) from public,anon,authenticated;
revoke all on function public.whatsapp_worker_ack(text,uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.whatsapp_worker_claim(text,integer) to service_role;
grant execute on function public.whatsapp_worker_ack(text,uuid,uuid,boolean,text) to service_role;

-- Explicit opt-in selected during self-registration; old profiles default false.
create or replace function private.set_signup_whatsapp_opt_in()
returns trigger language plpgsql security definer set search_path=''
as $$
declare meta jsonb;
begin
  select raw_user_meta_data into meta from auth.users where id=new.id;
  if meta->>'whatsapp_opt_in'='true' then
    new.whatsapp_opt_in := true;
  end if;
  return new;
end $$;
revoke all on function private.set_signup_whatsapp_opt_in() from public,anon,authenticated;
drop trigger if exists profile_whatsapp_registration on public.profiles;
create trigger profile_whatsapp_registration before insert on public.profiles
for each row execute function private.set_signup_whatsapp_opt_in();

-- PIXICO Barber — transactional email outbox.
-- Additive only: existing in-app notifications remain untouched.
-- Delivery is activated separately after an email provider is connected.

create table if not exists private.email_outbox (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete cascade,
  recipient_email text not null,
  event_type text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  available_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending','sending','sent','failed','cancelled')),
  attempts smallint not null default 0 check (attempts >= 0),
  request_id bigint,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists email_outbox_dispatch_idx
  on private.email_outbox(status, available_at, created_at);

create index if not exists email_outbox_appointment_idx
  on private.email_outbox(appointment_id, created_at desc);

create unique index if not exists email_outbox_one_pending_reminder
  on private.email_outbox(appointment_id, event_type)
  where event_type = 'client_reminder_24h'
    and status in ('pending','sending');

revoke all on private.email_outbox from anon, authenticated, public;

create or replace function private.queue_appointment_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  client public.profiles%rowtype;
  admin_row record;
  appointment_start timestamptz;
  common_payload jsonb;
  client_name text;
begin
  select * into client
  from public.profiles
  where id = new.cliente_id;

  client_name := trim(concat_ws(' ', client.nome, client.sobrenome));
  appointment_start := (new.data + new.faixa_inicio) at time zone 'America/Bahia';

  common_payload := jsonb_build_object(
    'appointmentId', new.id,
    'clientId', new.cliente_id,
    'clientName', coalesce(nullif(client_name,''), 'Cliente'),
    'clientEmail', client.email,
    'clientWhatsapp', client.whatsapp,
    'service', coalesce(new.servico_nome_reservado, 'Serviço'),
    'date', new.data,
    'start', new.faixa_inicio,
    'end', new.faixa_fim,
    'status', new.status,
    'rejectionReason', new.motivo_rejeicao,
    'suggestedDate', new.sugestao_data,
    'suggestedStart', new.sugestao_inicio,
    'suggestedEnd', new.sugestao_fim,
    'siteUrl', 'https://pixicobarber.pages.dev',
    'clientUrl', 'https://pixicobarber.pages.dev/painel',
    'adminUrl', 'https://pixicobarber.pages.dev/admin/agendamentos'
  );

  if tg_op = 'INSERT' then
    for admin_row in
      select email from public.profiles
      where role = 'admin' and nullif(trim(email),'') is not null
    loop
      insert into private.email_outbox(
        appointment_id, recipient_email, event_type, subject, payload
      ) values (
        new.id,
        admin_row.email,
        'admin_new_request',
        'Nova solicitação de agendamento — PIXICO',
        common_payload
      );
    end loop;

    if nullif(trim(client.email),'') is not null then
      insert into private.email_outbox(
        appointment_id, recipient_email, event_type, subject, payload
      ) values (
        new.id,
        client.email,
        'client_request_received',
        'Recebemos sua solicitação — PIXICO',
        common_payload
      );
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if nullif(trim(client.email),'') is not null then
      if new.status = 'confirmado' then
        insert into private.email_outbox(appointment_id,recipient_email,event_type,subject,payload)
        values(new.id,client.email,'client_approved','Seu horário está confirmado ✅ — PIXICO',common_payload);

      elsif new.status = 'rejeitado' then
        insert into private.email_outbox(appointment_id,recipient_email,event_type,subject,payload)
        values(new.id,client.email,'client_rejected','Atualização sobre seu agendamento — PIXICO',common_payload);

      elsif new.status = 'cancelado_admin' then
        insert into private.email_outbox(appointment_id,recipient_email,event_type,subject,payload)
        values(new.id,client.email,'client_cancelled_by_shop','Seu agendamento foi cancelado — PIXICO',common_payload);

      elsif new.status = 'cancelado_cliente' then
        insert into private.email_outbox(appointment_id,recipient_email,event_type,subject,payload)
        values(new.id,client.email,'client_cancelled_confirm','Cancelamento confirmado — PIXICO',common_payload);

      elsif new.status = 'aguardando_cliente' then
        insert into private.email_outbox(appointment_id,recipient_email,event_type,subject,payload)
        values(new.id,client.email,'client_reschedule_proposed','Pixico sugeriu um novo horário — PIXICO',common_payload);

      elsif new.status = 'remarcado' then
        insert into private.email_outbox(appointment_id,recipient_email,event_type,subject,payload)
        values(new.id,client.email,'client_rescheduled','Seu novo horário está confirmado — PIXICO',common_payload);
      end if;
    end if;

    if new.status = 'cancelado_cliente' then
      for admin_row in
        select email from public.profiles
        where role = 'admin' and nullif(trim(email),'') is not null
      loop
        insert into private.email_outbox(appointment_id,recipient_email,event_type,subject,payload)
        values(new.id,admin_row.email,'admin_client_cancelled','Cliente cancelou um agendamento — PIXICO',common_payload);
      end loop;
    end if;
  end if;

  -- If an already-confirmed appointment changes time without a status change,
  -- notify the client once again.
  if tg_op = 'UPDATE'
     and new.status in ('confirmado','remarcado')
     and old.status = new.status
     and (
       new.data is distinct from old.data
       or new.faixa_inicio is distinct from old.faixa_inicio
       or new.faixa_fim is distinct from old.faixa_fim
     )
     and nullif(trim(client.email),'') is not null
  then
    insert into private.email_outbox(appointment_id,recipient_email,event_type,subject,payload)
    values(new.id,client.email,'client_rescheduled','Seu horário foi atualizado — PIXICO',common_payload);
  end if;

  -- Keep exactly one future 24h reminder for active confirmed appointments.
  if tg_op = 'UPDATE' then
    update private.email_outbox
       set status='cancelled', updated_at=now()
     where appointment_id=new.id
       and event_type='client_reminder_24h'
       and status='pending';
  end if;

  if new.status in ('confirmado','remarcado')
     and appointment_start > now() + interval '24 hours'
     and nullif(trim(client.email),'') is not null
  then
    insert into private.email_outbox(
      appointment_id, recipient_email, event_type, subject, payload, available_at
    )
    values(
      new.id,
      client.email,
      'client_reminder_24h',
      'Lembrete: seu horário é amanhã — PIXICO',
      common_payload,
      appointment_start - interval '24 hours'
    )
    on conflict do nothing;
  end if;

  return new;
end
$function$;

drop trigger if exists appointment_email_queue on public.appointments;
create trigger appointment_email_queue
after insert or update of status, data, faixa_inicio, faixa_fim, sugestao_data, sugestao_inicio, sugestao_fim
on public.appointments
for each row execute function private.queue_appointment_emails();

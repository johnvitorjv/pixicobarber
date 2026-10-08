
-- PIXICO: extra reminder points for confirmed appointments.
create unique index if not exists email_outbox_extra_live_reminder
  on private.email_outbox(appointment_id,event_type)
  where event_type in ('client_reminder_12h','client_reminder_1h')
    and status in ('pending','sending','failed');

create or replace function private.queue_extra_reminders()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  client_address text;
  meeting_time timestamptz;
  event_row record;
  msg jsonb;
  is_enabled boolean;
begin
  select enabled into is_enabled from private.email_settings where id=true;
  if not coalesce(is_enabled,false) then return new; end if;

  if tg_op='UPDATE' then
    update private.email_outbox
       set status='cancelled',updated_at=now()
     where appointment_id=new.id
       and event_type in ('client_reminder_12h','client_reminder_1h')
       and status in ('pending','failed');
  end if;

  if new.status not in ('confirmado','remarcado') then return new; end if;

  select email into client_address from public.profiles
    where id=new.cliente_id;
  if nullif(trim(client_address),'') is null then return new; end if;

  meeting_time := (new.data+new.faixa_inicio) at time zone 'America/Bahia';
  msg := jsonb_build_object(
    'appointmentId',new.id,
    'clientName',(select trim(concat_ws(' ',nome,sobrenome)) from public.profiles where id=new.cliente_id),
    'service',new.servico_nome_reservado,
    'date',new.data,'start',new.faixa_inicio,'end',new.faixa_fim,
    'clientUrl','https://pixicobarber.pages.dev/painel#meus-agendamentos'
  );

  for event_row in
    select * from (values
      ('client_reminder_12h', interval '12 hours', 'Seu horário está chegando: faltam 12 horas — PIXICO'),
      ('client_reminder_1h', interval '1 hour', 'Seu corte é daqui a 1 hora — PIXICO')
    ) as e(kind, before_start, subject)
  loop
    if meeting_time - event_row.before_start > now() then
      insert into private.email_outbox(
        appointment_id,recipient_email,event_type,subject,payload,available_at
      ) values(
        new.id,client_address,event_row.kind,event_row.subject,
        msg,meeting_time - event_row.before_start
      )
      on conflict do nothing;
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists extra_email_reminders on public.appointments;
create trigger extra_email_reminders
after insert or update of status,data,faixa_inicio,faixa_fim
on public.appointments
for each row execute function private.queue_extra_reminders();

revoke all on function private.queue_extra_reminders() from public,anon,authenticated;

-- PIXICO: premium horizon for admin-starred favorites. All changes are additive.
-- Profiles preserve their existing RLS. New authorization column is SELECT-only for customers.
grant select(favorito) on table public.profiles to authenticated;

-- Booking horizon is derived from the AUTHENTICATED user's trusted profile, never from client input.
-- Admins retain their existing special flow. Developers keep their unlimited window.
create or replace function private.booking_window_days()
returns integer language sql stable security definer set search_path=''
as $$
  select case when exists (
    select 1 from public.profiles where id=auth.uid() and favorito and not is_developer
  ) then 14 else 7 end;
$$;
revoke all on function private.booking_window_days() from public, anon, authenticated;

create or replace function private.guard_public_booking_window()
returns trigger language plpgsql security definer set search_path=''
as $$
declare local_today date := (now() at time zone 'America/Bahia')::date;
begin
  if tg_op='INSERT' and auth.uid() is not null
    and not private.is_admin() and not private.is_developer() then
    if new.data < local_today or new.data > local_today + private.booking_window_days() then
      raise exception 'O agendamento está disponível somente até % dias à frente.', private.booking_window_days()
      using errcode='P0001';
    end if;
  end if;
  return new;
end $$;

create or replace function public.client_change_appointment(
  p_appointment uuid,
  p_service uuid,
  p_date date,
  p_start time without time zone
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  current_booking public.appointments%rowtype;
  requested_service public.services%rowtype;
  local_today date := (now() at time zone 'America/Bahia')::date;
  booking_end time;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Faça login para alterar o agendamento.' using errcode='42501';
  end if;

  select * into current_booking from public.appointments
   where id=p_appointment for update;

  if not found or current_booking.cliente_id<>auth.uid() then
    raise exception 'Agendamento não encontrado.' using errcode='42501';
  end if;
  if current_booking.status not in ('pendente','confirmado','remarcado') then
    raise exception 'Este agendamento não pode ser alterado. Converse com a barbearia.'
    using errcode='P0001';
  end if;
  if current_booking.data<=local_today then
    raise exception 'Alterações são permitidas somente até o dia anterior ao atendimento.'
    using errcode='P0001';
  end if;
  if p_date<=local_today then
    raise exception 'Selecione um horário a partir de amanhã.'
    using errcode='P0001';
  end if;
  if not private.is_developer() and p_date>local_today + private.booking_window_days() then
    raise exception 'O novo agendamento precisa estar dentro de % dias.', private.booking_window_days()
    using errcode='P0001';
  end if;

  select * into requested_service from public.services
    where id=p_service and status='ativo' and visivel_agendamento=true;
  if not found then
    raise exception 'Serviço indisponível.' using errcode='P0001';
  end if;
  if requested_service.confirmacao_manual then
    raise exception 'Serviços de duração variável precisam de um novo pedido.'
    using errcode='P0001';
  end if;
  if not extract(dow from p_date)::integer=any(requested_service.dias_permitidos) then
    raise exception 'Serviço indisponível no dia escolhido.' using errcode='P0001';
  end if;
  if extract(minute from p_start)::integer %15<>0 or
     extract(second from p_start)::integer<>0 then
    raise exception 'Escolha um início na grade de 15 minutos.' using errcode='P0001';
  end if;
  -- Compare timestamps so crossing midnight cannot wrap the time to 00:xx.
  if p_date + p_start + make_interval(mins=>requested_service.duracao)
      >= p_date + interval '1 day' then
    raise exception 'Horário fora do expediente.' using errcode='P0001';
  end if;
  booking_end := (p_start+make_interval(mins=>requested_service.duracao))::time;
  if not private.slot_allowed(p_date,p_start,booking_end,current_booking.id) then
    raise exception 'Esse horário não está mais disponível.' using errcode='23P01';
  end if;

  -- Atomic operation: cancellation and replacement both rollback on any error.
  -- A replacement requires new explicit approval from the barber.
  update public.appointments
     set status='cancelado_cliente'
   where id=current_booking.id;

  insert into public.appointments(
    cliente_id,servico_id,data,faixa_inicio,faixa_fim,status,notas_cliente
  ) values (
    auth.uid(),p_service,p_date,p_start,booking_end,'pendente',
    current_booking.notas_cliente
  )
  returning id into new_id;

  return new_id;
end $$;

create or replace function public.get_edit_slots(
  p_appointment uuid,
  p_date date,
  p_service uuid
) returns table(id text,inicio text,fim text,disponivel boolean)
language plpgsql stable security definer set search_path=''
as $$
declare
  booking public.appointments%rowtype;
  s public.services%rowtype;
  local_today date := (now() at time zone 'America/Bahia')::date;
  t timestamp;
begin
  if auth.uid() is null then
    raise exception 'Faça login para consultar os horários.' using errcode='42501';
  end if;
  select * into booking from public.appointments
    where public.appointments.id=p_appointment
      and cliente_id=auth.uid();
  if not found or booking.status not in ('pendente','confirmado','remarcado')
     or booking.data<=local_today then return; end if;

  if p_date<=local_today or
     (p_date>local_today + private.booking_window_days() and not private.is_developer()) then return; end if;

  select * into s from public.services
    where public.services.id=p_service and status='ativo'
      and visivel_agendamento=true and confirmacao_manual=false;
  if not found or not extract(dow from p_date)::integer=any(s.dias_permitidos) then return; end if;

  t:=p_date::timestamp;
  while t+make_interval(mins=>s.duracao)<p_date+interval '1 day' loop
    if private.schedule_allows(p_date,t::time,(t+make_interval(mins=>s.duracao))::time) then
      id:=to_char(t,'HH24:MI');
      inicio:=id;
      fim:=to_char(t+make_interval(mins=>s.duracao),'HH24:MI');
      disponivel:=private.slot_allowed(p_date,t::time,(t+make_interval(mins=>s.duracao))::time,booking.id);
      return next;
    end if;
    t:=t+interval '15 minutes';
  end loop;
end $$;

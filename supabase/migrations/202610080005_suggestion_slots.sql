
create or replace function public.get_suggestion_slots(
  p_appointment uuid,
  p_date date
) returns table(id text,inicio text,fim text,disponivel boolean)
language plpgsql stable security definer set search_path=''
as $$
declare
  booking public.appointments%rowtype;
  s public.services%rowtype;
  t timestamp;
  duration integer;
begin
  if not private.is_admin() then
    raise exception 'Acesso administrativo necessário' using errcode='42501';
  end if;
  select * into booking from public.appointments where public.appointments.id=p_appointment;
  if not found then return; end if;

  select * into s from public.services where public.services.id=booking.servico_id;
  if not found or s.confirmacao_manual=true
    or not extract(dow from p_date)::integer=any(s.dias_permitidos)
    or p_date < (now() at time zone 'America/Bahia')::date then return;
  end if;

  duration := coalesce(
    (extract(epoch from (booking.faixa_fim-booking.faixa_inicio))/60)::integer,
    s.duracao
  );
  if duration < 15 or duration>480 then return; end if;

  t:=p_date::timestamp;
  while t+make_interval(mins=>duration)<p_date+interval '1 day' loop
    if private.schedule_allows(p_date,t::time,(t+make_interval(mins=>duration))::time) then
      id:=to_char(t,'HH24:MI');
      inicio:=id;
      fim:=to_char(t+make_interval(mins=>duration),'HH24:MI');
      disponivel:=private.slot_allowed(p_date,t::time,(t+make_interval(mins=>duration))::time,booking.id);
      return next;
    end if;
    t:=t+interval '15 minutes';
  end loop;
end $$;
revoke all on function public.get_suggestion_slots(uuid,date) from public,anon;
grant execute on function public.get_suggestion_slots(uuid,date) to authenticated;

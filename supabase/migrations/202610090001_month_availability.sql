-- Calendar availability for all flows comes from the exact same server-side
-- slot checks used when committing appointments. Authentication is mandatory.
create or replace function public.get_month_availability(
    p_month date,
    p_mode text,
    p_service uuid default null,
    p_appointment uuid default null
) returns table(day date, available boolean)
language plpgsql stable security invoker set search_path = ''
as $$
declare
    local_today date := (now() at time zone 'America/Bahia')::date;
    cursor_day date;
    first_day date;
    last_day date;
begin
    if auth.uid() is null then
        raise exception 'Faça login para consultar a agenda.' using errcode = '42501';
    end if;
    if p_month is null or p_mode not in ('booking','edit','suggestion') then
        raise exception 'Calendário inválido.' using errcode = '22023';
    end if;
    if p_mode = 'booking' and p_service is null
       or p_mode = 'edit' and (p_appointment is null or p_service is null)
       or p_mode = 'suggestion' and p_appointment is null then
        raise exception 'Serviço ou agendamento não informado.' using errcode = '22023';
    end if;
    first_day := date_trunc('month', p_month)::date;
    last_day := (first_day + interval '1 month - 1 day')::date;
    if first_day > local_today + 59 or last_day < local_today then return; end if;
    cursor_day := greatest(first_day, local_today);
    while cursor_day <= least(last_day, local_today + 59) loop
        day := cursor_day;
        if p_mode = 'booking' then
            select exists (
                select 1 from public.get_available_slots(cursor_day, p_service) s
                 where s.disponivel
            ) into available;
        elsif p_mode = 'edit' then
            select exists (
                select 1 from public.get_edit_slots(p_appointment, cursor_day, p_service) s
                 where s.disponivel
            ) into available;
        else
            select exists (
                select 1 from public.get_suggestion_slots(p_appointment, cursor_day) s
                 where s.disponivel
            ) into available;
        end if;
        return next;
        cursor_day := cursor_day + 1;
    end loop;
end $$;
revoke all on function public.get_month_availability(date,text,uuid,uuid) from public, anon;
grant execute on function public.get_month_availability(date,text,uuid,uuid) to authenticated;

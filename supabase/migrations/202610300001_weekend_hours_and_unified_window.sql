-- PIXICO 2026-10-30: recurring 21:00 closing on Friday/Saturday; all customers 14 days.
-- Preserves existing date overrides, reservations, roles, grants and special developer access.
create or replace function private.booking_window_days()
returns integer language sql stable security definer set search_path=''
as $$ select 14; $$;

create or replace function private.schedule_allows(p_date date,p_start time,p_end time)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare c jsonb; o jsonb; day_end time;
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
  day_end := coalesce(c->'horarioFimPorDia' ->> (extract(dow from p_date)::integer)::text, c->>'horarioFim')::time;
  return c is not null and c->'diasFuncionamento' @> to_jsonb(array[extract(dow from p_date)::int])
    and not exists(select 1 from jsonb_array_elements(c->'ferias') f where p_date between (f->>'inicio')::date and (f->>'fim')::date)
    and not exists(select 1 from jsonb_array_elements(c->'bloqueiosEspeciais') f where p_date=(f->>'data')::date)
    and p_start >= (c->>'horarioInicio')::time and p_end <= day_end
    and not (p_start < (c->'intervaloAlmoco'->>'fim')::time and p_end > (c->'intervaloAlmoco'->>'inicio')::time);
end $$;

-- Extra validation for optional weekday settings. Existing schedule validation still applies.
create or replace function private.validate_weekday_closing() returns trigger
language plpgsql set search_path = '' as $$
declare c jsonb := new.data; weekday text; closing jsonb; close_text text;
begin
  if c ? 'horarioFimPorDia' then
    if jsonb_typeof(c->'horarioFimPorDia') is distinct from 'object' then
      raise exception 'Horários de fechamento por dia inválidos';
    end if;
    for weekday,closing in select key,value from jsonb_each(c->'horarioFimPorDia') loop
      if weekday !~ '^[0-6]$' or jsonb_typeof(closing) is distinct from 'string' then
        raise exception 'Dia ou horário de fechamento inválido';
      end if;
      close_text := closing #>> '{}';
      if close_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
        raise exception 'Horário de fechamento inválido';
      end if;
      if close_text::time <= (c->>'horarioInicio')::time
        or close_text::time < (c->'intervaloAlmoco'->>'fim')::time then
        raise exception 'Fechamento por dia deve respeitar abertura e pausa';
      end if;
    end loop;
  end if;
  return new;
end $$;
revoke all on function private.validate_weekday_closing() from public,anon,authenticated;
drop trigger if exists validate_weekday_closing on public.schedule_config;
create trigger validate_weekday_closing before insert or update on public.schedule_config
for each row execute function private.validate_weekday_closing();

-- Add the new weekly hours without overwriting the other saved schedule settings.
update public.schedule_config
set data = jsonb_set(data, '{horarioFimPorDia}', '{"5":"21:00","6":"21:00"}'::jsonb, true)
where id = true;

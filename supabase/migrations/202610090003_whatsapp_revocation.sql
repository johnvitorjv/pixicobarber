-- PIXICO WhatsApp: enforce revocations before message delivery.
-- Safe to run while whatsapp_settings.enabled = false.
create or replace function private.cancel_withdrawn_whatsapp()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if (old.whatsapp_opt_in and not new.whatsapp_opt_in)
    or old.whatsapp is distinct from new.whatsapp
    or (not old.blacklist and new.blacklist) then
    update private.whatsapp_outbox o
       set status='cancelled', lease_token=null, lease_until=null
      from public.appointments a
     where a.id=o.appointment_id and a.cliente_id=new.id
       and o.recipient_kind='client'
       and o.status in ('pending','failed','sending');
  end if;
  return new;
end $$;
revoke all on function private.cancel_withdrawn_whatsapp() from public,anon,authenticated;
drop trigger if exists profile_whatsapp_optout on public.profiles;
create trigger profile_whatsapp_optout
after update of whatsapp_opt_in,whatsapp,blacklist on public.profiles
for each row execute function private.cancel_withdrawn_whatsapp();

-- Whitelist only currently consenting recipients when leasing.
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
     and (
       (o.recipient_kind='admin' and cfg.admin_opt_in
         and o.recipient_phone=cfg.admin_whatsapp)
       or
       (o.recipient_kind='client' and exists (
          select 1 from public.appointments a
          join public.profiles c on c.id=a.cliente_id
          where a.id=o.appointment_id
            and c.whatsapp_opt_in
            and not c.blacklist
            and o.recipient_phone=c.whatsapp
       ))
     )
   order by o.available_at,o.created_at
   for update of o skip locked
   limit greatest(1,least(coalesce(p_limit,3),5))
 )
 update private.whatsapp_outbox o
    set status='sending', attempts=o.attempts+1,
        lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds'
 from selected s where o.id=s.id
 returning o.id,o.recipient_phone,o.body,o.lease_token;
end $$;

-- Final consent check immediately before outbound WhatsApp traffic.
create or replace function public.whatsapp_worker_validate(
 p_token text,p_id uuid,p_lease uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare cfg private.whatsapp_settings%rowtype;
begin
 select * into cfg from private.whatsapp_settings s where s.id=true;
 if not found or not cfg.enabled or cfg.secret_hash is null or length(p_token)<32
    or cfg.secret_hash <> encode(sha256(convert_to(p_token,'UTF8')),'hex') then
    raise exception 'Worker não autorizado' using errcode='42501';
 end if;
 return exists (
   select 1 from private.whatsapp_outbox o
   where o.id=p_id and o.lease_token=p_lease and o.status='sending'
     and o.lease_until>now()
     and (
       (o.recipient_kind='admin' and cfg.admin_opt_in
         and o.recipient_phone=cfg.admin_whatsapp)
       or
       (o.recipient_kind='client' and exists (
         select 1 from public.appointments a
         join public.profiles c on c.id=a.cliente_id
         where a.id=o.appointment_id
           and c.whatsapp_opt_in and not c.blacklist
           and c.whatsapp=o.recipient_phone
       ))
     )
 );
end $$;
revoke all on function public.whatsapp_worker_validate(text,uuid,uuid)
from public,anon,authenticated;
grant execute on function public.whatsapp_worker_validate(text,uuid,uuid)
to service_role;

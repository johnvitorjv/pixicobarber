-- PIXICO: lightweight query optimization for the free-tier PostgreSQL instance.
-- No grants, roles, or data are changed. Policies retain the same decisions.
create index if not exists appointments_service_idx on public.appointments(servico_id);

alter policy appointments_read on public.appointments
  using (cliente_id = (select auth.uid()) or (select private.is_admin()));

alter policy appointments_insert on public.appointments
  with check (((cliente_id = (select auth.uid())) and status = any(array['pendente'::text,'solicitado'::text])) or (select private.is_admin()));

alter policy appointments_update on public.appointments
  using (cliente_id = (select auth.uid()) or (select private.is_admin()))
  with check (cliente_id = (select auth.uid()) or (select private.is_admin()));

alter policy profiles_read on public.profiles
  using (id = (select auth.uid()) or (select private.is_admin()));

alter policy profiles_update on public.profiles
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

alter policy notifications_read on public.notifications
  using (destinatario = (select auth.uid()) or (para_admin and (select private.is_admin())));

alter policy notifications_update on public.notifications
  using (destinatario = (select auth.uid()) or (para_admin and (select private.is_admin())))
  with check (destinatario = (select auth.uid()) or (para_admin and (select private.is_admin())));

alter policy notifications_delete on public.notifications
  using (destinatario = (select auth.uid()) or (para_admin and (select private.is_admin())));

alter policy events_read on public.appointment_events
  using ((select private.is_admin()) or exists (
    select 1 from public.appointments a
    where a.id = appointment_events.appointment_id
      and a.cliente_id = (select auth.uid())
  ));

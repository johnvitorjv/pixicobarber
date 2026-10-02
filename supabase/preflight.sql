-- READ ONLY. Prepare results for review; do not print keys, passwords or auth metadata.
begin transaction read only;
select table_name,column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and table_name in ('profiles','services','appointments') order by table_name,ordinal_position;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname in ('public','storage') order by schemaname,tablename,policyname;
select conrelid::regclass as tabela,conname,pg_get_constraintdef(oid) as regra from pg_constraint
where conrelid in ('public.profiles'::regclass,'public.services'::regclass,'public.appointments'::regclass);
select count(*) as perfis, count(*) filter(where role='admin') as admins,
 count(*) filter(where role is null) as role_nulo from public.profiles;
-- Review each administrator using a trusted operator. Legacy metadata was user-editable.
select id,criado_em from public.profiles where role='admin';
select count(*) as agendamentos_invalidos from public.appointments
where cliente_id is null or servico_id is null or status is null or faixa_inicio >= faixa_fim
 or (recurso_id is not null and recurso_id <> 'pixico');
select a.id as primeiro,b.id as segundo,a.data from public.appointments a join public.appointments b
on a.id < b.id and a.data=b.data and a.faixa_inicio < b.faixa_fim and a.faixa_fim > b.faixa_inicio
where a.status in ('pendente','confirmado','aguardando_cliente','remarcado')
and b.status in ('pendente','confirmado','aguardando_cliente','remarcado');
select id from public.services where preco < 0 or preco_promocional < 0 or duracao not between 5 and 480;
select grantee,table_name,privilege_type from information_schema.role_table_grants
where table_schema='public' and grantee in ('PUBLIC','anon','authenticated') order by table_name,grantee;
select pubname,schemaname,tablename from pg_publication_tables where pubname='supabase_realtime';
select grantee,table_name,column_name,privilege_type from information_schema.column_privileges
where table_schema='public' and grantee in ('PUBLIC','anon','authenticated') order by table_name,column_name;
select n.nspname,p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private');
rollback;

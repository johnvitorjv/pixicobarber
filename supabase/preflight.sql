-- READ ONLY. Prepare results for review; do not print keys, passwords or auth metadata.
-- Compatible with the legacy baseline and the final schema. No application RPC is called.
-- A missing core table/column aborts the read: review drift, never create it here.
begin transaction read only;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
select current_setting('server_version') as postgres_version,
 current_setting('transaction_read_only') as leitura_somente;
select nome,to_regclass('public.' || nome) as objeto_existente
from unnest(array['profiles','services','appointments','business_settings','schedule_config',
 'day_overrides','expenses','notifications','appointment_events']) as nome;
select table_name,column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and table_name in ('profiles','services','appointments','business_settings',
 'schedule_config','day_overrides','expenses','notifications','appointment_events') order by table_name,ordinal_position;
select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','storage') and c.relkind in ('r','p') order by n.nspname,c.relname;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname in ('public','storage') order by schemaname,tablename,policyname;
select conrelid::regclass as tabela,conname,pg_get_constraintdef(oid) as regra from pg_constraint
where conrelid in ('public.profiles'::regclass,'public.services'::regclass,'public.appointments'::regclass);
select count(*) as perfis, count(*) filter(where role='admin') as admins,
 count(*) filter(where role is null) as role_nulo from public.profiles;
-- Review each administrator using a trusted operator. Legacy metadata was user-editable.
select id,criado_em from public.profiles where role='admin';
select count(*) as agendamentos_invalidos from public.appointments
where cliente_id is null or servico_id is null or data is null or faixa_inicio is null
 or status is null or status not in ('solicitado','pendente','confirmado','concluido','cancelado_cliente',
 'cancelado_admin','ausente','rejeitado','aguardando_cliente','remarcado')
 or (status='solicitado' and (faixa_fim is not null or coalesce(to_jsonb(appointments)->>'confirmacao_manual','false') <> 'true'))
 or (status <> 'solicitado' and faixa_fim is null and not
   (status in ('rejeitado','cancelado_cliente','cancelado_admin') and coalesce(to_jsonb(appointments)->>'confirmacao_manual','false')='true'))
 or faixa_inicio >= faixa_fim
 or (recurso_id is not null and recurso_id <> 'pixico');
select a.id as primeiro,b.id as segundo,a.data from public.appointments a join public.appointments b
on a.id < b.id and a.data=b.data and a.faixa_inicio < b.faixa_fim and a.faixa_fim > b.faixa_inicio
where a.status in ('pendente','confirmado','aguardando_cliente','remarcado')
and b.status in ('pendente','confirmado','aguardando_cliente','remarcado');
select id as servico_invalido from public.services
where preco is null or preco < 0 or preco_promocional < 0 or duracao not between 5 and 480
 or (duracao is null and coalesce(to_jsonb(services)->>'confirmacao_manual','false') <> 'true')
 or (coalesce(to_jsonb(services)->>'confirmacao_manual','false')='true' and
   (duracao is not null or coalesce(to_jsonb(services)->>'aplicacao_minutos','') <> '15'));
-- Public catalog only: enough to review aliases/unknown services without customer data.
select id,nome,preco,preco_promocional,duracao,
 to_jsonb(services)->'dias_permitidos' as dias_permitidos,
 to_jsonb(services)->'confirmacao_manual' as confirmacao_manual,
 to_jsonb(services)->'aplicacao_minutos' as aplicacao_minutos from public.services order by nome,id;
with normalized as (
 select id,nome,regexp_replace(translate(lower(trim(nome)),
 'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[^a-z0-9]','','g') as chave
 from public.services
), aliases as (
 select id,nome,case
  when chave in ('pezinhoacabamento','pezinho','acabamento') then 'pezinhoacabamento'
  when chave in ('tesouraemaquina','tesouramaquina') then 'tesouraemaquina'
  when chave in ('cortecrianca','corteinfantil') then 'cortecrianca'
  when chave in ('cabelobarba','cortebarba') then 'cabelobarba'
  else chave end as chave from normalized
)
select chave as catalogo_ambiguo,array_agg(id order by id) as ids,array_agg(nome order by id) as nomes
from aliases group by chave having count(*) > 1;
-- Future chemical occupancy requires review before this foundation can be applied.
select a.id as quimico_ativo_revisar,a.data,a.faixa_inicio,a.faixa_fim,s.nome
from public.appointments a join public.services s on s.id=a.servico_id
where a.status in ('pendente','confirmado','aguardando_cliente','remarcado')
 and a.data+a.faixa_fim > timezone('America/Bahia',now())
 and (coalesce(to_jsonb(s)->>'confirmacao_manual','false')='true' or
 regexp_replace(translate(lower(trim(s.nome)),
 'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[^a-z0-9]','','g') in ('platinado','luzes'));
-- Review departures from the new defaults; explicit date overrides may justify them.
select a.id as reserva_revisar_padrao,a.data,a.faixa_inicio,a.faixa_fim,s.nome
from public.appointments a join public.services s on s.id=a.servico_id
where a.status in ('pendente','confirmado','aguardando_cliente','remarcado')
 and a.data+a.faixa_fim > timezone('America/Bahia',now())
 and (extract(dow from a.data) not in (2,3,4,5,6) or a.faixa_inicio < time '09:00'
  or a.faixa_fim > time '20:00' or (a.faixa_inicio < time '15:30' and a.faixa_fim > time '13:00')
  or mod(extract(epoch from a.faixa_inicio)::numeric,900) <> 0
  or (regexp_replace(translate(lower(trim(s.nome)),
   'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[^a-z0-9]','','g') in ('cortecrianca','corteinfantil')
   and extract(dow from a.data) not in (2,3,4)));
select grantee,table_name,privilege_type from information_schema.role_table_grants
where table_schema='public' and grantee in ('PUBLIC','anon','authenticated') order by table_name,grantee;
select pubname,schemaname,tablename from pg_publication_tables where pubname='supabase_realtime';
select grantee,table_name,column_name,privilege_type from information_schema.column_privileges
where table_schema='public' and grantee in ('PUBLIC','anon','authenticated') order by table_name,column_name;
select n.nspname,p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private');
select n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) as definicao
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and (n.nspname='public' or (n.nspname='auth' and c.relname='users'))
order by n.nspname,c.relname,t.tgname;
select extname,extversion from pg_extension order by extname;
rollback;

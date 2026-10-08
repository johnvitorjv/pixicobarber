import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const service = '44444444-4444-4444-8444-444444444444';
const bootstrap = `
create role anon; create role authenticated;
create schema auth; create schema storage;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
create publication supabase_realtime;
`;

async function asUser(db, id, fn) {
  await db.query('select set_config($1,$2,false)', ['test.uid', id]);
  await db.exec('set role authenticated');
  try { return await fn(); } finally {
    await db.exec('reset role');
    await db.query('select set_config($1,$2,false)', ['test.uid', '']);
  }
}

test('new booking-window and suggestion migrations install, enforce horizon, and allow atomic self-service change', async () => {
  const db = new PGlite({ extensions: { btree_gist } });
  try {
    await db.exec(bootstrap);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    for (const file of [
      '202610010001_production_foundation.sql',
      '202610080004_booking_window_client_changes.sql',
      '202610080005_suggestion_slots.sql',
    ]) await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'alice@example.invalid','{}'),($2,'bob@example.invalid','{}')", [user,other]);
    await db.query("insert into public.services(id,nome,preco,duracao,categoria,dias_permitidos) values($1,'Teste 45m',60,45,'corte',array[0,1,2,3,4,5,6])", [service]);
    await db.exec("update public.schedule_config set data=jsonb_set(data,'{diasFuncionamento}','[0,1,2,3,4,5,6]')");
    const { rows } = await db.query("select (timezone('America/Bahia',now())::date + 3)::text as day3, (timezone('America/Bahia',now())::date + 5)::text as day5, (timezone('America/Bahia',now())::date + 8)::text as day8");
    const { day3, day5, day8 } = rows[0];
    const insert = (day) => asUser(db,user,()=>db.query("insert into public.appointments(cliente_id,servico_id,data,faixa_inicio,faixa_fim,status) values($1,$2,$3,'09:00','09:45','pendente') returning id",[user,service,day]));
    await assert.rejects(insert(day8), /7 dias/);
    const original = (await insert(day5)).rows[0].id;
    await assert.rejects(asUser(db,other,()=>db.query("select public.client_change_appointment($1,$2,$3,'10:00')",[original,service,day3])),/não encontrado/);
    const available = await asUser(db,user,()=>db.query("select * from public.get_edit_slots($1,$2,$3)",[original,day3,service]));
    assert.ok(available.rows.some(r=>r.inicio==='10:00'&&r.disponivel===true));
    const changed = await asUser(db,user,()=>db.query("select public.client_change_appointment($1,$2,$3,'10:00') as id",[original,service,day3]));
    assert.ok(changed.rows[0].id);
    assert.equal((await db.query('select status from public.appointments where id=$1',[original])).rows[0].status,'cancelado_cliente');
    assert.equal((await db.query('select status from public.appointments where id=$1',[changed.rows[0].id])).rows[0].status,'pendente');
  } finally { await db.close(); }
});

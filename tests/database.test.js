import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

let db;
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const admin = '33333333-3333-4333-8333-333333333333';
const service = '44444444-4444-4444-8444-444444444444';
const bootstrapSQL = `
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
let day;
before(async () => {
    db = new PGlite({ extensions: { btree_gist } });
    await db.exec(bootstrapSQL);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610010001_production_foundation.sql', import.meta.url), 'utf8'));
    await db.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,'alice@example.invalid','{"nome":"Alice","sobrenome":"Teste","role":"admin"}'),($2,'bob@example.invalid','{"nome":"Bob","sobrenome":"Teste"}'),($3,'admin@example.invalid','{"nome":"Admin","sobrenome":"Teste"}')`, [alice,bob,admin]);
    await db.query(`update public.profiles set role = 'admin' where id = $1`,[admin]);
    await db.query(`insert into public.services(id,nome,preco,duracao,categoria) values($1,'Corte',60,45,'corte')`,[service]);
    day = (await db.query(`select (timezone('America/Bahia',now())::date + 7)::text as day`)).rows[0].day;
    // Deterministic test schedule independent of day of week.
    await db.exec(`update public.schedule_config set data = jsonb_set(data,'{diasFuncionamento}','[0,1,2,3,4,5,6]')`);
});
after(async () => { await db?.close(); });

async function asUser(id, fn) {
    await db.query(`select set_config('test.uid',$1,false)`,[id]);
    await db.exec('set role authenticated');
    try { return await fn(); }
    finally { await db.exec('reset role'); await db.exec(`select set_config('test.uid','',false)`); }
}
async function book(id, start, end, date = day, status = 'pendente') {
    return asUser(id, () => db.query(`insert into public.appointments(cliente_id,servico_id,data,faixa_inicio,faixa_fim,status) values($1,$2,$3,$4,$5,$6) returning id`,[id,service,date,start,end,status]));
}

test('signup metadata cannot grant administrator; profiles RLS does not recurse', async () => {
    const rows = await asUser(alice, () => db.query('select id,role from public.profiles'));
    assert.deepEqual(rows.rows, [{ id: alice, role: 'client' }]);
    const all = await asUser(admin, () => db.query('select id from public.profiles'));
    assert.equal(all.rows.length,3);
});
test('clients and admin UI cannot mutate authorization or admin-only profile fields',async () => {
    await assert.rejects(asUser(alice, () => db.query(`update public.profiles set role='admin' where id=$1`,[alice])), /autorização/);
    await assert.rejects(asUser(admin, () => db.query(`update public.profiles set role='admin' where id=$1`,[bob])), /autorização/);
    await assert.rejects(asUser(alice, () => db.query(`update public.profiles set blacklist=false,favorito=true where id=$1`,[alice])), /protegidos/);
});
test('client cannot insert confirmed appointments or wrong duration', async () => {
    await assert.rejects(book(alice,'09:00','09:45',day,'confirmado'),/Pedido inválido|row-level/);
    await assert.rejects(book(alice,'09:00','09:30'),/Duração inválida/);
});
test('server rejects lunch overlap, closure and past reservations',async () => {
    await assert.rejects(book(alice,'11:30','12:15'),/indisponível/);
    await assert.rejects(book(alice,'17:30','18:15'),/indisponível/);
    await assert.rejects(book(alice,'09:00','09:45','2020-01-01'),/indisponível/);
    await db.query(`insert into public.day_overrides(data,value) values($1,'{"disponivel":false,"faixas":[]}')`,[day]);
    await assert.rejects(book(alice,'09:00','09:45'),/indisponível/);
    await db.query('delete from public.day_overrides where data=$1',[day]);
});
test('first reservation wins; overlapping second reservation rejected; adjacent slots allowed',async () => {
    await book(alice,'09:00','09:45');
    await assert.rejects(book(bob,'09:00','09:45'),/indisponível/);
    await assert.rejects(book(bob,'09:30','10:15'),/indisponível/);
    await book(bob,'10:00','10:45');
    const slots = await asUser(bob, () => db.query('select * from public.get_available_slots($1,$2)',[day,service]));
    assert.equal(slots.rows.find(s => s.inicio === '09:30').disponivel,false);
    assert.equal(slots.rows.find(s => s.inicio === '11:00').disponivel,true);
    assert.deepEqual(Object.keys(slots.rows[0]).sort(), ['disponivel','fim','id','inicio']);
});
test('RLS hides another client appointments and blocks foreign updates',async () => {
    const visible = await asUser(alice, () => db.query('select cliente_id from public.appointments'));
    assert.ok(visible.rows.every(a => a.cliente_id === alice));
    const updates = await asUser(alice, () => db.query(`update public.appointments set status='cancelado_cliente' where cliente_id=$1 returning id`,[bob]));
    assert.equal(updates.rows.length,0);
});
test('cancel releases slot and ignores unauthorized time/price edits',async () => {
    await asUser(alice, () => db.query(`update public.appointments set status='cancelado_cliente',faixa_inicio='15:00',faixa_fim='15:45',valor_cobrado=1 where cliente_id=$1`,[alice]));
    const original = (await db.query('select faixa_inicio,valor_cobrado from public.appointments where cliente_id=$1',[alice])).rows[0];
    assert.equal(original.faixa_inicio,'09:00:00'); assert.equal(original.valor_cobrado,null);
    await book(bob,'09:00','09:45');
});
test('admin sees inactive services; client cannot change shared availability',async () => {
    await db.query(`update public.services set status='inativo' where id=$1`,[service]);
    assert.equal((await asUser(admin, () => db.query('select id from public.services'))).rows.length,1);
    assert.equal((await asUser(alice, () => db.query('select id from public.services'))).rows.length,0);
    const write = await asUser(alice, () => db.query(`update public.schedule_config set data=data returning id`));
    assert.equal(write.rows.length,0);
    await db.query(`update public.services set status='ativo' where id=$1`,[service]);
});
test('blacklist and daily capacity are enforced on server',async () => {
    await db.query(`update public.business_settings set data=jsonb_set(data,'{blacklistBehavior}','"block"')`);
    await db.query('update public.profiles set blacklist=true where id=$1',[alice]);
    await assert.rejects(book(alice,'11:00','11:45'),/contato/);
    await db.query('update public.profiles set blacklist=false where id=$1',[alice]);
    await db.exec(`update public.schedule_config set data=jsonb_set(data,'{limiteClientesDia}','2')`);
    await assert.rejects(book(alice,'11:00','11:45'),/indisponível/);
    await db.exec(`update public.schedule_config set data=jsonb_set(data,'{limiteClientesDia}','16')`);
});
test('notifications and audit trail generated atomically and read state alone is mutable',async () => {
    const rows = await asUser(alice, () => db.query('select * from public.notifications'));
    assert.ok(rows.rows.length >= 2);
    assert.ok(rows.rows.every(n => n.destinatario === alice && !n.para_admin));
    await assert.rejects(asUser(alice, () => db.exec(`update public.notifications set mensagem='fraude'`)), /permission denied/);
    const events = await asUser(alice, () => db.query('select * from public.appointment_events'));
    assert.ok(events.rows.length >= 2);
});
async function dateOffset(n) { return (await db.query('select ($1::date + $2::int)::text as d',[day,n])).rows[0].d; }
test('administrative notes cannot be read through crafted client queries or RPC',async () => {
    await assert.rejects(asUser(alice, () => db.query('select observacoes_admin from public.profiles')), /permission denied/);
    await assert.rejects(asUser(alice, () => db.query('select * from public.get_admin_clients()')), /Acesso negado/);
    assert.equal((await asUser(admin, () => db.query('select * from public.get_admin_clients()'))).rows.length,2);
});
test('reschedule proposal preserves original date; acceptance uses only server proposal',async () => {
    const date = await dateOffset(1), proposed = await dateOffset(2);
    const row = (await book(alice,'09:00','09:45',date)).rows[0];
    await asUser(admin, () => db.query(`update public.appointments set status='aguardando_cliente',sugestao_data=$1,sugestao_inicio='14:00',sugestao_fim='14:45' where id=$2`,[proposed,row.id]));
    assert.equal((await db.query('select data::text from public.appointments where id=$1',[row.id])).rows[0].data,date);
    await asUser(alice, () => db.query(`update public.appointments set status='confirmado',data='2099-01-01',faixa_inicio='16:00',faixa_fim='17:00' where id=$1`,[row.id]));
    const accepted = (await db.query('select data::text,faixa_inicio,status,sugestao_data from public.appointments where id=$1',[row.id])).rows[0];
    assert.equal(accepted.data,proposed); assert.equal(accepted.faixa_inicio,'14:00:00');
    assert.equal(accepted.status,'confirmado'); assert.equal(accepted.sugestao_data,null);
});
test('occupied proposal is rejected atomically on acceptance',async () => {
    const date = await dateOffset(3), proposed = await dateOffset(4);
    const row = (await book(alice,'09:00','09:45',date)).rows[0];
    await asUser(admin, () => db.query(`update public.appointments set status='aguardando_cliente',sugestao_data=$1,sugestao_inicio='09:00',sugestao_fim='09:45' where id=$2`,[proposed,row.id]));
    await book(bob,'09:00','09:45',proposed);
    await assert.rejects(asUser(alice, () => db.query(`update public.appointments set status='confirmado' where id=$1`,[row.id])), /indisponível/);
    assert.equal((await db.query('select status from public.appointments where id=$1',[row.id])).rows[0].status,'aguardando_cliente');
});
test('database constraint protects overlap even if validation trigger is bypassed by owner',async () => {
    const date = await dateOffset(5);
    await book(alice,'09:00','09:45',date);
    await db.exec('alter table public.appointments disable trigger validate_appointment');
    try {
        await assert.rejects(db.query(`insert into public.appointments(cliente_id,servico_id,data,faixa_inicio,faixa_fim,status) values($1,$2,$3,'09:30','10:15','pendente')`,[bob,service,date]), /exclusion constraint/);
    } finally { await db.exec('alter table public.appointments enable trigger validate_appointment'); }
});
test('inactive service, off-grid start and invalid JSON rules rejected',async () => {
    const date = await dateOffset(6);
    await assert.rejects(book(alice,'09:15','10:00',date), /indisponível/);
    await db.query(`update public.services set status='inativo' where id=$1`,[service]);
    await assert.rejects(book(alice,'09:00','09:45',date), /Serviço indisponível/);
    await db.query(`update public.services set status='ativo' where id=$1`,[service]);
    await assert.rejects(asUser(admin, () => db.exec(`update public.schedule_config set data=jsonb_set(data,'{duracaoSlot}','null')`)), /inválidas/);
    await assert.rejects(asUser(admin, () => db.exec(`update public.schedule_config set data=jsonb_set(data,'{duracaoSlot}','0')`)), /inválidas/);
});
test('future completion rejected; historical charge and price persist independently of catalog',async () => {
    const date = await dateOffset(7);
    const row = (await book(alice,'09:00','09:45',date)).rows[0];
    await asUser(admin, () => db.query(`update public.appointments set status='confirmado' where id=$1`,[row.id]));
    await assert.rejects(asUser(admin, () => db.query(`update public.appointments set status='concluido',valor_cobrado=55,forma_pagamento='pix' where id=$1`,[row.id])), /ainda não iniciado/);
    // Trusted, local-only fixture representing a past confirmed appointment.
    await db.exec('alter table public.appointments disable trigger validate_appointment');
    await db.query(`update public.appointments set data='2020-01-01' where id=$1`,[row.id]);
    await db.exec('alter table public.appointments enable trigger validate_appointment');
    await assert.rejects(asUser(admin, () => db.query(`update public.appointments set status='concluido' where id=$1`,[row.id])), /pagamento/);
    await asUser(admin, () => db.query(`update public.appointments set status='concluido',valor_cobrado=55,forma_pagamento='pix' where id=$1`,[row.id]));
    await db.query('update public.services set preco=99 where id=$1',[service]);
    const value = (await db.query('select preco_reservado::text,valor_cobrado::text,forma_pagamento from public.appointments where id=$1',[row.id])).rows[0];
    assert.deepEqual(value,{preco_reservado:'60.00',valor_cobrado:'55.00',forma_pagamento:'pix'});
    await assert.rejects(asUser(admin, () => db.query(`update public.appointments set status='confirmado' where id=$1`,[row.id])), /encerrado/);
});
test('clients cannot read expenses, delete appointments or forge notifications',async () => {
    assert.equal((await asUser(alice, () => db.query('select * from public.expenses'))).rows.length,0);
    await assert.rejects(asUser(alice, () => db.exec('delete from public.appointments')),/permission denied/);
    await assert.rejects(asUser(alice, () => db.exec(`insert into public.notifications(para_admin,tipo,titulo,mensagem) values(true,'fake','fake','fake')`)),/permission denied/);
});

test('appointment admin notes cannot be queried by clients or leaked via realtime',async () => {
    await assert.rejects(asUser(alice, () => db.exec('select notas_admin from public.appointments')),/permission denied/);
    await assert.rejects(asUser(alice, () => db.exec('select * from public.get_admin_appointments()')),/Acesso negado/);
    assert.ok((await asUser(admin, () => db.exec('select * from public.get_admin_appointments()'))).length);
    const published = (await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime'")).rows.map(r=>r.tablename);
    assert.ok(!published.includes('profiles') && !published.includes('appointments'));
});

test('malformed rules and settings fail before they can break availability',async () => {
    for (const json of ['{"disponivel":true,"faixas":null}','{"disponivel":true,"faixas":[{"inicio":"12:00","fim":"11:00","disponivel":false}]}']) {
        await assert.rejects(asUser(admin, () => db.query('insert into public.day_overrides(data,value) values($1,$2)',[day,json])),/inválida/);
    }
    await assert.rejects(asUser(admin, () => db.exec("update public.business_settings set data='{}'")),/inválidos/);
    await assert.rejects(asUser(admin, () => db.exec("update public.schedule_config set data=jsonb_set(data,'{ferias}','[{}]')")),/Férias inválidas/);
    await assert.rejects(asUser(admin, () => db.exec("update public.schedule_config set data=jsonb_set(data,'{duracaoSlot}','30.5')")),/inválidas/);
});

test('legacy overlap aborts migration without deleting reservations or retaining partial schema',async () => {
    const legacy = new PGlite({ extensions: { btree_gist } });
    try {
        await legacy.exec(bootstrapSQL);
        await legacy.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
        await legacy.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'legacy@example.invalid','{\"nome\":\"Legacy\",\"sobrenome\":\"Test\",\"role\":\"client\"}')",[alice]);
        await legacy.query("insert into public.services(id,nome,preco,duracao,categoria) values($1,'Corte',60,45,'corte')",[service]);
        await legacy.query("insert into public.appointments(cliente_id,servico_id,data,faixa_inicio,faixa_fim,status) values($1,$2,'2099-01-01','09:00','09:45','pendente'),($1,$2,'2099-01-01','09:30','10:15','pendente')",[alice,service]);
        await assert.rejects(legacy.exec(await readFile(new URL('../supabase/migrations/202610010001_production_foundation.sql',import.meta.url),'utf8')),/exclusion constraint/);
        await legacy.exec('rollback');
        assert.equal((await legacy.query('select count(*)::int as n from public.appointments')).rows[0].n,2);
        assert.equal((await legacy.query("select to_regclass('public.schedule_config') as table_name")).rows[0].table_name,null);
    } finally { await legacy.close(); }
});

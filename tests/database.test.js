import { test, before, beforeEach, after } from 'node:test';
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
let day, seededConfig, seededCatalog, seededBusiness, fixtureServices;
before(async () => {
    db = new PGlite({ extensions: { btree_gist } });
    await db.exec(bootstrapSQL);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610010001_production_foundation.sql', import.meta.url), 'utf8'));
    seededConfig = (await db.query('select data from public.schedule_config')).rows[0].data;
    seededBusiness = (await db.query('select data from public.business_settings')).rows[0].data;
    seededCatalog = (await db.query('select * from public.services')).rows;
    await db.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,'alice@example.invalid','{"nome":"Alice","sobrenome":"Teste","role":"admin"}'),($2,'bob@example.invalid','{"nome":"Bob","sobrenome":"Teste"}'),($3,'admin@example.invalid','{"nome":"Admin","sobrenome":"Teste"}')`, [alice,bob,admin]);
    await db.query(`update public.profiles set role = 'admin' where id = $1`,[admin]);
    await db.query(`insert into public.services(id,nome,preco,duracao,categoria) values($1,'Teste 45m',60,45,'corte')`,[service]);
    fixtureServices = (await db.query('select * from public.services')).rows;
    day = (await db.query(`select (timezone('America/Bahia',now())::date + 7)::text as day`)).rows[0].day;
    // Deterministic test schedule independent of day of week.
    await db.exec(`update public.schedule_config set data = jsonb_set(data,'{diasFuncionamento}','[0,1,2,3,4,5,6]')`);
});
// Each scenario owns its disposable fixtures, including when run in isolation.
beforeEach(async () => {
    await db.exec(`reset role; select set_config('test.uid','',false);
      delete from public.appointment_events; delete from public.notifications;
      delete from public.appointments; delete from public.day_overrides;
      delete from public.services;
      update public.profiles set blacklist=false,favorito=false;`);
    await db.query('insert into public.services select * from jsonb_populate_recordset(null::public.services,$1::jsonb)',[JSON.stringify(fixtureServices)]);
    await db.query('update public.schedule_config set data=$1',[JSON.stringify({...seededConfig,diasFuncionamento:[0,1,2,3,4,5,6]})]);
    await db.query('update public.business_settings set data=$1',[JSON.stringify(seededBusiness)]);
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
    await assert.rejects(book(alice,'12:30','13:15'),/indisponível/);
    await assert.rejects(book(alice,'19:30','20:15'),/indisponível/);
    await assert.rejects(book(alice,'09:00','09:45','2020-01-01'),/indisponível/);
    await db.query(`insert into public.day_overrides(data,value) values($1,'{"disponivel":false,"intervalos":[],"bloqueios":[]}')`,[day]);
    await assert.rejects(book(alice,'09:00','09:45'),/indisponível/);
    await db.query('delete from public.day_overrides where data=$1',[day]);
});
test('first reservation wins; overlapping second reservation rejected; adjacent slots allowed',async () => {
    await book(alice,'09:00','09:45');
    await assert.rejects(book(bob,'09:00','09:45'),/indisponível/);
    await assert.rejects(book(bob,'09:30','10:15'),/indisponível/);
    await book(bob,'09:45','10:30');
    const slots = await asUser(bob, () => db.query('select * from public.get_available_slots($1,$2)',[day,service]));
    assert.equal(slots.rows.find(s => s.inicio === '09:30').disponivel,false);
    assert.equal(slots.rows.find(s => s.inicio === '11:00').disponivel,true);
    assert.deepEqual(Object.keys(slots.rows[0]).sort(), ['disponivel','fim','id','inicio']);
});
test('RLS hides another client appointments and blocks foreign updates',async () => {
    await book(alice,'09:00','09:45');
    await book(bob,'10:00','10:45');
    const visible = await asUser(alice, () => db.query('select cliente_id from public.appointments'));
    assert.equal(visible.rows.length,1);
    assert.ok(visible.rows.every(a => a.cliente_id === alice));
    const updates = await asUser(alice, () => db.query(`update public.appointments set status='cancelado_cliente' where cliente_id=$1 returning id`,[bob]));
    assert.equal(updates.rows.length,0);
});
test('cancel releases slot and ignores unauthorized time/price edits',async () => {
    await book(alice,'09:00','09:45');
    await asUser(alice, () => db.query(`update public.appointments set status='cancelado_cliente',faixa_inicio='15:00',faixa_fim='15:45',valor_cobrado=1 where cliente_id=$1`,[alice]));
    const original = (await db.query('select faixa_inicio,valor_cobrado from public.appointments where cliente_id=$1',[alice])).rows[0];
    assert.equal(original.faixa_inicio,'09:00:00'); assert.equal(original.valor_cobrado,null);
    await book(bob,'09:00','09:45');
});
test('admin sees inactive services; client cannot change shared availability',async () => {
    await db.query(`update public.services set status='inativo' where id=$1`,[service]);
    assert.equal((await asUser(admin, () => db.query('select id from public.services'))).rows.length,19);
    assert.equal((await asUser(alice, () => db.query('select id from public.services'))).rows.length,18);
    const write = await asUser(alice, () => db.query(`update public.schedule_config set data=data returning id`));
    assert.equal(write.rows.length,0);
    await db.query(`update public.services set status='ativo' where id=$1`,[service]);
});
test('blacklist enforced; obsolete daily and shift caps ignored',async () => {
    await db.query(`update public.business_settings set data=jsonb_set(data,'{blacklistBehavior}','"block"')`);
    await db.query('update public.profiles set blacklist=true where id=$1',[alice]);
    await assert.rejects(book(alice,'11:00','11:45'),/contato/);
    await db.query('update public.profiles set blacklist=false where id=$1',[alice]);
    await db.exec(`update public.schedule_config set data=jsonb_set(data,'{limiteClientesDia}','2')`);
    await db.exec(`update public.schedule_config set data=jsonb_set(data,'{limiteClientesTurno}','1')`);
    await book(alice,'11:00','11:45');
    await db.exec(`update public.schedule_config set data=jsonb_set(data,'{limiteClientesDia}','16')`);
});
test('notifications and audit trail generated atomically and read state alone is mutable',async () => {
    const appointment = (await book(alice,'09:00','09:45')).rows[0];
    await asUser(admin, () => db.query("update public.appointments set status='confirmado' where id=$1",[appointment.id]));
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
    await asUser(admin, () => db.query(`update public.appointments set status='aguardando_cliente',sugestao_data=$1,sugestao_inicio='15:30',sugestao_fim='16:15' where id=$2`,[proposed,row.id]));
    assert.equal((await db.query('select data::text from public.appointments where id=$1',[row.id])).rows[0].data,date);
    await asUser(alice, () => db.query(`update public.appointments set status='confirmado',data='2099-01-01',faixa_inicio='16:00',faixa_fim='17:00' where id=$1`,[row.id]));
    const accepted = (await db.query('select data::text,faixa_inicio,status,sugestao_data from public.appointments where id=$1',[row.id])).rows[0];
    assert.equal(accepted.data,proposed); assert.equal(accepted.faixa_inicio,'15:30:00');
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
    await assert.rejects(book(alice,'09:10','09:55',date), /indisponível/);
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

test('confirmed business defaults and all 18 catalog prices/durations are seeded exactly', () => {
    assert.deepEqual(seededConfig,{diasFuncionamento:[2,3,4,5,6],horarioInicio:'09:00',horarioFim:'20:00',intervaloAlmoco:{inicio:'13:00',fim:'15:30'},duracaoSlot:15,bloqueiosEspeciais:[],ferias:[]});
    assert.equal(seededBusiness.nomeNegocio,'PIXICO Barber');
    assert.equal(seededBusiness.whatsappNumero,'5571994096863');
    assert.equal(seededBusiness.endereco,'R. da Palestina, 297c - Itacaranha, Salvador - BA, 40713-660');
    const expected = {'Corte':[30,30],'Barba':[20,15],'Pezinho / Acabamento':[15,15],'Navalhado':[32,30],'Pigmentação':[20,15],'Tesoura e máquina':[35,30],'Tesoura':[40,30],'Navalhado + tesoura':[35,30],'Freestyle':[5,30],'Bigodin':[5,5],'Platinado':[100,null],'Luzes':[80,null],'Corte criança':[50,45],'Corte + bigodin + sobrancelha':[35,30],'Corte + barba + sobrancelha':[50,30],'Cabelo + barba':[45,45],'Pé + barba + sobrancelha':[35,30],'Corte + barba + sobrancelha + pigmentação':[60,45]};
    assert.equal(seededCatalog.length,18);
    for (const s of seededCatalog) {
        assert.deepEqual([Number(s.preco),s.duracao],expected[s.nome]);
        assert.equal(s.preco_promocional,null);
        assert.equal(s.confirmacao_manual,['Platinado','Luzes'].includes(s.nome));
        assert.equal(s.aplicacao_minutos,s.confirmacao_manual?15:null);
    }
});
async function override(date,value) {
    return asUser(admin,()=>db.query('insert into public.day_overrides(data,value) values($1,$2) on conflict(data) do update set value=excluded.value',[date,JSON.stringify(value)]));
}
async function bookService(s,date,start,end,status='pendente',user=alice) {
    return asUser(user,()=>db.query('insert into public.appointments(cliente_id,servico_id,data,faixa_inicio,faixa_fim,status) values($1,$2,$3,$4,$5,$6) returning id',[user,s,date,start,end,status]));
}
const closedDay={disponivel:false,intervalos:[],bloqueios:[]};
test('date override replaces all defaults; multiple intervals and arbitrary blocked ranges enforced by RPC and insert',async () => {
    const date=await dateOffset(10);
    await override(date,{disponivel:true,intervalos:[{inicio:'07:10',fim:'12:00'},{inicio:'14:00',fim:'21:00'}],bloqueios:[{inicio:'08:07',fim:'08:22'},{inicio:'16:05',fim:'16:10'}]});
    await db.query(`update public.schedule_config set data=jsonb_set(data,'{ferias}',$1::jsonb)`,[JSON.stringify([{inicio:date,fim:date}])]);
    await book(alice,'07:15','08:00',date);
    await book(alice,'14:00','14:45',date); // override intentionally replaces default break
    await book(alice,'20:15','21:00',date);
    await assert.rejects(book(bob,'08:00','08:45',date),/indisponível/);
    await assert.rejects(book(bob,'11:45','12:30',date),/indisponível/);
    await assert.rejects(book(bob,'16:00','16:45',date),/indisponível/);
    const rows=(await asUser(alice,()=>db.query('select * from public.get_available_slots($1,$2)',[date,service]))).rows;
    assert.equal(rows[0].inicio,'07:15');
    assert.equal(rows.some(r=>r.inicio==='08:00'),false);
    assert.equal(rows.some(r=>r.inicio==='20:15'),true);
    await db.exec(`update public.schedule_config set data=jsonb_set(data,'{ferias}','[]')`);
});
test('Sunday and Monday are closed by default but can open with custom hours; closed date rejected',async () => {
    const date=(await db.query(`select d::date::text as d from generate_series($1::date+14,$1::date+20,'1 day') d where extract(dow from d)=0`,[day])).rows[0].d;
    // Prior fixtures use all weekdays, so protect them with explicit overrides before changing the defaults.
    const existing=(await db.query(`select distinct data::text as d from public.appointments where status in ('pendente','confirmado','aguardando_cliente','remarcado') and extract(dow from data) in (0,1)`)).rows;
    for(const {d} of existing) {
        if (!(await db.query('select 1 from public.day_overrides where data=$1',[d])).rows.length) await override(d,{disponivel:true,intervalos:[{inicio:'09:00',fim:'13:00'},{inicio:'15:30',fim:'20:00'}],bloqueios:[]});
    }
    await db.query('update public.schedule_config set data=$1',[JSON.stringify(seededConfig)]);
    await assert.rejects(book(alice,'09:00','09:45',date),/indisponível/);
    await override(date,{disponivel:true,intervalos:[{inicio:'10:00',fim:'12:00'}],bloqueios:[]});
    await book(alice,'10:15','11:00',date);
    const empty=await dateOffset(22);
    await override(empty,closedDay);
    await assert.rejects(book(alice,'09:00','09:45',empty),/indisponível/);
});
test('rule edits and override deletion reject conflicts atomically; unrelated edits succeed',async () => {
    const date=await dateOffset(10);
    await override(date,{disponivel:true,intervalos:[{inicio:'07:00',fim:'12:00'}],bloqueios:[]});
    await book(alice,'07:15','08:00',date);
    await book(bob,'09:00','09:45',await dateOffset(11));
    await assert.rejects(override(date,closedDay),/Regra invalida agendamento/);
    await assert.rejects(asUser(admin,()=>db.query('delete from public.day_overrides where data=$1',[date])),/Regra invalida agendamento/);
    assert.equal((await db.query('select value from public.day_overrides where data=$1',[date])).rows[0].value.disponivel,true);
    await assert.rejects(asUser(admin,()=>db.exec(`update public.schedule_config set data=jsonb_set(data,'{horarioInicio}','"10:00"')`)),/Regra invalida agendamento/);
    await assert.rejects(asUser(admin,()=>db.query('update public.services set dias_permitidos=$1 where id=$2',[[new Date(date+'T12:00:00').getDay()===0?1:0],service])),/Regra invalida agendamento/);
    await override(await dateOffset(23),closedDay);
});
test('child haircut weekdays enforced on insert, proposal and slot RPC even on an opened weekend',async () => {
    const child=seededCatalog.find(s=>s.nome==='Corte criança').id;
    for (let n=24;n<31;n++) {
        const date=await dateOffset(n), dow=new Date(date+'T12:00:00').getDay();
        await override(date,{disponivel:true,intervalos:[{inicio:'09:00',fim:'12:00'}],bloqueios:[]});
        const allowed=[2,3,4].includes(dow);
        const slots=await asUser(alice,()=>db.query('select * from public.get_available_slots($1,$2)',[date,child]));
        assert.equal(slots.rows.length>0,allowed);
        if (allowed) await bookService(child,date,'09:00','09:45');
        else await assert.rejects(bookService(child,date,'09:00','09:45'),/dia da semana/);
    }
    const childBooking=(await db.query('select id from public.appointments where servico_id=$1 limit 1',[child])).rows[0];
    const friday=(await db.query(`select d::date::text as d from generate_series($1::date+24,$1::date+30,'1 day') d where extract(dow from d)=5`,[day])).rows[0].d;
    await assert.rejects(asUser(admin,()=>db.query(`update public.appointments set status='aguardando_cliente',sugestao_data=$1,sugestao_inicio='10:00',sugestao_fim='10:45' where id=$2`,[friday,childBooking.id])),/dia da semana/);
});
for (const chemicalName of ['Platinado','Luzes']) test(`${chemicalName} has no end or occupancy until admin confirms the full interval`,async () => {
    const chemical=seededCatalog.find(s=>s.nome===chemicalName).id, date=await dateOffset(32);
    await override(date,{disponivel:true,intervalos:[{inicio:'09:00',fim:'13:00'},{inicio:'15:30',fim:'20:00'}],bloqueios:[]});
    const slots=(await asUser(alice,()=>db.query('select * from public.get_available_slots($1,$2)',[date,chemical]))).rows;
    assert.ok(slots.length>0&&slots.every(s=>s.fim===null));
    await assert.rejects(bookService(chemical,date,'09:00','09:15'),/Pedido inválido/);
    await assert.rejects(bookService(chemical,date,'09:00','09:15','solicitado'),/não possui término/);
    const row=(await bookService(chemical,date,'09:00',null,'solicitado')).rows[0];
    assert.equal((await db.query('select confirmacao_manual from public.appointments where id=$1',[row.id])).rows[0].confirmacao_manual,true);
    await assert.rejects(asUser(alice,()=>db.query(`update public.appointments set status='confirmado',faixa_fim='11:00' where id=$1`,[row.id])),/Transição não permitida/);
    await assert.rejects(asUser(admin,()=>db.query(`update public.appointments set status='confirmado',faixa_fim='09:15' where id=$1`,[row.id])),/ocupação química total/);
    await assert.rejects(asUser(admin,()=>db.query(`update public.appointments set status='confirmado',faixa_fim='15:45' where id=$1`,[row.id])),/indisponível/);
    // Ordinary reservation may take the requested time; request was explicitly not a reservation.
    await book(bob,'10:00','10:45',date);
    await assert.rejects(asUser(admin,()=>db.query(`update public.appointments set status='confirmado',faixa_fim='11:00' where id=$1`,[row.id])),/indisponível/);
    assert.equal((await db.query('select status from public.appointments where id=$1',[row.id])).rows[0].status,'solicitado');
    await asUser(admin,()=>db.query(`update public.appointments set status='confirmado',faixa_inicio='15:30',faixa_fim='18:00' where id=$1`,[row.id]));
    await assert.rejects(book(bob,'16:00','16:45',date),/indisponível/);
    await assert.rejects(asUser(admin,()=>db.query(`update public.appointments set status='solicitado',faixa_fim=null where id=$1`,[row.id])),/liberar ocupação/);
    await assert.rejects(override(date,closedDay),/Regra invalida/);
    const request=(await bookService(chemical,date,'11:00',null,'solicitado')).rows[0];
    await asUser(alice,()=>db.query(`update public.appointments set status='cancelado_cliente' where id=$1`,[request.id]));
});
test('expired chemical preference remains cancellable because it never occupied a slot',async () => {
    const chemical=seededCatalog.find(s=>s.nome==='Luzes').id, date=await dateOffset(35);
    const row=(await bookService(chemical,date,'09:00',null,'solicitado')).rows[0];
    await db.exec('alter table public.appointments disable trigger validate_appointment');
    try { await db.query("update public.appointments set data='2020-01-01' where id=$1",[row.id]); }
    finally { await db.exec('alter table public.appointments enable trigger validate_appointment'); }
    await asUser(alice,()=>db.query("update public.appointments set status='cancelado_cliente' where id=$1",[row.id]));
    assert.deepEqual((await db.query('select status,faixa_fim from public.appointments where id=$1',[row.id])).rows[0],{status:'cancelado_cliente',faixa_fim:null});
});

test('more than old daily/shift caps fits; 5m Bigodin still starts every 15m',async()=>{
    const date=await dateOffset(33), bigodin=seededCatalog.find(s=>s.nome==='Bigodin').id;
    await override(date,{disponivel:true,intervalos:[{inicio:'09:00',fim:'13:00'},{inicio:'15:30',fim:'20:00'}],bloqueios:[]});
    for(let i=0;i<17;i++) {
        const start=i<16?9*60+i*15:15*60+30;
        const fmt=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
        await bookService(bigodin,date,fmt(start),fmt(start+5));
    }
    await assert.rejects(bookService(bigodin,date,'15:35','15:40'),/indisponível/);
});
test('atomic exclusion and global lock remain installed for all scheduling mutations',async()=>{
    const exclusion=(await db.query(`select pg_get_constraintdef(oid) as definition from pg_constraint where conname='appointments_no_overlap'`)).rows[0].definition;
    assert.match(exclusion,/EXCLUDE USING gist/); assert.match(exclusion,/confirmado/);
    const triggers=(await db.query(`select tgname from pg_trigger where tgname like 'lock_%'`)).rows.map(r=>r.tgname);
    for(const name of ['lock_booking_rules','lock_schedule_rules','lock_day_rules','lock_service_rules']) assert.ok(triggers.includes(name));
    const lock=(await db.query(`select pg_get_functiondef('private.lock_schedule()'::regprocedure) as definition`)).rows[0].definition;
    assert.match(lock,/pg_advisory_xact_lock\(7102026\)/);
});

test('competing inserts for one slot yield one winner (PGlite queue; real two-connection race is a release gate)',async()=>{
    const date=await dateOffset(34);
    await override(date,{disponivel:true,intervalos:[{inicio:'09:00',fim:'13:00'}],bloqueios:[]});
    const outcomes=await asUser(alice,()=>Promise.allSettled([1,2].map(()=>db.query(`insert into public.appointments(cliente_id,servico_id,data,faixa_inicio,faixa_fim,status) values($1,$2,$3,'09:00','09:45','pendente')`,[alice,service,date]))));
    assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(outcomes.filter(r=>r.status==='rejected').length,1);
    assert.equal((await db.query('select count(*)::int as n from public.appointments where data=$1',[date])).rows[0].n,1);
});

test('legacy migration reuses normalized service UUID and preserves users, profile, storage, price and occupied duration',async()=>{
    const legacy=new PGlite({extensions:{btree_gist}});
    try {
        await legacy.exec(bootstrapSQL);await legacy.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
        await legacy.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,'legacy@example.invalid','{"nome":"Legacy","sobrenome":"Test","role":"client"}')`,[alice]);
        await legacy.query(`insert into public.services(id,nome,preco,preco_promocional,duracao,categoria,imagem_url) values($1,' CORTE ',77,70,45,'corte','legacy-image')`,[service]);
        await legacy.query(`insert into public.appointments(cliente_id,servico_id,data,faixa_inicio,faixa_fim,status) values($1,$2,'2020-01-01','09:00','09:45:30','concluido')`,[alice,service]);
        await legacy.exec(`create schema private;
          create function private.other_app() returns int language sql as 'select 1';
          grant usage on schema private to authenticated;
          grant execute on function private.other_app() to authenticated;`);
        await legacy.exec(`insert into storage.objects(bucket_id,name) values('pixico-media','legacy.jpg')`);
        await legacy.exec(await readFile(new URL('../supabase/migrations/202610010001_production_foundation.sql',import.meta.url),'utf8'));
        assert.equal((await legacy.query('select count(*)::int as n from public.services')).rows[0].n,18);
        assert.deepEqual((await legacy.query('select nome,preco::text,duracao,imagem_url from public.services where id=$1',[service])).rows[0],{nome:'Corte',preco:'30.00',duracao:30,imagem_url:'legacy-image'});
        const a=(await legacy.query('select servico_id,preco_reservado::text,servico_nome_reservado,faixa_inicio,faixa_fim from public.appointments')).rows[0];
        assert.deepEqual(a,{servico_id:service,preco_reservado:'70.00',servico_nome_reservado:' CORTE ',faixa_inicio:'09:00:00',faixa_fim:'09:45:30'});
        assert.equal((await legacy.query('select nome from public.profiles where id=$1',[alice])).rows[0].nome,'Legacy');
        assert.equal((await legacy.query('select name from storage.objects')).rows[0].name,'legacy.jpg');
        assert.equal((await legacy.query("select has_function_privilege('authenticated','private.other_app()','EXECUTE') as allowed")).rows[0].allowed,true);
    } finally {await legacy.close();}
});

test('ambiguous legacy catalog and future chemical occupancy abort migration atomically for manual review',async()=>{
    const legacy=new PGlite({extensions:{btree_gist}});
    try {
        await legacy.exec(bootstrapSQL);await legacy.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
        await legacy.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,'legacy@example.invalid','{"nome":"Legacy","sobrenome":"Test","role":"client"}')`,[alice]);
        await legacy.query(`insert into public.services(id,nome,preco,duracao,categoria) values($1,'Platinado',100,15,'tratamento')`,[service]);
        await legacy.query(`insert into public.appointments(cliente_id,servico_id,data,faixa_inicio,faixa_fim,status) values($1,$2,'2099-01-01','09:00','09:15','confirmado')`,[alice,service]);
        const migration=await readFile(new URL('../supabase/migrations/202610010001_production_foundation.sql',import.meta.url),'utf8');
        await assert.rejects(legacy.exec(migration),/químico legado futuro/); await legacy.exec('rollback');
        assert.equal((await legacy.query('select faixa_fim from public.appointments')).rows[0].faixa_fim,'09:15:00');
        assert.equal((await legacy.query("select to_regclass('public.schedule_config') as t")).rows[0].t,null);
        await legacy.exec(`insert into public.services(nome,preco,duracao,categoria) values(' PLATINADO ',100,15,'tratamento')`);
        await assert.rejects(legacy.exec(migration),/Catálogo ambíguo/); await legacy.exec('rollback');
        assert.equal((await legacy.query('select count(*)::int as n from public.services')).rows[0].n,2);
    } finally {await legacy.close();}
});

test('preflight remains read-only on final schema and recognizes null-end chemical requests',async () => {
    const chemical=seededCatalog.find(s=>s.nome==='Luzes').id;
    await bookService(chemical,await dateOffset(36),'09:00',null,'solicitado');
    const before=(await db.query('select count(*)::int as n from public.appointments')).rows[0].n;
    const results=await db.exec(await readFile(new URL('../supabase/preflight.sql',import.meta.url),'utf8'));
    assert.equal(results.find(r=>r.rows?.[0]?.leitura_somente).rows[0].leitura_somente,'on');
    assert.equal(Number(results.find(r=>r.rows?.[0]?.agendamentos_invalidos!==undefined).rows[0].agendamentos_invalidos),0);
    assert.equal((await db.query('select count(*)::int as n from public.appointments')).rows[0].n,before);
});

test('preflight runs against untouched legacy schema and reports catalog alias ambiguity without migrating',async () => {
    const legacy=new PGlite({extensions:{btree_gist}});
    try {
        await legacy.exec(bootstrapSQL);
        await legacy.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
        await legacy.exec(`insert into public.services(nome,preco,duracao,categoria) values
          ('Corte infantil',50,45,'corte'),('Corte criança',50,45,'corte');`);
        const results=await legacy.exec(await readFile(new URL('../supabase/preflight.sql',import.meta.url),'utf8'));
        const aliases=results.flatMap(r=>r.rows||[]).find(r=>r.catalogo_ambiguo==='cortecrianca');
        assert.equal(aliases.ids.length,2);
        assert.equal((await legacy.query("select to_regclass('public.schedule_config') as t")).rows[0].t,null);
        assert.equal((await legacy.query('select count(*)::int as n from public.services')).rows[0].n,2);
    } finally {await legacy.close();}
});

test('rescheduling legacy occupancy preserves fractional minutes after a catalog duration change',async () => {
    const date=await dateOffset(37), proposed=await dateOffset(38);
    const row=(await book(alice,'09:00','09:45',date)).rows[0];
    await db.exec('alter table public.appointments disable trigger validate_appointment');
    try { await db.query("update public.appointments set faixa_fim='09:45:30' where id=$1",[row.id]); }
    finally {await db.exec('alter table public.appointments enable trigger validate_appointment');}
    await asUser(admin,()=>db.query('update public.services set duracao=30 where id=$1',[service]));
    await asUser(admin,()=>db.query("update public.appointments set status='aguardando_cliente',sugestao_data=$1,sugestao_inicio='10:00',sugestao_fim='10:45:30' where id=$2",[proposed,row.id]));
    await asUser(alice,()=>db.query("update public.appointments set status='confirmado' where id=$1",[row.id]));
    assert.equal((await db.query('select faixa_fim from public.appointments where id=$1',[row.id])).rows[0].faixa_fim,'10:45:30');
});

test('foundation replay fails before changes; original rules, RLS and catalog remain intact',async () => {
    const migration=await readFile(new URL('../supabase/migrations/202610010001_production_foundation.sql',import.meta.url),'utf8');
    const before=(await db.query('select data from public.schedule_config')).rows[0].data;
    await assert.rejects(db.exec(migration),/Foundation já instalada/);
    await db.exec('rollback');
    assert.deepEqual((await db.query('select data from public.schedule_config')).rows[0].data,before);
    assert.equal((await db.query('select count(*)::int as n from public.services')).rows[0].n,19);
    assert.equal((await db.query("select relrowsecurity as rls from pg_class where oid='public.appointments'::regclass")).rows[0].rls,true);
});

test('missing signup trigger aborts foundation without modifying the legacy database',async () => {
    const legacy=new PGlite({extensions:{btree_gist}});
    try {
        await legacy.exec(bootstrapSQL);await legacy.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
        await legacy.exec('drop trigger on_auth_user_created on auth.users');
        await assert.rejects(legacy.exec(await readFile(new URL('../supabase/migrations/202610010001_production_foundation.sql',import.meta.url),'utf8')),/Trigger de cadastro legado/);
        await legacy.exec('rollback');
        assert.equal((await legacy.query("select to_regclass('public.schedule_config') as t")).rows[0].t,null);
        assert.equal((await legacy.query("select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='services' and column_name='confirmacao_manual'")).rows[0].n,0);
    } finally {await legacy.close();}
});

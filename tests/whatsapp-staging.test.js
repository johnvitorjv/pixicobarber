import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const CUSTOMER='33333333-3333-4333-8333-333333333333';
const SERVICE='44444444-4444-4444-8444-444444444444';
const ADMIN='55555555-5555-4555-8555-555555555555';
const SECRET='locally-generated-test-token-never-use-this-in-production-0123456789';
const migrations=[
  '202610010001_production_foundation.sql',
  '202610080004_booking_window_client_changes.sql',
  '202610090002_whatsapp_staging.sql'
];

test('WhatsApp staging: disabled, explicit opt-in, separate outbox, lease',async()=>{
  const db=new PGlite({extensions:{btree_gist}});
  try {
    const bootstrap=[
      'create role anon; create role authenticated; create role service_role;',
      'create schema auth; create schema storage;',
      "create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');",
      "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;",
      'grant usage on schema auth to anon,authenticated;',
      'grant execute on function auth.uid() to anon,authenticated;',
      'create table storage.buckets(id text primary key,name text,public boolean);',
      'create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner uuid);',
      'alter table storage.objects enable row level security;',
      "create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;",
      'create publication supabase_realtime;',
    ].join('\n');
    await db.exec(bootstrap);
    await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
    for(const f of migrations)
      await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'customer@example.invalid',$2::jsonb)",[
      CUSTOMER,JSON.stringify({nome:'Teste',sobrenome:'Cliente',whatsapp:'5571999999999',whatsapp_opt_in:true})
    ]);
    const profile=(await db.query('select whatsapp_opt_in from public.profiles where id=$1',[CUSTOMER])).rows[0];
    assert.equal(profile.whatsapp_opt_in,true);
    await db.query("insert into public.services(id,nome,preco,duracao,categoria,dias_permitidos) values($1,'Corte',45,30,'corte',array[0,1,2,3,4,5,6])",[SERVICE]);
    await db.exec("update public.schedule_config set data=jsonb_set(data,'{diasFuncionamento}','[0,1,2,3,4,5,6]')");
    const day=(await db.query("select (timezone('America/Bahia',now())::date+3)::text as day")).rows[0].day;
    await db.query("select set_config('test.uid',$1,false)",[CUSTOMER]);
    const a=(await db.query("insert into public.appointments(cliente_id,servico_id,data,faixa_inicio,faixa_fim,status) values($1,$2,$3,'10:00','10:30','pendente') returning id",[CUSTOMER,SERVICE,day])).rows[0].id;
    let jobs=(await db.query('select * from private.whatsapp_outbox')).rows;
    assert.equal(jobs.length,0,'no messages before enabling');
    await assert.rejects(db.query("select * from public.whatsapp_worker_claim($1)",[SECRET]),/não autorizado/);
    await db.query("update private.whatsapp_settings set enabled=true,admin_whatsapp='5571888888888',admin_opt_in=true,secret_hash=encode(sha256(convert_to($1,'UTF8')),'hex') where id=true",[SECRET]);
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'barber@example.invalid',$2::jsonb)",[ADMIN,JSON.stringify({nome:'Admin',sobrenome:'Pixico'})]);
    await db.query("select set_config('test.uid','',false)");
    await db.query("update public.profiles set role='admin' where id=$1",[ADMIN]);
    await db.query("select set_config('test.uid',$1,false)",[ADMIN]);
    await db.query("update public.appointments set status='confirmado' where id=$1",[a]);
    jobs=(await db.query('select * from private.whatsapp_outbox order by created_at')).rows;
    assert.ok(jobs.some(j=>j.event_type==='client_approved'),'client approved');
    assert.ok(jobs.some(j=>j.event_type==='client_reminder_24h'),'24h reminder');
    assert.equal(jobs.some(j=>j.recipient_phone==='5571888888888'),false,'no admin broadcast on own approval');
    await db.query("select set_config('test.uid',$1,false)",[CUSTOMER]);
    await db.query("update public.appointments set status='cancelado_cliente' where id=$1",[a]);
    jobs=(await db.query('select * from private.whatsapp_outbox')).rows;
    assert.ok(jobs.some(j=>j.event_type==='admin_client_cancelled'),'admin cancelled');
    assert.ok(jobs.some(j=>j.event_type==='client_cancelled_confirm'),'client cancellation acknowledgement');
    assert.ok(!jobs.some(j=>j.event_type==='client_reminder_24h'&&j.status==='pending'),'stale reminder cancelled');
    const claim=await db.query('select * from public.whatsapp_worker_claim($1,1)',[SECRET]);
    assert.equal(claim.rows.length,1);
    assert.ok(claim.rows[0].lease_token);
    const ack=await db.query('select public.whatsapp_worker_ack($1,$2,$3,true,null) as ok',[
      SECRET,claim.rows[0].id,claim.rows[0].lease_token
    ]);
    assert.equal(ack.rows[0].ok,true);
    const again=await db.query('select public.whatsapp_worker_ack($1,$2,$3,true,null) as ok',[
      SECRET,claim.rows[0].id,claim.rows[0].lease_token
    ]);
    assert.equal(again.rows[0].ok,false,'cannot acknowledge twice');
    await assert.rejects(db.query('select * from public.whatsapp_worker_claim($1,1)',['incorrect']),/não autorizado/);
  } finally { await db.close(); }
});

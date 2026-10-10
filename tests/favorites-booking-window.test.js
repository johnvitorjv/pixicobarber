import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { bookingWindow, addCalendarDays } from '../src/lib/bookingWindow.js';
import { profileToUser } from '../src/lib/authUtils.js';

const REGULAR='11111111-1111-4111-8111-111111111111';
const FAVORITE='22222222-2222-4222-8222-222222222222';
const DEVELOPER='33333333-3333-4333-8333-333333333333';
const SERVICE='44444444-4444-4444-8444-444444444444';
async function asUser(db,id,fn) {
  await db.query('select set_config($1,$2,false)',['test.uid',id]);
  await db.exec('set role authenticated');
  try { return await fn(); }
  finally { await db.exec('reset role'); await db.query("select set_config('test.uid','',false)"); }
}

test('7-day standard, 14-day favorite, developer remains unrestricted in UI',()=>{
  const now='2026-10-10';
  for(const [profile,days,unrestricted] of [
    [{isDeveloper:false,favorito:false},7,false],
    [{isDeveloper:false,favorito:true},14,false],
    [{isDeveloper:true,favorito:true},7,true],
    [{isDeveloper:true,favorito:false},7,true],
  ]) {
    const w=bookingWindow(profile,now);
    assert.equal(w.days,days);
    assert.equal(w.end,addCalendarDays(now,days));
    assert.equal(w.unrestricted,unrestricted);
  }
  assert.equal(profileToUser({id:FAVORITE,email:'test@example.invalid'},{id:FAVORITE,favorito:true}).favorito,true);
});

test('DB enforces favorite 14d, regular 7d, developer exception, safe rebooking',async()=>{
  const db=new PGlite({extensions:{btree_gist}});
  try{
    await db.exec([
      'create role anon; create role authenticated;',
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
    ].join('\n'));
    await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
    for(const file of [
      '202610010001_production_foundation.sql',
      '202610080004_booking_window_client_changes.sql',
      '202610080005_suggestion_slots.sql',
      '202610090001_month_availability.sql',
      '202610100001_favorite_booking_window.sql',
    ]) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'regular@example.invalid','{}'),($2,'favorite@example.invalid','{}'),($3,'developer@example.invalid','{}')",[REGULAR,FAVORITE,DEVELOPER]);
    await db.query('update public.profiles set favorito=true where id=$1',[FAVORITE]);
    await db.query('update public.profiles set favorito=true,is_developer=true where id=$1',[DEVELOPER]);
    await db.query("insert into public.services(id,nome,preco,duracao,categoria,dias_permitidos) values($1,'Corte de teste',60,45,'corte',array[0,1,2,3,4,5,6])",[SERVICE]);
    await db.exec("update public.schedule_config set data=jsonb_set(data,'{diasFuncionamento}','[0,1,2,3,4,5,6]')");
    const {rows:[dates]}=await db.query("select (timezone('America/Bahia',now())::date+5)::text day5,(timezone('America/Bahia',now())::date+7)::text day7,(timezone('America/Bahia',now())::date+8)::text day8,(timezone('America/Bahia',now())::date+14)::text day14,(timezone('America/Bahia',now())::date+15)::text day15,(timezone('America/Bahia',now())::date+30)::text day30");
    const reserve=(who,when,slot='09:00',end='09:45')=>asUser(db,who,()=>db.query("insert into public.appointments(cliente_id,servico_id,data,faixa_inicio,faixa_fim,status) values($1,$2,$3,$4,$5,'pendente') returning id",[who,SERVICE,when,slot,end]));
    assert.equal((await db.query("select has_column_privilege('authenticated','public.profiles','favorito','SELECT') ok")).rows[0].ok,true);
    assert.equal((await reserve(REGULAR,dates.day7)).rows.length,1);
    await assert.rejects(reserve(REGULAR,dates.day8),/7 dias/);
    const original=(await reserve(FAVORITE,dates.day5)).rows[0].id;
    assert.equal((await reserve(FAVORITE,dates.day8)).rows.length,1);
    assert.equal((await reserve(FAVORITE,dates.day14)).rows.length,1);
    await assert.rejects(reserve(FAVORITE,dates.day15),/14 dias/);
    const slots14=await asUser(db,FAVORITE,()=>db.query("select * from public.get_edit_slots($1,$2,$3)",[original,dates.day14,SERVICE]));
    assert.ok(slots14.rows.some(s=>s.inicio==='11:00'&&s.disponivel));
    const slots15=await asUser(db,FAVORITE,()=>db.query("select * from public.get_edit_slots($1,$2,$3)",[original,dates.day15,SERVICE]));
    assert.equal(slots15.rows.length,0);
    const calendar=await asUser(db,FAVORITE,()=>db.query("select day::text as book_day,available from public.get_month_availability(date_trunc('month',$1::date)::date,'edit',$2,$3)",[dates.day14,SERVICE,original]));
    assert.ok(calendar.rows.some(x=>x.book_day===dates.day14&&x.available));
    await assert.rejects(asUser(db,FAVORITE,()=>db.query("select public.client_change_appointment($1,$2,$3,'11:00')",[original,SERVICE,dates.day15])),/14 dias/);
    const replacement=await asUser(db,FAVORITE,()=>db.query("select public.client_change_appointment($1,$2,$3,'11:00') id",[original,SERVICE,dates.day14]));
    assert.ok(replacement.rows[0].id);
    assert.equal((await db.query('select status from public.appointments where id=$1',[original])).rows[0].status,'cancelado_cliente');
    assert.equal((await reserve(DEVELOPER,dates.day30)).rows.length,1);
    await assert.rejects(asUser(db,REGULAR,()=>db.query('update public.profiles set favorito=true where id=$1',[REGULAR])),/administrativos|protegidos/);
    await db.query('update public.profiles set favorito=false where id=$1',[FAVORITE]);
    await assert.rejects(reserve(FAVORITE,dates.day8,'15:00','15:45'),/7 dias/);
  }finally{await db.close();}
});

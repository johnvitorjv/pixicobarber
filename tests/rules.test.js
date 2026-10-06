import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bahiaDate, calendarDate, generateDay, validateSchedule, mutationMessage, fitsDay, validateOverride, serviceAllowedOnDate } from '../src/lib/bookingRules.js';
import { normalizeWhatsApp } from '../src/lib/contact.js';
import { profileToUser } from '../src/lib/authUtils.js';
const config = { diasFuncionamento: [2,3,4,5,6], horarioInicio: '09:00', horarioFim: '20:00',
    intervaloAlmoco: { inicio: '13:00', fim: '15:30' }, duracaoSlot: 15, bloqueiosEspeciais: [], ferias: [] };
test('Bahia date remains prior day during UTC midnight', () => {
    assert.equal(bahiaDate(new Date('2026-10-02T01:30:00Z')), '2026-10-01');
    assert.equal(calendarDate(new Date(2026,9,1,12)), '2026-10-01');
});
test('invalid slots never cause infinite loop; grid fixed at 15 minutes', () => {
    for (const slot of [0,-1,NaN,Infinity,121]) assert.throws(() => validateSchedule({ ...config, duracaoSlot: slot }));
    assert.doesNotThrow(() => validateSchedule({ ...config, limiteClientesDia: 0 }));
    assert.throws(() => validateSchedule({ ...config, horarioFim: '08:00' }));
});
test('whole slot must fit before break; overrides replace vacations', () => {
    const day = generateDay('2026-10-02',config);
    assert.equal(day.faixas.some(f => f.inicio === '13:00'),false);
    assert.equal(day.faixas.some(f => f.inicio === '15:30'),true);
    assert.equal(generateDay('2026-10-02',{...config,ferias:[{inicio:'2026-10-01',fim:'2026-10-05'}]},{disponivel:true,intervalos:[{inicio:'08:00',fim:'12:00'}],bloqueios:[]}).disponivel,true);
});
test('untrusted auth metadata and fixed email never grant administrator', () => {
    const authUser = { id:'client-id', email:'admin@example.invalid', user_metadata:{role:'admin'} };
    assert.equal(profileToUser(authUser,{id:'client-id',role:'client'}).role,'client');
    assert.throws(() => profileToUser(authUser,{id:'other-id',role:'admin'}));
});
test('conflicts and storage failures have actionable safe messages', () => {
    assert.match(mutationMessage({code:'23P01'}),/outro/);
    assert.match(mutationMessage({code:'23503'}),/desativado/);
    assert.equal(mutationMessage(new Error('Valor inválido.')),'Valor inválido.');
});

test('local Brazilian phones gain country code; schedule changes preserve blocked intervals without stale slots', () => {
    assert.equal(normalizeWhatsApp('(71) 99999-0000'),'5571999990000');
    assert.equal(normalizeWhatsApp('+55 71 99999-0000'),'5571999990000');
    const day = generateDay('2026-10-02',config, {disponivel:true,intervalos:[{inicio:'08:00',fim:'11:00'}],bloqueios:[{inicio:'09:10',fim:'10:00'}]});
    assert.equal(day.faixas.find(f=>f.inicio==='09:00').disponivel,false);
    assert.equal(day.faixas.find(f=>f.inicio==='09:30').disponivel,false);
});

test('regular Tue-Sat defaults, 15m grid and break boundaries fit entire duration', () => {
    for (const date of ['2026-10-04','2026-10-05']) assert.equal(generateDay(date,config).disponivel,false);
    const day = generateDay('2026-10-06',config);
    assert.equal(day.faixas[0].inicio,'09:00');
    assert.equal(day.faixas.at(-1).inicio,'19:45');
    assert.ok(day.faixas.some(f=>f.inicio==='09:15'));
    assert.equal(fitsDay(day,12*60+30,13*60),true);
    assert.equal(fitsDay(day,12*60+45,13*60+15),false);
    assert.equal(fitsDay(day,15*60+15,16*60),false);
    assert.equal(fitsDay(day,19*60+30,20*60),true);
});

test('Sunday overrides, arbitrary partial blocks, multiple intervals and closure', () => {
    const override = {disponivel:true,intervalos:[{inicio:'07:10',fim:'12:00'},{inicio:'14:00',fim:'21:00'}],bloqueios:[{inicio:'08:07',fim:'08:22'},{inicio:'16:05',fim:'16:10'}]};
    const day = generateDay('2026-10-04',config,override);
    assert.equal(day.faixas[0].inicio,'07:15');
    assert.equal(fitsDay(day,8*60,8*60+30),false);
    assert.equal(fitsDay(day,11*60+45,14*60+15),false);
    assert.equal(fitsDay(day,14*60,14*60+45),true);
    assert.equal(fitsDay(day,16*60,16*60+15),false);
    assert.deepEqual(generateDay('2026-10-06',config,{disponivel:false,intervalos:[],bloqueios:[]}).faixas,[]);
    assert.throws(()=>validateOverride({...override,intervalos:[{inicio:'09:00',fim:'12:00'},{inicio:'11:00',fim:'13:00'}]}));
    assert.throws(()=>validateOverride({...override,bloqueios:[{inicio:'25:00',fim:'26:00'}]}));
});

test('child haircut allowed on Tuesday Wednesday Thursday only, including overrides', () => {
    const service={diasPermitidos:[2,3,4]};
    for (let d=4;d<=10;d++) assert.equal(serviceAllowedOnDate(service,`2026-10-${String(d).padStart(2,'0')}`),d>=6&&d<=8);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bahiaDate, calendarDate, generateDay, validateSchedule, mutationMessage } from '../src/lib/bookingRules.js';
import { normalizeWhatsApp } from '../src/lib/contact.js';
import { profileToUser } from '../src/lib/authUtils.js';
const config = { diasFuncionamento: [0,1,2,3,4,5,6], horarioInicio: '09:00', horarioFim: '18:00',
    intervaloAlmoco: { inicio: '11:45', fim: '14:00' }, duracaoSlot: 30, limiteClientesDia: 16,
    limiteClientesTurno: 8, bloqueiosEspeciais: [], ferias: [] };
test('Bahia date remains prior day during UTC midnight', () => {
    assert.equal(bahiaDate(new Date('2026-10-02T01:30:00Z')), '2026-10-01');
    assert.equal(calendarDate(new Date(2026,9,1,12)), '2026-10-01');
});
test('invalid slots never cause infinite loop; invalid limits rejected', () => {
    for (const slot of [0,-1,NaN,Infinity,121]) assert.throws(() => validateSchedule({ ...config, duracaoSlot: slot }));
    assert.throws(() => validateSchedule({ ...config, limiteClientesDia: 0 }));
    assert.throws(() => validateSchedule({ ...config, horarioFim: '08:00' }));
});
test('whole slot must fit before lunch; full closure and vacation take precedence', () => {
    const day = generateDay('2026-10-02',config);
    assert.equal(day.faixas.some(f => f.inicio === '11:30'),false);
    assert.equal(day.faixas.some(f => f.inicio === '14:00'),true);
    assert.equal(generateDay('2026-10-02',{...config,ferias:[{inicio:'2026-10-01',fim:'2026-10-05'}]},{disponivel:true}).disponivel,false);
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
    const day = generateDay('2026-10-02',{...config,duracaoSlot:60}, {disponivel:true,faixas:[{id:'09:30',inicio:'09:30',fim:'10:00',disponivel:false}]});
    assert.equal(day.faixas.find(f=>f.inicio==='09:00').disponivel,false);
    assert.equal(day.faixas.some(f=>f.inicio==='09:30'),false);
});

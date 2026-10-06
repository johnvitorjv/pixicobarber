import test from 'node:test';
import assert from 'node:assert/strict';
import { getServiceGroup, groupServices } from '../src/lib/serviceGroups.js';

test('service groups keep combos separate and route visual services to estética', () => {
    const services = [
        { nome: 'Corte', categoria: 'corte' },
        { nome: 'Tesoura', categoria: 'corte' },
        { nome: 'Cabelo + barba', categoria: 'combo' },
        { nome: 'Freestyle', categoria: 'corte' },
        { nome: 'Platinado', categoria: 'tratamento' },
        { nome: 'Luzes', categoria: 'tratamento' },
        { nome: 'Pigmentação', categoria: 'tratamento' },
    ];

    assert.equal(getServiceGroup(services[0]), 'avulsos');
    assert.equal(getServiceGroup(services[2]), 'combos');
    assert.equal(getServiceGroup(services[3]), 'estetica');
    assert.equal(getServiceGroup(services[6]), 'estetica');

    const groups = groupServices(services);
    assert.deepEqual(groups.map(group => group.id), ['avulsos', 'combos', 'estetica']);
    assert.deepEqual(groups.find(group => group.id === 'avulsos').services.map(s => s.nome), ['Corte', 'Tesoura']);
    assert.deepEqual(groups.find(group => group.id === 'combos').services.map(s => s.nome), ['Cabelo + barba']);
    assert.deepEqual(groups.find(group => group.id === 'estetica').services.map(s => s.nome), ['Freestyle', 'Platinado', 'Luzes', 'Pigmentação']);
});

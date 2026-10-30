import test from 'node:test';
import assert from 'node:assert/strict';
import { isPriorityFavoriteRequest, prioritizePendingFavorites } from '../src/lib/favoriteRequestPriority.js';

const clients = [
    {id:'favorite',favorito:true},
    {id:'regular',favorito:false},
];

test('priority applies to a particular pending favorite request, never to the client history', () => {
    const chronological = [
        {id:'regular-new',clienteId:'regular',status:'pendente'},
        {id:'favorite-approved',clienteId:'favorite',status:'confirmado'},
        {id:'regular-pending',clienteId:'regular',status:'pendente'},
        {id:'favorite-pending',clienteId:'favorite',status:'pendente'},
        {id:'favorite-finished',clienteId:'favorite',status:'concluido'},
        {id:'favorite-chemical',clienteId:'favorite',status:'solicitado'},
        {id:'favorite-cancelled',clienteId:'favorite',status:'cancelado_cliente'},
    ];
    const result = prioritizePendingFavorites(chronological, clients);
    assert.deepEqual(result.map(a=>a.id), [
        'favorite-pending','favorite-chemical','regular-new','favorite-approved',
        'regular-pending','favorite-finished','favorite-cancelled',
    ]);
    assert.deepEqual(chronological.map(a=>a.id), [
        'regular-new','favorite-approved','regular-pending','favorite-pending',
        'favorite-finished','favorite-chemical','favorite-cancelled',
    ]);
});

test('approval removes priority immediately without altering other appointments order', () => {
    const chronological = [
        {id:'new-regular',clienteId:'regular',status:'pendente'},
        {id:'other-favorite-confirmed',clienteId:'favorite',status:'confirmado'},
        {id:'new-favorite',clienteId:'favorite',status:'pendente'},
        {id:'old-favorite',clienteId:'favorite',status:'ausente'},
    ];
    assert.equal(prioritizePendingFavorites(chronological,clients)[0].id,'new-favorite');
    const approved = chronological.map(a => a.id==='new-favorite' ? {...a,status:'confirmado'} : a);
    assert.deepEqual(prioritizePendingFavorites(approved,clients).map(a=>a.id), chronological.map(a=>a.id));
    assert.equal(isPriorityFavoriteRequest(approved[2],true),false);
    assert.equal(isPriorityFavoriteRequest({...approved[2],status:'aguardando_cliente'},true),false);
    assert.equal(isPriorityFavoriteRequest({...approved[2],status:'remarcado'},true),false);
    assert.equal(isPriorityFavoriteRequest({...approved[2],status:'rejeitado'},true),false);
    assert.equal(isPriorityFavoriteRequest({...approved[2],status:'pendente'},false),false);
});

test('favoriting or unfavoriting a profile changes only its still-pending requests', () => {
    const list = [
        {id:'regular-new',clienteId:'regular',status:'pendente'},
        {id:'favorite-old',clienteId:'favorite',status:'confirmado'},
        {id:'favorite-new',clienteId:'favorite',status:'pendente'},
    ];
    assert.deepEqual(prioritizePendingFavorites(list, clients).map(x=>x.id), ['favorite-new','regular-new','favorite-old']);
    assert.deepEqual(prioritizePendingFavorites(list,[...clients.map(c=>({...c,favorito:false}))]).map(x=>x.id), list.map(x=>x.id));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRemoteStore } from '../src/stores/remoteStore.js';
test('confirmed write remains successful when refresh fails; retry restores cache and clears error', async () => {
    let failRead = false, records = [{id:1}];
    const client = {from:()=>({select:()=>({order:()=>({range:start=>Promise.resolve(failRead ? {error:new Error('offline')} : {data:start?[]:records})})})})};
    const store = createRemoteStore('expenses',x=>x,()=>client);
    await store.load(); assert.deepEqual(store.getAll(),[{id:1}]);
    failRead = true;
    await assert.doesNotReject(store.write(Promise.resolve({error:null})));
    assert.match(store.getError(),/atualizar/); assert.equal(store.isReady(),true);
    await assert.rejects(store.write(Promise.resolve({error:new Error('denied')})),/denied/);
    failRead = false; records = [{id:2}]; await store.load();
    assert.deepEqual(store.getAll(),[{id:2}]); assert.equal(store.getError(),'');
    store.clear(); assert.equal(store.isReady(),false); assert.equal(store.getError(),''); assert.deepEqual(store.getAll(),[]);
});

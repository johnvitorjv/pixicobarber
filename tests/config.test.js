import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicKey, validatePublicConfig } from '../src/lib/publicConfig.js';
import { fetchAllRows } from '../src/lib/fetchRows.js';
const jwt = role => 'test.' + Buffer.from(JSON.stringify({role})).toString('base64url') + '.signature';
test('public config rejects privileged keys, credentials in URL and production HTTP', () => {
    assert.equal(isPublicKey(jwt('service_role')),false); assert.equal(isPublicKey('sb_secret_TEST'),false);
    assert.equal(isPublicKey(jwt('anon')),true); assert.equal(isPublicKey('sb_publishable_test'),true);
    assert.throws(()=>validatePublicConfig('https://user:pass@example.invalid',jwt('anon')),/HTTPS/);
    assert.throws(()=>validatePublicConfig('http://127.0.0.1:54321',jwt('anon'),true),/HTTPS/);
    assert.doesNotThrow(()=>validatePublicConfig('http://127.0.0.1:54321',jwt('anon')));
    assert.throws(()=>validatePublicConfig('https://example.invalid',jwt('service_role')),/pública/);
});
test('row pagination handles server limits and aborts obsolete requests', async () => {
    const source = Array.from({length:2003},(_,id)=>({id}));
    const queries = [];
    const rows = await fetchAllRows(()=>({range(start,end){queries.push([start,end]);return Promise.resolve({data:source.slice(start,Math.min(end+1,start+400)),error:null});}}));
    assert.deepEqual(rows,source); assert.equal(queries.at(-1)[0],2003);
    assert.deepEqual(await fetchAllRows(()=>{throw new Error('should not query')},()=>false),[]);
    await assert.rejects(fetchAllRows(()=>({range:()=>Promise.resolve({error:new Error('offline')})})),/offline/);
});

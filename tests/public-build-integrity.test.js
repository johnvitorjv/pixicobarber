import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicBundleConfig } from '../scripts/public-build-integrity.js';

test('build guard accepts separately emitted Supabase URL and public key', () => {
  assert.doesNotThrow(() => assertPublicBundleConfig(['const url="https://project.supabase.co"', 'const key="sb_publishable_example"'], 'https://project.supabase.co', 'sb_publishable_example'));
});

test('build guard blocks missing URL, missing key and empty output', () => {
  assert.throws(() => assertPublicBundleConfig(['key=sb_publishable_example'], 'https://project.supabase.co', 'sb_publishable_example'), /Build bloqueado/);
  assert.throws(() => assertPublicBundleConfig(['url=https://project.supabase.co'], 'https://project.supabase.co', 'sb_publishable_example'), /Build bloqueado/);
  assert.throws(() => assertPublicBundleConfig([], 'https://project.supabase.co', 'sb_publishable_example'), /Build bloqueado/);
});

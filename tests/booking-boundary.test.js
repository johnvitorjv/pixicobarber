import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../supabase/migrations/202610080004_booking_window_client_changes.sql', import.meta.url), 'utf8');

test('self-service rebooking uses timestamp comparison to reject crossing midnight', async () => {
  assert.match(migration, /p_date\s*\+\s*p_start\s*\+\s*make_interval\(mins=>requested_service\.duracao\)\s*>=\s*p_date\s*\+\s*interval '1 day'/);
  const db = new PGlite();
  try {
    const { rows } = await db.query(`select
      (date '2026-10-08' + time '23:45' + make_interval(mins=>30) >= date '2026-10-08' + interval '1 day') as crosses_midnight,
      (date '2026-10-08' + time '22:00' + make_interval(mins=>30) >= date '2026-10-08' + interval '1 day') as within_day,
      (date '2026-10-08' + time '23:00' + make_interval(mins=>60) >= date '2026-10-08' + interval '1 day') as exactly_midnight`);
    assert.deepEqual(rows[0], { crosses_midnight: true, within_day: false, exactly_midnight: true });
  } finally {
    await db.close();
  }
});

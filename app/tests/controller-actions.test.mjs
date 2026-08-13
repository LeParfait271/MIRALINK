import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('controller workspace buttons are wired to local actions', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  for (const id of ['open-calibration-button', 'run-quick-test-button', 'open-history-button']) {
    assert.ok(source.includes(`$('#${id}').addEventListener('click'`), `${id} must have a click handler`);
  }
  assert.match(source, /Pico flash was not modified/);
});

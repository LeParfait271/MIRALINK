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

test('profile and firmware controls are wired to working local handlers', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.ok(source.includes("$('#profiles-button')?.addEventListener('click', openProfilesManager)"));
  assert.ok(source.includes("$('#firmware-file')?.addEventListener('change', inspectFirmware)"));
  assert.match(source, /commitProfileApplication/);
  assert.match(source, /inspectUf2/);
  assert.match(source, /Aucun flash n’a été lancé/);
  assert.match(source, /STRUCTURE VALIDE/);
  assert.match(source, /identité matérielle et l’authenticité ne sont pas vérifiées/);
  assert.match(source, /formatConfigurationChanges/);
  assert.match(source, /function updateInstalledVersion\(\)/);
});

test('identified bridges expose diagnostics and reconnect paths', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /diagnostics\.addEventListener\('click', \(\) => openEntryDiagnostics\(entry\)\)/);
  assert.match(source, /existing\.state !== 'ready'/);
  assert.match(source, /await reconnectEntry\(entry\)/);
});

test('pairing, session analyses and configuration writes keep their safety gates', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /open-pairing-button.*openPairingWindow\(readyBridgeEntry\(\)\)/s);
  assert.match(source, /miralink:open-pairing-window', \(\) => openPairingWindow\(readyBridgeEntry\(\)\)/);
  assert.match(source, /canEditBridgeConfiguration\(entry, state\.savedConfig\)/);
  assert.match(source, /entry\.analysisSnapshots = appendCalibrationRevision/);
  assert.doesNotMatch(source, /calibrationHistory|localCalibration|Restaurer localement/);
  assert.doesNotMatch(source, /\{ usagePage: HID_USAGE_PAGE \}/);
});

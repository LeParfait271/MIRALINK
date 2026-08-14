import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../src/protocol.js';
import { canonicalBackupJson, createBackup, validateBackup } from '../src/storage.js';

test('backup checksum uses canonical key ordering', () => {
  assert.equal(
    canonicalBackupJson({ z: 1, nested: { b: 2, a: 1 }, a: 2 }),
    canonicalBackupJson({ a: 2, nested: { a: 1, b: 2 }, z: 1 })
  );
});

test('backup identifies entry kind and validates its checksum', () => {
  const backup = createBackup({
    config: defaultConfig(),
    device: { kind: 'bridge', label: 'MiraLink Pico 2 W' },
    version: '0.38'
  });
  assert.equal(backup.formatVersion, 2);
  assert.equal(backup.device.type, 'bridge');
  assert.deepEqual(backup.checksum, { algorithm: 'CRC32', value: backup.checksum.value });
  assert.match(backup.checksum.value, /^[0-9a-f]{8}$/);
  assert.equal(validateBackup(backup), backup);
});

test('backup validation rejects altered content and absent checksums', () => {
  const backup = createBackup({ config: defaultConfig(), device: { kind: 'bridge' } });
  const altered = structuredClone(backup);
  altered.config.hapticsGain = 1.5;
  assert.throws(() => validateBackup(altered), /checksum does not match/);
  const { checksum: _checksum, ...unsigned } = backup;
  assert.throws(() => validateBackup(unsigned), /checksum is missing/);
});

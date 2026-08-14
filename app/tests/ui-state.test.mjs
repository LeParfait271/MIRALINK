import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canEditBridgeConfiguration,
  describeControllerOverview,
  formatConfigurationChanges,
  loadEntryWorkingCopy,
  saveEntryWorkingCopy
} from '../src/ui-state.js';

test('controller overview follows polled bridge controller state', () => {
  assert.deepEqual(describeControllerOverview({ bridge: { controllerState: { connected: true, inputAvailable: true } } }), {
    state: 'PRÊTE',
    note: 'DualSense via le bridge · entrées actives'
  });
  assert.equal(describeControllerOverview({ bridge: { controllerState: { pairingWindowOpen: true } } }).state, 'APPAIRAGE');
  assert.equal(describeControllerOverview({ bridge: { controllerState: { connectionPending: true } } }).state, 'CONNEXION');
});

test('bridge configuration remains locked until a successful read exists', () => {
  const bridge = { kind: 'bridge', state: 'ready', config: null };
  assert.equal(canEditBridgeConfiguration(bridge, null), false);
  bridge.config = { schema: 1 };
  assert.equal(canEditBridgeConfiguration(bridge, null), false);
  assert.equal(canEditBridgeConfiguration(bridge, { schema: 1 }), true);
});

test('each device keeps an independent draft and saved baseline', () => {
  const first = { config: { hapticsGain: 1 } };
  const second = { config: { hapticsGain: 1.2 } };
  saveEntryWorkingCopy(first, { draft: { hapticsGain: 1.5 }, savedConfig: { hapticsGain: 1 } });
  saveEntryWorkingCopy(second, { draft: { hapticsGain: 1.3 }, savedConfig: { hapticsGain: 1.2 } });
  assert.deepEqual(loadEntryWorkingCopy(first), { draft: { hapticsGain: 1.5 }, savedConfig: { hapticsGain: 1 } });
  assert.deepEqual(loadEntryWorkingCopy(second), { draft: { hapticsGain: 1.3 }, savedConfig: { hapticsGain: 1.2 } });
  const loaded = loadEntryWorkingCopy(first);
  loaded.draft.hapticsGain = 2;
  assert.equal(first.draft.hapticsGain, 1.5, 'loaded working copies must not alias entry state');
});

test('configuration confirmation renders explicit before and after values', () => {
  assert.equal(formatConfigurationChanges([
    { key: 'hapticsGain', before: 1, after: 1.4 },
    { key: 'enableUsbSerial', before: false, after: true }
  ]), '• Gain haptique : 1 → 1.4\n• Numéro de série USB : désactivé → activé');
});

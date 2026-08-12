import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS, defaultConfig, ProtocolError } from '../src/protocol.js';
import {
  bindProfileToTarget,
  BATTERY_AUTO_SWITCH_THRESHOLD,
  commitProfileApplication,
  createBuiltInProfiles,
  diffConfig,
  parseProfile,
  previewProfileApplication,
  resolveAutomaticBatteryProfile,
  serializeProfile
} from '../src/profiles.js';
import {
  applySimulationConfig,
  createSimulationAdapter,
  createSimulationDevice,
  listSimulationScenarios,
  readSimulationConfig,
  SIMULATION_MODE_LABEL,
  setSimulationScenario
} from '../src/simulation.js';
import {
  analyzeControllerInputs,
  appendCalibrationRevision,
  commitCalibrationRestore,
  compareControllerAnalyses,
  createCalibrationRevision,
  prepareCalibrationRestore
} from '../src/controller-lab.js';
import { createProfileStore, PROFILE_STORE_KEY } from '../src/profile-store.js';
import {
  appendMetricSnapshot,
  createConnectionMap,
  createLiveStatusSnapshot,
  createMetric,
  summarizeMetricHistory,
  updateConnectionNode
} from '../src/live-status.js';
import {
  applyButtonMapping,
  commitMappingApplication,
  createDefaultCommandProfile,
  createDefaultMapping,
  createInputCommandProfile,
  parseInputCommandProfile,
  previewMappingApplication,
  serializeInputCommandProfile
} from '../src/input-mapping.js';
import {
  commitEmergencyReset,
  getSafeEmergencyConfig,
  prepareEmergencyReset
} from '../src/emergency-mode.js';
import {
  createCompatibilityMatrix,
  createCompatibilityEntry,
  parseCompatibilityMatrix,
  resolveCompatibility,
  serializeCompatibilityMatrix
} from '../src/compatibility.js';
import {
  createDiagnosticPlan,
  exportDiagnosticReport,
  recordDiagnosticResult
} from '../src/diagnostics.js';

function sample({ leftX = 0, leftY = 0, rightX = 0, rightY = 0, leftTrigger = 0, rightTrigger = 0 } = {}) {
  return { leftStick: { x: leftX, y: leftY }, rightStick: { x: rightX, y: rightY }, leftTrigger, rightTrigger };
}

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

test('built-in profiles are limited to competitive, basic and economy', () => {
  const profiles = createBuiltInProfiles();
  assert.deepEqual(profiles.map((profile) => profile.id), ['competitive', 'basic', 'economy']);
  assert.ok(profiles.every((profile) => profile.builtIn && profile.target.type === 'bridge'));
  assert.ok(profiles.find((profile) => profile.id === 'competitive').config.pollingMode === 2);
  assert.equal(profiles.find((profile) => profile.id === 'competitive').config.audioBufferLength, 16);
  assert.equal(profiles.find((profile) => profile.id === 'basic').config.pollingMode, 1);
  assert.ok(profiles.find((profile) => profile.id === 'economy').config.inactiveMinutes === 15);
});

test('profile previews produce deterministic changes and require confirmation before application', () => {
  const profile = createBuiltInProfiles().find((value) => value.id === 'competitive');
  const preview = previewProfileApplication(profile, defaultConfig(), { type: 'bridge', id: null });
  assert.equal(preview.ok, true);
  assert.equal(preview.requiresConfirmation, true);
  assert.ok(preview.changes.some((change) => change.key === 'pollingMode'));
  assert.throws(() => commitProfileApplication(preview), (error) => error instanceof ProtocolError && error.code === 'confirmation_required');
  const applied = commitProfileApplication(preview, { confirmed: true });
  assert.equal(applied.applied, true);
  assert.equal(applied.persisted, false);
  assert.equal(applied.config.pollingMode, 2);
});

test('controller-bound profiles cannot be applied to a different target', () => {
  const profile = bindProfileToTarget(createBuiltInProfiles()[0], { type: 'controller', id: 'controller-a' });
  const preview = previewProfileApplication(profile, defaultConfig(), { type: 'controller', id: 'controller-b' });
  assert.equal(preview.ok, false);
  assert.equal(preview.reason, 'target_mismatch');
});

test('profile export and import preserve the validated profile contract', () => {
  const profile = bindProfileToTarget(createBuiltInProfiles()[0], { type: 'controller', id: 'controller-a' });
  const imported = parseProfile(serializeProfile(profile));
  assert.deepEqual(imported, profile);
  assert.throws(() => parseProfile({ format: 'other', formatVersion: 1, profile }), /Unsupported/);
});

test('battery automation switches basic to economy below ten percent', () => {
  const result = resolveAutomaticBatteryProfile({ activeProfileId: 'basic', batteryPercent: BATTERY_AUTO_SWITCH_THRESHOLD - 1 });
  assert.equal(result.switched, true);
  assert.equal(result.toProfileId, 'economy');
  assert.equal(result.requiresConfirmation, true);
  assert.equal(result.reason, 'battery_below_threshold');
});

test('battery automation does not switch at ten percent or override competitive', () => {
  assert.equal(resolveAutomaticBatteryProfile({ activeProfileId: 'basic', batteryPercent: 10 }).switched, false);
  const competitive = resolveAutomaticBatteryProfile({ activeProfileId: 'competitive', batteryPercent: 1 });
  assert.equal(competitive.switched, false);
  assert.equal(competitive.toProfileId, 'competitive');
  assert.equal(competitive.reason, 'competitive_protected');
});

test('configuration diff reports only changed fields', () => {
  const before = defaultConfig();
  const after = { ...before, hapticsGain: 1.5, disableLed: true };
  assert.deepEqual(diffConfig(before, after).map((change) => change.key), ['hapticsGain', 'disableLed']);
});

test('simulation always declares its mode and never claims a hardware test', () => {
  const device = createSimulationDevice({ scenario: 'connected' });
  assert.equal(device.modeLabel, SIMULATION_MODE_LABEL);
  assert.equal(device.hardwareTested, false);
  assert.equal(device.testStatus, 'not-tested');
  assert.equal(readSimulationConfig(device).ok, true);
});

test('simulation scenarios expose the requested failure states', () => {
  assert.deepEqual(listSimulationScenarios().map((scenario) => scenario.id), ['connected', 'error', 'disconnected', 'low-battery', 'packet-loss', 'invalid-config']);
  const lowBattery = createSimulationDevice({ scenario: 'low-battery' });
  assert.equal(lowBattery.metrics.batteryPercent, 12);
  const packetLoss = createSimulationDevice({ scenario: 'packet-loss' });
  assert.equal(packetLoss.metrics.packetLossPercent, 8.4);
  const invalid = createSimulationDevice({ scenario: 'invalid-config' });
  assert.equal(readSimulationConfig(invalid).reason, 'invalid_config');
});

test('simulation writes are confirmation-gated and never persistent', () => {
  const device = createSimulationDevice();
  const pending = applySimulationConfig(device, { ...defaultConfig(), pollingMode: 2 });
  assert.equal(pending.status, 'confirmation-required');
  const applied = applySimulationConfig(device, { ...defaultConfig(), pollingMode: 2 }, { confirmed: true });
  assert.equal(applied.ok, true);
  assert.equal(applied.persisted, false);
  assert.equal(applied.hardwareTested, false);
  assert.equal(applied.config.pollingMode, 2);
});

test('simulation disconnect blocks reads and writes until reconnect', () => {
  const device = setSimulationScenario(createSimulationDevice(), 'disconnected');
  assert.equal(readSimulationConfig(device).status, 'unavailable');
  assert.equal(applySimulationConfig(device, defaultConfig(), { confirmed: true }).status, 'unavailable');
  const adapter = createSimulationAdapter({ scenario: 'disconnected' });
  adapter.reconnect();
  assert.equal(adapter.readConfig().ok, true);
});

test('simulation module does not depend on hardware command identifiers', () => {
  assert.equal(typeof COMMANDS.hello, 'number');
  const adapter = createSimulationAdapter();
  assert.equal(adapter.snapshot.mode, 'simulation');
  assert.equal(adapter.snapshot.hardwareTested, false);
});

test('Controller Lab measures drift, deadzone coverage, amplitude and asymmetry', () => {
  const analysis = analyzeControllerInputs([
    sample({ leftX: 0.12, leftY: 0.04, rightX: -1, rightY: 0, leftTrigger: 0.2, rightTrigger: 0.8 }),
    sample({ leftX: 0.12, leftY: 0.04, rightX: 1, rightY: 0, leftTrigger: 0.4, rightTrigger: 1 }),
    sample({ leftX: 0.12, leftY: 0.04, rightX: 0, rightY: 1, leftTrigger: 0, rightTrigger: 0.5 })
  ]);
  assert.equal(analysis.hardwareTested, false);
  assert.equal(analysis.sticks.left.drift.detected, true);
  assert.equal(analysis.sticks.left.deadzone.coveragePercent, 0);
  assert.equal(analysis.sticks.right.amplitude.maxRadius, 1);
  assert.ok(analysis.triggers.left.amplitude > 0);
});

test('Controller Lab rejects values outside controller report ranges', () => {
  assert.throws(() => analyzeControllerInputs([sample({ leftX: 2 })]), /between -1 and 1/);
  assert.throws(() => analyzeControllerInputs([sample({ leftTrigger: 2 })]), /between 0 and 1/);
});

test('Controller Lab comparison is local and reports before/after deltas', () => {
  const before = analyzeControllerInputs([sample({ leftX: 0.2 }), sample({ leftX: 0.2 })]);
  const after = analyzeControllerInputs([sample({ leftX: 0 }), sample({ leftX: 0 })]);
  const comparison = compareControllerAnalyses(before, after);
  assert.equal(comparison.hardwareTested, false);
  assert.ok(comparison.leftStick.driftOffset < 0);
});

test('Calibration history is bounded and restore remains confirmation-gated', () => {
  const analysis = analyzeControllerInputs([sample()]);
  const first = createCalibrationRevision({ id: 'revision-1', deviceId: 'controller-a', analysis, createdAt: '2026-08-12T00:00:00.000Z' });
  const second = createCalibrationRevision({ id: 'revision-2', deviceId: 'controller-a', analysis, createdAt: '2026-08-12T00:01:00.000Z' });
  const history = appendCalibrationRevision(appendCalibrationRevision([], first, 1), second, 1);
  assert.deepEqual(history.map((entry) => entry.id), ['revision-2']);
  const preview = prepareCalibrationRestore([first, second], 'revision-1');
  assert.equal(preview.requiresConfirmation, true);
  assert.throws(() => commitCalibrationRestore(preview), /requires confirmation/);
  const restored = commitCalibrationRestore(preview, { confirmed: true });
  assert.equal(restored.persisted, false);
  assert.equal(restored.applied, true);
});

test('profile store keeps custom profiles local and versioned', () => {
  const storage = memoryStorage();
  const store = createProfileStore(storage);
  const profile = { id: 'my-profile', name: 'My Profile', description: 'Local only', target: { type: 'controller', id: 'controller-a' }, config: defaultConfig(), builtIn: false };
  assert.equal(store.available, true);
  assert.equal(store.save(profile).ok, true);
  assert.equal(storage.getItem(PROFILE_STORE_KEY).includes('miralink-profile-store'), true);
  assert.deepEqual(store.list().map((entry) => entry.id), ['my-profile']);
  const imported = store.exportDocument();
  assert.equal(store.remove('my-profile').removed, true);
  assert.equal(store.list().length, 0);
  assert.equal(store.importDocument(imported).imported, 1);
  assert.equal(store.list()[0].target.id, 'controller-a');
});

test('profile store reports malformed local entries without contacting a service', () => {
  const storage = memoryStorage();
  storage.setItem(PROFILE_STORE_KEY, JSON.stringify({ format: 'miralink-profile-store', formatVersion: 1, profiles: [{ format: 'bad' }] }));
  const store = createProfileStore(storage);
  assert.equal(store.list().length, 0);
  assert.equal(store.readDiagnostics().length, 1);
});

test('live status keeps simulation explicit and metrics bounded', () => {
  const snapshot = createLiveStatusSnapshot({
    source: 'simulation',
    bridgeState: 'connected',
    controllerState: 'connected',
    scenario: 'packet-loss',
    metrics: { usbLatencyMs: { value: 2 }, packetLossPercent: { value: 8.4 }, batteryPercent: { value: 72 } },
    capabilities: { vibration: { state: 'partial', reason: 'Simulated reduced output.' } }
  });
  assert.equal(snapshot.modeLabel, 'MODE SIMULATION');
  assert.equal(snapshot.hardwareTested, false);
  assert.equal(snapshot.metrics.packetLossPercent.value, 8.4);
  assert.equal(snapshot.capabilities.vibration.state, 'partial');
  const history = appendMetricSnapshot(appendMetricSnapshot([], snapshot, 1), snapshot, 1);
  assert.equal(history.length, 1);
  assert.equal(summarizeMetricHistory(history, 'packetLossPercent').average, 8.4);
});

test('live status rejects invented or out-of-range metrics', () => {
  assert.throws(() => createMetric('batteryPercent', { value: 101 }), /between 0 and 100/);
  assert.throws(() => createLiveStatusSnapshot({ source: 'simulation', metrics: { radioLatencyMs: { value: -1 } } }), /between 0 and 10000/);
  assert.throws(() => createLiveStatusSnapshot({ source: 'simulation', capabilities: { audio: { state: 'invented' } } }), /Capability state/);
});

test('connection map exposes the three local hops without sensitive identifiers', () => {
  const map = createConnectionMap({
    source: 'simulation',
    bridge: { id: 'bridge-1', label: 'Simulated Pico 2 W', state: 'connected', transport: 'webhid' },
    controllers: [{ id: 'controller-1', label: 'Simulated controller', state: 'connected', transport: 'radio', serial: 'must-not-appear', address: 'must-not-appear' }]
  });
  assert.equal(map.modeLabel, 'MODE SIMULATION');
  assert.equal(map.hardwareTested, false);
  assert.deepEqual(map.nodes.map((node) => node.type), ['computer', 'bridge', 'controller']);
  assert.deepEqual(map.links.map((item) => item.transport), ['webhid', 'radio']);
  assert.equal(JSON.stringify(map).includes('must-not-appear'), false);
  const disconnected = updateConnectionNode(map, 'controller-1', { state: 'disconnected', error: 'Simulated disconnect.' });
  assert.equal(disconnected.nodes[2].state, 'disconnected');
  assert.equal(disconnected.links[1].state, 'disconnected');
});

test('input command profiles validate mappings and require confirmation', () => {
  const profile = createInputCommandProfile({
    id: 'southpaw',
    name: 'Southpaw',
    target: { type: 'controller', id: 'controller-a' },
    mapping: { ...createDefaultMapping(), cross: 'circle', circle: 'cross' }
  });
  const preview = previewMappingApplication(profile, createDefaultMapping(), { type: 'controller', id: 'controller-a' });
  assert.equal(preview.requiresConfirmation, true);
  assert.throws(() => commitMappingApplication(preview), /requires confirmation/);
  const applied = commitMappingApplication(preview, { confirmed: true });
  assert.equal(applied.persisted, false);
  assert.equal(applied.mapping.cross, 'circle');
  assert.deepEqual(parseInputCommandProfile(serializeInputCommandProfile(profile)), profile);
  assert.equal(createDefaultCommandProfile().mapping.cross, 'cross');
});

test('button mapping is local, bounded and preserves non-button input fields', () => {
  const input = { timestamp: 'local', axes: { leftX: 0.2 }, buttons: { cross: true, circle: false } };
  const output = applyButtonMapping(input, { cross: 'circle', circle: 'cross' });
  assert.equal(output.timestamp, 'local');
  assert.deepEqual(output.axes, { leftX: 0.2 });
  assert.equal(output.buttons.circle, true);
  assert.equal(output.buttons.cross, false);
  assert.throws(() => applyButtonMapping(input, { cross: 'unknown' }), /invalid/);
});

test('emergency mode previews the safe Basic configuration and stays confirmation-gated', () => {
  const preview = prepareEmergencyReset({ currentConfig: createBuiltInProfiles()[0].config, target: { type: 'bridge', id: 'bridge-a' } });
  assert.equal(preview.profileId, 'basic');
  assert.equal(preview.requiresConfirmation, true);
  assert.equal(preview.after.pollingMode, getSafeEmergencyConfig().pollingMode);
  assert.throws(() => commitEmergencyReset(preview), /requires confirmation/);
  const applied = commitEmergencyReset(preview, { confirmed: true });
  assert.equal(applied.applied, true);
  assert.equal(applied.persisted, false);
});

test('compatibility matrix distinguishes recorded support from unknown combinations', () => {
  const matrix = createCompatibilityMatrix([
    createCompatibilityEntry({ firmwareVersion: '0.4.0', controllerModel: 'DualSense', adapterVersion: '1.0.0', state: 'partial', notes: 'Haptics pending.' })
  ]);
  assert.equal(resolveCompatibility(matrix, { firmwareVersion: '0.4.0', controllerModel: 'DualSense', adapterVersion: '1.0.0' }).state, 'partial');
  const unknown = resolveCompatibility(matrix, { firmwareVersion: '0.4.0', controllerModel: 'DualSense Edge', adapterVersion: '1.0.0' });
  assert.equal(unknown.state, 'not-tested');
  assert.equal(unknown.matched, false);
  assert.deepEqual(parseCompatibilityMatrix(serializeCompatibilityMatrix(matrix)), matrix);
  assert.throws(() => createCompatibilityMatrix([...matrix.entries, matrix.entries[0]]), /unique/);
});

test('guided diagnostics preserve simulation status and redact hardware claims', () => {
  let report = createDiagnosticPlan({ source: 'simulation', scenario: 'packet-loss' });
  report = recordDiagnosticResult(report, 'transport', { state: 'passed', evidence: 'Simulated transport answered.', probableCause: '', recommendation: 'Continue with the next step.', source: 'simulation', hardwareTested: true });
  const exported = exportDiagnosticReport(report);
  assert.equal(exported.modeLabel, 'MODE SIMULATION');
  assert.equal(exported.hardwareTested, false);
  assert.equal(exported.testStatus, 'not-tested');
  assert.equal(exported.steps[0].hardwareTested, false);
  assert.equal(exported.redaction, 'identifiers-omitted');
});

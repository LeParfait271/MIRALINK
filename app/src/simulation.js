import { assertValidConfig, defaultConfig, ProtocolError } from './protocol.js';

export const SIMULATION_MODE_LABEL = 'MODE SIMULATION';
export const SIMULATION_SCENARIOS = Object.freeze([
  'connected',
  'error',
  'disconnected',
  'low-battery',
  'packet-loss',
  'invalid-config'
]);

const SCENARIO_DEFINITIONS = Object.freeze({
  connected: Object.freeze({
    state: 'ready',
    message: 'Simulated Pico 2 W and controller are available.',
    metrics: Object.freeze({ usbLatencyMs: 1.8, radioLatencyMs: 5.2, packetLossPercent: 0.1, batteryPercent: 86, temperatureC: 36.4, audio: 'available', microphone: 'available', vibration: 'available', flash: 'available' }),
    configStatus: 'valid',
    configErrors: Object.freeze([])
  }),
  error: Object.freeze({
    state: 'error',
    message: 'Simulated transport error. No write is available.',
    metrics: Object.freeze({ usbLatencyMs: null, radioLatencyMs: null, packetLossPercent: null, batteryPercent: null, temperatureC: null, audio: 'unavailable', microphone: 'unavailable', vibration: 'unavailable', flash: 'unknown' }),
    configStatus: 'unavailable',
    configErrors: Object.freeze(['The simulated transport is in an error state.'])
  }),
  disconnected: Object.freeze({
    state: 'disconnected',
    message: 'Simulated controller disconnected from the bridge.',
    metrics: Object.freeze({ usbLatencyMs: null, radioLatencyMs: null, packetLossPercent: null, batteryPercent: null, temperatureC: null, audio: 'unavailable', microphone: 'unavailable', vibration: 'unavailable', flash: 'available' }),
    configStatus: 'unavailable',
    configErrors: Object.freeze(['No simulated controller is connected.'])
  }),
  'low-battery': Object.freeze({
    state: 'ready',
    message: 'Simulated controller is connected with a low battery.',
    metrics: Object.freeze({ usbLatencyMs: 2.1, radioLatencyMs: 7.4, packetLossPercent: 0.8, batteryPercent: 12, temperatureC: 37.1, audio: 'available', microphone: 'available', vibration: 'available', flash: 'available' }),
    configStatus: 'valid',
    configErrors: Object.freeze([])
  }),
  'packet-loss': Object.freeze({
    state: 'ready',
    message: 'Simulated radio packet loss is above the warning threshold.',
    metrics: Object.freeze({ usbLatencyMs: 2.7, radioLatencyMs: 24.6, packetLossPercent: 8.4, batteryPercent: 71, temperatureC: 39.2, audio: 'available', microphone: 'available', vibration: 'partial', flash: 'available' }),
    configStatus: 'valid',
    configErrors: Object.freeze([])
  }),
  'invalid-config': Object.freeze({
    state: 'ready',
    message: 'Simulated device returned an invalid configuration.',
    metrics: Object.freeze({ usbLatencyMs: 2, radioLatencyMs: 5.8, packetLossPercent: 0.2, batteryPercent: 64, temperatureC: 36.8, audio: 'available', microphone: 'available', vibration: 'available', flash: 'available' }),
    configStatus: 'invalid',
    configErrors: Object.freeze(['audioBufferLength is outside the supported range.'])
  })
});

function cloneConfig(config) {
  return { ...assertValidConfig(config) };
}

function definitionFor(scenario) {
  if (!SIMULATION_SCENARIOS.includes(scenario)) throw new ProtocolError(`Unknown simulation scenario: ${scenario}`, 'invalid_simulation_scenario');
  return SCENARIO_DEFINITIONS[scenario];
}

function addEvent(device, message) {
  return [...(device.events || []), Object.freeze({ timestamp: new Date().toISOString(), message })].slice(-50);
}

export function createSimulationDevice({ scenario = 'connected', config = defaultConfig() } = {}) {
  const definition = definitionFor(scenario);
  const value = cloneConfig(config);
  return {
    mode: 'simulation',
    modeLabel: SIMULATION_MODE_LABEL,
    hardwareTested: false,
    testStatus: 'not-tested',
    scenario,
    state: definition.state,
    message: definition.message,
    metrics: { ...definition.metrics },
    config: value,
    configStatus: definition.configStatus,
    configErrors: [...definition.configErrors],
    events: [{ timestamp: new Date().toISOString(), message: `Scenario selected: ${scenario}` }]
  };
}

export function snapshotSimulation(device) {
  if (!device || device.mode !== 'simulation') throw new ProtocolError('A simulation device is required', 'not_simulation');
  return {
    mode: 'simulation',
    modeLabel: SIMULATION_MODE_LABEL,
    hardwareTested: false,
    testStatus: 'not-tested',
    scenario: device.scenario,
    state: device.state,
    message: device.message,
    metrics: { ...device.metrics },
    configStatus: device.configStatus,
    configErrors: [...device.configErrors],
    config: cloneConfig(device.config),
    events: [...(device.events || [])]
  };
}

export function setSimulationScenario(device, scenario) {
  const current = snapshotSimulation(device);
  const next = createSimulationDevice({ scenario, config: current.config });
  next.events = addEvent(next, `Scenario changed from ${current.scenario} to ${scenario}.`);
  return next;
}

export function readSimulationConfig(device) {
  const snapshot = snapshotSimulation(device);
  if (snapshot.state === 'disconnected') return { ok: false, status: 'unavailable', reason: 'disconnected', device: snapshot };
  if (snapshot.state === 'error') return { ok: false, status: 'failed', reason: 'transport_error', device: snapshot };
  if (snapshot.configStatus === 'invalid') return { ok: false, status: 'failed', reason: 'invalid_config', errors: snapshot.configErrors, device: snapshot };
  return { ok: true, status: 'available', config: snapshot.config, hardwareTested: false, modeLabel: SIMULATION_MODE_LABEL, device: snapshot };
}

export function applySimulationConfig(device, config, { confirmed = false } = {}) {
  const snapshot = snapshotSimulation(device);
  if (!confirmed) return { ok: false, status: 'confirmation-required', reason: 'confirmation_required', device: snapshot };
  if (snapshot.state === 'disconnected') return { ok: false, status: 'unavailable', reason: 'disconnected', device: snapshot };
  if (snapshot.state === 'error') return { ok: false, status: 'failed', reason: 'transport_error', device: snapshot };
  let validated;
  try {
    validated = cloneConfig(config);
  } catch (error) {
    return { ok: false, status: 'failed', reason: 'invalid_config', errors: [error.message], device: snapshot };
  }
  const next = { ...snapshot, config: validated, configStatus: 'valid', configErrors: [], events: addEvent(snapshot, 'Configuration applied in simulation; no hardware was written.') };
  return { ok: true, status: 'applied', persisted: false, hardwareTested: false, modeLabel: SIMULATION_MODE_LABEL, device: next, config: validated };
}

export function createSimulationAdapter(options = {}) {
  let device = createSimulationDevice(options);
  return {
    get snapshot() { return snapshotSimulation(device); },
    get modeLabel() { return SIMULATION_MODE_LABEL; },
    setScenario(scenario) { device = setSimulationScenario(device, scenario); return snapshotSimulation(device); },
    readConfig() { return readSimulationConfig(device); },
    applyConfig(config, optionsForApply) {
      const result = applySimulationConfig(device, config, optionsForApply);
      if (result.ok) device = result.device;
      return result;
    },
    disconnect() { return this.setScenario('disconnected'); },
    reconnect() { return this.setScenario('connected'); }
  };
}

export function listSimulationScenarios() {
  return SIMULATION_SCENARIOS.map((id) => ({ id, state: SCENARIO_DEFINITIONS[id].state, message: SCENARIO_DEFINITIONS[id].message }));
}

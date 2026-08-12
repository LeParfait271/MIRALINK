import { ProtocolError } from './protocol.js';

export const CAPABILITY_STATES = Object.freeze(['supported', 'partial', 'unavailable', 'not-tested']);
export const CONNECTION_STATES = Object.freeze(['connected', 'connecting', 'disconnected', 'error', 'not-tested']);
export const TRANSPORTS = Object.freeze(['webhid', 'usb', 'radio', 'none', 'unknown']);
export const SIMULATION_MODE_LABEL = 'MODE SIMULATION';
export const DEFAULT_METRIC_HISTORY_LIMIT = 60;

const METRIC_LIMITS = Object.freeze({
  usbLatencyMs: Object.freeze({ min: 0, max: 10000, unit: 'ms' }),
  radioLatencyMs: Object.freeze({ min: 0, max: 10000, unit: 'ms' }),
  packetLossPercent: Object.freeze({ min: 0, max: 100, unit: '%' }),
  batteryPercent: Object.freeze({ min: 0, max: 100, unit: '%' }),
  temperatureC: Object.freeze({ min: -40, max: 125, unit: '°C' })
});

function text(value, field, maxLength = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) throw new ProtocolError(`${field} is invalid`, 'invalid_live_status');
  return value.trim();
}

function sourceValue(source) {
  if (!['hardware', 'simulation', 'local', 'unknown'].includes(source)) throw new ProtocolError('Live status source is invalid', 'invalid_live_status');
  return source;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function createCapabilityState({ state = 'not-tested', value = null, source = 'unknown', reason = '', sampledAt = null } = {}) {
  if (!CAPABILITY_STATES.includes(state)) throw new ProtocolError('Capability state is invalid', 'invalid_capability_state');
  const normalizedSource = sourceValue(source);
  if (reason !== '' && typeof reason !== 'string') throw new ProtocolError('Capability reason is invalid', 'invalid_capability_state');
  if (sampledAt !== null && typeof sampledAt !== 'string') throw new ProtocolError('Capability timestamp is invalid', 'invalid_capability_state');
  return {
    state,
    value: clone(value),
    source: normalizedSource,
    reason: reason.trim(),
    sampledAt,
    hardwareTested: normalizedSource === 'hardware' && state !== 'not-tested',
    testStatus: normalizedSource === 'simulation' ? 'not-tested' : (state === 'not-tested' ? 'not-tested' : 'available')
  };
}

export function createMetric(name, { value = null, state = 'not-tested', source = 'unknown', reason = '', sampledAt = null } = {}) {
  if (!Object.prototype.hasOwnProperty.call(METRIC_LIMITS, name)) throw new ProtocolError(`Metric is unsupported: ${name}`, 'invalid_metric');
  const limits = METRIC_LIMITS[name];
  if (value !== null && (!Number.isFinite(value) || value < limits.min || value > limits.max)) throw new ProtocolError(`${name} must be between ${limits.min} and ${limits.max}`, 'invalid_metric');
  return { ...createCapabilityState({ state, value, source, reason, sampledAt }), name, unit: limits.unit };
}

function createDeviceCapability(name, input, source) {
  if (typeof input === 'string') return createCapabilityState({ state: input, source });
  return createCapabilityState({ ...(input || {}), source: input?.source || source });
}

export function createLiveStatusSnapshot({ source = 'unknown', bridgeState = 'not-tested', controllerState = 'not-tested', metrics = {}, capabilities = {}, scenario = null, sampledAt = null } = {}) {
  const normalizedSource = sourceValue(source);
  if (!CONNECTION_STATES.includes(bridgeState) || !CONNECTION_STATES.includes(controllerState)) throw new ProtocolError('Connection state is invalid', 'invalid_live_status');
  if (scenario !== null && typeof scenario !== 'string') throw new ProtocolError('Live status scenario is invalid', 'invalid_live_status');
  if (sampledAt !== null && typeof sampledAt !== 'string') throw new ProtocolError('Live status timestamp is invalid', 'invalid_live_status');
  const metricNames = Object.keys(METRIC_LIMITS);
  const normalizedMetrics = Object.fromEntries(metricNames.map((name) => [name, createMetric(name, { ...(metrics[name] || {}), source: metrics[name]?.source || normalizedSource, sampledAt: metrics[name]?.sampledAt || sampledAt })]));
  const normalizedCapabilities = {
    audio: createDeviceCapability('audio', capabilities.audio, normalizedSource),
    microphone: createDeviceCapability('microphone', capabilities.microphone, normalizedSource),
    vibration: createDeviceCapability('vibration', capabilities.vibration, normalizedSource),
    flash: createDeviceCapability('flash', capabilities.flash, normalizedSource)
  };
  return {
    mode: normalizedSource,
    modeLabel: normalizedSource === 'simulation' ? SIMULATION_MODE_LABEL : null,
    source: normalizedSource,
    hardwareTested: normalizedSource === 'hardware',
    testStatus: normalizedSource === 'simulation' ? 'not-tested' : (normalizedSource === 'hardware' ? 'available' : 'not-tested'),
    bridgeState,
    controllerState,
    scenario,
    sampledAt,
    metrics: normalizedMetrics,
    capabilities: normalizedCapabilities
  };
}

export function appendMetricSnapshot(history, snapshot, limit = DEFAULT_METRIC_HISTORY_LIMIT) {
  if (!Array.isArray(history)) throw new ProtocolError('Metric history must be an array', 'invalid_metric_history');
  if (!Number.isInteger(limit) || limit < 1 || limit > 600) throw new ProtocolError('Metric history limit is invalid', 'invalid_metric_history');
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.metrics) throw new ProtocolError('Metric snapshot is invalid', 'invalid_metric_history');
  return [...history, clone(snapshot)].slice(-limit);
}

export function summarizeMetricHistory(history, metricName) {
  if (!Array.isArray(history)) throw new ProtocolError('Metric history must be an array', 'invalid_metric_history');
  if (!Object.prototype.hasOwnProperty.call(METRIC_LIMITS, metricName)) throw new ProtocolError(`Metric is unsupported: ${metricName}`, 'invalid_metric');
  const values = history.map((snapshot) => snapshot?.metrics?.[metricName]?.value).filter((value) => Number.isFinite(value));
  if (!values.length) return { metric: metricName, count: 0, min: null, max: null, average: null, last: null, source: 'local', hardwareTested: false, testStatus: 'not-tested' };
  return {
    metric: metricName,
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    last: values[values.length - 1],
    source: 'local',
    hardwareTested: history.some((snapshot) => snapshot?.source === 'hardware'),
    testStatus: history.some((snapshot) => snapshot?.source === 'hardware') ? 'available' : 'not-tested'
  };
}

function normalizeNode(node, fallbackType) {
  if (!node || typeof node !== 'object') throw new ProtocolError('Connection node is invalid', 'invalid_connection_map');
  const id = text(node.id, 'Connection node id', 80);
  const type = node.type || fallbackType;
  if (!['computer', 'bridge', 'controller'].includes(type)) throw new ProtocolError('Connection node type is invalid', 'invalid_connection_map');
  if (!CONNECTION_STATES.includes(node.state || 'not-tested')) throw new ProtocolError('Connection node state is invalid', 'invalid_connection_map');
  const transport = node.transport || 'unknown';
  if (!TRANSPORTS.includes(transport)) throw new ProtocolError('Connection transport is invalid', 'invalid_connection_map');
  return {
    id,
    type,
    label: typeof node.label === 'string' && node.label.trim() ? node.label.trim().slice(0, 120) : id,
    state: node.state || 'not-tested',
    transport,
    source: sourceValue(node.source || 'unknown'),
    error: typeof node.error === 'string' ? node.error.trim().slice(0, 240) : '',
    lastEventAt: typeof node.lastEventAt === 'string' ? node.lastEventAt : null
  };
}

function link(from, to, transport, state, source) {
  return { from, to, transport, state, source: sourceValue(source), hardwareTested: source === 'hardware' && state === 'connected' };
}

export function createConnectionMap({ source = 'unknown', computer = {}, bridge = null, controllers = [] } = {}) {
  const normalizedSource = sourceValue(source);
  if (!Array.isArray(controllers)) throw new ProtocolError('Controller nodes must be an array', 'invalid_connection_map');
  const computerNode = normalizeNode({ id: 'computer', label: 'This computer', type: 'computer', state: computer.state || 'connected', transport: computer.transport || 'webhid', source: computer.source || normalizedSource, error: computer.error, lastEventAt: computer.lastEventAt }, 'computer');
  const nodes = [computerNode];
  const links = [];
  if (bridge) {
    const bridgeNode = normalizeNode({ ...bridge, type: 'bridge', source: bridge.source || normalizedSource }, 'bridge');
    nodes.push(bridgeNode);
    links.push(link(computerNode.id, bridgeNode.id, bridgeNode.transport, bridgeNode.state, bridgeNode.source));
    for (const controller of controllers) {
      const controllerNode = normalizeNode({ ...controller, type: 'controller', source: controller.source || normalizedSource }, 'controller');
      nodes.push(controllerNode);
      links.push(link(bridgeNode.id, controllerNode.id, controllerNode.transport || 'radio', controllerNode.state, controllerNode.source));
    }
  }
  const isSimulation = normalizedSource === 'simulation' || nodes.some((node) => node.source === 'simulation');
  return {
    mode: isSimulation ? 'simulation' : normalizedSource,
    modeLabel: isSimulation ? SIMULATION_MODE_LABEL : null,
    source: normalizedSource,
    hardwareTested: !isSimulation && normalizedSource === 'hardware',
    testStatus: isSimulation || normalizedSource !== 'hardware' ? 'not-tested' : 'available',
    nodes,
    links
  };
}

export function updateConnectionNode(map, nodeId, patch) {
  if (!map || !Array.isArray(map.nodes)) throw new ProtocolError('Connection map is invalid', 'invalid_connection_map');
  const index = map.nodes.findIndex((node) => node.id === nodeId);
  if (index < 0) throw new ProtocolError('Connection node was not found', 'connection_node_not_found');
  const updated = normalizeNode({ ...map.nodes[index], ...patch }, map.nodes[index].type);
  const nodes = map.nodes.slice();
  nodes[index] = updated;
  const links = map.links.map((item) => {
    if (item.from !== nodeId && item.to !== nodeId) return item;
    return { ...item, state: updated.state, source: updated.source, hardwareTested: updated.source === 'hardware' && updated.state === 'connected' };
  });
  const isSimulation = map.mode === 'simulation' || nodes.some((node) => node.source === 'simulation');
  return { ...map, mode: isSimulation ? 'simulation' : map.mode, modeLabel: isSimulation ? SIMULATION_MODE_LABEL : map.modeLabel, hardwareTested: !isSimulation && nodes.some((node) => node.source === 'hardware' && node.state === 'connected'), testStatus: isSimulation ? 'not-tested' : map.testStatus, nodes, links };
}

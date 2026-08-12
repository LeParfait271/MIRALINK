import { ProtocolError } from './protocol.js';

export const HEALTH_SOURCES = Object.freeze(['hardware', 'simulation', 'local', 'unknown']);
export const HEALTH_STATUS = Object.freeze(['available', 'attention', 'unavailable', 'not-tested']);

function sourceValue(source) {
  if (!HEALTH_SOURCES.includes(source)) throw new ProtocolError('Health source is invalid', 'invalid_health_analysis');
  return source;
}

function finiteValues(values, min, max, field) {
  if (values === undefined) return [];
  if (!Array.isArray(values)) throw new ProtocolError(`${field} must be an array`, 'invalid_health_analysis');
  if (values.some((value) => !Number.isFinite(value) || value < min || value > max)) throw new ProtocolError(`${field} contains an out-of-range value`, 'invalid_health_analysis');
  return values.map(Number);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.ceil(fraction * ordered.length) - 1));
  return ordered[index];
}

function summarize(values, unit) {
  if (!values.length) return { count: 0, min: null, max: null, average: null, p95: null, unit };
  return { count: values.length, min: Math.min(...values), max: Math.max(...values), average: average(values), p95: percentile(values, 0.95), unit };
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function statusFor(source, hardwareTested, hasData) {
  if (!hasData) return 'unavailable';
  return source === 'hardware' && hardwareTested === true ? 'available' : 'not-tested';
}

export function benchmarkConnection({ usbLatencyMs = [], radioLatencyMs = [], packetLossPercent = [], source = 'local', hardwareTested = false } = {}) {
  const normalizedSource = sourceValue(source);
  const usb = finiteValues(usbLatencyMs, 0, 10000, 'usbLatencyMs');
  const radio = finiteValues(radioLatencyMs, 0, 10000, 'radioLatencyMs');
  const packetLoss = finiteValues(packetLossPercent, 0, 100, 'packetLossPercent');
  const components = [];
  if (usb.length) components.push({ name: 'usbLatencyMs', weight: 0.35, score: clamp(100 - average(usb) * 5, 0, 100), summary: summarize(usb, 'ms') });
  if (radio.length) components.push({ name: 'radioLatencyMs', weight: 0.45, score: clamp(100 - average(radio), 0, 100), summary: summarize(radio, 'ms') });
  if (packetLoss.length) components.push({ name: 'packetLossPercent', weight: 0.2, score: clamp(100 - average(packetLoss), 0, 100), summary: summarize(packetLoss, '%') });
  const weightTotal = components.reduce((sum, component) => sum + component.weight, 0);
  const hasData = components.length > 0;
  const score = hasData ? round(components.reduce((sum, component) => sum + component.score * component.weight, 0) / weightTotal) : null;
  const isHardware = normalizedSource === 'hardware' && hardwareTested === true;
  return {
    source: normalizedSource,
    modeLabel: normalizedSource === 'simulation' ? 'MODE SIMULATION' : null,
    hardwareTested: isHardware,
    testStatus: statusFor(normalizedSource, hardwareTested, hasData),
    status: hasData ? 'available' : 'unavailable',
    score,
    scoreScale: '0-100',
    scoreMethod: 'Weighted local measurements: USB 35%, radio 45%, packet loss 20%; missing components are excluded and weights are normalized.',
    components
  };
}

function alertRecord(kind, severity, message, evidence, source, hardwareTested) {
  const isHardware = source === 'hardware' && hardwareTested === true;
  return { kind, severity, message, evidence, source, hardwareTested: isHardware, testStatus: isHardware ? 'available' : 'not-tested' };
}

export function detectLocalAnomalies({ batterySamples = [], controllerAnalysis = null, source = 'local', hardwareTested = false, batteryLowThreshold = 10, batteryDropThreshold = 20 } = {}) {
  const normalizedSource = sourceValue(source);
  if (!Number.isFinite(batteryLowThreshold) || batteryLowThreshold < 0 || batteryLowThreshold > 100) throw new ProtocolError('Battery low threshold is invalid', 'invalid_health_analysis');
  if (!Number.isFinite(batteryDropThreshold) || batteryDropThreshold < 0 || batteryDropThreshold > 100) throw new ProtocolError('Battery drop threshold is invalid', 'invalid_health_analysis');
  const battery = finiteValues(batterySamples, 0, 100, 'batterySamples');
  const alerts = [];
  if (battery.length) {
    const last = battery.at(-1);
    if (last < batteryLowThreshold) alerts.push(alertRecord('battery-low', 'warning', 'Battery is below the configured local threshold.', { lastPercent: last, thresholdPercent: batteryLowThreshold }, normalizedSource, hardwareTested));
    if (battery.length >= 2) {
      const drop = battery[0] - last;
      if (drop >= batteryDropThreshold) alerts.push(alertRecord('battery-abnormal-drop', 'critical', 'Battery level dropped faster than the configured local threshold.', { firstPercent: battery[0], lastPercent: last, dropPercent: drop, thresholdPercent: batteryDropThreshold }, normalizedSource, hardwareTested));
    }
  }
  const sticks = controllerAnalysis?.sticks;
  for (const side of ['left', 'right']) {
    if (sticks?.[side]?.drift?.detected === true) alerts.push(alertRecord('stick-drift', 'warning', `${side} stick drift was detected by the local Controller Lab analysis.`, { side, offset: sticks[side].center?.offset ?? null, threshold: sticks[side].drift?.threshold ?? null }, normalizedSource, hardwareTested));
  }
  const hasEvidence = battery.length > 0 || Boolean(sticks?.left || sticks?.right);
  const isHardware = normalizedSource === 'hardware' && hardwareTested === true;
  return {
    source: normalizedSource,
    modeLabel: normalizedSource === 'simulation' ? 'MODE SIMULATION' : null,
    hardwareTested: isHardware,
    testStatus: hasEvidence && isHardware ? 'available' : 'not-tested',
    status: hasEvidence ? (alerts.length ? 'attention' : 'available') : 'unavailable',
    alerts
  };
}

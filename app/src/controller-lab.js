import { ProtocolError } from './protocol.js';

export const LAB_SAMPLE_STATUS = Object.freeze({ available: 'available', notTested: 'not-tested', invalid: 'invalid' });
const DEVICE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/i;

function numberInRange(value, min, max, field) {
  if (!Number.isFinite(value) || value < min || value > max) throw new ProtocolError(`${field} must be between ${min} and ${max}`, 'invalid_input_sample');
  return Number(value);
}

function normalizeStick(value, field) {
  if (!value || typeof value !== 'object') throw new ProtocolError(`${field} is missing`, 'invalid_input_sample');
  return Object.freeze({
    x: numberInRange(value.x, -1, 1, `${field}.x`),
    y: numberInRange(value.y, -1, 1, `${field}.y`)
  });
}

export function normalizeInputSample(sample) {
  if (!sample || typeof sample !== 'object') throw new ProtocolError('Input sample is invalid', 'invalid_input_sample');
  if (sample.timestamp !== undefined && sample.timestamp !== null && typeof sample.timestamp !== 'string') throw new ProtocolError('Input sample timestamp is invalid', 'invalid_input_sample');
  return Object.freeze({
    timestamp: sample.timestamp || null,
    leftStick: normalizeStick(sample.leftStick, 'leftStick'),
    rightStick: normalizeStick(sample.rightStick, 'rightStick'),
    leftTrigger: numberInRange(sample.leftTrigger, 0, 1, 'leftTrigger'),
    rightTrigger: numberInRange(sample.rightTrigger, 0, 1, 'rightTrigger')
  });
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function rangeStats(values) {
  if (!values.length) return { min: null, max: null, mean: null, span: null, positive: null, negative: null };
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    min,
    max,
    mean: mean(values),
    span: max - min,
    positive: Math.max(0, max),
    negative: Math.max(0, -min)
  };
}

function asymmetryPercent(positive, negative) {
  const denominator = Math.max(positive, negative);
  return denominator === 0 ? 0 : Math.abs(positive - negative) / denominator * 100;
}

function emptyStickAnalysis(deadzone) {
  return {
    status: LAB_SAMPLE_STATUS.notTested,
    source: 'local-samples',
    hardwareTested: false,
    testStatus: 'not-tested',
    sampleCount: 0,
    center: { x: null, y: null, offset: null },
    drift: { detected: false, threshold: null },
    deadzone: { radius: deadzone, samplesInside: 0, coveragePercent: null, source: 'configured' },
    amplitude: { x: rangeStats([]), y: rangeStats([]), maxRadius: null },
    circularity: { ratio: null, deviationPercent: null },
    asymmetry: { xPercent: null, yPercent: null }
  };
}

export function analyzeStick(samples, { deadzone = 0.08, driftThreshold = 0.1 } = {}) {
  numberInRange(deadzone, 0, 1, 'deadzone');
  numberInRange(driftThreshold, 0, 1, 'driftThreshold');
  if (!Array.isArray(samples)) throw new ProtocolError('Stick samples must be an array', 'invalid_input_sample');
  const values = samples.map((sample) => normalizeStick(sample, 'stick'));
  if (!values.length) return emptyStickAnalysis(deadzone);

  const xs = values.map(({ x }) => x);
  const ys = values.map(({ y }) => y);
  const centerX = mean(xs);
  const centerY = mean(ys);
  const centerOffset = Math.hypot(centerX, centerY);
  const radii = values.map(({ x, y }) => Math.hypot(x, y));
  const maxRadius = Math.max(...radii);
  const circularitySectorCount = 8;
  const circularitySectorWidth = Math.PI * 2 / circularitySectorCount;
  const circularitySectorRadii = Array(circularitySectorCount).fill(null);
  values.forEach(({ x, y }, index) => {
    const radius = radii[index];
    if (radius < 0.2) return;
    const angle = (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2);
    const sector = Math.floor(((angle + circularitySectorWidth / 2) % (Math.PI * 2)) / circularitySectorWidth);
    circularitySectorRadii[sector] = Math.max(circularitySectorRadii[sector] ?? 0, radius);
  });
  const circularityCovered = circularitySectorRadii.every((radius) => radius !== null);
  const minCircularRadius = circularityCovered ? Math.min(...circularitySectorRadii) : null;
  const maxCircularRadius = circularityCovered ? Math.max(...circularitySectorRadii) : null;
  const circularityRatio = maxCircularRadius ? minCircularRadius / maxCircularRadius : null;
  const xRange = rangeStats(xs);
  const yRange = rangeStats(ys);
  const samplesInsideDeadzone = radii.filter((radius) => radius <= deadzone).length;

  return {
    status: LAB_SAMPLE_STATUS.available,
    source: 'local-samples',
    hardwareTested: false,
    testStatus: 'not-tested',
    sampleCount: values.length,
    center: { x: centerX, y: centerY, offset: centerOffset },
    drift: { detected: centerOffset > driftThreshold, threshold: driftThreshold },
    deadzone: { radius: deadzone, samplesInside: samplesInsideDeadzone, coveragePercent: samplesInsideDeadzone / values.length * 100, source: 'configured' },
    amplitude: { x: xRange, y: yRange, maxRadius },
    circularity: { ratio: circularityRatio, deviationPercent: circularityRatio === null ? null : (1 - circularityRatio) * 100 },
    asymmetry: { xPercent: asymmetryPercent(xRange.positive, xRange.negative), yPercent: asymmetryPercent(yRange.positive, yRange.negative) }
  };
}

export function analyzeTrigger(values) {
  if (!Array.isArray(values)) throw new ProtocolError('Trigger samples must be an array', 'invalid_input_sample');
  const normalized = values.map((value) => numberInRange(value, 0, 1, 'trigger'));
  if (!normalized.length) return { status: LAB_SAMPLE_STATUS.notTested, source: 'local-samples', hardwareTested: false, testStatus: 'not-tested', sampleCount: 0, min: null, max: null, mean: null, amplitude: null };
  const stats = rangeStats(normalized);
  return { status: LAB_SAMPLE_STATUS.available, source: 'local-samples', hardwareTested: false, testStatus: 'not-tested', sampleCount: normalized.length, min: stats.min, max: stats.max, mean: stats.mean, amplitude: stats.span };
}

export function analyzeControllerInputs(samples, options = {}) {
  if (!Array.isArray(samples)) throw new ProtocolError('Controller samples must be an array', 'invalid_input_sample');
  const normalized = samples.map(normalizeInputSample);
  return {
    status: normalized.length ? LAB_SAMPLE_STATUS.available : LAB_SAMPLE_STATUS.notTested,
    source: 'local-samples',
    hardwareTested: false,
    testStatus: 'not-tested',
    sampleCount: normalized.length,
    sticks: {
      left: analyzeStick(normalized.map(({ leftStick }) => leftStick), options),
      right: analyzeStick(normalized.map(({ rightStick }) => rightStick), options)
    },
    triggers: {
      left: analyzeTrigger(normalized.map(({ leftTrigger }) => leftTrigger)),
      right: analyzeTrigger(normalized.map(({ rightTrigger }) => rightTrigger))
    }
  };
}

function numericDelta(before, after) {
  return Number.isFinite(before) && Number.isFinite(after) ? after - before : null;
}

export function compareControllerAnalyses(before, after) {
  if (!before || !after) throw new ProtocolError('Two controller analyses are required', 'invalid_analysis');
  const delta = (path) => numericDelta(path[0], path[1]);
  return {
    source: 'local-samples',
    hardwareTested: false,
    testStatus: 'not-tested',
    sampleCount: { before: before.sampleCount ?? 0, after: after.sampleCount ?? 0 },
    leftStick: {
      driftOffset: delta([before.sticks?.left?.center?.offset, after.sticks?.left?.center?.offset]),
      maxRadius: delta([before.sticks?.left?.amplitude?.maxRadius, after.sticks?.left?.amplitude?.maxRadius]),
      circularityRatio: delta([before.sticks?.left?.circularity?.ratio, after.sticks?.left?.circularity?.ratio]),
      asymmetryPercent: delta([before.sticks?.left?.asymmetry?.xPercent, after.sticks?.left?.asymmetry?.xPercent])
    },
    rightStick: {
      driftOffset: delta([before.sticks?.right?.center?.offset, after.sticks?.right?.center?.offset]),
      maxRadius: delta([before.sticks?.right?.amplitude?.maxRadius, after.sticks?.right?.amplitude?.maxRadius]),
      circularityRatio: delta([before.sticks?.right?.circularity?.ratio, after.sticks?.right?.circularity?.ratio]),
      asymmetryPercent: delta([before.sticks?.right?.asymmetry?.xPercent, after.sticks?.right?.asymmetry?.xPercent])
    },
    triggers: {
      leftAmplitude: delta([before.triggers?.left?.amplitude, after.triggers?.left?.amplitude]),
      rightAmplitude: delta([before.triggers?.right?.amplitude, after.triggers?.right?.amplitude])
    }
  };
}

export function createCalibrationRevision({ id, deviceId = 'unassigned', analysis, source = 'local-draft', createdAt = new Date().toISOString() }) {
  if (typeof id !== 'string' || !DEVICE_ID_PATTERN.test(id)) throw new ProtocolError('Calibration revision id is invalid', 'invalid_calibration_revision');
  if (typeof deviceId !== 'string' || !deviceId.trim() || deviceId.length > 80) throw new ProtocolError('Calibration device id is invalid', 'invalid_calibration_revision');
  if (!analysis || typeof analysis !== 'object') throw new ProtocolError('Calibration analysis is missing', 'invalid_calibration_revision');
  if (typeof source !== 'string' || !source.trim() || source.length > 80) throw new ProtocolError('Calibration source is invalid', 'invalid_calibration_revision');
  if (typeof createdAt !== 'string' || !createdAt.trim()) throw new ProtocolError('Calibration date is invalid', 'invalid_calibration_revision');
  return {
    id,
    deviceId: deviceId.trim(),
    source: source.trim(),
    createdAt,
    analysis: JSON.parse(JSON.stringify(analysis)),
    hardwareTested: false,
    testStatus: 'not-tested'
  };
}

export function appendCalibrationRevision(history, revision, limit = 20) {
  if (!Array.isArray(history)) throw new ProtocolError('Calibration history must be an array', 'invalid_calibration_history');
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new ProtocolError('Calibration history limit is invalid', 'invalid_calibration_history');
  const value = createCalibrationRevision(revision);
  return [...history.filter((entry) => entry?.id !== value.id), value].slice(-limit);
}

export function prepareCalibrationRestore(history, revisionId) {
  if (!Array.isArray(history)) throw new ProtocolError('Calibration history must be an array', 'invalid_calibration_history');
  const revision = history.find((entry) => entry?.id === revisionId);
  if (!revision) return { ok: false, reason: 'revision_not_found', requiresConfirmation: false };
  return { ok: true, reason: 'revision_ready', requiresConfirmation: true, persisted: false, hardwareTested: false, revision: createCalibrationRevision(revision) };
}

export function commitCalibrationRestore(preview, { confirmed = false } = {}) {
  if (!preview?.ok || !preview.revision) throw new ProtocolError('A valid calibration restore preview is required', 'invalid_calibration_preview');
  if (!confirmed) throw new ProtocolError('Calibration restore requires confirmation', 'confirmation_required');
  return { ...preview, applied: true, persisted: false, calibration: JSON.parse(JSON.stringify(preview.revision.analysis)) };
}

import { normalizeInputSample } from './controller-lab.js';
import { ProtocolError } from './protocol.js';

export const SESSION_FORMAT = 'miralink-local-session';
export const SESSION_VERSION = 1;
export const SESSION_SOURCES = Object.freeze(['hardware', 'simulation', 'local', 'unknown']);
export const DEFAULT_SESSION_SAMPLE_LIMIT = 600;
export const DEFAULT_SESSION_EVENT_LIMIT = 120;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sourceValue(source) {
  if (!SESSION_SOURCES.includes(source)) throw new ProtocolError('Session source is invalid', 'invalid_session');
  return source;
}

function text(value, field, maxLength = 240) {
  if (typeof value !== 'string' || value.trim().length > maxLength) throw new ProtocolError(`${field} is invalid`, 'invalid_session');
  return value.trim();
}

function timestamp(value, field) {
  if (value === null || value === undefined) return new Date().toISOString();
  const normalized = text(value, field, 64);
  if (Number.isNaN(Date.parse(normalized))) throw new ProtocolError(`${field} is not an ISO date`, 'invalid_session');
  return normalized;
}

function redactText(value) {
  return String(value)
    .replace(/(serial|deviceId|address|mac)\s*[:=]\s*[^\s,;]+/gi, '$1:[redacted]')
    .replace(/\b[0-9a-f]{2}(?::[0-9a-f]{2}){5}\b/gi, '[redacted-address]')
    .replace(/\b[0-9a-f]{12,}\b/g, '[redacted-id]');
}

function validateLimits(maxSamples, maxEvents) {
  if (!Number.isInteger(maxSamples) || maxSamples < 1 || maxSamples > 3600) throw new ProtocolError('Session sample limit is invalid', 'invalid_session');
  if (!Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 600) throw new ProtocolError('Session event limit is invalid', 'invalid_session');
}

function sessionStatus(session) {
  const source = sourceValue(session.source);
  const hardwareTested = source === 'hardware' && session.hardwareTested === true;
  return {
    modeLabel: source === 'simulation' ? 'MODE SIMULATION' : null,
    hardwareTested,
    testStatus: hardwareTested ? 'available' : 'not-tested'
  };
}

export function createLocalSession({ id, source = 'local', scenario = null, maxSamples = DEFAULT_SESSION_SAMPLE_LIMIT, maxEvents = DEFAULT_SESSION_EVENT_LIMIT, startedAt = null, hardwareTested = false } = {}) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id)) throw new ProtocolError('Session id is invalid', 'invalid_session');
  validateLimits(maxSamples, maxEvents);
  const normalizedSource = sourceValue(source);
  if (scenario !== null && (typeof scenario !== 'string' || scenario.length > 80)) throw new ProtocolError('Session scenario is invalid', 'invalid_session');
  const status = sessionStatus({ source: normalizedSource, hardwareTested });
  return {
    format: SESSION_FORMAT,
    formatVersion: SESSION_VERSION,
    id,
    source: normalizedSource,
    scenario,
    modeLabel: status.modeLabel,
    hardwareTested: status.hardwareTested,
    testStatus: status.testStatus,
    startedAt: timestamp(startedAt, 'Session start'),
    endedAt: null,
    active: true,
    maxSamples,
    maxEvents,
    samples: [],
    events: []
  };
}

function assertSession(session) {
  if (!session || session.format !== SESSION_FORMAT || session.formatVersion !== SESSION_VERSION || !Array.isArray(session.samples) || !Array.isArray(session.events)) throw new ProtocolError('Session is invalid', 'invalid_session');
  validateLimits(session.maxSamples, session.maxEvents);
  return session;
}

export function appendSessionSample(session, sample, { at = null } = {}) {
  const current = assertSession(session);
  if (!current.active) throw new ProtocolError('Session is already stopped', 'session_stopped');
  const normalized = normalizeInputSample(sample);
  const samples = [...current.samples, { at: timestamp(at, 'Sample date'), input: clone(normalized) }].slice(-current.maxSamples);
  return { ...current, samples };
}

export function appendSessionEvent(session, { type, message = '', at = null } = {}) {
  const current = assertSession(session);
  if (typeof type !== 'string' || !/^[a-z0-9_-]{1,40}$/i.test(type)) throw new ProtocolError('Session event type is invalid', 'invalid_session');
  const event = { at: timestamp(at, 'Event date'), type, message: redactText(text(message, 'Session event message')) };
  return { ...current, events: [...current.events, event].slice(-current.maxEvents) };
}

export function stopLocalSession(session, { endedAt = null } = {}) {
  const current = assertSession(session);
  return { ...current, active: false, endedAt: current.endedAt || timestamp(endedAt, 'Session end') };
}

export function summarizeSession(session) {
  const current = assertSession(session);
  const end = current.endedAt || current.samples.at(-1)?.at || current.startedAt;
  const durationMs = Math.max(0, Date.parse(end) - Date.parse(current.startedAt));
  const status = sessionStatus(current);
  return {
    format: SESSION_FORMAT,
    formatVersion: SESSION_VERSION,
    id: current.id,
    source: current.source,
    scenario: current.scenario,
    modeLabel: status.modeLabel,
    hardwareTested: status.hardwareTested,
    testStatus: status.testStatus,
    startedAt: current.startedAt,
    endedAt: current.endedAt,
    active: current.active,
    durationMs,
    sampleCount: current.samples.length,
    eventCount: current.events.length,
    retention: { maxSamples: current.maxSamples, maxEvents: current.maxEvents, persistentByDefault: false }
  };
}

export function exportLocalSession(session, { includeSamples = false, confirmed = false } = {}) {
  const current = assertSession(session);
  if (!confirmed) throw new ProtocolError('Session export requires confirmation', 'confirmation_required');
  const summary = summarizeSession(current);
  return {
    format: SESSION_FORMAT,
    formatVersion: SESSION_VERSION,
    product: 'MiraLink',
    source: current.source,
    scenario: current.scenario,
    modeLabel: summary.modeLabel,
    hardwareTested: summary.hardwareTested,
    testStatus: summary.testStatus,
    redaction: 'identifiers-omitted',
    summary,
    events: current.events.map((event) => ({ ...event, message: redactText(event.message) })),
    samples: includeSamples ? clone(current.samples) : [],
    samplesIncluded: includeSamples
  };
}

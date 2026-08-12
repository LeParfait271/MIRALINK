import { ProtocolError } from './protocol.js';
import { CAPABILITY_STATES } from './live-status.js';

export const COMPATIBILITY_FORMAT = 'miralink-compatibility';
export const COMPATIBILITY_VERSION = 1;

function text(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) throw new ProtocolError(`${field} is invalid`, 'invalid_compatibility');
  return value.trim();
}

function normalizeState(state) {
  if (!CAPABILITY_STATES.includes(state)) throw new ProtocolError('Compatibility state is invalid', 'invalid_compatibility');
  return state;
}

function keyOf({ firmwareVersion, controllerModel, adapterVersion }) {
  return `${firmwareVersion}\u0000${controllerModel}\u0000${adapterVersion}`;
}

export function createCompatibilityEntry({ firmwareVersion, controllerModel, adapterVersion = 'local', state = 'not-tested', notes = '', testedAt = null } = {}) {
  const entry = {
    firmwareVersion: text(firmwareVersion, 'Firmware version', 40),
    controllerModel: text(controllerModel, 'Controller model', 80),
    adapterVersion: text(adapterVersion, 'Adapter version', 40),
    state: normalizeState(state),
    notes: typeof notes === 'string' ? notes.trim().slice(0, 240) : '',
    testedAt
  };
  if (testedAt !== null && typeof testedAt !== 'string') throw new ProtocolError('Compatibility test date is invalid', 'invalid_compatibility');
  return Object.freeze(entry);
}

export function createCompatibilityMatrix(entries = []) {
  if (!Array.isArray(entries)) throw new ProtocolError('Compatibility entries must be an array', 'invalid_compatibility');
  const normalized = entries.map((entry) => createCompatibilityEntry(entry));
  const keys = new Set();
  for (const entry of normalized) {
    const key = keyOf(entry);
    if (keys.has(key)) throw new ProtocolError('Compatibility entries must be unique', 'invalid_compatibility');
    keys.add(key);
  }
  return Object.freeze({ format: COMPATIBILITY_FORMAT, formatVersion: COMPATIBILITY_VERSION, entries: Object.freeze(normalized) });
}

export function resolveCompatibility(matrix, { firmwareVersion, controllerModel, adapterVersion = 'local' } = {}) {
  const value = createCompatibilityMatrix(matrix?.entries || matrix || []);
  const requested = createCompatibilityEntry({ firmwareVersion, controllerModel, adapterVersion });
  const match = value.entries.find((entry) => keyOf(entry) === keyOf(requested));
  if (!match) return Object.freeze({ ...requested, state: 'not-tested', notes: 'No local compatibility record exists.', matched: false });
  return Object.freeze({ ...match, matched: true });
}

export function serializeCompatibilityMatrix(matrix) {
  const value = createCompatibilityMatrix(matrix?.entries || matrix || []);
  return { format: COMPATIBILITY_FORMAT, formatVersion: COMPATIBILITY_VERSION, entries: value.entries.map((entry) => ({ ...entry })) };
}

export function parseCompatibilityMatrix(document) {
  if (!document || document.format !== COMPATIBILITY_FORMAT || document.formatVersion !== COMPATIBILITY_VERSION || !Array.isArray(document.entries)) throw new ProtocolError('Unsupported MiraLink compatibility file', 'invalid_compatibility_file');
  return createCompatibilityMatrix(document.entries);
}

import { ProtocolError } from './protocol.js';
import { normalizeProfileTarget, profileMatchesTarget } from './profiles.js';

export const INPUT_MAPPING_FORMAT = 'miralink-input-mapping';
export const INPUT_MAPPING_VERSION = 1;
export const INPUT_BUTTONS = Object.freeze([
  'cross', 'circle', 'square', 'triangle',
  'l1', 'r1', 'l2', 'r2', 'l3', 'r3',
  'dpadUp', 'dpadDown', 'dpadLeft', 'dpadRight', 'create', 'options', 'ps', 'touchpad'
]);

const INPUT_BUTTON_SET = new Set(INPUT_BUTTONS);
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function text(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) throw new ProtocolError(`${field} is invalid`, 'invalid_input_mapping');
  return value.trim();
}

export function createDefaultMapping() {
  return Object.fromEntries(INPUT_BUTTONS.map((button) => [button, button]));
}

export function normalizeMapping(mapping = createDefaultMapping()) {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw new ProtocolError('Input mapping must be an object', 'invalid_input_mapping');
  const unknown = Object.keys(mapping).filter((key) => !INPUT_BUTTON_SET.has(key));
  if (unknown.length) throw new ProtocolError(`Unknown input mapping key: ${unknown[0]}`, 'invalid_input_mapping');
  const normalized = {};
  for (const button of INPUT_BUTTONS) {
    const target = mapping[button] ?? button;
    if (typeof target !== 'string' || !INPUT_BUTTON_SET.has(target)) throw new ProtocolError(`Input mapping target for ${button} is invalid`, 'invalid_input_mapping');
    normalized[button] = target;
  }
  return normalized;
}

export function createInputCommandProfile({ id, name, description = '', target = { type: 'bridge', id: null }, mapping = createDefaultMapping(), builtIn = false, createdAt = null, updatedAt = null }) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new ProtocolError('Input command profile id is invalid', 'invalid_input_mapping');
  const normalizedName = text(name, 'Input command profile name', 80);
  if (typeof description !== 'string' || description.length > 240) throw new ProtocolError('Input command profile description is invalid', 'invalid_input_mapping');
  if (createdAt !== null && typeof createdAt !== 'string') throw new ProtocolError('Input command profile creation date is invalid', 'invalid_input_mapping');
  if (updatedAt !== null && typeof updatedAt !== 'string') throw new ProtocolError('Input command profile update date is invalid', 'invalid_input_mapping');
  return Object.freeze({
    id,
    name: normalizedName,
    description: description.trim(),
    target: Object.freeze(normalizeProfileTarget(target)),
    mapping: Object.freeze(normalizeMapping(mapping)),
    builtIn: Boolean(builtIn),
    createdAt,
    updatedAt
  });
}

export function createDefaultCommandProfile() {
  return createInputCommandProfile({
    id: 'default',
    name: 'Default commands',
    description: 'One-to-one controller commands with no remapping.',
    builtIn: true
  });
}

export function diffMapping(before, after) {
  const left = normalizeMapping(before);
  const right = normalizeMapping(after);
  return INPUT_BUTTONS
    .filter((button) => left[button] !== right[button])
    .map((button) => Object.freeze({ button, before: left[button], after: right[button] }));
}

export function previewMappingApplication(profile, currentMapping, target) {
  const value = createInputCommandProfile(profile);
  const expected = normalizeProfileTarget(target);
  const current = normalizeMapping(currentMapping);
  if (!profileMatchesTarget(value, expected)) {
    return Object.freeze({ ok: false, requiresConfirmation: false, reason: 'target_mismatch', profileId: value.id, target: expected, before: current, after: current, changes: [] });
  }
  const after = normalizeMapping(value.mapping);
  const changes = diffMapping(current, after);
  return Object.freeze({
    ok: true,
    requiresConfirmation: changes.length > 0,
    reason: changes.length ? 'changes_pending' : 'already_applied',
    profileId: value.id,
    profileName: value.name,
    target: expected,
    before: Object.freeze(current),
    after: Object.freeze(after),
    changes: Object.freeze(changes),
    persisted: false
  });
}

export function commitMappingApplication(preview, { confirmed = false } = {}) {
  if (!preview || preview.ok !== true) throw new ProtocolError('A valid input mapping preview is required', 'invalid_input_mapping_preview');
  if (preview.requiresConfirmation && !confirmed) throw new ProtocolError('Input mapping application requires confirmation', 'confirmation_required');
  return Object.freeze({ ...preview, applied: true, persisted: false, mapping: Object.freeze(normalizeMapping(preview.after)) });
}

export function applyButtonMapping(input, mapping) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ProtocolError('Controller input is invalid', 'invalid_controller_input');
  if (!input.buttons || typeof input.buttons !== 'object' || Array.isArray(input.buttons)) throw new ProtocolError('Controller buttons are invalid', 'invalid_controller_input');
  const normalized = normalizeMapping(mapping);
  const buttons = Object.fromEntries(INPUT_BUTTONS.map((button) => [button, false]));
  for (const [source, target] of Object.entries(normalized)) buttons[target] = Boolean(buttons[target] || input.buttons[source]);
  return { ...clone(input), buttons };
}

export function serializeInputCommandProfile(profile) {
  return { format: INPUT_MAPPING_FORMAT, formatVersion: INPUT_MAPPING_VERSION, profile: createInputCommandProfile(profile) };
}

export function parseInputCommandProfile(document) {
  if (!document || document.format !== INPUT_MAPPING_FORMAT || document.formatVersion !== INPUT_MAPPING_VERSION || !document.profile) throw new ProtocolError('Unsupported MiraLink input mapping file', 'invalid_input_mapping_file');
  return createInputCommandProfile(document.profile);
}

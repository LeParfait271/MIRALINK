import { ProtocolError } from './protocol.js';

export const ACTION_GUARD_FORMAT = 'miralink-action-guard';
export const ACTION_GUARD_VERSION = 1;
export const ACTION_TYPES = Object.freeze([
  'read',
  'export-local',
  'write-config',
  'test-haptic',
  'test-trigger',
  'reset-config',
  'reconnect',
  'recovery',
  'flash-firmware'
]);

const CONFIRMATION_REQUIRED = new Set([
  'write-config',
  'test-haptic',
  'test-trigger',
  'reset-config',
  'reconnect',
  'recovery',
  'flash-firmware'
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeBoolean(value, field) {
  if (typeof value !== 'boolean') throw new ProtocolError(`${field} must be boolean`, 'invalid_action_guard');
  return value;
}

export function createActionGuard({ readOnly = false, locked = false, updatedAt = null } = {}) {
  return Object.freeze({
    format: ACTION_GUARD_FORMAT,
    formatVersion: ACTION_GUARD_VERSION,
    readOnly: normalizeBoolean(readOnly, 'readOnly'),
    locked: normalizeBoolean(locked, 'locked'),
    updatedAt: updatedAt === null ? null : String(updatedAt)
  });
}

export function updateActionGuard(guard, patch = {}) {
  const current = createActionGuard(guard);
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new ProtocolError('Action guard patch is invalid', 'invalid_action_guard');
  return createActionGuard({
    readOnly: patch.readOnly === undefined ? current.readOnly : patch.readOnly,
    locked: patch.locked === undefined ? current.locked : patch.locked,
    updatedAt: patch.updatedAt === undefined ? new Date().toISOString() : patch.updatedAt
  });
}

export function requiresActionConfirmation(action) {
  if (!ACTION_TYPES.includes(action)) throw new ProtocolError(`Unknown action: ${action}`, 'invalid_action');
  return CONFIRMATION_REQUIRED.has(action);
}

export function checkAction(guard, action, { confirmed = false, capabilityState = 'supported' } = {}) {
  const current = createActionGuard(guard);
  if (!ACTION_TYPES.includes(action)) throw new ProtocolError(`Unknown action: ${action}`, 'invalid_action');
  if (!['supported', 'partial', 'unavailable', 'not-tested'].includes(capabilityState)) throw new ProtocolError('Capability state is invalid', 'invalid_action');
  if (action !== 'read' && action !== 'export-local' && current.readOnly) return Object.freeze({ allowed: false, reason: 'read_only', requiresConfirmation: false, action });
  if (action !== 'read' && action !== 'export-local' && current.locked) return Object.freeze({ allowed: false, reason: 'locked', requiresConfirmation: false, action });
  if (action !== 'read' && action !== 'export-local' && capabilityState !== 'supported') return Object.freeze({ allowed: false, reason: `capability_${capabilityState}`, requiresConfirmation: false, action });
  const needsConfirmation = requiresActionConfirmation(action);
  if (needsConfirmation && !confirmed) return Object.freeze({ allowed: false, reason: 'confirmation_required', requiresConfirmation: true, action });
  return Object.freeze({ allowed: true, reason: 'allowed', requiresConfirmation: needsConfirmation, action });
}

export function assertActionAllowed(guard, action, options = {}) {
  const result = checkAction(guard, action, options);
  if (!result.allowed) throw new ProtocolError(`Action is not allowed: ${result.reason}`, result.reason);
  return result;
}

export function serializeActionGuard(guard) {
  return clone(createActionGuard(guard));
}

export function parseActionGuard(document) {
  if (!document || document.format !== ACTION_GUARD_FORMAT || document.formatVersion !== ACTION_GUARD_VERSION) throw new ProtocolError('Unsupported MiraLink action guard', 'invalid_action_guard_file');
  return createActionGuard(document);
}

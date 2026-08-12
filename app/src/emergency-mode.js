import { assertValidConfig, ProtocolError } from './protocol.js';
import { createBuiltInProfiles, diffConfig, normalizeProfileTarget } from './profiles.js';

export const EMERGENCY_PROFILE_ID = 'basic';

function cloneConfig(config) {
  return { ...assertValidConfig(config) };
}

export function getSafeEmergencyConfig() {
  return cloneConfig(createBuiltInProfiles().find((profile) => profile.id === EMERGENCY_PROFILE_ID).config);
}

export function prepareEmergencyReset({ currentConfig, target = { type: 'bridge', id: null }, safeConfig = getSafeEmergencyConfig(), reason = 'Local emergency recovery' } = {}) {
  const before = cloneConfig(currentConfig);
  const after = cloneConfig(safeConfig);
  const normalizedTarget = normalizeProfileTarget(target);
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 240) throw new ProtocolError('Emergency reset reason is invalid', 'invalid_emergency_reset');
  return Object.freeze({
    ok: true,
    action: 'emergency-reset',
    target: normalizedTarget,
    reason: reason.trim(),
    profileId: EMERGENCY_PROFILE_ID,
    requiresConfirmation: true,
    persisted: false,
    before: Object.freeze(before),
    after: Object.freeze(after),
    changes: Object.freeze(diffConfig(before, after))
  });
}

export function commitEmergencyReset(preview, { confirmed = false } = {}) {
  if (!preview || preview.ok !== true || preview.action !== 'emergency-reset') throw new ProtocolError('A valid emergency reset preview is required', 'invalid_emergency_reset_preview');
  if (!confirmed) throw new ProtocolError('Emergency reset requires confirmation', 'confirmation_required');
  return Object.freeze({ ...preview, applied: true, persisted: false, config: Object.freeze(cloneConfig(preview.after)) });
}

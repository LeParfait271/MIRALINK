import { assertValidConfig, defaultConfig, ProtocolError } from './protocol.js';

export const PROFILE_FORMAT = 'miralink-profile';
export const PROFILE_FORMAT_VERSION = 1;
export const PROFILE_TARGET_TYPES = Object.freeze(['bridge', 'controller']);
export const BATTERY_AUTO_SWITCH_THRESHOLD = 10;

const PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const PRESET_DEFINITIONS = Object.freeze([
  {
    id: 'competitive',
    name: 'Competitive',
    description: 'Minimum latency and maximum performance. This profile is protected from automatic battery switching.',
    patch: Object.freeze({ pollingMode: 2, audioBufferLength: 16, hapticsGain: 1.1, disableLed: true, enableWake: true })
  },
  {
    id: 'basic',
    name: 'Basic',
    description: 'Reliable everyday operation with conservative, balanced settings.',
    patch: Object.freeze({ pollingMode: 1, audioBufferLength: 64, hapticsGain: 1, inactiveMinutes: 0, disableLed: false, enableWake: false })
  },
  {
    id: 'economy',
    name: 'Economy',
    description: 'Reduced activity for low-power operation when the battery is below the local threshold.',
    patch: Object.freeze({ pollingMode: 0, audioBufferLength: 96, hapticsGain: 1, inactiveMinutes: 15, disableLed: true, enableWake: false })
  }
]);

function cloneConfig(config) {
  return { ...assertValidConfig(config) };
}

function normalizeText(value, field, maxLength) {
  if (typeof value !== 'string') throw new ProtocolError(`${field} must be text`, 'invalid_profile');
  const text = value.trim();
  if (!text || text.length > maxLength) throw new ProtocolError(`${field} is invalid`, 'invalid_profile');
  return text;
}

export function normalizeProfileTarget(target = { type: 'bridge', id: null }) {
  if (!target || !PROFILE_TARGET_TYPES.includes(target.type)) throw new ProtocolError('Profile target type is unsupported', 'invalid_profile_target');
  if (target.id !== null && target.id !== undefined && (typeof target.id !== 'string' || !target.id.trim())) throw new ProtocolError('Profile target id is invalid', 'invalid_profile_target');
  return { type: target.type, id: target.id ? target.id.trim() : null };
}

export function createProfile({ id, name, description = '', target, config = defaultConfig(), builtIn = false, createdAt = null, updatedAt = null }) {
  if (typeof id !== 'string' || !PROFILE_ID_PATTERN.test(id)) throw new ProtocolError('Profile id is invalid', 'invalid_profile');
  const normalizedName = normalizeText(name, 'Profile name', 80);
  if (typeof description !== 'string' || description.length > 240) throw new ProtocolError('Profile description is invalid', 'invalid_profile');
  if (createdAt !== null && typeof createdAt !== 'string') throw new ProtocolError('Profile creation date is invalid', 'invalid_profile');
  if (updatedAt !== null && typeof updatedAt !== 'string') throw new ProtocolError('Profile update date is invalid', 'invalid_profile');
  const profileTarget = normalizeProfileTarget(target);
  const profileConfig = cloneConfig(config);
  return Object.freeze({
    id,
    name: normalizedName,
    description: description.trim(),
    target: Object.freeze(profileTarget),
    config: Object.freeze(profileConfig),
    builtIn: Boolean(builtIn),
    createdAt,
    updatedAt
  });
}

export function createBuiltInProfiles(baseConfig = defaultConfig()) {
  const base = cloneConfig(baseConfig);
  return PRESET_DEFINITIONS.map((definition) => createProfile({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    target: { type: 'bridge', id: null },
    config: { ...base, ...definition.patch },
    builtIn: true
  }));
}

export function resolveAutomaticBatteryProfile({ activeProfileId, batteryPercent, automaticSwitchEnabled = true } = {}) {
  if (typeof activeProfileId !== 'string' || !activeProfileId.trim()) throw new ProtocolError('Active profile id is invalid', 'invalid_profile_automation');
  if (!Number.isFinite(batteryPercent) || batteryPercent < 0 || batteryPercent > 100) throw new ProtocolError('Battery percentage is invalid', 'invalid_profile_automation');
  const profileId = activeProfileId.trim();
  const underThreshold = batteryPercent < BATTERY_AUTO_SWITCH_THRESHOLD;
  const base = {
    switched: false,
    fromProfileId: profileId,
    toProfileId: profileId,
    batteryPercent,
    threshold: BATTERY_AUTO_SWITCH_THRESHOLD,
    requiresConfirmation: false
  };
  if (!automaticSwitchEnabled) return { ...base, reason: 'automatic_switch_disabled' };
  if (profileId === 'competitive') return { ...base, reason: underThreshold ? 'competitive_protected' : 'battery_above_threshold' };
  if (profileId === 'basic' && underThreshold) return { ...base, switched: true, toProfileId: 'economy', reason: 'battery_below_threshold', requiresConfirmation: true };
  return { ...base, reason: underThreshold ? 'no_switch_policy_for_profile' : 'battery_above_threshold' };
}

export function bindProfileToTarget(profile, target) {
  const value = createProfile(profile);
  return createProfile({ ...value, target: normalizeProfileTarget(target) });
}

export function profileMatchesTarget(profile, target) {
  const value = createProfile(profile);
  const expected = normalizeProfileTarget(target);
  return value.target.type === expected.type && (value.target.id === null || value.target.id === expected.id);
}

export function diffConfig(before, after) {
  const left = cloneConfig(before);
  const right = cloneConfig(after);
  return Object.keys(defaultConfig())
    .filter((key) => left[key] !== right[key])
    .map((key) => Object.freeze({ key, before: left[key], after: right[key] }));
}

export function previewProfileApplication(profile, currentConfig, target) {
  const value = createProfile(profile);
  const current = cloneConfig(currentConfig);
  const expected = normalizeProfileTarget(target);
  if (!profileMatchesTarget(value, expected)) {
    return Object.freeze({
      ok: false,
      requiresConfirmation: false,
      reason: 'target_mismatch',
      message: 'This profile is not bound to the selected device.',
      profileId: value.id,
      target: expected,
      before: current,
      after: current,
      changes: []
    });
  }
  const after = cloneConfig(value.config);
  const changes = diffConfig(current, after);
  return Object.freeze({
    ok: true,
    requiresConfirmation: changes.length > 0,
    reason: changes.length ? 'changes_pending' : 'already_applied',
    message: changes.length ? `${changes.length} configuration change(s) are ready for review.` : 'The selected profile is already active.',
    profileId: value.id,
    profileName: value.name,
    target: expected,
    before: Object.freeze(current),
    after: Object.freeze(after),
    changes: Object.freeze(changes)
  });
}

export function commitProfileApplication(preview, { confirmed = false } = {}) {
  if (!preview || preview.ok !== true) throw new ProtocolError('A valid profile preview is required', 'invalid_profile_preview');
  if (!confirmed && preview.requiresConfirmation) throw new ProtocolError('Profile application requires confirmation', 'confirmation_required');
  return Object.freeze({
    ...preview,
    applied: true,
    persisted: false,
    config: Object.freeze(cloneConfig(preview.after))
  });
}

export function serializeProfile(profile) {
  return {
    format: PROFILE_FORMAT,
    formatVersion: PROFILE_FORMAT_VERSION,
    profile: createProfile(profile)
  };
}

export function parseProfile(document) {
  if (!document || document.format !== PROFILE_FORMAT || document.formatVersion !== PROFILE_FORMAT_VERSION || !document.profile) throw new ProtocolError('Unsupported MiraLink profile file', 'invalid_profile_file');
  return createProfile(document.profile);
}

export function listPresetDefinitions() {
  return PRESET_DEFINITIONS.map(({ id, name, description }) => ({ id, name, description }));
}

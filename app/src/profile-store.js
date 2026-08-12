import { createProfile, parseProfile, serializeProfile } from './profiles.js';

export const PROFILE_STORE_KEY = 'miralink:profiles:v1';
export const PROFILE_STORE_FORMAT = 'miralink-profile-store';
export const PROFILE_STORE_VERSION = 1;

function storageMethodsAvailable(storage) {
  return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function' && typeof storage.removeItem === 'function';
}

function emptyDocument() {
  return { format: PROFILE_STORE_FORMAT, formatVersion: PROFILE_STORE_VERSION, profiles: [] };
}

function readDocument(storage) {
  if (!storageMethodsAvailable(storage)) return { document: emptyDocument(), errors: ['Local storage is unavailable.'] };
  const raw = storage.getItem(PROFILE_STORE_KEY);
  if (!raw) return { document: emptyDocument(), errors: [] };
  try {
    const value = JSON.parse(raw);
    if (!value || value.format !== PROFILE_STORE_FORMAT || value.formatVersion !== PROFILE_STORE_VERSION || !Array.isArray(value.profiles)) return { document: emptyDocument(), errors: ['Stored profile data is unsupported.'] };
    const profiles = [];
    const errors = [];
    for (const candidate of value.profiles) {
      try { profiles.push(parseProfile(candidate)); } catch (error) { errors.push(error.message); }
    }
    return { document: { ...emptyDocument(), profiles }, errors };
  } catch (error) {
    return { document: emptyDocument(), errors: [`Stored profile data could not be read: ${error.message}`] };
  }
}

function writeDocument(storage, profiles) {
  if (!storageMethodsAvailable(storage)) return { ok: false, reason: 'storage_unavailable' };
  const document = { ...emptyDocument(), profiles: profiles.map(serializeProfile) };
  try {
    storage.setItem(PROFILE_STORE_KEY, JSON.stringify(document));
    return { ok: true, document };
  } catch (error) {
    return { ok: false, reason: 'storage_write_failed', message: error.message };
  }
}

export function createProfileStore(storage = globalThis.localStorage) {
  const list = () => readDocument(storage).document.profiles;
  return {
    key: PROFILE_STORE_KEY,
    available: storageMethodsAvailable(storage),
    list,
    readDiagnostics: () => readDocument(storage).errors,
    save(profile) {
      const value = createProfile(profile);
      const next = [...list().filter((entry) => entry.id !== value.id), value];
      const result = writeDocument(storage, next);
      return result.ok ? { ok: true, profile: value } : result;
    },
    remove(profileId) {
      const current = list();
      const next = current.filter((entry) => entry.id !== profileId);
      const result = writeDocument(storage, next);
      return result.ok ? { ok: true, removed: current.length !== next.length } : result;
    },
    exportDocument() {
      return { ...emptyDocument(), profiles: list().map(serializeProfile) };
    },
    importDocument(document, { replace = false } = {}) {
      if (!document || document.format !== PROFILE_STORE_FORMAT || document.formatVersion !== PROFILE_STORE_VERSION || !Array.isArray(document.profiles)) throw new Error('Unsupported MiraLink profile store');
      const imported = document.profiles.map(parseProfile);
      const next = replace ? imported : [...list().filter((entry) => !imported.some((value) => value.id === entry.id)), ...imported];
      const result = writeDocument(storage, next);
      return result.ok ? { ok: true, imported: imported.length } : result;
    },
    clear() {
      if (!storageMethodsAvailable(storage)) return { ok: false, reason: 'storage_unavailable' };
      try { storage.removeItem(PROFILE_STORE_KEY); return { ok: true }; } catch (error) { return { ok: false, reason: 'storage_remove_failed', message: error.message }; }
    }
  };
}

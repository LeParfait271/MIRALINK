const PREFIX = 'miralink:';
const KEYS = Object.freeze({ language: `${PREFIX}language`, logs: `${PREFIX}logs`, drafts: `${PREFIX}drafts`, backups: `${PREFIX}backups` });

function storageAvailable() {
  try {
    const key = `${PREFIX}probe`;
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

const available = storageAvailable();

function read(key, fallback) {
  if (!available) return fallback;
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}

function write(key, value) {
  if (!available) return false;
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export const preferences = {
  getLanguage: () => read(KEYS.language, 'en'),
  setLanguage: (value) => write(KEYS.language, value)
};

export const logs = {
  get: () => read(KEYS.logs, []).filter((entry) => entry && typeof entry.message === 'string').slice(-200),
  set: (value) => write(KEYS.logs, value.slice(-200)),
  clear: () => write(KEYS.logs, [])
};

export const drafts = {
  get: (deviceId) => read(`${KEYS.drafts}:${deviceId}`, null),
  set: (deviceId, value) => write(`${KEYS.drafts}:${deviceId}`, value),
  clear: (deviceId) => { if (available) localStorage.removeItem(`${KEYS.drafts}:${deviceId}`); }
};

export function createBackup({ config, device = {}, version = '1.6.0' }) {
  return { format: 'miralink-backup', formatVersion: 1, product: 'MiraLink', version, exportedAt: new Date().toISOString(), device: { type: device.type || 'unknown', label: device.label || 'MiraLink device' }, config };
}

export function validateBackup(value) {
  if (!value || value.format !== 'miralink-backup' || value.formatVersion !== 1 || !value.config) throw new Error('Unsupported MiraLink backup file');
  return value;
}

export function downloadJson(filename, value) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

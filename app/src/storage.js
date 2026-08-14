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

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalValue(value[key]);
    return result;
  }, {});
}

export function canonicalBackupJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function crc32(input) {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function backupChecksum(value) {
  const bytes = new TextEncoder().encode(canonicalBackupJson(value));
  return crc32(bytes).toString(16).padStart(8, '0');
}

export function createBackup({ config, device = {}, version = '2.0.0' }) {
  const payload = {
    format: 'miralink-backup',
    formatVersion: 2,
    product: 'MiraLink',
    version,
    exportedAt: new Date().toISOString(),
    device: { type: device.kind || device.type || 'unknown', label: device.label || 'MiraLink device' },
    config
  };
  return { ...payload, checksum: { algorithm: 'CRC32', value: backupChecksum(payload) } };
}

export function validateBackup(value) {
  if (!value || value.format !== 'miralink-backup' || value.formatVersion !== 2 || !value.config) throw new Error('Unsupported MiraLink backup file');
  if (value.checksum?.algorithm !== 'CRC32' || !/^[0-9a-f]{8}$/i.test(value.checksum?.value || '')) throw new Error('MiraLink backup checksum is missing or unsupported');
  const { checksum, ...payload } = value;
  if (backupChecksum(payload) !== checksum.value.toLowerCase()) throw new Error('MiraLink backup checksum does not match its contents');
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

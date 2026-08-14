export function describeControllerOverview({ controller = null, bridge = null, notConnected = 'Non connectée' } = {}) {
  if (controller) {
    return controller.state === 'ready'
      ? { state: 'PRÊTE', note: controller.label || 'Manette filaire' }
      : { state: 'ATTENTION', note: controller.nextAction || notConnected };
  }

  const controllerState = bridge?.controllerState;
  if (!controllerState) return { state: '—', note: notConnected };
  if (controllerState.connected) {
    return controllerState.inputAvailable
      ? { state: 'PRÊTE', note: 'DualSense via le bridge · entrées actives' }
      : { state: 'CONNECTÉE', note: 'DualSense via le bridge · en attente d’entrées' };
  }
  if (controllerState.connectionPending || controllerState.inquiryActive) {
    return { state: 'CONNEXION', note: 'Appairage Bluetooth en cours' };
  }
  if (controllerState.pairingWindowOpen) {
    return { state: 'APPAIRAGE', note: 'Fenêtre d’appairage ouverte' };
  }
  if (controllerState.pairedControllerKnown) {
    return { state: 'HORS LIGNE', note: 'DualSense connue · non connectée' };
  }
  return { state: '—', note: notConnected };
}

export function canEditBridgeConfiguration(entry, savedConfig) {
  return Boolean(entry?.kind === 'bridge' && entry.state === 'ready' && entry.config && savedConfig);
}

function cloneConfig(config) {
  return config && typeof config === 'object' ? { ...config } : null;
}

const CONFIG_LABELS = Object.freeze({
  schema: 'Schéma',
  hapticsGain: 'Gain haptique',
  speakerVolume: 'Volume haut-parleur',
  headsetVolume: 'Volume casque',
  speakerGain: 'Gain haut-parleur',
  inactiveMinutes: 'Délai d’inactivité',
  pollingMode: 'Mode de lecture',
  audioBufferLength: 'Buffer audio',
  controllerMode: 'Mode manette',
  disableLed: 'LED du Pico désactivée',
  enableUsbSerial: 'Numéro de série USB',
  psShortcut: 'Raccourci PS',
  disableMic: 'Microphone désactivé',
  disableSpeaker: 'Haut-parleur désactivé',
  enableWake: 'Réveil de l’ordinateur',
  triggerReduce: 'Réduction des gâchettes',
  lockVolume: 'Volume verrouillé',
  statusGpioPin: 'Broche GPIO d’état',
  statusGpioMode: 'Mode GPIO d’état'
});

function displayConfigValue(value) {
  if (typeof value === 'boolean') return value ? 'activé' : 'désactivé';
  return String(value);
}

export function formatConfigurationChanges(changes) {
  if (!Array.isArray(changes)) return '';
  return changes.map(({ key, before, after }) => (
    `• ${CONFIG_LABELS[key] || key} : ${displayConfigValue(before)} → ${displayConfigValue(after)}`
  )).join('\n');
}

export function saveEntryWorkingCopy(entry, { draft = null, savedConfig = null } = {}) {
  if (!entry || typeof entry !== 'object') return;
  entry.draft = cloneConfig(draft);
  entry.savedConfig = cloneConfig(savedConfig);
}

export function loadEntryWorkingCopy(entry) {
  if (!entry || typeof entry !== 'object') return { draft: null, savedConfig: null };
  return {
    draft: cloneConfig(entry.draft ?? entry.config),
    savedConfig: cloneConfig(entry.savedConfig ?? entry.config)
  };
}

import {
  COMMANDS,
  MIRALINK_USB_FILTER,
  REPORT_IDS,
  ProtocolError,
  assertValidConfig,
  decodeCommitConfigAck,
  decodeConfig,
  decodeControllerCapabilities,
  decodeControllerStatePayload,
  decodeAudioStatusPayload,
  decodeDiagnosticsPayload,
  decodeFrame,
  decodeHelloPayload,
  decodeInfoPayload,
  defaultConfig,
  encodeConfig,
  getHidIdentificationOrder,
  inspectMiraLinkHidIdentity
} from './protocol.js';
import { createBackup, downloadJson, logs as logStore, validateBackup } from './storage.js';
import { applyTranslations, translate } from './i18n.js?ui=50-output-fifo';
import { inspectUf2 } from './uf2.js';
import { createDualSenseAdapter, dualSenseWebHidFilters, isDualSenseDevice } from './dualsense.js';
import { commitProfileApplication, createBuiltInProfiles, createProfile, diffConfig, previewProfileApplication } from './profiles.js';
import { createProfileStore } from './profile-store.js';
import {
  canEditBridgeConfiguration,
  describeControllerOverview,
  formatConfigurationChanges,
  loadEntryWorkingCopy,
  saveEntryWorkingCopy
} from './ui-state.js';
import {
  createHidTransactionQueue,
  describeWebHidError,
  inspectWebHidAvailability,
  isHidRequestCancellation,
  setWebHidWarningVisibility,
  transactFeatureReport
} from './hid-transport.js';
import { analyzeControllerInputs, appendCalibrationRevision, compareControllerAnalyses, createCalibrationRevision } from './controller-lab.js';
import { scrollToRouteTarget } from './site-effects.js?ui=50-output-fifo';

const state = {
  devices: new Map(),
  activeDeviceId: null,
  sequence: 0,
  draft: null,
  savedConfig: null,
  logs: logStore.get(),
  version: { version: '0.50', developer: 'MaruChiwa', lastUpdated: '2026-08-15' }
};

const CONTROLLER_POLL_INTERVAL_MS = 100;
const CONTROLLER_POLL_RETRY_DELAYS_MS = Object.freeze([250, 500]);
const CONTROLLER_POLL_MAX_FAILURES = 3;
const USB_DISCONNECT_OBSERVE_TIMEOUT_MS = 900;
const USB_DISCONNECT_OBSERVE_INTERVAL_MS = 25;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function setElementVisibility(element, visible) {
  if (!element) return;
  element.hidden = !visible;
  if (visible) element.style.removeProperty('display');
  else element.style.setProperty('display', 'none', 'important');
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function setText(selector, value) {
  const node = $(selector);
  if (node) node.textContent = value;
}

function formatVector(vector) {
  return vector ? `X ${vector.x} / Y ${vector.y} / Z ${vector.z}` : 'X — / Y — / Z —';
}

function formatBatteryState(value) {
  return ({ discharging: 'décharge', charging: 'charge', full: 'pleine', error: 'erreur' })[value] || 'état inconnu';
}

function formatStickAnalysis(stick) {
  if (!stick || stick.status !== 'available') return { center: '—', amplitude: '—', circularity: '—' };
  return {
    center: `X ${formatLabValue(stick.center.x)} / Y ${formatLabValue(stick.center.y)} / Δ ${formatLabValue(stick.center.offset)}`,
    amplitude: `X ${formatLabValue(stick.amplitude.x.span)} / Y ${formatLabValue(stick.amplitude.y.span)} / R ${formatLabValue(stick.amplitude.maxRadius)}`,
    circularity: Number.isFinite(stick.circularity.ratio)
      ? `${(stick.circularity.ratio * 100).toFixed(1)} %`
      : 'Échantillons insuffisants'
  };
}

function renderControllerLab(entry = activeEntry()) {
  const consoleNode = $('#controller-lab-console');
  if (!consoleNode) return;
  const sample = entry?.lastSample || null;
  const controllerState = entry?.controllerState || null;
  const samples = controllerSamples(entry);
  const inputLive = entry?.state === 'ready' && Boolean(sample);

  consoleNode.dataset.state = inputLive ? 'live' : entry?.state === 'ready' ? 'waiting' : 'offline';
  const linkState = !entry
    ? 'Aucun appareil'
    : entry.kind === 'bridge'
      ? controllerState?.connected ? `Manette connectée · ${sample?.transport || 'transport local'}` : 'Bridge prêt · manette en attente'
      : entry.state === 'ready' ? 'Manette USB connectée' : 'Liaison indisponible';
  setText('#controller-lab-link-state', linkState);
  setText('#controller-lab-sample-state', sample ? 'Entrées reçues' : 'Aucun reçu');
  setText('#controller-lab-sample-count', String(samples.length));

  const extended = sample?.extended || null;
  setText('#controller-lab-battery', sample?.batteryPercent === null || sample?.batteryPercent === undefined
    ? 'Non exposée'
    : `${sample.batteryPercent} % · ${formatBatteryState(sample.batteryState)}`);
  setText('#controller-lab-headset', extended
    ? `${extended.headphoneConnected ? 'Connecté' : 'Non connecté'} · flux audio USB non exposé`
    : 'Non exposé par ce rapport');
  setText('#controller-lab-microphone', extended
    ? `${extended.microphoneConnected ? 'Connecté' : 'Non connecté'}${extended.microphoneMuted ? ' · muet' : ''} · flux USB non exposé`
    : 'Non exposé par ce rapport');

  for (const side of ['left', 'right']) {
    const stick = sample?.[`${side}Stick`] || { x: 0, y: 0 };
    const point = $(`#controller-${side}-stick-point`);
    if (point) {
      point.style.setProperty('--stick-left', `${(50 + clamp(stick.x, -1, 1) * 42).toFixed(2)}%`);
      point.style.setProperty('--stick-top', `${(50 + clamp(stick.y, -1, 1) * 42).toFixed(2)}%`);
    }
    setText(`#controller-${side}-stick-value`, `X ${formatLabValue(stick.x)} / Y ${formatLabValue(stick.y)}`);
  }

  for (const side of ['left', 'right']) {
    const value = clamp(sample?.[`${side}Trigger`], 0, 1);
    const progress = $(`#controller-${side}-trigger`);
    if (progress) progress.value = value;
    setText(`#controller-${side}-trigger-value`, `${Math.round(value * 100)} %`);
  }

  const buttonState = { ...(sample?.buttons || {}), ...(sample?.buttons?.dpad || {}) };
  $$('[data-controller-button]').forEach((node) => {
    const active = Boolean(buttonState[node.dataset.controllerButton]);
    const label = node.querySelector('small')?.textContent || node.textContent.trim();
    node.dataset.active = String(active);
    node.setAttribute('aria-label', `${label} : ${active ? 'appuyé' : 'relâché'}`);
  });

  setText('#controller-gyro-value', formatVector(extended?.gyro));
  setText('#controller-accelerometer-value', formatVector(extended?.accelerometer));
  [0, 1].forEach((index) => {
    const touch = extended?.touchPoints?.[index];
    setText(`#controller-touch-${index + 1}-value`, touch
      ? `${touch.active ? 'Actif' : 'Inactif'} / X ${touch.x} / Y ${touch.y}`
      : 'Non exposé / X — / Y —');
  });

  if (!samples.length) {
    setText('#controller-analysis-summary', 'En attente d’échantillons locaux · aucune calibration écrite.');
    for (const side of ['left', 'right']) {
      for (const metric of ['center', 'amplitude', 'circularity']) setText(`#controller-analysis-${side}-${metric}`, '—');
    }
    return;
  }

  try {
    const analysis = analyzeControllerInputs(samples);
    setText('#controller-analysis-summary', `${analysis.sampleCount} échantillons locaux · analyse en lecture seule · aucune calibration écrite.`);
    for (const side of ['left', 'right']) {
      const formatted = formatStickAnalysis(analysis.sticks[side]);
      for (const metric of ['center', 'amplitude', 'circularity']) setText(`#controller-analysis-${side}-${metric}`, formatted[metric]);
    }
  } catch (error) {
    setText('#controller-analysis-summary', `Analyse locale indisponible : ${error.message}`);
  }
}

function connectionErrorLabel(code) {
  return ({
    1: 'inquiry',
    2: 'HID connection',
    3: 'HID acceptance',
    4: 'connection opening',
    5: 'protocol handshake',
    6: 'HID descriptor',
    7: 'handshake timeout',
    8: 'unexpected close'
  })[code] || 'unknown Bluetooth step';
}

function addLog(level, message) {
  const entry = { timestamp: new Date().toISOString(), level, message: String(message) };
  state.logs.push(entry);
  state.logs = state.logs.slice(-200);
  logStore.set(state.logs);
  renderLogs();
}

function setGlobalStatus(text, stateName = 'idle') {
  const status = $('#global-status');
  const statusText = $('#global-status-text');
  if (status) status.dataset.state = stateName;
  if (statusText) statusText.textContent = text;
}

function renderLogs() {
  const view = $('#log-view');
  view.replaceChildren();
  if (!state.logs.length) {
    const empty = document.createElement('span');
    empty.textContent = 'Aucun événement local.';
    view.append(empty);
    return;
  }
  for (const entry of state.logs) {
    const line = document.createElement('div');
    line.className = `log-line log-${entry.level}`;
    line.textContent = `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}`;
    view.append(line);
  }
  view.scrollTop = view.scrollHeight;
}

function activeEntry() {
  return state.activeDeviceId ? state.devices.get(state.activeDeviceId) : null;
}

function readyBridgeEntry() {
  const active = activeEntry();
  if (active?.kind === 'bridge' && active.state === 'ready') return active;
  return [...state.devices.values()].find((entry) => entry.kind === 'bridge' && entry.state === 'ready') || null;
}

function syncActiveWorkingCopy() {
  const entry = activeEntry();
  if (entry) saveEntryWorkingCopy(entry, { draft: state.draft, savedConfig: state.savedConfig });
}

function recordControllerSample(entry, sample) {
  if (!entry || !sample) return;
  entry.sampleHistory = [...(entry.sampleHistory || []), sample].slice(-600);
  entry.sampleCount = entry.sampleHistory.length;
  entry.lastSample = sample;
  if (entry.id === state.activeDeviceId) renderControllerLab(entry);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('miralink:controller-sample', { detail: { deviceId: entry.id, sample } }));
}

function deviceStateLabel(value) {
  return ({
    opening: 'ouverture USB',
    handshaking: 'identification HELLO',
    reconnecting: 'reconnexion',
    ready: 'prêt',
    error: 'attention'
  })[value] || String(value || 'inconnu');
}

function selectEntry(entry) {
  if (!entry) return;
  syncActiveWorkingCopy();
  state.activeDeviceId = entry.id;
  const workingCopy = loadEntryWorkingCopy(entry);
  state.draft = workingCopy.draft;
  state.savedConfig = workingCopy.savedConfig;
}

function scrollToSection(id) {
  scrollToRouteTarget(`#${id}`, { updateHash: true });
}

function showBridgeConnectionDiagnostics(entry) {
  if (!entry || entry.kind !== 'bridge') return;
  const ready = entry.state === 'ready';
  $('[data-diagnostic="usb"]').textContent = ready ? 'READY' : 'DETECTED';
  for (const name of ['radio', 'audio', 'storage']) $('[data-diagnostic="' + name + '"]').textContent = 'À TESTER';
  const summary = $('#diagnostic-summary');
  if (ready) {
    summary.textContent = `${entry.label} est identifié comme pont MiraLink. Cliquez sur « Lancer les diagnostics » pour vérifier le firmware, la radio et les entrées.`;
  } else {
    summary.textContent = `${entry.connectionSummary || 'Le pont MiraLink est identifié, mais il n’est pas prêt.'} Prochaine étape : ${entry.nextAction || 'Rebranchez le Pico puis réessayez.'}`;
  }
}

function openEntryDiagnostics(entry) {
  selectEntry(entry);
  renderDevices();
  updateUiForActiveDevice();
  showBridgeConnectionDiagnostics(entry);
  scrollToSection('tab-diagnostics');
}

function renderDevices() {
  const list = $('#device-list');
  list.replaceChildren();
  if (!state.devices.size) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.id = 'empty-devices';
    const glyph = document.createElement('span'); glyph.className = 'empty-glyph'; glyph.setAttribute('aria-hidden', 'true'); glyph.textContent = '◇';
    const title = document.createElement('p'); title.className = 'empty-title'; title.textContent = translate('noDevices');
    const copy = document.createElement('p'); copy.className = 'empty-copy'; copy.textContent = translate('noDevicesCopy');
    empty.append(glyph, title, copy); list.append(empty);
  }
  for (const entry of state.devices.values()) {
    const card = document.createElement('article');
    card.className = 'device-card';
    card.dataset.active = String(entry.id === state.activeDeviceId);
    const info = document.createElement('div');
    const name = document.createElement('p'); name.className = 'device-name'; name.textContent = entry.label;
    const meta = document.createElement('p'); meta.className = 'device-meta'; meta.textContent = `${entry.kindLabel} · ${deviceStateLabel(entry.state)}`;
    info.append(name, meta);
    if (entry.nextAction) {
      const nextAction = document.createElement('p'); nextAction.className = 'device-meta'; nextAction.textContent = `Étape suivante : ${entry.nextAction}`;
      info.append(nextAction);
    }
    const actions = document.createElement('div'); actions.className = 'action-row';
    const select = document.createElement('button'); select.className = 'button quiet'; select.type = 'button'; select.textContent = entry.id === state.activeDeviceId ? 'Actif' : 'Utiliser'; select.disabled = entry.id === state.activeDeviceId;
    select.addEventListener('click', () => { selectEntry(entry); renderDevices(); updateUiForActiveDevice(); });
    const disconnect = document.createElement('button'); disconnect.className = 'button quiet'; disconnect.type = 'button'; disconnect.textContent = '×'; disconnect.setAttribute('aria-label', `Déconnecter ${entry.label}`); disconnect.addEventListener('click', () => disconnectEntry(entry.id));
    actions.append(select);
    if (entry.kind === 'bridge') {
      const diagnostics = document.createElement('button'); diagnostics.className = 'button quiet'; diagnostics.type = 'button'; diagnostics.textContent = 'Diagnostics'; diagnostics.addEventListener('click', () => openEntryDiagnostics(entry));
      actions.append(diagnostics);
    }
    actions.append(disconnect); card.append(info, actions); list.append(card);
  }
  updateOverview();
}

function updateOverview() {
  const entries = [...state.devices.values()];
  const bridge = entries.find((entry) => entry.kind === 'bridge');
  const controller = entries.find((entry) => entry.kind === 'controller');
  const controllerOverview = describeControllerOverview({
    controller,
    bridge: bridge?.state === 'ready' ? bridge : null,
    notConnected: translate('controllerNotConnected')
  });
  $('#overview-bridge-state').textContent = bridge ? bridge.state === 'ready' ? 'READY' : 'ATTENTION' : '—';
  $('#overview-bridge-note').textContent = bridge ? bridge.state === 'ready' ? bridge.label : bridge.nextAction : translate('notConnected');
  $('#overview-controller-state').textContent = controllerOverview.state;
  $('#overview-controller-note').textContent = controllerOverview.note;
  const firmware = bridge?.state === 'ready' ? bridge.firmwareVersion || '—' : '—';
  $('#overview-firmware-state').textContent = firmware;
  $('#overview-firmware-note').textContent = bridge ? 'MiraLink bridge' : translate('awaitingDevice');
  updateInstalledVersion();
}

function controllerOverviewChanged(previous, next) {
  const fields = ['connected', 'inputAvailable', 'pairingWindowOpen', 'inquiryActive', 'connectionPending', 'pairedControllerKnown'];
  return !previous || fields.some((field) => Boolean(previous[field]) !== Boolean(next?.[field]));
}

function updateInstalledVersion() {
  const versionNode = $('#installed-version');
  const noteNode = $('#installed-version-note');
  if (!versionNode && !noteNode) return;
  const bridge = activeEntry()?.kind === 'bridge'
    ? activeEntry()
    : [...state.devices.values()].find((entry) => entry.kind === 'bridge');
  if (versionNode) versionNode.textContent = bridge?.state === 'ready' ? bridge.firmwareVersion || '—' : '—';
  if (!noteNode) return;
  if (!bridge) noteNode.textContent = 'Connectez un Pico 2 W pour lire sa version.';
  else if (bridge.state !== 'ready') noteNode.textContent = `Pont détecté, version illisible. ${bridge.nextAction}`;
  else if (bridge.firmwareVersion) noteNode.textContent = 'Version lue localement via le pont MiraLink.';
  else noteNode.textContent = 'Pont connecté, mais cette version du firmware ne publie pas son numéro.';
}

function updateUiForActiveDevice() {
  const entry = activeEntry();
  const bridgeReady = entry?.kind === 'bridge' && entry.state === 'ready';
  const configurationEditable = canEditBridgeConfiguration(entry, state.savedConfig);
  const pendingChanges = configurationEditable && state.draft ? diffConfig(state.savedConfig, state.draft) : [];
  const controls = $$('#tab-bridge input, #tab-bridge select');
  controls.forEach((control) => { control.disabled = !configurationEditable; });
  $('#audio-buffer').disabled = true;
  $('#ps-shortcut').disabled = true;
  $('#read-config-button').disabled = !bridgeReady;
  $('#save-config-button').disabled = !configurationEditable || !pendingChanges.length;
  $('#reset-config-button').disabled = !configurationEditable || !pendingChanges.length;
  $('#factory-reset-config-button').disabled = !configurationEditable;
  const reconnectRequired = Boolean(entry?.usbReenumerationRequired);
  setElementVisibility($('#usb-reconnect-notice'), reconnectRequired);
  $('#reconnect-usb-button').disabled = !bridgeReady || !reconnectRequired;
  setText('#audio-buffer-hint', translate('audioBufferUnavailableHint'));
  setText('#ps-shortcut-hint', translate('psShortcutUnavailableHint'));
  const pairingButton = $('#open-pairing-button');
  if (pairingButton) pairingButton.disabled = !readyBridgeEntry();
  $('#bridge-device-status').textContent = bridgeReady ? entry.label : entry?.kind === 'bridge' ? `Pont détecté · ${deviceStateLabel(entry.state)}` : translate('selectDevice');
  const readonlyNotice = $('#bridge-readonly-notice');
  readonlyNotice.hidden = configurationEditable;
  if (!configurationEditable) {
    readonlyNotice.querySelector('strong').textContent = bridgeReady ? 'Lecture requise' : translate('readOnlyTitle');
    readonlyNotice.querySelector('span').textContent = bridgeReady
      ? 'Lisez d’abord la configuration actuelle du Pico 2 W pour créer un brouillon sûr.'
      : translate('readOnlyBody');
  }
  renderConfig(state.draft || state.savedConfig || defaultConfig());
  renderControllerLab(entry);
}

function renderConfig(config) {
  const value = config || defaultConfig();
  $('#haptics-gain').value = value.hapticsGain;
  $('#haptics-gain-value').textContent = Number(value.hapticsGain).toFixed(2);
  $('#trigger-reduce').value = value.triggerReduce;
  $('#trigger-reduce-value').textContent = `${value.triggerReduce}%`;
  $('#polling-mode').value = value.pollingMode;
  $('#audio-buffer').value = value.audioBufferLength;
  $('#audio-buffer-value').textContent = value.audioBufferLength;
  $('#inactive-time').value = value.inactiveMinutes;
  $('#inactive-time-value').textContent = `${value.inactiveMinutes} min`;
  $('#disable-led').checked = value.disableLed;
  $('#enable-wake').checked = value.enableWake;
  $('#controller-mode').value = value.controllerMode;
  $('#enable-usb-sn').checked = value.enableUsbSerial;
  $('#ps-shortcut').checked = value.psShortcut;
  const changed = state.savedConfig && JSON.stringify(assertValidConfig(value)) !== JSON.stringify(assertValidConfig(state.savedConfig));
  $('#draft-status').textContent = changed ? 'Modifications locales en attente de validation.' : translate('noDraft');
}

function readDraftFromControls() {
  if (!state.draft || !state.savedConfig) throw new ProtocolError('Lisez la configuration du Pico 2 W avant de la modifier.', 'config_not_loaded');
  const base = state.draft;
  return assertValidConfig({
    ...base,
    hapticsGain: Number($('#haptics-gain').value),
    triggerReduce: Number($('#trigger-reduce').value),
    pollingMode: Number($('#polling-mode').value),
    audioBufferLength: base.audioBufferLength,
    inactiveMinutes: Number($('#inactive-time').value),
    disableLed: $('#disable-led').checked,
    enableWake: $('#enable-wake').checked,
    controllerMode: Number($('#controller-mode').value),
    enableUsbSerial: $('#enable-usb-sn').checked,
    psShortcut: base.psShortcut
  });
}

async function loadMetadata() {
  try {
    const response = await fetch('./build-info.json?ui=50-output-fifo', { cache: 'no-store' });
    if (response.ok) state.version = { ...state.version, ...(await response.json()) };
  } catch { addLog('info', 'Development metadata is not available; using local defaults.'); }
  const label = `v${state.version.version}`;
  const versionChip = $('#version-chip');
  const footerVersion = $('#footer-version');
  const footerUpdated = $('#footer-updated');
  if (versionChip) versionChip.textContent = label;
  if (footerVersion) footerVersion.textContent = label;
  if (footerUpdated) footerUpdated.textContent = state.version.lastUpdated || '2026-08-12';
}

function webHidStatus() {
  return inspectWebHidAvailability({
    navigator: typeof navigator !== 'undefined' ? navigator : null,
    document: typeof document !== 'undefined' ? document : null,
    isSecureContext: typeof window !== 'undefined' && window.isSecureContext
  });
}

function hasHid() {
  return webHidStatus().available;
}

function setHidActionAvailability(available) {
  const enabled = Boolean(available);
  for (const selector of ['#connect-button', '#refresh-devices-button']) {
    const control = $(selector);
    if (control) control.disabled = !enabled;
  }
}

function hideHidWarning() {
  setWebHidWarningVisibility($('#hid-warning'), false);
  setHidActionAvailability(true);
}

function showHidWarning(status) {
  setHidActionAvailability(false);
  const warning = $('#hid-warning');
  if (!warning) return;
  const copyKeys = {
    'insecure-context': ['webhidInsecureTitle', 'webhidInsecureBody'],
    'permissions-policy': ['webhidPolicyTitle', 'webhidPolicyBody'],
    'browser-or-context': ['webhidContextTitle', 'webhidContextBody']
  }[status.reason] || ['webhidMissingTitle', 'webhidMissingBody'];
  const title = warning.querySelector('strong');
  const body = warning.querySelector('span');
  if (title) {
    title.dataset.i18n = copyKeys[0];
    title.textContent = translate(copyKeys[0]);
  }
  if (body) {
    body.dataset.i18n = copyKeys[1];
    body.textContent = translate(copyKeys[1]);
  }
  setWebHidWarningVisibility(warning, true);
}

function requireHid() {
  const status = webHidStatus();
  if (status.available) {
    hideHidWarning();
    return true;
  }
  showHidWarning(status);
  addLog('error', `MiraLink bridge unavailable: ${status.reason} (secure context: ${status.isSecureContext ? 'yes' : 'no'}, permissions policy: ${status.permissionsPolicy === false ? 'blocked' : status.permissionsPolicy === true ? 'allowed' : 'unknown'}).`);
  return false;
}

function nextSequence() { state.sequence = (state.sequence + 1) & 0xffff; return state.sequence; }

function isRegisteredEntry(entry) {
  return Boolean(entry && !entry.disposed && state.devices.get(entry.id) === entry);
}

function assertBridgeTransactionAllowed(entry, command) {
  if (!isRegisteredEntry(entry)) throw new ProtocolError('The HID device entry is no longer active', 'transaction_cancelled');
  const identity = inspectMiraLinkHidIdentity(entry.device);
  entry.bridgeIdentity = identity;
  if (!identity.bridgeCandidate || (command !== COMMANDS.hello && (entry.kind !== 'bridge' || !entry.bridgeVerified))) {
    throw new ProtocolError('Refusing MiraLink management traffic for an unverified HID device', 'untrusted_hid_device');
  }
  if (!entry.device.opened) throw new ProtocolError('The HID device is not open', 'device_not_open');
}

function transact(entry, command, payload = new Uint8Array(), timeoutMs = 1400) {
  if (!entry?.transactionQueue) {
    return Promise.reject(new ProtocolError('The HID transaction queue is unavailable', 'transaction_cancelled'));
  }
  return entry.transactionQueue.enqueue(async ({ assertActive }) => {
    const assertCurrent = () => {
      assertActive();
      if (!isRegisteredEntry(entry)) throw new ProtocolError('The HID device entry is no longer active', 'transaction_cancelled');
    };
    assertBridgeTransactionAllowed(entry, command);
    // Sequence allocation happens only when the transaction reaches the head
    // of the queue. No stale entry may auto-open or write to a new device.
    return transactFeatureReport(entry.device, {
      sequence: nextSequence(),
      command,
      payload,
      timeoutMs,
      assertActive: assertCurrent,
      onReceiveRetry: ({ attempt, maximum, error }) => {
        addLog('info', `WebHID response read retry ${attempt}/${maximum} for command 0x${command.toString(16).padStart(2, '0')} (${error.browserErrorName}): ${error.message}; the command was not resent.`);
      }
    });
  });
}

function identifyAsDirectDualSense(entry) {
  try { entry.adapter?.stop(); } catch {}
  entry.kind = 'controller';
  entry.kindLabel = 'Manette DualSense';
  entry.transport = 'usb';
  entry.adapter = createDualSenseAdapter(entry.device, {
    onSample: (sample) => recordControllerSample(entry, sample),
    onError: (error) => addLog('error', `${entry.label} input report rejected: ${error.message}`)
  });
  entry.adapter.start();
  entry.state = 'ready';
  entry.error = null;
  entry.errorObject = null;
  entry.connectionSummary = 'DualSense filaire identifiée.';
  entry.nextAction = 'Bougez une commande pour vérifier les entrées dans l’espace Manettes.';
  addLog('info', `${entry.label} identified as a DualSense controller. Direct wired input is available; use the Pico 2 W bridge for Bluetooth output features.`);
}

async function identifyAsMiraLinkBridge(entry) {
  entry.bridgeVerified = false;
  entry.kind = 'bridge';
  entry.kindLabel = 'MiraLink bridge';
  entry.transport = 'usb';
  entry.state = 'handshaking';
  entry.nextAction = 'Attendez la réponse HELLO du Pico.';
  const response = await transact(entry, COMMANDS.hello);
  const hello = decodeHelloPayload(response.payload);
  entry.bridgeVerified = true;
  entry.firmwareVersion = `protocol ${hello.protocolVersion}`;
  entry.hello = hello;
  entry.state = 'ready';
  entry.error = null;
  entry.errorObject = null;
  entry.connectionSummary = 'Le canal de contrôle MiraLink répond.';
  entry.nextAction = 'Ouvrez Diagnostics pour vérifier la radio Bluetooth et les entrées.';
  entry.pollFailureCount = 0;
  try {
    const infoResponse = await transact(entry, COMMANDS.getInfo, new Uint8Array(), 500);
    entry.firmwareVersion = decodeInfoPayload(infoResponse.payload).version;
  } catch (error) {
    addLog('info', `${entry.label} did not expose a readable firmware version: ${error.message}`);
  }
  try {
    const capabilityResponse = await transact(entry, COMMANDS.getControllerCapabilities, new Uint8Array(), 500);
    entry.controllerCapabilities = decodeControllerCapabilities(capabilityResponse.payload);
  } catch (error) {
    entry.controllerCapabilities = null;
    addLog('info', `${entry.label} does not expose controller capabilities yet: ${error.message}`);
  }
  addLog('info', `${entry.label} identified as MiraLink bridge.`);
  startBridgePolling(entry);
}

function markConnectionFailure(entry, error, { bridgeIdentified = entry.bridgeIdentity?.bridgeCandidate, operation = 'connection' } = {}) {
  stopBridgePolling(entry);
  const guidance = describeWebHidError(error, { bridgeIdentified, operation });
  if (bridgeIdentified) {
    entry.kind = 'bridge';
    entry.kindLabel = 'MiraLink bridge';
  } else if (isDualSenseDevice(entry.device)) {
    entry.kind = 'controller';
    entry.kindLabel = 'Manette DualSense';
  } else {
    entry.kind = 'unknown';
    entry.kindLabel = 'Unsupported HID device';
  }
  entry.state = 'error';
  entry.error = guidance.detail;
  entry.errorObject = error;
  entry.connectionSummary = guidance.summary;
  entry.nextAction = guidance.nextAction;
  entry.retryable = guidance.retryable;
  addLog('error', `${entry.label}: ${guidance.summary} Prochaine étape : ${guidance.nextAction}`);
  if (bridgeIdentified) showBridgeConnectionDiagnostics(entry);
}

async function identify(entry) {
  const directDualSense = isDualSenseDevice(entry.device);
  entry.bridgeIdentity = inspectMiraLinkHidIdentity(entry.device);
  const identificationOrder = getHidIdentificationOrder(entry.device, directDualSense);
  let bridgeError = null;

  for (const candidate of identificationOrder) {
    if (candidate === 'bridge') {
      try {
        await identifyAsMiraLinkBridge(entry);
        return true;
      } catch (error) {
        bridgeError = error;
      }
    } else {
      identifyAsDirectDualSense(entry);
      return true;
    }
  }

  const error = bridgeError || new ProtocolError('Unsupported HID device', 'unsupported_device');
  markConnectionFailure(entry, error, { bridgeIdentified: entry.bridgeIdentity.bridgeCandidate, operation: 'hello' });
  return false;
}

function handleBridgeEvent(entry, event) {
  if (!isRegisteredEntry(entry) || event.device !== entry.device || event.reportId !== REPORT_IDS.event) return;
  try {
    const frame = decodeFrame(event.data);
    if (frame.command !== COMMANDS.getControllerState) return;
    const controllerState = decodeControllerStatePayload(frame.payload);
    const previousControllerState = entry.controllerState;
    entry.controllerState = controllerState;
    if (controllerState.sample) recordControllerSample(entry, controllerState.sample);
    if (!controllerState.inputAvailable) {
      entry.lastSample = null;
      if (entry.id === state.activeDeviceId) renderControllerLab(entry);
    }
    if (controllerOverviewChanged(previousControllerState, controllerState)) updateOverview();
  } catch (error) {
    addLog('error', `${entry.label} controller event rejected: ${error.message}`);
  }
}

function startBridgePolling(entry) {
  if (entry.kind !== 'bridge' || entry.pollRunning) return;
  const generation = (entry.pollGeneration || 0) + 1;
  entry.pollGeneration = generation;
  entry.pollRunning = true;
  entry.pollFailureCount = 0;

  const pollingIsCurrent = () => entry.pollRunning
    && entry.pollGeneration === generation
    && isRegisteredEntry(entry)
    && entry.state === 'ready';

  const schedule = (delayMs) => {
    if (!pollingIsCurrent()) return;
    entry.pollTimer = window.setTimeout(() => {
      entry.pollTimer = null;
      void poll();
    }, delayMs);
  };

  const poll = async () => {
    if (!pollingIsCurrent()) return;
    let nextDelayMs = CONTROLLER_POLL_INTERVAL_MS;
    try {
      const response = await transact(entry, COMMANDS.getControllerState, new Uint8Array(), 350);
      if (!pollingIsCurrent()) return;
      const controllerState = decodeControllerStatePayload(response.payload);
      const recoveredFailures = entry.pollFailureCount || 0;
      entry.pollFailureCount = 0;
      const previousControllerState = entry.controllerState;
      entry.controllerState = controllerState;
      if (controllerState.sample) {
        recordControllerSample(entry, controllerState.sample);
      } else if (!controllerState.inputAvailable) {
        entry.lastSample = null;
        if (entry.id === state.activeDeviceId) renderControllerLab(entry);
      }
      if (controllerOverviewChanged(previousControllerState, controllerState)) updateOverview();
      if (recoveredFailures > 0) {
        addLog('info', `Controller polling recovered after ${recoveredFailures} failed ${recoveredFailures === 1 ? 'attempt' : 'attempts'}.`);
      }
    } catch (error) {
      if (pollingIsCurrent()) {
        entry.pollFailureCount = (entry.pollFailureCount || 0) + 1;
        const stage = error?.operationStage ? ` · ${error.operationStage}` : '';
        const code = error?.code || error?.name || 'webhid_error';
        addLog('info', `Controller polling retry ${entry.pollFailureCount}/${CONTROLLER_POLL_MAX_FAILURES} (${code}${stage}): ${error.message}`);
        if (entry.pollFailureCount >= CONTROLLER_POLL_MAX_FAILURES) {
          markConnectionFailure(entry, error, { bridgeIdentified: true, operation: 'supervision' });
          renderDevices();
          updateUiForActiveDevice();
          setGlobalStatus('Bridge attention', 'error');
        } else {
          nextDelayMs = CONTROLLER_POLL_RETRY_DELAYS_MS[entry.pollFailureCount - 1] || CONTROLLER_POLL_RETRY_DELAYS_MS.at(-1);
        }
      }
    } finally {
      schedule(nextDelayMs);
    }
  };
  void poll();
}

function stopBridgePolling(entry) {
  if (!entry) return;
  entry.pollRunning = false;
  entry.pollGeneration = (entry.pollGeneration || 0) + 1;
  if (entry.pollTimer) window.clearTimeout(entry.pollTimer);
  entry.pollTimer = null;
}

async function reconnectEntry(entry, { initial = false } = {}) {
  if (entry.connectionPromise) return entry.connectionPromise;
  const connection = (async () => {
    stopBridgePolling(entry);
    entry.state = initial ? 'opening' : 'reconnecting';
    entry.nextAction = initial ? 'Attendez l’ouverture du périphérique.' : 'Reconnexion WebHID en cours.';
    renderDevices();
    updateUiForActiveDevice();
    setGlobalStatus(initial ? 'Connecting' : 'Reconnecting', 'busy');
    try {
      await entry.transactionQueue.drain();
      if (!isRegisteredEntry(entry)) throw new ProtocolError('The HID device entry is no longer active', 'transaction_cancelled');
      entry.bridgeIdentity = inspectMiraLinkHidIdentity(entry.device);
      entry.bridgeVerified = false;
      if (!initial && entry.device.opened) {
        addLog('info', `${entry.label}: reopening the authorised WebHID session before identification.`);
        await entry.device.close();
      }
      if (!isRegisteredEntry(entry)) throw new ProtocolError('The HID device entry is no longer active', 'transaction_cancelled');
      if (!entry.device.opened) await entry.device.open();
      if (!isRegisteredEntry(entry)) throw new ProtocolError('The HID device entry is no longer active', 'transaction_cancelled');
      await identify(entry);
    } catch (error) {
      if (isRegisteredEntry(entry)) markConnectionFailure(entry, error, { bridgeIdentified: entry.bridgeIdentity?.bridgeCandidate });
    }
    if (!isRegisteredEntry(entry)) return entry;
    renderDevices();
    updateUiForActiveDevice();
    updateInstalledVersion();
    setGlobalStatus(entry.state === 'ready' ? 'Ready' : 'Action required', entry.state === 'ready' ? 'idle' : 'error');
    return entry;
  })();
  entry.connectionPromise = connection;
  try {
    return await connection;
  } finally {
    entry.connectionPromise = null;
  }
}

async function registerDevice(device) {
  hideHidWarning();
  const existing = [...state.devices.values()].find((entry) => entry.device === device);
  if (existing) {
    selectEntry(existing);
    if (existing.connectionPromise) await existing.connectionPromise;
    else if (existing.state !== 'ready' || !existing.device.opened) await reconnectEntry(existing);
    else { renderDevices(); updateUiForActiveDevice(); updateInstalledVersion(); }
    return existing;
  }
  const id = `device-${Date.now()}-${state.devices.size + 1}`;
  const bridgeIdentity = inspectMiraLinkHidIdentity(device);
  const entry = { id, device, label: device.productName || 'Appareil MiraLink', kind: bridgeIdentity.bridgeCandidate ? 'bridge' : 'unknown', kindLabel: bridgeIdentity.bridgeCandidate ? 'MiraLink bridge' : 'Identification', state: 'opening', config: null, draft: null, savedConfig: null, analysisSnapshots: [], firmwareVersion: null, adapter: null, sampleCount: 0, sampleHistory: [], controllerState: null, lastSample: null, pollTimer: null, pollRunning: false, pollGeneration: 0, pollFailureCount: 0, transactionQueue: createHidTransactionQueue(), connectionPromise: null, disposed: false, bridgeIdentity, bridgeVerified: false, usbReenumerationRequired: false, expectedUsbDisconnect: false, lastCommitAck: null, nextAction: 'Attendez l’ouverture du périphérique.' };
  entry.eventHandler = (event) => handleBridgeEvent(entry, event);
  device.addEventListener('inputreport', entry.eventHandler);
  state.devices.set(id, entry);
  selectEntry(entry);
  await reconnectEntry(entry, { initial: true });
  return entry;
}

async function connectDevice() {
  if (!requireHid()) return;
  try {
    setGlobalStatus('Waiting for device', 'busy');
    const devices = await navigator.hid.requestDevice({ filters: [MIRALINK_USB_FILTER, ...dualSenseWebHidFilters()] });
    for (const device of devices) {
      await registerDevice(device);
      const entry = [...state.devices.values()].find((item) => item.device === device);
      if (entry?.kind === 'bridge' && entry.state === 'ready') await openPairingWindow(entry);
    }
    if (!devices.length) setGlobalStatus('Ready', 'idle');
  } catch (error) {
    if (isHidRequestCancellation(error)) {
      setGlobalStatus('Ready', 'idle');
      addLog('info', 'Device selection was closed without changing the current connection.');
    } else {
      setGlobalStatus('Error', 'error');
      addLog('error', `Device request failed: ${error.message}`);
    }
  }
}

async function refreshDevices() {
  if (!requireHid()) return;
  try {
    setGlobalStatus('Refreshing', 'busy');
    const devices = await navigator.hid.getDevices();
    for (const device of devices) await registerDevice(device);
    renderDevices();
    const ready = [...state.devices.values()].some((entry) => entry.state === 'ready');
    const hasError = [...state.devices.values()].some((entry) => entry.state === 'error');
    setGlobalStatus(ready ? 'Ready' : hasError ? 'Action required' : 'No authorised device', hasError && !ready ? 'error' : 'idle');
  } catch (error) {
    setGlobalStatus('Error', 'error');
    addLog('error', `Device refresh failed: ${error.message}`);
  }
}

async function disconnectEntry(id) {
  const entry = state.devices.get(id);
  if (!entry) return;
  const expectedUsbDisconnect = entry.expectedUsbDisconnect === true;
  entry.disposed = true;
  stopBridgePolling(entry);
  entry.transactionQueue.cancel('The HID device was disconnected');
  try { entry.adapter?.stop(); } catch (error) { addLog('error', `Controller adapter stop failed: ${error.message}`); }
  entry.device.removeEventListener('inputreport', entry.eventHandler);
  state.devices.delete(id);
  if (state.activeDeviceId === id) {
    state.activeDeviceId = null;
    state.draft = null;
    state.savedConfig = null;
    const nextEntry = state.devices.values().next().value;
    if (nextEntry) selectEntry(nextEntry);
  }
  renderDevices(); updateUiForActiveDevice(); updateInstalledVersion();
  if (!state.devices.size && !hasHid()) showHidWarning(webHidStatus());
  await entry.transactionQueue.drain();
  try { if (entry.device.opened) await entry.device.close(); } catch (error) { addLog('error', `Close failed: ${error.message}`); }
  if (expectedUsbDisconnect) {
    setGlobalStatus('Waiting for USB reconnect', 'busy');
    addLog('info', `${entry.label} disconnected temporarily as expected after the explicit RECONNECT_USB command; waiting for Windows to enumerate it again.`);
  } else {
    addLog('info', `${entry.label} disconnected.`);
  }
}

async function readConfig() {
  const entry = activeEntry(); if (!entry || entry.kind !== 'bridge') return;
  try {
    setGlobalStatus('Reading', 'busy');
    const response = await transact(entry, COMMANDS.getConfig);
    const config = decodeConfig(response.payload);
    entry.config = { ...config };
    state.savedConfig = { ...config };
    state.draft = { ...config };
    syncActiveWorkingCopy();
    renderConfig(config);
    updateUiForActiveDevice();
    addLog('info', 'Configuration read from Pico 2 W.');
    setGlobalStatus('Ready', 'idle');
  } catch (error) {
    setGlobalStatus('Error', 'error');
    addLog('error', `Configuration read failed: ${error.message}`);
  }
}

function askConfirmation(message) {
  const dialog = $('#confirm-dialog');
  if (!dialog.showModal) return Promise.resolve(window.confirm(message));
  $('#confirm-message').textContent = message;
  // Dialog return values persist across openings. Clear the previous choice so
  // closing a later prompt with Escape can never reuse an earlier approval.
  dialog.returnValue = '';
  return new Promise((resolve) => { const done = () => { dialog.removeEventListener('close', done); resolve(dialog.returnValue === 'confirm'); }; dialog.addEventListener('close', done); dialog.showModal(); });
}

function applyCommitAcknowledgement(entry, acknowledgement, operation) {
  entry.lastCommitAck = acknowledgement;
  if (acknowledgement.usbReenumerationRequired === true) entry.usbReenumerationRequired = true;

  if (!acknowledgement.supported) {
    addLog('info', `${operation} succeeded with a legacy empty COMMIT_CONFIG acknowledgement; USB re-enumeration requirement is unknown and no reconnect was started.`);
  } else if (acknowledgement.usbReenumerationRequired) {
    addLog('info', `${operation} succeeded; firmware reports that USB re-enumeration is required. Use the separate confirmed USB reconnect action when ready.`);
  } else {
    addLog('info', `${operation} succeeded; firmware reports that USB re-enumeration is not required.`);
  }
}

function storeCommittedConfig(entry, config, acknowledgement, operation) {
  entry.config = { ...config };
  state.savedConfig = { ...config };
  state.draft = { ...config };
  syncActiveWorkingCopy();
  applyCommitAcknowledgement(entry, acknowledgement, operation);
  renderConfig(config);
  updateUiForActiveDevice();
  setGlobalStatus('Ready', 'idle');
}

async function saveConfig() {
  const entry = activeEntry(); if (!entry || entry.kind !== 'bridge') return;
  try {
    if (!canEditBridgeConfiguration(entry, state.savedConfig)) throw new ProtocolError('Lisez la configuration actuelle avant toute écriture.', 'config_not_loaded');
    const config = readDraftFromControls();
    const changes = diffConfig(state.savedConfig, config);
    if (!changes.length) {
      addLog('info', 'No configuration change to save.');
      updateUiForActiveDevice();
      return;
    }
    const difference = formatConfigurationChanges(changes);
    if (!await askConfirmation(`Écrire cette configuration validée dans la mémoire flash du Pico 2 W ?\n\nModifications avant → après :\n${difference}`)) return;
    setGlobalStatus('Writing', 'busy');
    await transact(entry, COMMANDS.setConfigDraft, encodeConfig(config));
    const commitResponse = await transact(entry, COMMANDS.commitConfig);
    const acknowledgement = decodeCommitConfigAck(commitResponse.payload);
    storeCommittedConfig(entry, config, acknowledgement, 'Configuration write');
  } catch (error) { setGlobalStatus('Error', 'error'); addLog('error', `Configuration write failed: ${error.message}`); }
}

async function factoryResetConfig() {
  const entry = activeEntry(); if (!entry || entry.kind !== 'bridge') return;
  try {
    if (!canEditBridgeConfiguration(entry, state.savedConfig)) throw new ProtocolError('Lisez la configuration actuelle avant une restauration d’usine.', 'config_not_loaded');
    const factoryConfig = assertValidConfig(defaultConfig());
    const changes = diffConfig(state.savedConfig, factoryConfig);
    const difference = changes.length
      ? formatConfigurationChanges(changes)
      : '• Aucun écart : la configuration lue correspond déjà aux réglages d’usine.';
    if (!await askConfirmation(`Restaurer tous les réglages d’usine du Pico 2 W ?\n\nConfiguration actuelle → usine :\n${difference}\n\nCette action est distincte de la réinitialisation du brouillon local et écrit dans la mémoire flash.`)) return;
    setGlobalStatus('Writing factory defaults', 'busy');
    await transact(entry, COMMANDS.resetConfig);
    const commitResponse = await transact(entry, COMMANDS.commitConfig);
    const acknowledgement = decodeCommitConfigAck(commitResponse.payload);
    storeCommittedConfig(entry, factoryConfig, acknowledgement, 'Factory reset');
  } catch (error) {
    setGlobalStatus('Error', 'error');
    addLog('error', `Factory reset failed: ${error.message}`);
  }
}

function usbDisconnectObserved(entry, error = null) {
  return !isRegisteredEntry(entry) || entry?.device?.opened === false || error?.code === 'device_disconnected';
}

function usbDisconnectMayFollow(error) {
  const browserErrorName = error?.browserErrorName || error?.cause?.name || error?.name;
  return error?.code === 'timeout'
    || (error?.code === 'device_io'
    && error?.operationStage === 'receive'
    && ['InvalidStateError', 'NetworkError', 'NotFoundError', 'NotReadableError'].includes(browserErrorName));
}

async function waitForUsbDisconnect(entry, error = null) {
  const deadline = Date.now() + USB_DISCONNECT_OBSERVE_TIMEOUT_MS;
  while (!usbDisconnectObserved(entry, error) && Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, USB_DISCONNECT_OBSERVE_INTERVAL_MS));
  }
  return usbDisconnectObserved(entry, error);
}

async function finishObservedUsbDisconnect(entry) {
  entry.usbReenumerationRequired = false;
  if (isRegisteredEntry(entry) && entry.device.opened === false) await disconnectEntry(entry.id);
}

function restoreAfterMissingUsbDisconnect(entry, detail) {
  if (!isRegisteredEntry(entry)) return;
  entry.expectedUsbDisconnect = false;
  entry.usbReenumerationRequired = true;
  entry.nextAction = 'La déconnexion USB attendue n’a pas été observée ; le bridge reste actif et aucune commande n’a été renvoyée.';
  startBridgePolling(entry);
  renderDevices();
  updateUiForActiveDevice();
  setGlobalStatus('USB reconnect failed', 'error');
  addLog('error', `${detail} No RECONNECT_USB retry was sent; polling resumed on the existing verified bridge.`);
}

async function reconnectUsb() {
  const entry = activeEntry();
  if (!entry || entry.kind !== 'bridge' || entry.state !== 'ready' || !entry.usbReenumerationRequired) return;
  if (!await askConfirmation('Reconnecter maintenant le pont USB ?\n\nLe Pico 2 W disparaîtra brièvement de Windows. Cette déconnexion est attendue et distincte de l’enregistrement de la configuration.')) return;

  stopBridgePolling(entry);
  entry.expectedUsbDisconnect = true;
  entry.nextAction = 'Déconnexion USB temporaire attendue ; le navigateur reprendra le pont quand Windows l’aura réénuméré.';
  $('#reconnect-usb-button').disabled = true;
  setGlobalStatus('USB reconnect requested', 'busy');
  addLog('info', 'Explicit RECONNECT_USB requested after confirmation; a temporary HID disconnect is expected.');
  try {
    await transact(entry, COMMANDS.reconnectUsb, new Uint8Array(), 900);
    addLog('info', 'RECONNECT_USB acknowledged; waiting for the expected temporary USB disconnect.');
    if (await waitForUsbDisconnect(entry)) {
      addLog('info', 'Expected USB disconnect observed after the RECONNECT_USB acknowledgement.');
      await finishObservedUsbDisconnect(entry);
      return;
    }
    restoreAfterMissingUsbDisconnect(entry, `RECONNECT_USB was acknowledged, but no USB disconnect followed within ${USB_DISCONNECT_OBSERVE_TIMEOUT_MS} ms.`);
  } catch (error) {
    if (usbDisconnectObserved(entry, error)) {
      addLog('info', `Expected USB disconnect observed while RECONNECT_USB completed: ${error.message}`);
      await finishObservedUsbDisconnect(entry);
      return;
    }
    if (usbDisconnectMayFollow(error)) {
      addLog('info', `RECONNECT_USB may have reached the firmware, but its ACK was not readable; waiting up to ${USB_DISCONNECT_OBSERVE_TIMEOUT_MS} ms for the physical disconnect: ${error.message}`);
      if (await waitForUsbDisconnect(entry)) {
        addLog('info', `Expected USB disconnect observed after an unreadable RECONNECT_USB acknowledgement: ${error.message}`);
        await finishObservedUsbDisconnect(entry);
        return;
      }
      restoreAfterMissingUsbDisconnect(entry, `RECONNECT_USB ACK could not be confirmed and no USB disconnect followed within ${USB_DISCONNECT_OBSERVE_TIMEOUT_MS} ms: ${error.message}`);
      return;
    }
    entry.expectedUsbDisconnect = false;
    entry.nextAction = 'La reconnexion USB explicite a échoué ; le bridge reste utilisable sans nouvelle tentative automatique.';
    startBridgePolling(entry);
    updateUiForActiveDevice();
    setGlobalStatus('Error', 'error');
    addLog('error', `Explicit USB reconnect failed: ${error.message}`);
  }
}

async function resetDraft() {
  if (!state.draft || !await askConfirmation('Discard the local configuration draft?')) return;
  if (!state.savedConfig) return;
  state.draft = { ...state.savedConfig };
  syncActiveWorkingCopy();
  renderConfig(state.draft); updateUiForActiveDevice(); addLog('info', 'Local draft reset.');
}

function wireDraftControls() {
  ['haptics-gain', 'trigger-reduce', 'polling-mode', 'inactive-time', 'disable-led', 'enable-wake', 'controller-mode', 'enable-usb-sn'].forEach((id) => $( `#${id}`).addEventListener('input', () => {
    try {
      state.draft = readDraftFromControls();
      syncActiveWorkingCopy();
      renderConfig(state.draft);
      updateUiForActiveDevice();
    } catch (error) {
      addLog('error', error.message);
    }
  }));
}

let localProfileStore = null;

function getLocalProfileStore() {
  if (localProfileStore) return localProfileStore;
  try {
    localProfileStore = createProfileStore(globalThis.localStorage);
  } catch {
    localProfileStore = createProfileStore(null);
  }
  return localProfileStore;
}

async function applyLocalProfile(profile) {
  const entry = activeEntry();
  if (!canEditBridgeConfiguration(entry, state.savedConfig) || !state.draft) {
    $('#controller-lab-dialog')?.close('profile-needs-config');
    scrollToSection('tab-bridge');
    addLog('error', 'Lisez la configuration du Pico 2 W avant de préparer un profil.');
    return;
  }
  const current = state.draft;
  const target = { type: 'bridge', id: entry?.kind === 'bridge' ? entry.id : null };
  const safeProfile = {
    ...profile,
    config: {
      ...profile.config,
      audioBufferLength: current.audioBufferLength,
      psShortcut: current.psShortcut
    }
  };
  const preview = previewProfileApplication(safeProfile, current, target);
  if (!preview.ok) {
    addLog('error', preview.message);
    return;
  }
  $('#controller-lab-dialog')?.close('profile-preview');
  const difference = formatConfigurationChanges(preview.changes);
  if (preview.requiresConfirmation && !await askConfirmation(`Préparer le profil ${preview.profileName} comme brouillon local ?\n\nModifications avant → après :\n${difference}\n\nRien ne sera écrit sur le Pico 2 W à cette étape.`)) {
    openProfilesManager();
    return;
  }
  const applied = commitProfileApplication(preview, { confirmed: true });
  state.draft = { ...applied.config };
  syncActiveWorkingCopy();
  renderConfig(state.draft);
  updateUiForActiveDevice();
  scrollToSection('tab-bridge');
  addLog('info', `Profile ${preview.profileName} applied as a local draft; Pico flash was not modified.`);
}

function saveCurrentLocalProfile() {
  const entry = activeEntry();
  if (!canEditBridgeConfiguration(entry, state.savedConfig) || !state.draft) {
    addLog('error', 'Lisez la configuration du Pico 2 W avant d’enregistrer un profil.');
    return;
  }
  const name = window.prompt('Nom du profil local :');
  if (!name?.trim()) return;
  const now = new Date().toISOString();
  const id = `custom-${Date.now().toString(36)}`;
  try {
    const profile = createProfile({
      id,
      name: name.trim(),
      description: 'Profil local créé depuis le brouillon MiraLink.',
      target: { type: 'bridge', id: null },
      config: state.draft,
      builtIn: false,
      createdAt: now,
      updatedAt: now
    });
    const result = getLocalProfileStore().save(profile);
    if (!result.ok) throw new Error(result.message || result.reason);
    addLog('info', `Local profile ${profile.name} saved in this browser.`);
    $('#controller-lab-dialog')?.close('profile-saved');
    openProfilesManager();
  } catch (error) {
    addLog('error', `Local profile could not be saved: ${error.message}`);
  }
}

function importLocalProfiles() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const result = getLocalProfileStore().importDocument(JSON.parse(await file.text()));
      if (!result.ok) throw new Error(result.message || result.reason);
      addLog('info', `${result.imported} local profile(s) imported.`);
      $('#controller-lab-dialog')?.close('profiles-imported');
      openProfilesManager();
    } catch (error) {
      addLog('error', `Profile import rejected: ${error.message}`);
    }
  }, { once: true });
  input.click();
}

function openProfilesManager() {
  const store = getLocalProfileStore();
  const builtIn = createBuiltInProfiles();
  const custom = store.list();
  showControllerLabDialog({
    title: 'Profils MiraLink',
    message: 'Choisissez un profil pour préparer un brouillon local. Une écriture sur le Pico demandera toujours une confirmation séparée.',
    buildBody: (body) => {
      for (const profile of [...builtIn, ...custom]) {
        const row = document.createElement('div');
        row.className = 'log-line';
        const copy = document.createElement('span');
        copy.textContent = `${profile.name} · ${profile.description}`;
        const apply = document.createElement('button');
        apply.className = 'button quiet';
        apply.type = 'button';
        apply.textContent = 'Préparer le brouillon';
        apply.addEventListener('click', () => applyLocalProfile(profile));
        row.append(copy, apply);
        if (!profile.builtIn) {
          const remove = document.createElement('button');
          remove.className = 'button quiet';
          remove.type = 'button';
          remove.textContent = 'Supprimer';
          remove.addEventListener('click', async () => {
            if (!await askConfirmation(`Delete the local profile ${profile.name}?`)) return;
            store.remove(profile.id);
            $('#controller-lab-dialog')?.close('profile-removed');
            openProfilesManager();
          });
          row.append(remove);
        }
        body.append(row);
      }
      if (!store.available) {
        const unavailable = document.createElement('p');
        unavailable.textContent = 'Le stockage local est indisponible : les profils intégrés restent utilisables, mais les profils personnalisés ne peuvent pas être conservés.';
        body.append(unavailable);
      }
    },
    actions: [
      { label: 'Enregistrer le brouillon', onClick: saveCurrentLocalProfile },
      { label: 'Importer', onClick: importLocalProfiles },
      { label: 'Exporter', onClick: () => downloadJson('miralink-profiles.json', store.exportDocument()) }
    ]
  });
}

async function inspectFirmware(event) {
  const file = event.target.files?.[0]; if (!file) return;
  const result = $('#firmware-result');
  if (!result) return;
  result.hidden = false;
  result.textContent = 'Inspection locale en cours…';
  try {
    const buffer = await file.arrayBuffer();
    const inspection = await inspectUf2(buffer);
    result.dataset.state = inspection.ok ? 'pass' : 'error';
    result.textContent = inspection.ok
      ? `STRUCTURE VALIDE — ${inspection.message}${inspection.sha256 ? ` SHA-256 local ${inspection.sha256}.` : ' SHA-256 local indisponible dans ce contexte.'} La cible, l’identité matérielle et l’authenticité ne sont pas vérifiées. Aucun flash n’a été lancé.`
      : `STRUCTURE INVALIDE — ${inspection.message} Le fichier n’a pas été utilisé ; aucune cible, identité matérielle ou authenticité n’a été vérifiée.`;
    addLog(inspection.ok ? 'info' : 'error', `UF2 inspection: ${result.textContent}`);
  } catch (error) {
    result.dataset.state = 'error';
    result.textContent = `Inspection failed: ${error.message}`;
    addLog('error', result.textContent);
  } finally {
    event.target.value = '';
  }
}

async function exportBackup() {
  const config = state.draft || state.savedConfig;
  if (!config) {
    addLog('error', 'Lisez une configuration du Pico 2 W avant de l’exporter.');
    return;
  }
  downloadJson(`miralink-backup-${new Date().toISOString().slice(0, 10)}.json`, createBackup({ config, device: activeEntry(), version: state.version.version }));
  addLog('info', 'Local backup exported.');
}

async function importBackup(event) {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    const entry = activeEntry();
    if (!canEditBridgeConfiguration(entry, state.savedConfig)) throw new Error('Lisez d’abord la configuration actuelle du Pico 2 W.');
    const value = validateBackup(JSON.parse(await file.text()));
    state.draft = assertValidConfig(value.config);
    syncActiveWorkingCopy();
    renderConfig(state.draft);
    updateUiForActiveDevice();
    scrollToSection('tab-bridge');
    addLog('info', 'Backup loaded into a local draft.');
  } catch (error) { addLog('error', `Backup rejected: ${error.message}`); }
  event.target.value = '';
}

async function runDiagnostics() {
  let entry = activeEntry();
  for (const node of $$('[data-diagnostic]')) node.textContent = entry ? '…' : translate('notConnected');
  if (!entry) { $('#diagnostic-summary').textContent = translate('noDevicesCopy'); return; }
  if (entry.kind !== 'bridge') {
    for (const node of $$('[data-diagnostic]')) node.textContent = 'Indisponible';
    $('#diagnostic-summary').textContent = entry.state === 'ready'
      ? 'Les entrées de la manette filaire sont disponibles, mais les diagnostics du bridge nécessitent un Pico 2 W connecté.'
      : `${entry.connectionSummary || 'La manette filaire n’est pas prête.'} Prochaine étape : ${entry.nextAction || 'Reconnectez-la puis actualisez.'}`;
    addLog('info', 'Diagnostics du bridge indisponibles pour une connexion manette directe.');
    return;
  }
  if (entry.state !== 'ready') {
    showBridgeConnectionDiagnostics(entry);
    await reconnectEntry(entry);
    entry = activeEntry();
    if (!entry || entry.state !== 'ready') {
      if (entry) showBridgeConnectionDiagnostics(entry);
      return;
    }
  }
  try {
    const response = await transact(entry, COMMANDS.getDiagnostics);
    const diagnostics = decodeDiagnosticsPayload(response.payload);
    let audio = null;
    try {
      const audioResponse = await transact(entry, COMMANDS.getAudioStatus, new Uint8Array(), 350);
      audio = decodeAudioStatusPayload(audioResponse.payload);
    } catch (error) {
      addLog('info', `Audio status is not exposed by this bridge firmware: ${error.message}`);
    }
    $('[data-diagnostic="usb"]').textContent = diagnostics.usbMounted ? 'PASS' : 'FAIL';
    $('[data-diagnostic="radio"]').textContent = diagnostics.bluetoothAvailable ? 'PASS' : 'Unavailable';
    const audioStreaming = Boolean(diagnostics.audioUsbStreaming || diagnostics.audioBluetoothStreaming || audio?.usbStreaming || audio?.bluetoothStreaming);
    const audioLinked = Boolean(audio?.bluetoothLinkAvailable || diagnostics.audioBluetoothStreaming);
    $('[data-diagnostic="audio"]').textContent = audioStreaming ? 'PASS' : audioLinked ? 'Ready' : 'Not tested';
    $('[data-diagnostic="storage"]').textContent = diagnostics.configLoaded ? 'PASS' : 'Not tested';
    const radioState = diagnostics.bluetoothAvailable
      ? diagnostics.controllerConnected ? 'connected' : diagnostics.pairingWindowOpen ? 'pairing window open' : 'ready'
      : 'unavailable';
    const audioState = audioStreaming ? 'streaming' : audioLinked ? 'link ready, no stream' : 'no active local stream';
    const connectionIssue = diagnostics.lastConnectionError
      ? ` Last Bluetooth issue: ${connectionErrorLabel(diagnostics.lastConnectionError)} (status 0x${diagnostics.lastConnectionStatus.toString(16).padStart(2, '0')}).`
      : '';
    $('#diagnostic-summary').textContent = `USB ${diagnostics.usbMounted ? 'mounted' : 'not mounted'}; flash ${diagnostics.configLoaded ? 'loaded' : 'safe defaults'}; Bluetooth ${radioState}; audio ${audioState}.${connectionIssue}`;
    entry.lastDiagnostics = diagnostics;
    entry.connectionSummary = 'Les diagnostics du pont répondent.';
    entry.nextAction = diagnostics.inputAvailable
      ? 'Testez les boutons et joysticks dans l’espace Manettes.'
      : diagnostics.controllerConnected
        ? 'La manette est connectée mais aucune entrée valide n’arrive : vérifiez le firmware et reconnectez la manette.'
        : 'Ouvrez la fenêtre d’appairage puis connectez la DualSense au Pico.';
    renderDevices();
    addLog('info', 'Diagnostics completed with capability limits reported.');
  } catch (error) {
    for (const node of $$('[data-diagnostic]')) node.textContent = 'Unavailable';
    const guidance = describeWebHidError(error, { bridgeIdentified: true, operation: 'diagnostic' });
    entry.connectionSummary = guidance.summary;
    entry.nextAction = guidance.nextAction;
    $('#diagnostic-summary').textContent = `${guidance.summary} Prochaine étape : ${guidance.nextAction}`;
    addLog('error', `Diagnostics failed: ${guidance.detail}`);
    renderDevices();
  }
}

async function openPairingWindow(targetEntry = readyBridgeEntry()) {
  const entry = targetEntry;
  if (!entry || entry.kind !== 'bridge') {
    addLog('error', 'Connect a MiraLink bridge before opening its Bluetooth pairing window.');
    return;
  }
  if (entry.state !== 'ready') {
    openEntryDiagnostics(entry);
    addLog('error', `The MiraLink bridge is detected but not ready. ${entry.nextAction}`);
    return;
  }
  if (!await askConfirmation('Open the Pico 2 W Bluetooth pairing window for five minutes?')) return;
  try {
    setGlobalStatus('Pairing window', 'busy');
    await transact(entry, COMMANDS.openPairingWindow);
    addLog('info', 'Bluetooth pairing window opened locally for five minutes.');
    setGlobalStatus('Ready', 'idle');
  } catch (error) {
    setGlobalStatus('Error', 'error');
    addLog('error', `Bluetooth pairing window failed: ${error.message}`);
  }
}

function ensureControllerLabDialog() {
  const existing = $('#controller-lab-dialog');
  if (existing) return existing;
  const dialog = document.createElement('dialog');
  dialog.id = 'controller-lab-dialog';
  dialog.className = 'confirm-dialog';
  dialog.setAttribute('aria-labelledby', 'controller-lab-title');
  const form = document.createElement('form');
  form.method = 'dialog';
  form.className = 'dialog-card';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'CONTROLLER LAB / LOCAL';
  const title = document.createElement('h2');
  title.id = 'controller-lab-title';
  const body = document.createElement('div');
  body.id = 'controller-lab-body';
  body.setAttribute('aria-live', 'polite');
  const actions = document.createElement('div');
  actions.id = 'controller-lab-actions';
  actions.className = 'action-row';
  form.append(eyebrow, title, body, actions);
  dialog.append(form);
  document.body.append(dialog);
  return dialog;
}

function showControllerLabDialog({ title, message, buildBody, actions = [] }) {
  const dialog = ensureControllerLabDialog();
  const titleNode = $('#controller-lab-title');
  const body = $('#controller-lab-body');
  const actionRow = $('#controller-lab-actions');
  titleNode.textContent = title;
  body.replaceChildren();
  if (message) {
    const copy = document.createElement('p');
    copy.textContent = message;
    body.append(copy);
  }
  buildBody?.(body);
  actionRow.replaceChildren();
  for (const action of actions) {
    const button = document.createElement('button');
    button.className = `button ${action.kind === 'primary' ? 'primary' : 'quiet'}`;
    button.type = 'button';
    button.textContent = action.label;
    button.addEventListener('click', action.onClick);
    actionRow.append(button);
  }
  const close = document.createElement('button');
  close.className = 'button quiet';
  close.type = 'submit';
  close.value = 'close';
  close.textContent = 'Fermer';
  actionRow.append(close);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else window.alert(`${title}\n\n${message || ''}`);
  return dialog;
}

function appendLabMetric(container, label, value) {
  const line = document.createElement('p');
  line.className = 'log-line';
  line.textContent = `${label}: ${value}`;
  container.append(line);
}

function formatLabValue(value, digits = 3) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '—';
}

function controllerSamples(entry) {
  return entry?.sampleHistory?.length ? entry.sampleHistory : entry?.lastSample ? [entry.lastSample] : [];
}

function openCalibrationWorkspace() {
  const entry = activeEntry();
  if (!entry) {
    showControllerLabDialog({ title: 'Analyse indisponible', message: 'Connectez le Pico 2 W et une manette avant d’ouvrir l’analyse locale des entrées.' });
    return;
  }
  const samples = controllerSamples(entry);
  if (!samples.length) {
    showControllerLabDialog({ title: 'Analyse en attente d’entrées', message: 'Le bridge est connecté, mais aucun échantillon valide n’est arrivé. Bougez un stick ou une gâchette, puis réessayez.' });
    addLog('info', 'Controller Lab opened without an input sample.');
    return;
  }
  let analysis;
  try {
    analysis = analyzeControllerInputs(samples);
  } catch (error) {
    showControllerLabDialog({ title: 'Analyse indisponible', message: `Les échantillons locaux n’ont pas pu être analysés : ${error.message}` });
    addLog('error', `Controller Lab analysis failed: ${error.message}`);
    return;
  }
  const dialog = showControllerLabDialog({
    title: 'Analyse locale des entrées',
    message: 'Cette analyse décrit seulement les entrées reçues pendant cette session. Un instantané reste en mémoire jusqu’à la fermeture ou la déconnexion ; il n’est ni persistant ni appliqué au firmware.',
    buildBody: (body) => {
      appendLabMetric(body, 'Échantillons d’entrée', analysis.sampleCount);
      appendLabMetric(body, 'Décalage du stick gauche', analysis.sticks.left.drift.detected ? `détecté (${formatLabValue(analysis.sticks.left.center.offset)})` : 'non détecté');
      appendLabMetric(body, 'Décalage du stick droit', analysis.sticks.right.drift.detected ? `détecté (${formatLabValue(analysis.sticks.right.center.offset)})` : 'non détecté');
      appendLabMetric(body, 'Amplitude gâchette gauche', `${formatLabValue(analysis.triggers.left.amplitude)} / 1`);
      appendLabMetric(body, 'Amplitude gâchette droite', `${formatLabValue(analysis.triggers.right.amplitude)} / 1`);
      appendLabMetric(body, 'Origine', analysis.status === 'available' && samples.at(-1)?.hardwareTested === true ? 'entrées reçues du matériel connecté' : 'matériel non vérifié');
    },
    actions: [{
      label: 'Créer un instantané de session',
      kind: 'primary',
      onClick: () => {
        const revision = createCalibrationRevision({ id: `revision-${Date.now()}`, deviceId: entry.id, analysis, source: 'session-input-analysis' });
        entry.analysisSnapshots = appendCalibrationRevision(entry.analysisSnapshots || [], revision);
        dialog.close('saved');
        addLog('info', `Session input analysis snapshot created for ${entry.label}; Pico flash was not modified.`);
        showControllerLabDialog({ title: 'Instantané de session créé', message: 'Cet instantané sert uniquement à une comparaison locale pendant cette session. Il ne corrige pas la manette, n’est pas enregistré durablement et n’a pas été écrit sur le Pico 2 W.' });
      }
    }]
  });
}

function runQuickControllerTest() {
  const entry = activeEntry();
  if (!entry) {
    showControllerLabDialog({ title: 'Test indisponible', message: 'Connectez le Pico 2 W et une manette avant de tester les entrées reçues.' });
    return;
  }
  const sample = entry.lastSample;
  const pressedButtons = sample?.buttons ? Object.entries(sample.buttons).filter(([name, pressed]) => name !== 'dpad' && pressed === true).map(([name]) => name) : [];
  showControllerLabDialog({
    title: 'Test local des entrées',
    message: 'Ce test lit uniquement les entrées locales. Il n’envoie aucune commande de vibration, d’audio ou de gâchette adaptative.',
    buildBody: (body) => {
      appendLabMetric(body, 'Bridge', entry.state === 'ready' ? 'PRÊT' : 'INDISPONIBLE');
      appendLabMetric(body, 'Entrées de la manette', sample ? 'REÇUES — échantillon matériel valide' : 'NON TESTÉES — aucun échantillon reçu');
      appendLabMetric(body, 'Sticks et gâchettes', sample ? 'VALEURS DISPONIBLES' : 'NON TESTÉS');
      appendLabMetric(body, 'Boutons actuellement pressés', pressedButtons.length ? pressedButtons.join(', ') : 'aucun observé');
      appendLabMetric(body, 'Vibration / audio', 'NON TESTÉS — aucune commande de sortie envoyée');
      appendLabMetric(body, 'Portée du test', sample?.hardwareTested === true ? 'entrées matérielles observées ; sorties non testées' : 'matériel non testé');
    }
  });
  addLog('info', `Quick controller test completed locally for ${entry.label}.`);
}

function openCalibrationHistory() {
  const entry = activeEntry();
  if (!entry) {
    showControllerLabDialog({ title: 'Analyses indisponibles', message: 'Connectez une manette pour consulter les instantanés de cette session.' });
    return;
  }
  const history = entry.analysisSnapshots || [];
  const dialog = showControllerLabDialog({
    title: 'Analyses de cette session',
    message: history.length
      ? 'Ces instantanés éphémères servent uniquement à comparer des entrées locales. Ils ne sont ni restaurables, ni actifs, ni appliqués au firmware.'
      : 'Aucun instantané n’a été créé pendant cette session. Rien n’est conservé après fermeture ou déconnexion.'
  });
  if (!history.length) return;
  const body = $('#controller-lab-body');
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const revision = history[index];
    const row = document.createElement('div');
    row.className = 'log-line';
    const date = new Date(revision.createdAt).toLocaleString();
    const label = document.createElement('span');
    label.textContent = `${date} · ${revision.analysis?.sampleCount || 0} échantillon(s)`;
    row.append(label);
    if (index > 0) {
      const compare = document.createElement('button');
      compare.className = 'button quiet';
      compare.type = 'button';
      compare.textContent = 'Comparer au précédent';
      compare.addEventListener('click', () => {
        const difference = compareControllerAnalyses(history[index - 1].analysis, revision.analysis);
        dialog.close('compare');
        showControllerLabDialog({
          title: 'Comparaison locale de session',
          message: 'Les valeurs ci-dessous sont des écarts calculés localement entre deux analyses. Elles ne constituent pas une calibration et ne sont appliquées à aucun appareil.',
          buildBody: (container) => {
            appendLabMetric(container, 'Échantillons', `${difference.sampleCount.before} → ${difference.sampleCount.after}`);
            appendLabMetric(container, 'Décalage stick gauche (delta)', formatLabValue(difference.leftStick.driftOffset));
            appendLabMetric(container, 'Décalage stick droit (delta)', formatLabValue(difference.rightStick.driftOffset));
            appendLabMetric(container, 'Amplitude gâchette gauche (delta)', formatLabValue(difference.triggers.leftAmplitude));
            appendLabMetric(container, 'Amplitude gâchette droite (delta)', formatLabValue(difference.triggers.rightAmplitude));
          }
        });
      });
      row.append(compare);
    }
    body.append(row);
  }
}

function init() {
  applyTranslations();
  renderLogs();
  $('#connect-button')?.addEventListener('click', connectDevice);
  $('#refresh-devices-button')?.addEventListener('click', refreshDevices);
  $('#open-pairing-button')?.addEventListener('click', () => openPairingWindow(readyBridgeEntry()));
  $('#read-config-button')?.addEventListener('click', readConfig);
  $('#save-config-button')?.addEventListener('click', saveConfig);
  $('#reset-config-button')?.addEventListener('click', resetDraft);
  $('#factory-reset-config-button')?.addEventListener('click', factoryResetConfig);
  $('#reconnect-usb-button')?.addEventListener('click', reconnectUsb);
  $('#backup-file')?.addEventListener('change', importBackup);
  $('#export-button')?.addEventListener('click', exportBackup);
  $('#profiles-button')?.addEventListener('click', openProfilesManager);
  $('#firmware-file')?.addEventListener('change', inspectFirmware);
  $('#run-diagnostics-button')?.addEventListener('click', runDiagnostics);
  $('#open-calibration-button').addEventListener('click', openCalibrationWorkspace);
  $('#run-quick-test-button').addEventListener('click', runQuickControllerTest);
  $('#open-history-button').addEventListener('click', openCalibrationHistory);
  $('#clear-logs-button')?.addEventListener('click', () => { state.logs = []; logStore.clear(); renderLogs(); });
  wireDraftControls();
  window.addEventListener('miralink:open-pairing-window', () => openPairingWindow(readyBridgeEntry()));
  const initialHidStatus = webHidStatus();
  if (initialHidStatus.available) {
    hideHidWarning();
    navigator.hid.addEventListener('connect', (event) => {
      registerDevice(event.device).catch((error) => addLog('error', `Automatic device connection failed: ${error.message}`));
    });
    navigator.hid.addEventListener('disconnect', (event) => {
      const entry = [...state.devices.values()].find((item) => item.device === event.device);
      if (entry) disconnectEntry(entry.id).catch((error) => addLog('error', `Device disconnect cleanup failed: ${error.message}`));
    });
  } else {
    showHidWarning(initialHidStatus);
    addLog('info', `MiraLink bridge transport is unavailable until connection: ${initialHidStatus.reason}.`);
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js?ui=50-output-fifo').catch((error) => addLog('info', `Offline shell unavailable: ${error.message}`));
  loadMetadata();
  addLog('info', 'MiraLink démarré en mode local uniquement.');
}

init();

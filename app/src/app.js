import {
  COMMANDS,
  MIRALINK_USB_FILTER,
  REPORT_IDS,
  ProtocolError,
  assertValidConfig,
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
import { applyTranslations, translate } from './i18n.js?ui=38-control-deck';
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
  describeWebHidError,
  inspectWebHidAvailability,
  isHidRequestCancellation,
  setWebHidWarningVisibility,
  transactFeatureReport
} from './hid-transport.js';
import { analyzeControllerInputs, appendCalibrationRevision, compareControllerAnalyses, createCalibrationRevision } from './controller-lab.js';
import './site-effects.js?ui=38-control-deck';

const state = {
  devices: new Map(),
  activeDeviceId: null,
  sequence: 0,
  draft: null,
  savedConfig: null,
  logs: logStore.get(),
  version: { version: '0.38', developer: 'MaruChiwa', lastUpdated: '2026-08-14' }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

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
  setTab('diagnostics');
  showBridgeConnectionDiagnostics(entry);
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

function setTab(name, { focus = false } = {}) {
  let activeButton = null;
  $$('.tab-button').forEach((button) => {
    const selected = button.dataset.tab === name;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected) activeButton = button;
  });
  $$('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== name; });
  if (focus) activeButton?.focus();
}

function handleTabKeydown(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const tabs = $$('.tab-button');
  const currentIndex = tabs.indexOf(event.currentTarget);
  if (currentIndex < 0) return;
  let nextIndex = null;
  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
  else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = tabs.length - 1;
  if (nextIndex === null) return;
  event.preventDefault();
  setTab(tabs[nextIndex].dataset.tab, { focus: true });
}

function updateUiForActiveDevice() {
  const entry = activeEntry();
  const bridgeReady = entry?.kind === 'bridge' && entry.state === 'ready';
  const configurationEditable = canEditBridgeConfiguration(entry, state.savedConfig);
  const pendingChanges = configurationEditable && state.draft ? diffConfig(state.savedConfig, state.draft) : [];
  const controls = $$('#tab-bridge input, #tab-bridge select');
  controls.forEach((control) => { control.disabled = !configurationEditable; });
  $('#read-config-button').disabled = !bridgeReady;
  $('#save-config-button').disabled = !configurationEditable || !pendingChanges.length;
  $('#reset-config-button').disabled = !configurationEditable || !pendingChanges.length;
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
    audioBufferLength: Number($('#audio-buffer').value),
    inactiveMinutes: Number($('#inactive-time').value),
    disableLed: $('#disable-led').checked,
    enableWake: $('#enable-wake').checked,
    controllerMode: Number($('#controller-mode').value),
    enableUsbSerial: $('#enable-usb-sn').checked,
    psShortcut: $('#ps-shortcut').checked
  });
}

async function loadMetadata() {
  try {
    const response = await fetch('./build-info.json?ui=38-control-deck', { cache: 'no-store' });
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

function hideHidWarning() {
  setWebHidWarningVisibility($('#hid-warning'), false);
}

function showHidWarning(status) {
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

function transact(entry, command, payload = new Uint8Array(), timeoutMs = 1400) {
  // Feature reports are request/response traffic. Keep one exchange in flight
  // per device so the supervision poll cannot consume another command's reply.
  const previous = entry.transactionTail || Promise.resolve();
  const run = previous.then(async () => {
    if (!entry.device.opened) await entry.device.open();
    return transactFeatureReport(entry.device, { sequence: nextSequence(), command, payload, timeoutMs });
  });
  entry.transactionTail = run.catch(() => undefined);
  return run;
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
  entry.kind = 'bridge';
  entry.kindLabel = 'MiraLink bridge';
  entry.transport = 'usb';
  entry.state = 'handshaking';
  entry.nextAction = 'Attendez la réponse HELLO du Pico.';
  const response = await transact(entry, COMMANDS.hello);
  const hello = decodeHelloPayload(response.payload);
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
  if (event.device !== entry.device || event.reportId !== REPORT_IDS.event) return;
  try {
    const frame = decodeFrame(event.data);
    if (frame.command !== COMMANDS.getControllerState) return;
    const state = decodeControllerStatePayload(frame.payload);
    const previousControllerState = entry.controllerState;
    entry.controllerState = state;
    if (state.sample) recordControllerSample(entry, state.sample);
    if (!state.inputAvailable) entry.lastSample = null;
    if (controllerOverviewChanged(previousControllerState, state)) updateOverview();
  } catch (error) {
    addLog('error', `${entry.label} controller event rejected: ${error.message}`);
  }
}

function startBridgePolling(entry) {
  if (entry.kind !== 'bridge' || entry.pollTimer) return;
  let inFlight = false;
  const poll = async () => {
    if (inFlight || !state.devices.has(entry.id) || entry.state !== 'ready') return;
    inFlight = true;
    try {
      const response = await transact(entry, COMMANDS.getControllerState, new Uint8Array(), 350);
      const controllerState = decodeControllerStatePayload(response.payload);
      entry.pollFailureCount = 0;
      const previousControllerState = entry.controllerState;
      entry.controllerState = controllerState;
      if (controllerState.sample) {
        recordControllerSample(entry, controllerState.sample);
      } else if (!controllerState.inputAvailable) {
        entry.lastSample = null;
      }
      if (controllerOverviewChanged(previousControllerState, controllerState)) updateOverview();
    } catch (error) {
      if (state.devices.has(entry.id)) {
        entry.pollFailureCount = (entry.pollFailureCount || 0) + 1;
        if (entry.pollFailureCount >= 3) {
          markConnectionFailure(entry, error, { bridgeIdentified: true, operation: 'supervision' });
          renderDevices();
          updateUiForActiveDevice();
          setGlobalStatus('Bridge attention', 'error');
        } else if (error?.code !== 'timeout') {
          addLog('info', `Controller polling retry ${entry.pollFailureCount}/3: ${error.message}`);
        }
      }
    } finally {
      inFlight = false;
    }
  };
  entry.pollTimer = window.setInterval(poll, 40);
  poll();
}

function stopBridgePolling(entry) {
  if (!entry?.pollTimer) return;
  window.clearInterval(entry.pollTimer);
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
      await entry.transactionTail.catch(() => undefined);
      entry.transactionTail = Promise.resolve();
      if (!entry.device.opened) await entry.device.open();
      await identify(entry);
    } catch (error) {
      markConnectionFailure(entry, error, { bridgeIdentified: entry.bridgeIdentity?.bridgeCandidate });
    }
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
  const entry = { id, device, label: device.productName || 'Appareil MiraLink', kind: bridgeIdentity.bridgeCandidate ? 'bridge' : 'unknown', kindLabel: bridgeIdentity.bridgeCandidate ? 'MiraLink bridge' : 'Identification', state: 'opening', config: null, draft: null, savedConfig: null, analysisSnapshots: [], firmwareVersion: null, adapter: null, sampleCount: 0, sampleHistory: [], controllerState: null, lastSample: null, pollTimer: null, pollFailureCount: 0, transactionTail: Promise.resolve(), connectionPromise: null, bridgeIdentity, nextAction: 'Attendez l’ouverture du périphérique.' };
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
  stopBridgePolling(entry);
  try { entry.adapter?.stop(); } catch (error) { addLog('error', `Controller adapter stop failed: ${error.message}`); }
  entry.device.removeEventListener('inputreport', entry.eventHandler);
  try { if (entry.device.opened) await entry.device.close(); } catch (error) { addLog('error', `Close failed: ${error.message}`); }
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
  addLog('info', `${entry.label} disconnected.`);
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
  return new Promise((resolve) => { const done = () => { dialog.removeEventListener('close', done); resolve(dialog.returnValue === 'confirm'); }; dialog.addEventListener('close', done); dialog.showModal(); });
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
    await transact(entry, COMMANDS.commitConfig);
    entry.config = { ...config };
    state.savedConfig = { ...config };
    state.draft = { ...config };
    syncActiveWorkingCopy();
    renderConfig(config);
    updateUiForActiveDevice();
    addLog('info', 'Configuration committed and acknowledged.');
    setGlobalStatus('Ready', 'idle');
  } catch (error) { setGlobalStatus('Error', 'error'); addLog('error', `Configuration write failed: ${error.message}`); }
}

async function resetDraft() {
  if (!state.draft || !await askConfirmation('Discard the local configuration draft?')) return;
  if (!state.savedConfig) return;
  state.draft = { ...state.savedConfig };
  syncActiveWorkingCopy();
  renderConfig(state.draft); updateUiForActiveDevice(); addLog('info', 'Local draft reset.');
}

function wireDraftControls() {
  ['haptics-gain', 'trigger-reduce', 'polling-mode', 'audio-buffer', 'inactive-time', 'disable-led', 'enable-wake', 'controller-mode', 'enable-usb-sn', 'ps-shortcut'].forEach((id) => $( `#${id}`).addEventListener('input', () => {
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
    setTab('bridge');
    addLog('error', 'Lisez la configuration du Pico 2 W avant de préparer un profil.');
    return;
  }
  const current = state.draft;
  const target = { type: 'bridge', id: entry?.kind === 'bridge' ? entry.id : null };
  const preview = previewProfileApplication(profile, current, target);
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
  setTab('bridge');
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
    setTab('bridge');
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
  $$('.tab-button').forEach((button) => {
    button.addEventListener('click', () => setTab(button.dataset.tab));
    button.addEventListener('keydown', handleTabKeydown);
  });
  $('#connect-button')?.addEventListener('click', connectDevice);
  $('#refresh-devices-button')?.addEventListener('click', refreshDevices);
  $('#open-pairing-button')?.addEventListener('click', () => openPairingWindow(readyBridgeEntry()));
  $('#read-config-button')?.addEventListener('click', readConfig);
  $('#save-config-button')?.addEventListener('click', saveConfig);
  $('#reset-config-button')?.addEventListener('click', resetDraft);
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
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js?ui=38-control-deck').catch((error) => addLog('info', `Offline shell unavailable: ${error.message}`));
  loadMetadata();
  addLog('info', 'MiraLink démarré en mode local uniquement.');
}

init();

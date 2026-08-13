import {
  COMMANDS,
  HID_USAGE_PAGE,
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
  defaultConfig,
  encodeConfig
} from './protocol.js';
import { createBackup, downloadJson, logs as logStore, validateBackup } from './storage.js';
import { applyTranslations, setupLanguage, translate } from './i18n.js';
import { parseUf2 } from './uf2.js';
import { createDualSenseAdapter, dualSenseWebHidFilters, isDualSenseDevice } from './dualsense.js';
import { inspectWebHidAvailability, transactFeatureReport } from './hid-transport.js';

const state = {
  devices: new Map(),
  activeDeviceId: null,
  sequence: 0,
  draft: null,
  savedConfig: null,
  logs: logStore.get(),
  version: { version: '0.22', developer: 'MaruChiwa', lastUpdated: '2026-08-13' }
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
  $('#global-status').dataset.state = stateName;
  $('#global-status-text').textContent = text;
}

function renderLogs() {
  const view = $('#log-view');
  view.replaceChildren();
  if (!state.logs.length) {
    const empty = document.createElement('span');
    empty.textContent = 'No local events.';
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

function renderDevices() {
  const list = $('#device-list');
  list.replaceChildren();
  if (!state.devices.size) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
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
    const meta = document.createElement('p'); meta.className = 'device-meta'; meta.textContent = `${entry.kindLabel} · ${entry.state}`;
    info.append(name, meta);
    const actions = document.createElement('div'); actions.className = 'action-row';
    const select = document.createElement('button'); select.className = 'button quiet'; select.type = 'button'; select.textContent = entry.id === state.activeDeviceId ? 'Active' : 'Use'; select.disabled = entry.id === state.activeDeviceId;
    select.addEventListener('click', () => { state.activeDeviceId = entry.id; state.draft = entry.config ? { ...entry.config } : null; state.savedConfig = entry.config ? { ...entry.config } : null; renderDevices(); updateUiForActiveDevice(); });
    const disconnect = document.createElement('button'); disconnect.className = 'button quiet'; disconnect.type = 'button'; disconnect.textContent = '×'; disconnect.setAttribute('aria-label', `Disconnect ${entry.label}`); disconnect.addEventListener('click', () => disconnectEntry(entry.id));
    actions.append(select, disconnect); card.append(info, actions); list.append(card);
  }
  updateOverview();
}

function updateOverview() {
  const entries = [...state.devices.values()];
  const bridge = entries.find((entry) => entry.kind === 'bridge');
  const controller = entries.find((entry) => entry.kind === 'controller');
  $('#overview-bridge-state').textContent = bridge ? 'READY' : '—';
  $('#overview-bridge-note').textContent = bridge ? bridge.label : translate('notConnected');
  $('#overview-controller-state').textContent = controller ? 'READY' : '—';
  $('#overview-controller-note').textContent = controller ? controller.label : translate('notConnected');
  const firmware = bridge?.firmwareVersion || '—';
  $('#overview-firmware-state').textContent = firmware;
  $('#overview-firmware-note').textContent = bridge ? 'MiraLink bridge' : translate('awaitingDevice');
}

function setTab(name) {
  $$('.tab-button').forEach((button) => {
    const selected = button.dataset.tab === name;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  $$('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== name; });
}

function updateUiForActiveDevice() {
  const entry = activeEntry();
  const bridgeReady = entry?.kind === 'bridge' && entry.state === 'ready';
  const controls = $$('#tab-bridge input, #tab-bridge select');
  controls.forEach((control) => { control.disabled = !bridgeReady; });
  $('#read-config-button').disabled = !bridgeReady;
  $('#save-config-button').disabled = !bridgeReady || !state.draft;
  $('#reset-config-button').disabled = !state.draft;
  $('#bridge-device-status').textContent = bridgeReady ? entry.label : translate('selectDevice');
  $('#bridge-readonly-notice').hidden = bridgeReady;
  renderConfig(state.draft || defaultConfig());
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
  $('#draft-status').textContent = changed ? 'Local changes waiting for review.' : translate('noDraft');
}

function readDraftFromControls() {
  const base = state.draft || defaultConfig();
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
    const response = await fetch('./build-info.json', { cache: 'no-store' });
    if (response.ok) state.version = { ...state.version, ...(await response.json()) };
  } catch { addLog('info', 'Development metadata is not available; using local defaults.'); }
  const label = `v${state.version.version}`;
  $('#version-chip').textContent = label; $('#footer-version').textContent = label; $('#footer-updated').textContent = state.version.lastUpdated || '2026-08-12';
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

function requireHid() {
  const status = webHidStatus();
  if (status.available) return true;
  $('#hid-warning').hidden = false;
  addLog('error', `WebHID unavailable: ${status.reason} (secure context: ${status.isSecureContext ? 'yes' : 'no'}).`);
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

async function identify(entry) {
  if (isDualSenseDevice(entry.device)) {
    entry.kind = 'controller';
    entry.kindLabel = 'DualSense controller';
    entry.transport = 'usb';
    entry.adapter = createDualSenseAdapter(entry.device, {
      onSample: (sample) => {
        entry.sampleCount = (entry.sampleCount || 0) + 1;
        entry.lastSample = sample;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('miralink:controller-sample', { detail: { deviceId: entry.id, sample } }));
      },
      onError: (error) => addLog('error', `${entry.label} input report rejected: ${error.message}`)
    });
    entry.adapter.start();
    entry.state = 'ready';
    addLog('info', `${entry.label} identified as a DualSense controller. Direct wired input is available; use the Pico 2 W bridge for Bluetooth output features.`);
    return;
  }
  try {
    const response = await transact(entry, COMMANDS.hello);
    const hello = decodeHelloPayload(response.payload);
    entry.kind = 'bridge'; entry.kindLabel = 'MiraLink bridge'; entry.firmwareVersion = `protocol ${hello.protocolVersion}`; entry.hello = hello;
    entry.transport = 'usb';
    entry.state = 'ready';
    try {
      const capabilityResponse = await transact(entry, COMMANDS.getControllerCapabilities, new Uint8Array(), 500);
      entry.controllerCapabilities = decodeControllerCapabilities(capabilityResponse.payload);
    } catch (error) {
      entry.controllerCapabilities = null;
      addLog('info', `${entry.label} does not expose controller capabilities yet: ${error.message}`);
    }
    addLog('info', `${entry.label} identified as MiraLink bridge.`);
    startBridgePolling(entry);
  } catch (error) {
    entry.kind = 'unknown'; entry.kindLabel = 'Unsupported HID device'; entry.state = 'error'; entry.error = error.message;
    addLog('error', `${entry.label} is not a MiraLink bridge or supported DualSense: ${error.message}`);
  }
}

function handleBridgeEvent(entry, event) {
  if (event.device !== entry.device || event.reportId !== REPORT_IDS.event) return;
  try {
    const frame = decodeFrame(event.data);
    if (frame.command !== COMMANDS.getControllerState) return;
    const state = decodeControllerStatePayload(frame.payload);
    entry.controllerState = state;
    if (state.sample) {
      entry.sampleCount = (entry.sampleCount || 0) + 1;
      entry.lastSample = state.sample;
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('miralink:controller-sample', { detail: { deviceId: entry.id, sample: state.sample } }));
    }
    if (!state.inputAvailable) entry.lastSample = null;
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
      entry.controllerState = controllerState;
      if (controllerState.sample) {
        entry.sampleCount = (entry.sampleCount || 0) + 1;
        entry.lastSample = controllerState.sample;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('miralink:controller-sample', { detail: { deviceId: entry.id, sample: controllerState.sample } }));
      } else if (!controllerState.inputAvailable) {
        entry.lastSample = null;
      }
    } catch (error) {
      if (state.devices.has(entry.id) && error?.code !== 'timeout') addLog('error', `controller polling failed: ${error.message}`);
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

async function registerDevice(device) {
  const existing = [...state.devices.values()].find((entry) => entry.device === device);
  if (existing) { state.activeDeviceId = existing.id; renderDevices(); return; }
  const id = `device-${Date.now()}-${state.devices.size + 1}`;
  const entry = { id, device, label: device.productName || 'MiraLink device', kind: 'unknown', kindLabel: 'Identifying', state: 'opening', config: null, firmwareVersion: null, adapter: null, sampleCount: 0, controllerState: null, lastSample: null, pollTimer: null, transactionTail: Promise.resolve() };
  entry.eventHandler = (event) => handleBridgeEvent(entry, event);
  device.addEventListener('inputreport', entry.eventHandler);
  state.devices.set(id, entry); state.activeDeviceId = id; renderDevices(); setGlobalStatus('Connecting', 'busy');
  try { if (!device.opened) await device.open(); await identify(entry); } catch (error) { entry.state = 'error'; addLog('error', `Device connection failed: ${error.message}`); }
  renderDevices(); updateUiForActiveDevice(); setGlobalStatus(entry.state === 'ready' ? 'Ready' : 'Error', entry.state === 'ready' ? 'idle' : 'error');
}

async function connectDevice() {
  if (!requireHid()) return;
  try {
    setGlobalStatus('Waiting for device', 'busy');
    const devices = await navigator.hid.requestDevice({ filters: [MIRALINK_USB_FILTER, { usagePage: HID_USAGE_PAGE }, ...dualSenseWebHidFilters()] });
    for (const device of devices) {
      await registerDevice(device);
      const entry = [...state.devices.values()].find((item) => item.device === device);
      if (entry?.kind === 'bridge') await openPairingWindow(entry);
    }
    if (!devices.length) setGlobalStatus('Ready', 'idle');
  } catch (error) { setGlobalStatus('Error', 'error'); addLog('error', `Device request cancelled or failed: ${error.message}`); }
}

async function refreshDevices() {
  if (!requireHid()) return;
  try { const devices = await navigator.hid.getDevices(); for (const device of devices) await registerDevice(device); renderDevices(); } catch (error) { addLog('error', `Device refresh failed: ${error.message}`); }
}

async function disconnectEntry(id) {
  const entry = state.devices.get(id);
  if (!entry) return;
  stopBridgePolling(entry);
  try { entry.adapter?.stop(); } catch (error) { addLog('error', `Controller adapter stop failed: ${error.message}`); }
  entry.device.removeEventListener('inputreport', entry.eventHandler);
  try { if (entry.device.opened) await entry.device.close(); } catch (error) { addLog('error', `Close failed: ${error.message}`); }
  state.devices.delete(id); if (state.activeDeviceId === id) state.activeDeviceId = state.devices.keys().next().value || null;
  state.draft = null; state.savedConfig = null; renderDevices(); updateUiForActiveDevice(); addLog('info', `${entry.label} disconnected.`);
}

async function readConfig() {
  const entry = activeEntry(); if (!entry || entry.kind !== 'bridge') return;
  try { setGlobalStatus('Reading', 'busy'); const response = await transact(entry, COMMANDS.getConfig); const config = decodeConfig(response.payload); entry.config = config; state.savedConfig = { ...config }; state.draft = { ...config }; renderConfig(config); updateUiForActiveDevice(); addLog('info', 'Configuration read from Pico 2 W.'); setGlobalStatus('Ready', 'idle'); } catch (error) { setGlobalStatus('Error', 'error'); addLog('error', `Configuration read failed: ${error.message}`); }
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
    const config = readDraftFromControls();
    if (!await askConfirmation('Write this validated configuration to the Pico 2 W flash?')) return;
    setGlobalStatus('Writing', 'busy'); await transact(entry, COMMANDS.setConfigDraft, encodeConfig(config)); await transact(entry, COMMANDS.commitConfig); entry.config = config; state.savedConfig = { ...config }; state.draft = { ...config }; renderConfig(config); addLog('info', 'Configuration committed and acknowledged.'); setGlobalStatus('Ready', 'idle');
  } catch (error) { setGlobalStatus('Error', 'error'); addLog('error', `Configuration write failed: ${error.message}`); }
}

async function resetDraft() {
  if (!state.draft || !await askConfirmation('Discard the local configuration draft?')) return;
  state.draft = state.savedConfig ? { ...state.savedConfig } : defaultConfig(); renderConfig(state.draft); updateUiForActiveDevice(); addLog('info', 'Local draft reset.');
}

function wireDraftControls() {
  ['haptics-gain', 'trigger-reduce', 'polling-mode', 'audio-buffer', 'inactive-time', 'disable-led', 'enable-wake', 'controller-mode', 'enable-usb-sn', 'ps-shortcut'].forEach((id) => $( `#${id}`).addEventListener('input', () => { try { state.draft = readDraftFromControls(); renderConfig(state.draft); updateUiForActiveDevice(); } catch (error) { addLog('error', error.message); } }));
}

async function inspectFirmware(event) {
  const file = event.target.files?.[0]; if (!file) return;
  const result = $('#firmware-result'); result.hidden = false; result.textContent = 'Inspecting locally…';
  try { const buffer = await file.arrayBuffer(); const inspection = parseUf2(buffer); const digest = await crypto.subtle.digest('SHA-256', buffer); const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); result.textContent = inspection.ok ? `PASS — ${inspection.message} SHA-256 ${hash}` : `REJECTED — ${inspection.message}`; addLog(inspection.ok ? 'info' : 'error', `UF2 inspection: ${result.textContent}`); } catch (error) { result.textContent = `Inspection failed: ${error.message}`; addLog('error', result.textContent); }
}

async function exportBackup() {
  const config = state.draft || state.savedConfig || defaultConfig();
  downloadJson(`miralink-backup-${new Date().toISOString().slice(0, 10)}.json`, createBackup({ config, device: activeEntry(), version: state.version.version }));
  addLog('info', 'Local backup exported.');
}

async function importBackup(event) {
  const file = event.target.files?.[0]; if (!file) return;
  try { const value = validateBackup(JSON.parse(await file.text())); state.draft = assertValidConfig(value.config); renderConfig(state.draft); updateUiForActiveDevice(); setTab('bridge'); addLog('info', 'Backup loaded into a local draft.'); } catch (error) { addLog('error', `Backup rejected: ${error.message}`); }
  event.target.value = '';
}

async function runDiagnostics() {
  const entry = activeEntry();
  for (const node of $$('[data-diagnostic]')) node.textContent = entry ? '…' : 'No device';
  if (!entry) { $('#diagnostic-summary').textContent = 'Connect a device before running diagnostics.'; return; }
  if (entry.kind !== 'bridge') {
    for (const node of $$('[data-diagnostic]')) node.textContent = 'Unavailable';
    $('#diagnostic-summary').textContent = 'Direct controller input is available, but MiraLink bridge diagnostics require a connected Pico 2 W.';
    addLog('info', 'Diagnostics unavailable for a direct controller connection.');
    return;
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
    addLog('info', 'Diagnostics completed with capability limits reported.');
  } catch (error) {
    for (const node of $$('[data-diagnostic]')) node.textContent = 'Unavailable';
    $('#diagnostic-summary').textContent = `Diagnostics could not complete: ${error.message}`;
    addLog('error', `Diagnostics failed: ${error.message}`);
  }
}

async function openPairingWindow(targetEntry = activeEntry()) {
  const entry = targetEntry;
  if (!entry || entry.kind !== 'bridge') {
    addLog('error', 'Connect a MiraLink bridge before opening its Bluetooth pairing window.');
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

function init() {
  setupLanguage($('#language-select'), () => { applyTranslations(); renderDevices(); renderConfig(state.draft || defaultConfig()); });
  renderLogs();
  $$('.tab-button').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.tab)));
  $('#connect-button').addEventListener('click', connectDevice); $('#refresh-devices-button').addEventListener('click', refreshDevices); $('#read-config-button').addEventListener('click', readConfig); $('#save-config-button').addEventListener('click', saveConfig); $('#reset-config-button').addEventListener('click', resetDraft); $('#firmware-file').addEventListener('change', inspectFirmware); $('#backup-file').addEventListener('change', importBackup); $('#export-button').addEventListener('click', exportBackup); $('#run-diagnostics-button').addEventListener('click', runDiagnostics); $('#clear-logs-button').addEventListener('click', () => { state.logs = []; logStore.clear(); renderLogs(); });
  wireDraftControls();
  window.addEventListener('miralink:open-pairing-window', openPairingWindow);
  if (!requireHid()) addLog('info', 'WebHID diagnostics are visible in the local event log.');
  if (hasHid()) { navigator.hid.addEventListener('connect', (event) => registerDevice(event.device)); navigator.hid.addEventListener('disconnect', (event) => { const entry = [...state.devices.values()].find((item) => item.device === event.device); if (entry) disconnectEntry(entry.id); }); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch((error) => addLog('info', `Offline shell unavailable: ${error.message}`));
  loadMetadata();
  addLog('info', 'MiraLink started in local-only mode.');
}

init();

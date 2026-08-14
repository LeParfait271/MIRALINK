export const PROTOCOL_VERSION = 1;
export const FRAME_MAGIC = Object.freeze([0x4d, 0x4c]);
export const HID_REPORT_BYTES = 64;
export const FRAME_OVERHEAD_BYTES = 13;
export const MAX_PAYLOAD = HID_REPORT_BYTES - FRAME_OVERHEAD_BYTES - 3;
export const HID_USAGE_PAGE = 0xff00;
export const MIRALINK_VENDOR_ID = 0x054c;
export const MIRALINK_PRODUCT_ID = 0x0ce6;
const DUALSENSE_EDGE_PRODUCT_ID = 0x0df2;
const DIRECT_DUALSENSE_PRODUCT_IDS = Object.freeze([MIRALINK_PRODUCT_ID, DUALSENSE_EDGE_PRODUCT_ID]);
const MIRALINK_PRODUCT_IDS = DIRECT_DUALSENSE_PRODUCT_IDS;
export const MIRALINK_USB_FILTER = Object.freeze({
  vendorId: MIRALINK_VENDOR_ID,
  productId: MIRALINK_PRODUCT_ID
});

// Keep MiraLink management traffic away from the report IDs used by the
// DualSense persona (notably 0x01 and 0x02).
export const REPORT_IDS = Object.freeze({ command: 0x70, response: 0x71, event: 0x72 });
export const RESPONSE_FLAGS = Object.freeze({ response: 1 << 0, error: 1 << 1 });
export const COMMANDS = Object.freeze({
  hello: 0x01,
  getInfo: 0x02,
  getConfig: 0x03,
  setConfigDraft: 0x04,
  commitConfig: 0x05,
  resetConfig: 0x06,
  reconnectUsb: 0x07,
  getDiagnostics: 0x08,
  getLogPage: 0x09,
  enterRecovery: 0x0a,
  getControllerState: 0x0b,
  openPairingWindow: 0x0c,
  getControllerCapabilities: 0x0d,
  sendHaptic: 0x0e,
  setLightbar: 0x0f,
  setMicrophoneMute: 0x10,
  setControllerOutput: 0x11,
  getAudioStatus: 0x12
});

export const CONTROLLER_CAPABILITIES = Object.freeze({
  battery: 1 << 0,
  haptics: 1 << 1,
  lightbar: 1 << 2,
  motion: 1 << 3,
  touchpad: 1 << 4,
  audioStatus: 1 << 5,
  microphoneMute: 1 << 6,
  adaptiveTriggers: 1 << 7
});

export const CONFIG_SCHEMA = 1;
export const CONFIG_BYTES = 24;
export const FEATURE_FLAGS = Object.freeze({
  disableLed: 1 << 0,
  enableUsbSerial: 1 << 1,
  psShortcut: 1 << 2,
  disableMic: 1 << 3,
  disableSpeaker: 1 << 4,
  enableWake: 1 << 5,
  lockVolume: 1 << 6
});

export class ProtocolError extends Error {
  constructor(message, code = 'protocol_error') {
    super(message);
    this.name = 'ProtocolError';
    this.code = code;
  }
}

function inspectHidCollections(device) {
  const pending = Array.isArray(device?.collections) ? [...device.collections] : [];
  const visited = new Set();
  const featureReportIds = new Set();
  let vendorCollection = false;

  while (pending.length) {
    const collection = pending.shift();
    if (!collection || typeof collection !== 'object' || visited.has(collection)) continue;
    visited.add(collection);
    if (Number(collection.usagePage) === HID_USAGE_PAGE) vendorCollection = true;
    if (Array.isArray(collection.featureReports)) {
      for (const report of collection.featureReports) {
        const reportId = Number(report?.reportId);
        if (Number.isInteger(reportId) && reportId >= 0 && reportId <= 0xff) featureReportIds.add(reportId);
      }
    }
    if (Array.isArray(collection.children)) pending.push(...collection.children);
  }

  return { vendorCollection, featureReportIds };
}

/**
 * Inspect the WebHID descriptor without assuming where Chromium exposes a
 * nested collection's feature reports. The WebHID model may expose them on
 * the child collection, in the top-level flattened report list, or both.
 */
export function inspectMiraLinkHidIdentity(device) {
  const { vendorCollection, featureReportIds } = inspectHidCollections(device);
  const usbIdentityMatches = device?.vendorId === MIRALINK_VENDOR_ID
    && MIRALINK_PRODUCT_IDS.includes(device?.productId);
  const commandReport = featureReportIds.has(REPORT_IDS.command);
  const responseReport = featureReportIds.has(REPORT_IDS.response);
  const completeManagementChannel = commandReport && responseReport;
  const bridgeCandidate = usbIdentityMatches && completeManagementChannel;

  return Object.freeze({
    usbIdentityMatches,
    vendorCollection,
    commandReport,
    responseReport,
    completeManagementChannel,
    bridgeCandidate,
    featureReportIds: Object.freeze([...featureReportIds].sort((left, right) => left - right))
  });
}

export function hasMiraLinkVendorCollection(device) {
  return inspectMiraLinkHidIdentity(device).vendorCollection;
}

export function getHidIdentificationOrder(device, directDualSense = false) {
  // A MiraLink bridge and a real wired DualSense share the deployed Sony USB
  // identity. Only the complete 0x70/0x71 feature channel distinguishes the
  // bridge; a bare FF00 collection must never authorize bridge traffic.
  const identity = inspectMiraLinkHidIdentity(device);
  if (identity.bridgeCandidate) return Object.freeze(['bridge']);
  const directControllerIdentity = directDualSense
    && device?.vendorId === MIRALINK_VENDOR_ID
    && DIRECT_DUALSENSE_PRODUCT_IDS.includes(device?.productId);
  if (directControllerIdentity && !identity.completeManagementChannel) return Object.freeze(['controller']);
  return Object.freeze([]);
}

export function decodeInfoPayload(input) {
  const bytes = bytesOf(input);
  if (bytes.length < 11) throw new ProtocolError('GET_INFO payload is too short', 'short_info');
  const signature = String.fromCharCode(...bytes.slice(0, 8));
  if (signature !== 'MiraLink') throw new ProtocolError('GET_INFO product signature is invalid', 'invalid_info');
  const [major, minor, patch] = bytes.slice(8, 11);
  return Object.freeze({
    product: signature,
    version: patch === 0 ? `${major}.${minor}` : `${major}.${minor}.${patch}`,
    major,
    minor,
    patch
  });
}

function bytesOf(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return Uint8Array.from(input || []);
}

export function crc32(input) {
  const bytes = bytesOf(input);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function encodeFrame({ sequence = 0, command, flags = 0, payload = new Uint8Array() }) {
  const body = bytesOf(payload);
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > 0xffff) throw new ProtocolError('Invalid sequence', 'invalid_sequence');
  if (!Number.isInteger(command) || command < 0 || command > 0xff) throw new ProtocolError('Invalid command', 'invalid_command');
  if (body.length > MAX_PAYLOAD) throw new ProtocolError('Payload is too large', 'payload_too_large');

  const frame = new Uint8Array(HID_REPORT_BYTES);
  frame.set(FRAME_MAGIC, 0);
  frame[2] = PROTOCOL_VERSION;
  frame[3] = flags & 0xff;
  const view = new DataView(frame.buffer);
  view.setUint16(4, sequence, true);
  frame[6] = command;
  view.setUint16(7, body.length, true);
  frame.set(body, 9);
  view.setUint32(9 + body.length, crc32(frame.subarray(0, 9 + body.length)), true);
  return frame;
}

export function decodeFrame(input) {
  const frame = bytesOf(input);
  if (frame.length < 13) throw new ProtocolError('Frame is too short', 'short_frame');
  if (frame[0] !== FRAME_MAGIC[0] || frame[1] !== FRAME_MAGIC[1]) throw new ProtocolError('Frame magic is invalid', 'bad_magic');
  if (frame[2] !== PROTOCOL_VERSION) throw new ProtocolError('Protocol version is unsupported', 'bad_version');
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const payloadLength = view.getUint16(7, true);
  if (payloadLength > MAX_PAYLOAD) throw new ProtocolError('Payload is too large', 'payload_too_large');
  if (frame.length !== HID_REPORT_BYTES) throw new ProtocolError('HID report length is invalid', 'bad_length');
  const expectedCrc = view.getUint32(9 + payloadLength, true);
  const actualCrc = crc32(frame.subarray(0, 9 + payloadLength));
  if (expectedCrc !== actualCrc) throw new ProtocolError('Frame checksum is invalid', 'bad_crc');
  for (let index = 13 + payloadLength; index < HID_REPORT_BYTES; index += 1) {
    if (frame[index] !== 0) throw new ProtocolError('HID report padding is invalid', 'bad_padding');
  }
  return Object.freeze({
    version: frame[2],
    flags: frame[3],
    sequence: view.getUint16(4, true),
    command: frame[6],
    payload: frame.slice(9, 9 + payloadLength)
  });
}

export function decodeHelloPayload(input) {
  const bytes = bytesOf(input);
  if (bytes.length !== 4) throw new ProtocolError('HELLO payload is invalid', 'invalid_hello_payload');
  return Object.freeze({ protocolVersion: bytes[0], configSchema: bytes[1], transportVersion: bytes[2], featureFlags: bytes[3] });
}

export function decodeDiagnosticsPayload(input) {
  const bytes = bytesOf(input);
  if (bytes.length === 3) {
    return Object.freeze({
      schema: bytes[0],
      configLoaded: Boolean(bytes[1]),
      usbMounted: Boolean(bytes[2]),
      bluetoothAvailable: false,
      pairingWindowOpen: false,
      inquiryActive: false,
      connectionPending: false,
      controllerConnected: false,
      descriptorAvailable: false,
      inputAvailable: false,
      sampleCount: 0,
      rejectedReportCount: 0
    });
  }
  if ((bytes.length !== 18 || bytes[0] !== 2)
    && (bytes.length !== 28 || bytes[0] !== 3)
    && (bytes.length !== 48 || bytes[0] !== 4)) throw new ProtocolError('Diagnostics payload is invalid', 'invalid_diagnostics_payload');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hasConnectionFailure = bytes.length === 48 && bytes[0] === 4;
  const hasAudio = bytes.length === 28 || hasConnectionFailure;
  const result = {
    schema: bytes[0],
    configLoaded: Boolean(bytes[1]),
    usbMounted: Boolean(bytes[2]),
    bluetoothAvailable: Boolean(bytes[3]),
    pairingWindowOpen: Boolean(bytes[4]),
    inquiryActive: Boolean(bytes[5]),
    connectionPending: Boolean(bytes[6]),
    controllerConnected: Boolean(bytes[7]),
    descriptorAvailable: Boolean(bytes[8]),
    inputAvailable: Boolean(bytes[9]),
    sampleCount: view.getUint32(10, true),
    rejectedReportCount: view.getUint32(14, true),
    audioUsbStreaming: hasAudio ? Boolean(bytes[18]) : false,
    audioBluetoothStreaming: hasAudio ? Boolean(bytes[19]) : false,
    audioUsbPacketCount: hasAudio ? view.getUint32(20, true) : 0,
    audioDroppedFrameCount: hasAudio ? view.getUint32(24, true) : 0
  };
  if (hasConnectionFailure) {
    result.lastConnectionError = bytes[28];
    result.lastConnectionStatus = bytes[29];
    result.connectionAttemptCount = view.getUint32(32, true);
    result.connectionFailureCount = view.getUint32(36, true);
    result.reconnectAttemptCount = view.getUint32(40, true);
  }
  return Object.freeze(result);
}

export function decodeAudioStatusPayload(input) {
  const bytes = bytesOf(input);
  if (bytes.length !== 16 || bytes[0] !== 1) throw new ProtocolError('Audio status payload is invalid', 'invalid_audio_status_payload');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Object.freeze({
    schema: bytes[0],
    usbStreaming: Boolean(bytes[1]),
    bluetoothStreaming: Boolean(bytes[2]),
    bluetoothLinkAvailable: Boolean(bytes[3]),
    usbPacketCount: view.getUint32(4, true),
    droppedFrameCount: view.getUint32(8, true),
    bluetoothPacketCount: view.getUint32(12, true)
  });
}

export function decodeControllerStatePayload(input) {
  const bytes = bytesOf(input);
  if ((bytes.length !== 16 || bytes[0] !== 1) && (bytes.length !== 48 || bytes[0] !== 2)) throw new ProtocolError('Controller state payload is invalid', 'invalid_controller_state_payload');
  const flags = bytes[1];
  const inputAvailable = Boolean(flags & (1 << 2));
  const dpadFace = bytes[9];
  const dpadStates = [
    { up: true, right: false, down: false, left: false },
    { up: true, right: true, down: false, left: false },
    { up: false, right: true, down: false, left: false },
    { up: false, right: true, down: true, left: false },
    { up: false, right: false, down: true, left: false },
    { up: false, right: false, down: true, left: true },
    { up: false, right: false, down: false, left: true },
    { up: true, right: false, down: false, left: true },
    { up: false, right: false, down: false, left: false }
  ];
  const axis = (value) => (value / 127.5) - 1;
  const pressed = (value, bit) => Boolean(value & (1 << bit));
  const extended = bytes[0] === 2 ? Object.freeze({
    batteryPercent: bytes[16] === 0xff ? null : bytes[16],
    batteryState: ['unknown', 'discharging', 'charging', 'full', 'error'][bytes[17]] || 'unknown',
    batteryValid: Boolean(bytes[18] & (1 << 0)),
    headphoneConnected: Boolean(bytes[18] & (1 << 1)),
    microphoneConnected: Boolean(bytes[18] & (1 << 2)),
    microphoneMuted: Boolean(bytes[18] & (1 << 3)),
    touchPoints: Object.freeze([
      Object.freeze({ active: Boolean(bytes[18] & (1 << 4)), x: new DataView(bytes.buffer, bytes.byteOffset + 36, 2).getUint16(0, true), y: new DataView(bytes.buffer, bytes.byteOffset + 38, 2).getUint16(0, true) }),
      Object.freeze({ active: Boolean(bytes[18] & (1 << 5)), x: new DataView(bytes.buffer, bytes.byteOffset + 40, 2).getUint16(0, true), y: new DataView(bytes.buffer, bytes.byteOffset + 42, 2).getUint16(0, true) })
    ]),
    inputSequence: bytes[19],
    gyro: Object.freeze({ x: new DataView(bytes.buffer, bytes.byteOffset + 20, 2).getInt16(0, true), y: new DataView(bytes.buffer, bytes.byteOffset + 22, 2).getInt16(0, true), z: new DataView(bytes.buffer, bytes.byteOffset + 24, 2).getInt16(0, true) }),
    accelerometer: Object.freeze({ x: new DataView(bytes.buffer, bytes.byteOffset + 26, 2).getInt16(0, true), y: new DataView(bytes.buffer, bytes.byteOffset + 28, 2).getInt16(0, true), z: new DataView(bytes.buffer, bytes.byteOffset + 30, 2).getInt16(0, true) }),
    sensorTimestamp: new DataView(bytes.buffer, bytes.byteOffset + 32, 4).getUint32(0, true)
  }) : null;
  const sample = inputAvailable ? Object.freeze({
    timestamp: new Date().toISOString(),
    source: 'hardware',
    hardwareTested: true,
    testStatus: 'available',
    transport: flags & (1 << 3) ? 'bluetooth' : 'unknown',
    reportId: bytes[2],
    leftStick: Object.freeze({ x: axis(bytes[3]), y: axis(bytes[4]) }),
    rightStick: Object.freeze({ x: axis(bytes[5]), y: axis(bytes[6]) }),
    leftTrigger: bytes[7] / 255,
    rightTrigger: bytes[8] / 255,
    buttons: Object.freeze({
      dpad: Object.freeze(dpadStates[dpadFace & 0x0f] || dpadStates[8]),
      square: pressed(dpadFace, 4), cross: pressed(dpadFace, 5), circle: pressed(dpadFace, 6), triangle: pressed(dpadFace, 7),
      l1: pressed(bytes[10], 0), r1: pressed(bytes[10], 1), l2: pressed(bytes[10], 2), r2: pressed(bytes[10], 3),
      create: pressed(bytes[10], 4), options: pressed(bytes[10], 5), l3: pressed(bytes[10], 6), r3: pressed(bytes[10], 7),
      ps: pressed(bytes[11], 0), touchpad: pressed(bytes[11], 1), mute: pressed(bytes[11], 2)
    }),
    batteryPercent: extended?.batteryValid ? extended.batteryPercent : null,
    batteryState: extended?.batteryState || 'unknown',
    capabilities: Object.freeze({ input: 'supported', battery: extended?.batteryValid ? 'supported' : 'unavailable', haptics: extended ? 'supported' : 'not-implemented', lightbar: extended ? 'supported' : 'not-implemented', adaptiveTriggers: extended ? 'supported-through-output-route' : 'not-implemented', calibration: 'local-analysis-only' }),
    extended
  }) : null;
  return Object.freeze({
    schema: bytes[0],
    connected: Boolean(flags & (1 << 0)),
    descriptorAvailable: Boolean(flags & (1 << 1)),
    inputAvailable,
    bluetoothAvailable: Boolean(flags & (1 << 3)),
    pairingWindowOpen: Boolean(flags & (1 << 4)),
    inquiryActive: Boolean(flags & (1 << 5)),
    connectionPending: Boolean(flags & (1 << 6)),
    pairedControllerKnown: Boolean(flags & (1 << 7)),
    extended,
    sample
  });
}

export function decodeControllerCapabilities(input) {
  const bytes = bytesOf(input);
  if (bytes.length !== 8 || bytes[0] !== 1) throw new ProtocolError('Controller capabilities payload is invalid', 'invalid_controller_capabilities_payload');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Object.freeze({
    schema: bytes[0],
    connected: Boolean(bytes[1]),
    transport: bytes[2] === 1 ? 'bluetooth' : 'unknown',
    model: bytes[3] === 1 ? 'DualSense' : 'unknown',
    capabilities: view.getUint16(4, true),
    maxHapticDurationMs: view.getUint16(6, true)
  });
}

function boundedByte(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new ProtocolError(`${name} must be between 0 and 255`, 'invalid_controller_output');
  return value;
}

export function encodeHapticRequest({ leftMotor = 0, rightMotor = 0, durationMs = 250 } = {}) {
  boundedByte(leftMotor, 'leftMotor'); boundedByte(rightMotor, 'rightMotor');
  if (!Number.isInteger(durationMs) || durationMs < 1 || durationMs > 3000) throw new ProtocolError('durationMs must be between 1 and 3000', 'invalid_controller_output');
  const bytes = new Uint8Array(5); bytes[0] = 1; bytes[1] = leftMotor; bytes[2] = rightMotor; new DataView(bytes.buffer).setUint16(3, durationMs, true); return bytes;
}

export function encodeLightbarRequest({ red = 0, green = 0, blue = 0, playerLeds = 0 } = {}) {
  boundedByte(red, 'red'); boundedByte(green, 'green'); boundedByte(blue, 'blue');
  if (!Number.isInteger(playerLeds) || playerLeds < 0 || playerLeds > 0x1f) throw new ProtocolError('playerLeds must be between 0 and 31', 'invalid_controller_output');
  return Uint8Array.from([1, red, green, blue, playerLeds]);
}

export function encodeMicrophoneMuteRequest(muted) {
  if (typeof muted !== 'boolean') throw new ProtocolError('muted must be boolean', 'invalid_controller_output');
  return Uint8Array.from([1, muted ? 1 : 0]);
}

export function encodeControllerOutputRequest(report) {
  const bytes = bytesOf(report);
  if (bytes.length !== 47) throw new ProtocolError('Controller output report must contain 47 bytes', 'invalid_controller_output');
  return Uint8Array.from([1, ...bytes]);
}

export function defaultConfig() {
  return {
    schema: CONFIG_SCHEMA,
    hapticsGain: 1,
    speakerVolume: 100,
    headsetVolume: 100,
    speakerGain: 0,
    inactiveMinutes: 0,
    pollingMode: 1,
    audioBufferLength: 64,
    controllerMode: 2,
    disableLed: false,
    enableUsbSerial: false,
    psShortcut: false,
    disableMic: false,
    disableSpeaker: false,
    enableWake: false,
    triggerReduce: 0,
    lockVolume: false,
    statusGpioPin: 0xff,
    statusGpioMode: 0
  };
}

export function validateConfig(config) {
  const value = { ...defaultConfig(), ...(config || {}) };
  const errors = [];
  const range = (name, min, max) => {
    if (!Number.isFinite(value[name]) || value[name] < min || value[name] > max) errors.push(`${name} must be between ${min} and ${max}`);
  };
  if (value.schema !== CONFIG_SCHEMA) errors.push('schema is unsupported');
  range('hapticsGain', 1, 2);
  range('speakerVolume', 0, 127);
  range('headsetVolume', 0, 127);
  range('speakerGain', 0, 7);
  range('inactiveMinutes', 0, 60);
  range('pollingMode', 0, 2);
  range('audioBufferLength', 16, 127);
  range('controllerMode', 0, 2);
  range('triggerReduce', 0, 10);
  range('statusGpioPin', 0, 255);
  range('statusGpioMode', 0, 1);
  for (const key of ['disableLed', 'enableUsbSerial', 'psShortcut', 'disableMic', 'disableSpeaker', 'enableWake', 'lockVolume']) {
    if (typeof value[key] !== 'boolean') errors.push(`${key} must be boolean`);
  }
  return { ok: errors.length === 0, errors, value };
}

export function assertValidConfig(config) {
  const result = validateConfig(config);
  if (!result.ok) throw new ProtocolError(result.errors.join('; '), 'invalid_config');
  return result.value;
}

export function encodeConfig(config) {
  const value = assertValidConfig(config);
  const bytes = new Uint8Array(CONFIG_BYTES);
  const view = new DataView(bytes.buffer);
  bytes[0] = value.schema;
  view.setUint16(1, Math.round(value.hapticsGain * 100), true);
  bytes[3] = value.speakerVolume;
  bytes[4] = value.headsetVolume;
  bytes[5] = value.speakerGain;
  bytes[6] = value.inactiveMinutes;
  bytes[7] = value.pollingMode;
  bytes[8] = value.audioBufferLength;
  bytes[9] = value.controllerMode;
  let flags = 0;
  for (const [name, bit] of Object.entries(FEATURE_FLAGS)) if (value[name]) flags |= bit;
  view.setUint16(10, flags, true);
  bytes[12] = value.triggerReduce;
  bytes[13] = value.statusGpioPin;
  bytes[14] = value.statusGpioMode;
  return bytes;
}

export function decodeConfig(input) {
  const bytes = bytesOf(input);
  if (bytes.length < 15) throw new ProtocolError('Configuration payload is too short', 'short_config');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flags = view.getUint16(10, true);
  const config = {
    schema: bytes[0],
    hapticsGain: view.getUint16(1, true) / 100,
    speakerVolume: bytes[3],
    headsetVolume: bytes[4],
    speakerGain: bytes[5],
    inactiveMinutes: bytes[6],
    pollingMode: bytes[7],
    audioBufferLength: bytes[8],
    controllerMode: bytes[9],
    disableLed: Boolean(flags & FEATURE_FLAGS.disableLed),
    enableUsbSerial: Boolean(flags & FEATURE_FLAGS.enableUsbSerial),
    psShortcut: Boolean(flags & FEATURE_FLAGS.psShortcut),
    disableMic: Boolean(flags & FEATURE_FLAGS.disableMic),
    disableSpeaker: Boolean(flags & FEATURE_FLAGS.disableSpeaker),
    enableWake: Boolean(flags & FEATURE_FLAGS.enableWake),
    lockVolume: Boolean(flags & FEATURE_FLAGS.lockVolume),
    triggerReduce: bytes[12],
    statusGpioPin: bytes[13],
    statusGpioMode: bytes[14]
  };
  return assertValidConfig(config);
}

export function commandPayload(command, payload = new Uint8Array()) {
  return encodeFrame({ command, payload });
}

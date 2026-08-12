export const PROTOCOL_VERSION = 1;
export const FRAME_MAGIC = Object.freeze([0x4d, 0x4c]);
export const HID_REPORT_BYTES = 64;
export const FRAME_OVERHEAD_BYTES = 13;
export const MAX_PAYLOAD = HID_REPORT_BYTES - FRAME_OVERHEAD_BYTES - 3;
export const HID_USAGE_PAGE = 0xff00;

export const REPORT_IDS = Object.freeze({ command: 0x01, response: 0x02, event: 0x03 });
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
  enterRecovery: 0x0a
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

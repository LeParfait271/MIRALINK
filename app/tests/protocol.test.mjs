import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMANDS,
  ProtocolError,
  assertValidConfig,
  decodeControllerCapabilities,
  decodeControllerStatePayload,
  decodeConfig,
  decodeAudioStatusPayload,
  decodeDiagnosticsPayload,
  decodeHelloPayload,
  decodeFrame,
  defaultConfig,
  encodeConfig,
  encodeHapticRequest,
  encodeLightbarRequest,
  encodeMicrophoneMuteRequest,
  encodeControllerOutputRequest,
  encodeFrame
} from '../src/protocol.js';
import { inspectWebHidAvailability, transactFeatureReport } from '../src/hid-transport.js';

test('WebHID availability identifies a blocked permissions policy locally', () => {
  const status = inspectWebHidAvailability({
    navigator: {},
    isSecureContext: true,
    document: { permissionsPolicy: { allowsFeature: (name) => name !== 'hid' } }
  });
  assert.deepEqual(status, { available: false, isSecureContext: true, permissionsPolicy: false, reason: 'permissions-policy' });
});

test('WebHID availability identifies an insecure local context', () => {
  const status = inspectWebHidAvailability({ navigator: {}, isSecureContext: false });
  assert.deepEqual(status, { available: false, isSecureContext: false, permissionsPolicy: null, reason: 'insecure-context' });
});

test('frame round trip preserves sequence, command and payload', () => {
  const frame = encodeFrame({ sequence: 42, command: COMMANDS.hello, payload: Uint8Array.from([1, 2, 3]) });
  assert.equal(frame.length, 64);
  const decoded = decodeFrame(frame);
  assert.equal(decoded.sequence, 42);
  assert.equal(decoded.command, COMMANDS.hello);
  assert.deepEqual([...decoded.payload], [1, 2, 3]);
});

test('frame checksum rejects mutation', () => {
  const frame = encodeFrame({ sequence: 1, command: COMMANDS.getInfo });
  frame[6] ^= 1;
  assert.throws(() => decodeFrame(frame), (error) => error instanceof ProtocolError && error.code === 'bad_crc');
});

test('frame length rejects truncation', () => {
  const frame = encodeFrame({ sequence: 1, command: COMMANDS.getInfo, payload: Uint8Array.from([9]) });
  assert.throws(() => decodeFrame(frame.subarray(0, frame.length - 1)), /short|length/i);
});

test('frame padding rejects non-zero bytes', () => {
  const frame = encodeFrame({ sequence: 1, command: COMMANDS.getInfo });
  frame[63] = 1;
  assert.throws(() => decodeFrame(frame), /padding/i);
});

test('HID bridge commands read delayed feature responses explicitly', async () => {
  const device = {
    opened: true,
    reads: 0,
    sent: null,
    response: null,
    async sendFeatureReport(reportId, data) {
      this.sent = { reportId, data: Uint8Array.from(data) };
      this.response = encodeFrame({ sequence: 7, command: COMMANDS.hello, flags: 1, payload: Uint8Array.from([1, 1, 1, 0]) });
    },
    async receiveFeatureReport(reportId) {
      assert.equal(reportId, 2);
      this.reads += 1;
      if (this.reads === 1) throw new Error('feature response not ready');
      return this.response;
    }
  };

  const response = await transactFeatureReport(device, { sequence: 7, command: COMMANDS.hello, timeoutMs: 100, pollIntervalMs: 1 });
  assert.equal(device.sent.reportId, 1);
  assert.equal(device.sent.data.length, 64);
  assert.equal(device.reads, 2);
  assert.equal(response.sequence, 7);
  assert.deepEqual([...response.payload], [1, 1, 1, 0]);
});

test('HID bridge accepts a native report-id-prefixed feature response', async () => {
  const frame = encodeFrame({ sequence: 9, command: COMMANDS.hello, flags: 1, payload: Uint8Array.from([1, 1, 1, 0]) });
  const device = {
    async sendFeatureReport() {},
    async receiveFeatureReport(reportId) {
      return Uint8Array.from([reportId, ...frame]);
    }
  };
  const response = await transactFeatureReport(device, { sequence: 9, command: COMMANDS.hello, timeoutMs: 50 });
  assert.equal(response.sequence, 9);
  assert.deepEqual([...response.payload], [1, 1, 1, 0]);
});

test('HID bridge command errors remain typed', async () => {
  const device = {
    opened: true,
    async sendFeatureReport() {},
    async receiveFeatureReport() {
      return encodeFrame({ sequence: 8, command: COMMANDS.hello, flags: 3, payload: new TextEncoder().encode('Bluetooth is not ready') });
    }
  };

  await assert.rejects(
    transactFeatureReport(device, { sequence: 8, command: COMMANDS.hello, timeoutMs: 50 }),
    (error) => error instanceof ProtocolError && error.code === 'device_error' && /Bluetooth/.test(error.message)
  );
});

test('HELLO payload is decoded as structured binary data', () => {
  assert.deepEqual(decodeHelloPayload(Uint8Array.from([1, 1, 1, 0])), {
    protocolVersion: 1,
    configSchema: 1,
    transportVersion: 1,
    featureFlags: 0
  });
});

test('diagnostics payload keeps unavailable capabilities out of binary status', () => {
  assert.deepEqual(decodeDiagnosticsPayload(Uint8Array.from([1, 1, 1])), {
    schema: 1,
    configLoaded: true,
    usbMounted: true,
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
  assert.deepEqual(decodeDiagnosticsPayload(Uint8Array.from([2, 1, 1, 1, 1, 1, 0, 1, 1, 1, 5, 0, 0, 0, 2, 0, 0, 0])), {
    schema: 2,
    configLoaded: true,
    usbMounted: true,
    bluetoothAvailable: true,
    pairingWindowOpen: true,
    inquiryActive: true,
    connectionPending: false,
    controllerConnected: true,
    descriptorAvailable: true,
    inputAvailable: true,
    sampleCount: 5,
    rejectedReportCount: 2,
    audioUsbStreaming: false,
    audioBluetoothStreaming: false,
    audioUsbPacketCount: 0,
    audioDroppedFrameCount: 0
  });
  const extended = new Uint8Array(28);
  extended.set([3, 1, 1, 1, 0, 0, 1, 1, 1, 1, 5, 0, 0, 0, 2, 0, 0, 0, 1, 1], 0);
  new DataView(extended.buffer).setUint32(20, 12, true);
  new DataView(extended.buffer).setUint32(24, 3, true);
  assert.equal(decodeDiagnosticsPayload(extended).audioUsbPacketCount, 12);
  assert.equal(decodeDiagnosticsPayload(extended).audioBluetoothStreaming, true);
  const detailed = new Uint8Array(48);
  detailed.set(extended, 0);
  detailed[0] = 4;
  detailed[28] = 5;
  detailed[29] = 0x0e;
  new DataView(detailed.buffer).setUint32(32, 9, true);
  new DataView(detailed.buffer).setUint32(36, 3, true);
  new DataView(detailed.buffer).setUint32(40, 2, true);
  assert.deepEqual(
    (({ lastConnectionError, lastConnectionStatus, connectionAttemptCount, connectionFailureCount, reconnectAttemptCount }) => ({ lastConnectionError, lastConnectionStatus, connectionAttemptCount, connectionFailureCount, reconnectAttemptCount }))(decodeDiagnosticsPayload(detailed)),
    { lastConnectionError: 5, lastConnectionStatus: 0x0e, connectionAttemptCount: 9, connectionFailureCount: 3, reconnectAttemptCount: 2 }
  );
  assert.throws(() => decodeDiagnosticsPayload(Uint8Array.from([1])), /diagnostics/i);
});

test('controller state payload exposes Bluetooth input without inventing unsupported capabilities', () => {
  const payload = Uint8Array.from([1, 0x0f, 0x31, 128, 255, 0, 64, 32, 224, 0x30, 0x03, 0x01, 0, 0, 0, 0]);
  const decoded = decodeControllerStatePayload(payload);
  assert.equal(decoded.connected, true);
  assert.equal(decoded.bluetoothAvailable, true);
  assert.equal(decoded.pairingWindowOpen, false);
  assert.equal(decoded.inquiryActive, false);
  assert.equal(decoded.connectionPending, false);
  assert.equal(decoded.sample.transport, 'bluetooth');
  assert.equal(decoded.sample.buttons.cross, true);
  assert.equal(decoded.sample.buttons.square, true);
  assert.equal(decoded.sample.capabilities.haptics, 'not-implemented');
});

test('extended controller state decodes battery, sensors, touch and supported output limits', () => {
  const payload = new Uint8Array(48);
  payload.set([2, 0x0f, 0x31, 128, 128, 128, 128, 0, 0, 8, 0, 0, 72, 2, 0, 0, 75, 2, 0x3f, 9], 0);
  const view = new DataView(payload.buffer);
  view.setInt16(20, -100, true); view.setInt16(22, 200, true); view.setInt16(24, 300, true);
  view.setUint32(32, 1234, true); view.setUint16(36, 100, true); view.setUint16(38, 200, true);
  const decoded = decodeControllerStatePayload(payload);
  assert.equal(decoded.schema, 2);
  assert.equal(decoded.sample.batteryPercent, 75);
  assert.equal(decoded.sample.batteryState, 'charging');
  assert.equal(decoded.sample.extended.gyro.x, -100);
  assert.equal(decoded.sample.extended.sensorTimestamp, 1234);
  assert.equal(decoded.sample.extended.touchPoints[0].x, 100);
  assert.equal(decoded.sample.capabilities.haptics, 'supported');
  assert.equal(decoded.sample.capabilities.adaptiveTriggers, 'supported-through-output-route');
});

test('controller output payloads are versioned and bounded', () => {
  assert.deepEqual([...encodeHapticRequest({ leftMotor: 1, rightMotor: 2, durationMs: 3000 })], [1, 1, 2, 0xb8, 0x0b]);
  assert.deepEqual([...encodeLightbarRequest({ red: 1, green: 2, blue: 3, playerLeds: 0x1f })], [1, 1, 2, 3, 0x1f]);
  assert.deepEqual([...encodeMicrophoneMuteRequest(true)], [1, 1]);
  assert.equal(encodeControllerOutputRequest(new Uint8Array(47)).length, 48);
  assert.throws(() => encodeControllerOutputRequest(new Uint8Array(46)), /47 bytes/);
  assert.throws(() => encodeHapticRequest({ durationMs: 3001 }), /between 1 and 3000/);
  assert.throws(() => encodeLightbarRequest({ playerLeds: 0x20 }), /between 0 and 31/);
});

test('controller capabilities payload keeps transport and feature bits explicit', () => {
  const payload = Uint8Array.from([1, 1, 1, 1, 0x7f, 0, 0xb8, 0x0b]);
  const decoded = decodeControllerCapabilities(payload);
  assert.equal(decoded.transport, 'bluetooth');
  assert.equal(decoded.model, 'DualSense');
  assert.equal(decoded.capabilities, 0x7f);
  assert.equal(decoded.maxHapticDurationMs, 3000);
});

test('audio status payload keeps local stream counters typed', () => {
  const payload = new Uint8Array(16);
  payload.set([1, 1, 1, 1], 0);
  const view = new DataView(payload.buffer);
  view.setUint32(4, 8, true); view.setUint32(8, 2, true); view.setUint32(12, 5, true);
  assert.deepEqual(decodeAudioStatusPayload(payload), {
    schema: 1,
    usbStreaming: true,
    bluetoothStreaming: true,
    bluetoothLinkAvailable: true,
    usbPacketCount: 8,
    droppedFrameCount: 2,
    bluetoothPacketCount: 5
  });
});

test('controller state exposes an explicitly opened pairing window', () => {
  const payload = Uint8Array.from([1, 0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(decodeControllerStatePayload(payload).pairingWindowOpen, true);
});

test('controller state exposes inquiry and pending connection flags', () => {
  const payload = Uint8Array.from([1, 0x60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const decoded = decodeControllerStatePayload(payload);
  assert.equal(decoded.inquiryActive, true);
  assert.equal(decoded.connectionPending, true);
});

test('controller state exposes local paired-controller knowledge', () => {
  const payload = Uint8Array.from([1, 0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(decodeControllerStatePayload(payload).pairedControllerKnown, true);
});

test('configuration round trip preserves all fields', () => {
  const value = { ...defaultConfig(), hapticsGain: 1.37, speakerVolume: 77, inactiveMinutes: 12, pollingMode: 2, enableWake: true, lockVolume: true, statusGpioPin: 8, statusGpioMode: 1 };
  assert.deepEqual(decodeConfig(encodeConfig(value)), assertValidConfig(value));
});

test('configuration rejects unsafe values', () => {
  assert.throws(() => encodeConfig({ ...defaultConfig(), audioBufferLength: 2 }), (error) => error instanceof ProtocolError && error.code === 'invalid_config');
});

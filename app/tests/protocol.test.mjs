import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMANDS,
  ProtocolError,
  assertValidConfig,
  decodeControllerStatePayload,
  decodeConfig,
  decodeDiagnosticsPayload,
  decodeHelloPayload,
  decodeFrame,
  defaultConfig,
  encodeConfig,
  encodeFrame
} from '../src/protocol.js';
import { transactFeatureReport } from '../src/hid-transport.js';

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
  assert.deepEqual(decodeDiagnosticsPayload(Uint8Array.from([1, 1, 1])), { schema: 1, configLoaded: true, usbMounted: true });
  assert.throws(() => decodeDiagnosticsPayload(Uint8Array.from([1])), /diagnostics/i);
});

test('controller state payload exposes Bluetooth input without inventing unsupported capabilities', () => {
  const payload = Uint8Array.from([1, 0x0f, 0x31, 128, 255, 0, 64, 32, 224, 0x30, 0x03, 0x01, 0, 0, 0, 0]);
  const decoded = decodeControllerStatePayload(payload);
  assert.equal(decoded.connected, true);
  assert.equal(decoded.bluetoothAvailable, true);
  assert.equal(decoded.pairingWindowOpen, false);
  assert.equal(decoded.sample.transport, 'bluetooth');
  assert.equal(decoded.sample.buttons.cross, true);
  assert.equal(decoded.sample.buttons.square, true);
  assert.equal(decoded.sample.capabilities.haptics, 'not-implemented');
});

test('controller state exposes an explicitly opened pairing window', () => {
  const payload = Uint8Array.from([1, 0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(decodeControllerStatePayload(payload).pairingWindowOpen, true);
});

test('configuration round trip preserves all fields', () => {
  const value = { ...defaultConfig(), hapticsGain: 1.37, speakerVolume: 77, inactiveMinutes: 12, pollingMode: 2, enableWake: true, lockVolume: true, statusGpioPin: 8, statusGpioMode: 1 };
  assert.deepEqual(decodeConfig(encodeConfig(value)), assertValidConfig(value));
});

test('configuration rejects unsafe values', () => {
  assert.throws(() => encodeConfig({ ...defaultConfig(), audioBufferLength: 2 }), (error) => error instanceof ProtocolError && error.code === 'invalid_config');
});

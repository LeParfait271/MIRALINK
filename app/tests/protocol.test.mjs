import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMANDS,
  ProtocolError,
  assertValidConfig,
  decodeConfig,
  decodeFrame,
  defaultConfig,
  encodeConfig,
  encodeFrame
} from '../src/protocol.js';

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

test('configuration round trip preserves all fields', () => {
  const value = { ...defaultConfig(), hapticsGain: 1.37, speakerVolume: 77, inactiveMinutes: 12, pollingMode: 2, enableWake: true, lockVolume: true, statusGpioPin: 8, statusGpioMode: 1 };
  assert.deepEqual(decodeConfig(encodeConfig(value)), assertValidConfig(value));
});

test('configuration rejects unsafe values', () => {
  assert.throws(() => encodeConfig({ ...defaultConfig(), audioBufferLength: 2 }), (error) => error instanceof ProtocolError && error.code === 'invalid_config');
});

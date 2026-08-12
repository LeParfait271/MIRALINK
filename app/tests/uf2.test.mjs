import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUf2, UF2_FLAG_EXTENDED_TAGS, UF2_MAGIC0, UF2_MAGIC1, UF2_MAGIC_END } from '../src/uf2.js';

function block({ blockNo = 0, blockCount = 1, payloadSize = 4, flags = 0 } = {}) {
  const bytes = new Uint8Array(512);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, UF2_MAGIC0, true);
  view.setUint32(4, UF2_MAGIC1, true);
  view.setUint32(8, flags, true);
  view.setUint32(16, payloadSize, true);
  view.setUint32(20, blockNo, true);
  view.setUint32(24, blockCount, true);
  view.setUint32(508, UF2_MAGIC_END, true);
  return bytes;
}

test('UF2 parser accepts complete blocks', () => {
  assert.equal(parseUf2(block()).ok, true);
});

test('UF2 parser accepts an extended metadata block beside program blocks', () => {
  const bytes = new Uint8Array(1024);
  bytes.set(block({ blockCount: 2, payloadSize: 256, flags: UF2_FLAG_EXTENDED_TAGS }), 0);
  bytes.set(block({ blockCount: 1, payloadSize: 4 }), 512);
  assert.equal(parseUf2(bytes).ok, true);
});

test('UF2 parser rejects bad alignment', () => {
  assert.match(parseUf2(new Uint8Array(511)).message, /aligned/i);
});

test('UF2 parser rejects duplicate or out-of-range blocks', () => {
  const duplicate = new Uint8Array(1024);
  duplicate.set(block({ blockNo: 0, blockCount: 2 }), 0);
  duplicate.set(block({ blockNo: 0, blockCount: 2 }), 512);
  assert.match(parseUf2(duplicate).message, /duplicated/i);
  assert.match(parseUf2(block({ blockNo: 1, blockCount: 1 })).message, /number/i);
});

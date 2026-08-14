import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectUf2, parseUf2, UF2_EXTENSION_RP2_IGNORE_BLOCK, UF2_FAMILY_RP2350_ABSOLUTE, UF2_FLAG_EXTENDED_TAGS, UF2_FLAG_FAMILY_ID_PRESENT, UF2_MAGIC0, UF2_MAGIC1, UF2_MAGIC_END } from '../src/uf2.js';

function block({ blockNo = 0, blockCount = 1, payloadSize = 4, flags = 0, familyId = 0 } = {}) {
  const bytes = new Uint8Array(512);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, UF2_MAGIC0, true);
  view.setUint32(4, UF2_MAGIC1, true);
  view.setUint32(8, flags, true);
  view.setUint32(16, payloadSize, true);
  view.setUint32(20, blockNo, true);
  view.setUint32(24, blockCount, true);
  view.setUint32(28, familyId, true);
  view.setUint32(508, UF2_MAGIC_END, true);
  return bytes;
}

function rp2350AbsoluteSentinel() {
  const bytes = block({
    blockNo: 0,
    blockCount: 2,
    payloadSize: 256,
    flags: UF2_FLAG_FAMILY_ID_PRESENT | UF2_FLAG_EXTENDED_TAGS,
    familyId: UF2_FAMILY_RP2350_ABSOLUTE
  });
  bytes.fill(0xef, 32, 32 + 256);
  new DataView(bytes.buffer).setUint32(32 + 256, UF2_EXTENSION_RP2_IGNORE_BLOCK, true);
  return bytes;
}

test('UF2 parser accepts complete blocks', () => {
  assert.equal(parseUf2(block()).ok, true);
});

test('UF2 parser accepts coherently numbered blocks carrying extended tags', () => {
  const bytes = new Uint8Array(1024);
  bytes.set(block({ blockNo: 0, blockCount: 2, payloadSize: 256, flags: UF2_FLAG_EXTENDED_TAGS }), 0);
  bytes.set(block({ blockNo: 1, blockCount: 2, payloadSize: 4 }), 512);
  const result = parseUf2(bytes);
  assert.equal(result.ok, true);
  assert.equal(result.blocks, 2);
  assert.equal(result.bytes, 1024);
  assert.match(result.message, /^2 valid UF2 blocks/);
});

test('UF2 parser accepts a Picotool RP2350 sentinel before its load sequence', () => {
  const familyFlags = UF2_FLAG_FAMILY_ID_PRESENT;
  const bytes = new Uint8Array(4 * 512);
  bytes.set(rp2350AbsoluteSentinel(), 0);
  bytes.set(block({ blockNo: 0, blockCount: 3, payloadSize: 256, flags: familyFlags, familyId: 0xe48bff59 }), 512);
  bytes.set(block({ blockNo: 1, blockCount: 3, payloadSize: 256, flags: familyFlags, familyId: 0xe48bff59 }), 1024);
  bytes.set(block({ blockNo: 2, blockCount: 3, payloadSize: 256, flags: familyFlags, familyId: 0xe48bff59 }), 1536);

  const result = parseUf2(bytes);
  assert.equal(result.ok, true);
  assert.equal(result.blocks, 4);
  assert.equal(result.sequences, 1);
  assert.equal(result.ignoredBlocks, 1);
  assert.match(result.message, /^4 valid UF2 blocks across 1 sequence/);
});

test('UF2 parser does not excuse an incomplete fake RP2350 absolute sequence', () => {
  const badPayload = rp2350AbsoluteSentinel();
  badPayload[32] = 0;
  assert.match(parseUf2(badPayload).message, /count does not match/i);

  const badExtension = rp2350AbsoluteSentinel();
  new DataView(badExtension.buffer).setUint32(32 + 256, 0, true);
  assert.match(parseUf2(badExtension).message, /count does not match/i);

  const badFlags = rp2350AbsoluteSentinel();
  new DataView(badFlags.buffer).setUint32(8, UF2_FLAG_FAMILY_ID_PRESENT, true);
  assert.match(parseUf2(badFlags).message, /count does not match/i);

  const sentinelOnly = rp2350AbsoluteSentinel();
  assert.match(parseUf2(sentinelOnly).message, /no loadable/i);

  const misplaced = new Uint8Array(1024);
  misplaced.set(block(), 0);
  misplaced.set(rp2350AbsoluteSentinel(), 512);
  assert.match(parseUf2(misplaced).message, /count does not match/i);
});

test('UF2 parser keeps independent ordinary family sequences strict', () => {
  const flags = UF2_FLAG_FAMILY_ID_PRESENT;
  const bytes = new Uint8Array(4 * 512);
  bytes.set(block({ blockNo: 0, blockCount: 2, flags, familyId: 0x11111111 }), 0);
  bytes.set(block({ blockNo: 1, blockCount: 2, flags, familyId: 0x11111111 }), 512);
  bytes.set(block({ blockNo: 0, blockCount: 2, flags, familyId: 0x22222222 }), 1024);
  bytes.set(block({ blockNo: 1, blockCount: 2, flags, familyId: 0x22222222 }), 1536);
  const result = parseUf2(bytes);
  assert.equal(result.ok, true);
  assert.equal(result.sequences, 2);
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

test('UF2 extended-tag blocks cannot bypass duplicate, index or count checks', () => {
  const duplicate = new Uint8Array(1024);
  duplicate.set(block({ blockNo: 0, blockCount: 2, flags: UF2_FLAG_EXTENDED_TAGS }), 0);
  duplicate.set(block({ blockNo: 0, blockCount: 2 }), 512);
  assert.match(parseUf2(duplicate).message, /duplicated/i);

  assert.match(parseUf2(block({ blockNo: 2, blockCount: 2, flags: UF2_FLAG_EXTENDED_TAGS })).message, /number/i);

  const inconsistentCount = new Uint8Array(1024);
  inconsistentCount.set(block({ blockNo: 0, blockCount: 2, flags: UF2_FLAG_EXTENDED_TAGS }), 0);
  inconsistentCount.set(block({ blockNo: 1, blockCount: 3 }), 512);
  assert.match(parseUf2(inconsistentCount).message, /inconsistent block count/i);

  assert.match(parseUf2(block({ blockNo: 0, blockCount: 2, flags: UF2_FLAG_EXTENDED_TAGS })).message, /count does not match/i);
});

test('UF2 inspection computes a local SHA-256 only for a valid image', async () => {
  let digestCalls = 0;
  const subtle = {
    async digest(algorithm, bytes) {
      digestCalls += 1;
      assert.equal(algorithm, 'SHA-256');
      assert.equal(bytes.byteLength, 512);
      return Uint8Array.from([0x00, 0xab, 0xff]).buffer;
    }
  };
  const valid = await inspectUf2(block(), { subtle });
  assert.equal(valid.ok, true);
  assert.equal(valid.sha256, '00abff');
  assert.equal(digestCalls, 1);

  const invalid = await inspectUf2(new Uint8Array(511), { subtle });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.sha256, null);
  assert.equal(digestCalls, 1);
});

test('UF2 inspection remains useful when Web Crypto is unavailable', async () => {
  const inspection = await inspectUf2(block(), { subtle: null });
  assert.equal(inspection.ok, true);
  assert.equal(inspection.sha256, null);
});

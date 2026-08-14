export const UF2_BLOCK_BYTES = 512;
export const UF2_PAYLOAD_OFFSET = 32;
export const UF2_PAYLOAD_MAX = 476;
export const UF2_MAGIC0 = 0x0a324655;
export const UF2_MAGIC1 = 0x9e5d5157;
export const UF2_MAGIC_END = 0x0ab16f30;
export const UF2_FLAG_FAMILY_ID_PRESENT = 0x00002000;
export const UF2_FLAG_EXTENDED_TAGS = 0x00008000;
export const UF2_FAMILY_RP2350_ABSOLUTE = 0xe48bff57;
export const UF2_EXTENSION_RP2_IGNORE_BLOCK = 0x9957e304;

function readBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return Uint8Array.from(input || []);
}

export function parseUf2(input) {
  const bytes = readBytes(input);
  if (bytes.length === 0 || bytes.length % UF2_BLOCK_BYTES !== 0) return { ok: false, message: 'The file is not aligned to UF2 blocks.' };

  // RP2350 images can carry more than one independently numbered UF2
  // sequence (for example, an absolute family metadata sequence followed by
  // the ARM-S payload sequence). Validate numbering and completeness inside
  // each declared family instead of conflating their block counters.
  const sequences = new Map();
  let ignoredBlocks = 0;
  for (let offset = 0; offset < bytes.length; offset += UF2_BLOCK_BYTES) {
    const block = new DataView(bytes.buffer, bytes.byteOffset + offset, UF2_BLOCK_BYTES);
    const blockIndex = offset / UF2_BLOCK_BYTES;
    if (block.getUint32(0, true) !== UF2_MAGIC0 || block.getUint32(4, true) !== UF2_MAGIC1 || block.getUint32(508, true) !== UF2_MAGIC_END) {
      return { ok: false, message: `Invalid UF2 magic at block ${blockIndex}.` };
    }
    const payloadSize = block.getUint32(16, true);
    const blockNo = block.getUint32(20, true);
    const blockCount = block.getUint32(24, true);
    const flags = block.getUint32(8, true);
    if (payloadSize === 0 || payloadSize > UF2_PAYLOAD_MAX || UF2_PAYLOAD_OFFSET + payloadSize > 508) return { ok: false, message: `Invalid UF2 payload at block ${blockNo}.` };
    if (blockCount === 0 || blockNo >= blockCount) return { ok: false, message: `Invalid UF2 block number ${blockNo}.` };
    const familyId = (flags & UF2_FLAG_FAMILY_ID_PRESENT) !== 0 ? block.getUint32(28, true) : null;
    const isRp2350AbsoluteSentinel = blockIndex === 0
      && familyId === UF2_FAMILY_RP2350_ABSOLUTE
      && flags === (UF2_FLAG_FAMILY_ID_PRESENT | UF2_FLAG_EXTENDED_TAGS)
      && payloadSize === 256
      && blockNo === 0
      && blockCount === 2
      && bytes.subarray(offset + UF2_PAYLOAD_OFFSET, offset + UF2_PAYLOAD_OFFSET + payloadSize).every((byte) => byte === 0xef)
      && block.getUint32(UF2_PAYLOAD_OFFSET + payloadSize, true) === UF2_EXTENSION_RP2_IGNORE_BLOCK
      && block.getUint32(UF2_PAYLOAD_OFFSET + payloadSize + 4, true) === 0;
    if (isRp2350AbsoluteSentinel) {
      // Picotool's RP2350-E10 workaround is a physical sentinel, not an
      // independently complete load sequence. Its exact IGNORE_BLOCK tag is
      // the only form allowed to bypass per-family sequence counting.
      ignoredBlocks += 1;
      continue;
    }
    const sequenceKey = familyId === null ? 'unscoped' : `family:${familyId.toString(16).padStart(8, '0')}`;
    let sequence = sequences.get(sequenceKey);
    if (!sequence) {
      sequence = { expectedBlockCount: blockCount, seenBlocks: new Set() };
      sequences.set(sequenceKey, sequence);
    } else if (blockCount !== sequence.expectedBlockCount) {
      return { ok: false, message: `UF2 block ${blockNo} declares an inconsistent block count within its sequence.` };
    }
    if (sequence.seenBlocks.has(blockNo)) return { ok: false, message: `UF2 block ${blockNo} is duplicated within its sequence.` };
    sequence.seenBlocks.add(blockNo);
    // Extended tags occupy padding in an otherwise normal UF2 block. Their
    // flag never exempts that block from sequence and count validation.
    void flags;
  }
  if (sequences.size === 0) return { ok: false, message: 'UF2 contains no loadable block sequence.' };
  for (const sequence of sequences.values()) {
    if (sequence.seenBlocks.size !== sequence.expectedBlockCount) return { ok: false, message: 'UF2 block count does not match its sequence.' };
    for (let blockNo = 0; blockNo < sequence.expectedBlockCount; blockNo += 1) {
      if (!sequence.seenBlocks.has(blockNo)) return { ok: false, message: `UF2 block ${blockNo} is missing from its sequence.` };
    }
  }
  const blockTotal = bytes.length / UF2_BLOCK_BYTES;
  const sequenceTotal = sequences.size;
  const sequenceLabel = sequenceTotal === 1 ? 'sequence' : 'sequences';
  return { ok: true, blocks: blockTotal, sequences: sequenceTotal, ignoredBlocks, bytes: bytes.length, message: `${blockTotal} valid UF2 blocks across ${sequenceTotal} ${sequenceLabel} (${bytes.length.toLocaleString()} bytes).` };
}

export async function inspectUf2(input, { subtle = globalThis.crypto?.subtle } = {}) {
  const bytes = readBytes(input);
  const inspection = parseUf2(bytes);
  if (!inspection.ok || !subtle || typeof subtle.digest !== 'function') {
    return Object.freeze({ ...inspection, sha256: null });
  }
  const digest = await subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return Object.freeze({ ...inspection, sha256 });
}

export const UF2_BLOCK_BYTES = 512;
export const UF2_PAYLOAD_OFFSET = 32;
export const UF2_PAYLOAD_MAX = 476;
export const UF2_MAGIC0 = 0x0a324655;
export const UF2_MAGIC1 = 0x9e5d5157;
export const UF2_MAGIC_END = 0x0ab16f30;
export const UF2_FLAG_EXTENDED_TAGS = 0x00008000;

function readBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return Uint8Array.from(input || []);
}

export function parseUf2(input) {
  const bytes = readBytes(input);
  if (bytes.length === 0 || bytes.length % UF2_BLOCK_BYTES !== 0) return { ok: false, message: 'The file is not aligned to UF2 blocks.' };

  const groups = new Map();
  let dataBlocks = 0;
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
    if ((flags & UF2_FLAG_EXTENDED_TAGS) !== 0) continue;
    dataBlocks += 1;
    if (!groups.has(blockCount)) groups.set(blockCount, new Set());
    const seenBlocks = groups.get(blockCount);
    if (seenBlocks.has(blockNo)) return { ok: false, message: `UF2 block ${blockNo} is duplicated.` };
    seenBlocks.add(blockNo);
  }
  if (dataBlocks === 0) return { ok: false, message: 'UF2 contains no program blocks.' };
  for (const [expectedBlocks, seenBlocks] of groups) if (seenBlocks.size !== expectedBlocks) return { ok: false, message: 'UF2 block count does not match the file.' };
  return { ok: true, blocks: dataBlocks, bytes: bytes.length, message: `${dataBlocks} valid UF2 blocks (${bytes.length.toLocaleString()} bytes).` };
}

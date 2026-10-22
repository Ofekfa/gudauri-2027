/**
 * A minimal ZIP writer ("stored": no compression; JPEGs don't shrink further).
 * Builds the archive as a Blob of parts so large albums don't need one big buffer.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const DOS_DATE_2027 = ((2027 - 1980) << 9) | (2 << 5) | 24; // a fixed date: our first day
const UTF8_FLAG = 0x0800;

function header(size: number): { view: DataView; bytes: Uint8Array<ArrayBuffer> } {
  const bytes = new Uint8Array(size);
  return { view: new DataView(bytes.buffer), bytes };
}

export function createZip(entries: readonly ZipEntry[]): Blob {
  const enc = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = enc.encode(entry.name);
    const crc = crc32(entry.data);
    const local = header(30);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, UTF8_FLAG, true);
    local.view.setUint16(12, DOS_DATE_2027, true);
    local.view.setUint32(14, crc, true);
    local.view.setUint32(18, entry.data.length, true);
    local.view.setUint32(22, entry.data.length, true);
    local.view.setUint16(26, name.length, true);
    parts.push(local.bytes, name, entry.data as Uint8Array<ArrayBuffer>);

    const dir = header(46);
    dir.view.setUint32(0, 0x02014b50, true);
    dir.view.setUint16(4, 20, true);
    dir.view.setUint16(6, 20, true);
    dir.view.setUint16(8, UTF8_FLAG, true);
    dir.view.setUint16(14, DOS_DATE_2027, true);
    dir.view.setUint32(16, crc, true);
    dir.view.setUint32(20, entry.data.length, true);
    dir.view.setUint32(24, entry.data.length, true);
    dir.view.setUint16(28, name.length, true);
    dir.view.setUint32(42, offset, true);
    central.push(dir.bytes, name);
    offset += 30 + name.length + entry.data.length;
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const end = header(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, entries.length, true);
  end.view.setUint16(10, entries.length, true);
  end.view.setUint32(12, centralSize, true);
  end.view.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.bytes], { type: 'application/zip' });
}

/** "03-taxi-to-the-ski-resort-02.jpg": frame number, slug, photo number. */
export function zipName(frameNumber: number, title: string, photoNumber: number): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(frameNumber)}-${slug || 'frame'}-${two(photoNumber)}.jpg`;
}

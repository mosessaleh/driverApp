const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const files = ['assets/icon.png', 'assets/adaptive-icon.png'];

const makeCrcTable = () => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
};

const crcTable = makeCrcTable();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const isWhiteBorderPixel = (r, g, b, a) => {
  if (a === 0) return false;
  const threshold = 250;
  return r >= threshold && g >= threshold && b >= threshold;
};

const processFile = (relativePath) => {
  const filePath = path.resolve(__dirname, '..', relativePath);
  const data = fs.readFileSync(filePath);
  const pngSignature = data.slice(0, 8);
  if (!pngSignature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error('Not a PNG file: ' + relativePath);
  }

  let offset = 8;
  const chunks = [];
  let ihdr = null;
  let idatBuffers = [];

  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.slice(offset + 4, offset + 8).toString('ascii');
    const chunkData = data.slice(offset + 8, offset + 8 + length);
    const crc = data.readUInt32BE(offset + 8 + length);
    chunks.push({ type, length, chunkData, crc });
    if (type === 'IHDR') {
      ihdr = chunkData;
    } else if (type === 'IDAT') {
      idatBuffers.push(chunkData);
    }
    offset += 12 + length;
  }

  if (!ihdr) throw new Error('No IHDR chunk');

  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr.readUInt8(8);
  const colorType = ihdr.readUInt8(9);
  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error('Unsupported PNG format for ' + relativePath + ' (expected RGBA 8-bit)');
  }

  const rawData = zlib.inflateSync(Buffer.concat(idatBuffers));
  const bytesPerPixel = 4;
  const scanlineLength = 1 + width * bytesPerPixel;
  if (rawData.length !== scanlineLength * height) {
    throw new Error('Unexpected decompressed length for ' + relativePath);
  }

  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  let inOffset = 0;
  const prevLine = Buffer.alloc(width * bytesPerPixel);
  for (let y = 0; y < height; y++) {
    const filterType = rawData[inOffset];
    const line = rawData.slice(inOffset + 1, inOffset + 1 + width * bytesPerPixel);
    const outLine = pixels.subarray(y * width * bytesPerPixel, (y + 1) * width * bytesPerPixel);

    if (filterType === 0) {
      line.copy(outLine);
    } else if (filterType === 1) {
      for (let x = 0; x < line.length; x++) {
        const left = x >= bytesPerPixel ? outLine[x - bytesPerPixel] : 0;
        outLine[x] = (line[x] + left) & 0xff;
      }
    } else if (filterType === 2) {
      for (let x = 0; x < line.length; x++) {
        const up = prevLine[x];
        outLine[x] = (line[x] + up) & 0xff;
      }
    } else if (filterType === 3) {
      for (let x = 0; x < line.length; x++) {
        const left = x >= bytesPerPixel ? outLine[x - bytesPerPixel] : 0;
        const up = prevLine[x];
        outLine[x] = (line[x] + Math.floor((left + up) / 2)) & 0xff;
      }
    } else if (filterType === 4) {
      const paeth = (a, b, c) => {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        if (pa <= pb && pa <= pc) return a;
        if (pb <= pc) return b;
        return c;
      };
      for (let x = 0; x < line.length; x++) {
        const left = x >= bytesPerPixel ? outLine[x - bytesPerPixel] : 0;
        const up = prevLine[x];
        const upLeft = x >= bytesPerPixel ? prevLine[x - bytesPerPixel] : 0;
        outLine[x] = (line[x] + paeth(left, up, upLeft)) & 0xff;
      }
    } else {
      throw new Error('Unsupported filter type ' + filterType);
    }

    outLine.copy(prevLine);
    inOffset += scanlineLength;
  }

  const visited = new Uint8Array(width * height);
  const queue = [];
  const enqueue = (x, y) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    queue.push([x, y]);
  };

  const getPixel = (x, y) => {
    const base = (y * width + x) * bytesPerPixel;
    return [pixels[base], pixels[base + 1], pixels[base + 2], pixels[base + 3]];
  };
  const setAlpha = (x, y, value) => {
    const base = (y * width + x) * bytesPerPixel;
    pixels[base + 3] = value;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queue.length) {
    const [x, y] = queue.shift();
    const [r, g, b, a] = getPixel(x, y);
    if (!isWhiteBorderPixel(r, g, b, a)) continue;
    setAlpha(x, y, 0);
    if (x > 0) enqueue(x - 1, y);
    if (x < width - 1) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y < height - 1) enqueue(x, y + 1);
  }

  const outLines = Buffer.alloc((bytesPerPixel * width + 1) * height);
  let outOffset = 0;
  for (let y = 0; y < height; y++) {
    outLines[outOffset++] = 0;
    const row = pixels.subarray(y * width * bytesPerPixel, (y + 1) * width * bytesPerPixel);
    row.copy(outLines, outOffset);
    outOffset += width * bytesPerPixel;
  }

  const compressed = zlib.deflateSync(outLines);
  const newChunks = [];
  let idatInserted = false;
  chunks.forEach((chunk) => {
    if (chunk.type === 'IDAT') {
      if (!idatInserted) {
        const len = compressed.length;
        const typeBuf = Buffer.from('IDAT');
        const crcBuf = Buffer.alloc(4);
        const crcVal = crc32(Buffer.concat([typeBuf, compressed]));
        const newChunk = Buffer.alloc(12 + len);
        newChunk.writeUInt32BE(len, 0);
        typeBuf.copy(newChunk, 4);
        compressed.copy(newChunk, 8);
        newChunk.writeUInt32BE(crcVal, 8 + len);
        newChunks.push(newChunk);
        idatInserted = true;
      }
    } else if (chunk.type === 'IEND') {
      const len = 0;
      const typeBuf = Buffer.from('IEND');
      const newChunk = Buffer.alloc(12);
      newChunk.writeUInt32BE(len, 0);
      typeBuf.copy(newChunk, 4);
      newChunk.writeUInt32BE(crc32(typeBuf), 8);
      newChunks.push(newChunk);
    } else if (chunk.type !== 'IDAT') {
      const header = Buffer.alloc(8);
      header.writeUInt32BE(chunk.length, 0);
      Buffer.from(chunk.type).copy(header, 4);
      newChunks.push(Buffer.concat([header, chunk.chunkData, Buffer.alloc(4)]));
      const crcVal = crc32(Buffer.concat([Buffer.from(chunk.type), chunk.chunkData]));
      newChunks[newChunks.length - 1].writeUInt32BE(crcVal, 8 + chunk.chunkData.length);
    }
  });

  const output = Buffer.concat([pngSignature, ...newChunks]);
  fs.writeFileSync(filePath, output);
  console.log('Updated', relativePath);
};

files.forEach(processFile);

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const table = [];
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c >>> 0;
}

function crc32(buf) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return ((crc ^ -1) >>> 0);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(size, drawFn) {
  const width = size;
  const height = size;
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    rawData[rowOffset] = 0; // Filter type 0
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function renderAdminIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const r = w / 2;
  const dx = (x - cx) / r;
  const dy = (y - cy) / r;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background dark gradient #090d16 -> #131b2e
  const bgGrad = 0.5 + 0.5 * (dy * 0.7 - dx * 0.3);
  let red = Math.round(9 + bgGrad * 12);
  let green = Math.round(13 + bgGrad * 16);
  let blue = Math.round(22 + bgGrad * 28);
  let alpha = 255;

  // Outer gold ring
  if (dist >= 0.88 && dist <= 0.94) {
    const ringAlpha = 1 - Math.abs(dist - 0.91) / 0.03;
    red = Math.round(red * (1 - ringAlpha) + 218 * ringAlpha);
    green = Math.round(green * (1 - ringAlpha) + 165 * ringAlpha);
    blue = Math.round(blue * (1 - ringAlpha) + 32 * ringAlpha);
  }

  // Four-pointed star in center (✦)
  // Distance metric for 4-point star: |dx|^0.5 + |dy|^0.5 < threshold
  const starDist = Math.pow(Math.abs(dx), 0.55) + Math.pow(Math.abs(dy), 0.55);
  if (starDist < 0.62) {
    const starIntensity = Math.min(1, Math.max(0, (0.62 - starDist) / 0.2));
    red = Math.round(red * (1 - starIntensity) + 245 * starIntensity);
    green = Math.round(green * (1 - starIntensity) + 200 * starIntensity);
    blue = Math.round(blue * (1 - starIntensity) + 66 * starIntensity);
  }

  // Inner core glow
  if (dist < 0.16) {
    const core = (0.16 - dist) / 0.16;
    red = Math.round(red * (1 - core) + 255 * core);
    green = Math.round(green * (1 - core) + 235 * core);
    blue = Math.round(blue * (1 - core) + 160 * core);
  }

  return [red, green, blue, alpha];
}

const outDir = path.resolve(__dirname, '../client/public/icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'icon-192x192.png'), createPng(192, renderAdminIcon));
fs.writeFileSync(path.join(outDir, 'icon-512x512.png'), createPng(512, renderAdminIcon));
fs.writeFileSync(path.join(outDir, 'admin-pwa-icon.png'), createPng(192, renderAdminIcon));
console.log('PWA icons created successfully in', outDir);

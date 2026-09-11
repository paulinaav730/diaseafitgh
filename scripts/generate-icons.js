import fs from 'fs';
import zlib from 'zlib';

function createPng(size, rx, borderWidth, borderColor, bgColor, triangleColor) {
  // RGBA buffer
  const width = size;
  const height = size;
  const buffer = Buffer.alloc(width * height * 4);

  // Helper colors
  const parseHex = (hex) => {
    hex = hex.replace('#', '');
    return [
      parseInt(hex.substring(0, 2), 16),
      parseInt(hex.substring(2, 4), 16),
      parseInt(hex.substring(4, 6), 16),
      255,
    ];
  };

  const bg = parseHex(bgColor);
  const border = parseHex(borderColor);
  const tri = parseHex(triangleColor);

  // Signed distance function for rounded box
  // Box bounds: [pad, pad, size - pad, size - pad]
  const pad = borderWidth / 2 + 1;
  const bx = (size - 2 * pad) / 2;
  const by = (size - 2 * pad) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const r = Math.min(rx, bx, by);

  // Triangle vertices (optically centered)
  // Triangle height = size * 0.38, width = size * 0.30
  // Left: cx - size * 0.10, Right tip: cx + size * 0.19
  const x1 = cx - size * 0.10;
  const y1 = cy - size * 0.19;
  const x2 = cx + size * 0.19;
  const y2 = cy;
  const x3 = cx - size * 0.10;
  const y3 = cy + size * 0.19;

  // Point in triangle test
  const sign = (p1x, p1y, p2x, p2y, p3x, p3y) => {
    return (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y);
  };

  const isInsideTriangle = (px, py) => {
    const d1 = sign(px, py, x1, y1, x2, y2);
    const d2 = sign(px, py, x2, y2, x3, y3);
    const d3 = sign(px, py, x3, y3, x1, y1);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Distance to rounded rect edge
      const dx = Math.abs(x + 0.5 - cx) - (bx - r);
      const dy = Math.abs(y + 0.5 - cy) - (by - r);
      let distOuter = 0;
      if (dx > 0 && dy > 0) {
        distOuter = Math.sqrt(dx * dx + dy * dy) - r;
      } else {
        distOuter = Math.max(dx, dy) - r;
      }

      if (distOuter > 1) {
        // Transparent outside
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
      } else if (distOuter > -borderWidth) {
        // Border
        const alpha = distOuter > 0 ? 1 - distOuter : 1;
        buffer[idx] = border[0];
        buffer[idx + 1] = border[1];
        buffer[idx + 2] = border[2];
        buffer[idx + 3] = Math.round(255 * alpha);
      } else {
        // Inside
        if (isInsideTriangle(x + 0.5, y + 0.5)) {
          buffer[idx] = tri[0];
          buffer[idx + 1] = tri[1];
          buffer[idx + 2] = tri[2];
          buffer[idx + 3] = 255;
        } else {
          buffer[idx] = bg[0];
          buffer[idx + 1] = bg[1];
          buffer[idx + 2] = bg[2];
          buffer[idx + 3] = 255;
        }
      }
    }
  }

  // Encode PNG
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type 6: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const makeChunk = (type, data) => {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    // CRC
    const crcVal = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
    buf.writeUInt32BE(crcVal, 8 + len);
    return buf;
  };

  // Scanlines with filter byte 0
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const scanlineOffset = y * (1 + width * 4);
    scanlines[scanlineOffset] = 0; // Filter None
    buffer.copy(scanlines, scanlineOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressedData = zlib.deflateSync(scanlines);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect x="3" y="3" width="58" height="58" rx="18" fill="#FFFDF8" stroke="#E2B167" stroke-width="4" />
  <path d="M 26 20.5 L 43.5 32 L 26 43.5 Z" fill="#B83A24" stroke="#B83A24" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
</svg>`;

fs.writeFileSync('public/favicon.svg', svgContent, 'utf-8');

const png32 = createPng(32, 9, 2.5, '#E2B167', '#FFFDF8', '#B83A24');
fs.writeFileSync('public/favicon-32x32.png', png32);
fs.writeFileSync('public/favicon.ico', png32);

const png192 = createPng(192, 54, 14, '#E2B167', '#FFFDF8', '#B83A24');
fs.writeFileSync('public/icon-192.png', png192);
fs.writeFileSync('public/apple-touch-icon.png', png192);

const png512 = createPng(512, 145, 36, '#E2B167', '#FFFDF8', '#B83A24');
fs.writeFileSync('public/icon-512.png', png512);

console.log('Favicons and PNG icons generated successfully!');

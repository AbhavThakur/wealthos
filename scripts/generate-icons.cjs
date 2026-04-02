const fs = require("fs");
const zlib = require("zlib");

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return c ^ 0xffffffff;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(typeData) >>> 0);
  return Buffer.concat([len, typeData, crcVal]);
}

function createPNG(size) {
  const bg = [12, 12, 15];
  const gold = [201, 168, 76];
  const rawData = Buffer.alloc(size * (size * 4 + 1));
  const cr = Math.floor(size * 0.22);

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    rawData[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 4;
      let inside = true;

      // rounded corners
      if (x < cr && y < cr) {
        inside = (x - cr) * (x - cr) + (y - cr) * (y - cr) <= cr * cr;
      } else if (x >= size - cr && y < cr) {
        inside =
          (x - (size - cr - 1)) * (x - (size - cr - 1)) + (y - cr) * (y - cr) <=
          cr * cr;
      } else if (x < cr && y >= size - cr) {
        inside =
          (x - cr) * (x - cr) + (y - (size - cr - 1)) * (y - (size - cr - 1)) <=
          cr * cr;
      } else if (x >= size - cr && y >= size - cr) {
        inside =
          (x - (size - cr - 1)) * (x - (size - cr - 1)) +
            (y - (size - cr - 1)) * (y - (size - cr - 1)) <=
          cr * cr;
      }

      if (!inside) {
        rawData[px] = 0;
        rawData[px + 1] = 0;
        rawData[px + 2] = 0;
        rawData[px + 3] = 0;
        continue;
      }
      rawData[px] = bg[0];
      rawData[px + 1] = bg[1];
      rawData[px + 2] = bg[2];
      rawData[px + 3] = 255;
    }
  }

  // Draw gold ₹ symbol (simplified geometric shapes)
  const cX = Math.floor(size / 2);
  const cY = Math.floor(size * 0.47);
  const s = Math.floor(size * 0.16);
  const thick = Math.max(2, Math.floor(size * 0.035));

  // Top horizontal bar
  for (let y = cY - s; y < cY - s + thick; y++) {
    for (let x = cX - s; x < cX + s; x++) {
      setGold(rawData, size, x, y, gold);
    }
  }
  // Middle horizontal bar
  for (
    let y = cY - Math.floor(s * 0.3);
    y < cY - Math.floor(s * 0.3) + thick;
    y++
  ) {
    for (let x = cX - s; x < cX + s; x++) {
      setGold(rawData, size, x, y, gold);
    }
  }
  // Vertical stem
  for (let y = cY - s; y < cY + Math.floor(s * 0.4); y++) {
    for (
      let x = cX - Math.floor(thick * 0.5);
      x < cX + Math.floor(thick * 1.5);
      x++
    ) {
      setGold(rawData, size, x, y, gold);
    }
  }
  // Diagonal leg
  for (let i = 0; i < Math.floor(s * 1.5); i++) {
    const bx = cX + Math.floor(i * 0.6);
    const by = cY + Math.floor(s * 0.2) + i;
    for (let t = -thick; t <= thick; t++) {
      setGold(rawData, size, bx + t, by, gold);
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function setGold(rawData, size, x, y, gold) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const px = y * (size * 4 + 1) + 1 + x * 4;
  if (rawData[px + 3] === 0) return; // outside rounded rect
  rawData[px] = gold[0];
  rawData[px + 1] = gold[1];
  rawData[px + 2] = gold[2];
}

fs.writeFileSync("public/icons/icon-192.png", createPNG(192));
fs.writeFileSync("public/icons/icon-512.png", createPNG(512));
fs.writeFileSync("public/apple-touch-icon.png", createPNG(180));
console.log("Done: icon-192.png, icon-512.png, apple-touch-icon.png");

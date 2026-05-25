const fs = require('fs');
const files = ['assets/icon.png', 'assets/adaptive-icon.png', 'assets/icon-legacy.png', 'assets/adaptive-icon-legacy.png'];
files.forEach((name) => {
  const path = require('path').resolve(__dirname, '..', name);
  const buf = fs.readFileSync(path);
  const chunks = [];
  let pos = 8;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.slice(pos + 4, pos + 8).toString('ascii');
    chunks.push({ type, len });
    if (type === 'IHDR') {
      const ihdrData = buf.slice(pos + 8, pos + 8 + len);
      console.log(name);
      console.log('  chunks:', chunks.map((c) => c.type).join(','));
      console.log('  width', ihdrData.readUInt32BE(0), 'height', ihdrData.readUInt32BE(4));
      console.log('  bitDepth', ihdrData.readUInt8(8), 'colorType', ihdrData.readUInt8(9), 'compression', ihdrData.readUInt8(10), 'filter', ihdrData.readUInt8(11), 'interlace', ihdrData.readUInt8(12));
      break;
    }
    pos += 12 + len;
  }
});

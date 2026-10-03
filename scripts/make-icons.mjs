// Renders the app icons in public/ from the favicon artwork. Run after changing public/favicon.svg:
//   node scripts/make-icons.mjs
// sharp is installed with the toolchain (next and miniflare depend on it).
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const rounded = readFileSync("public/favicon.svg");
// iOS and Android mask icons themselves, so these variants fill the whole square.
const fullBleed = Buffer.from(rounded.toString("utf8").replace(/ rx="\d+"/, ""));

const png = (svg, size) => sharp(svg, { density: 72 * (size / 40) }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

writeFileSync("public/apple-touch-icon.png", await png(fullBleed, 180));
writeFileSync("public/icon-192.png", await png(rounded, 192));
writeFileSync("public/icon-512.png", await png(rounded, 512));
writeFileSync("public/icon-maskable-512.png", await png(fullBleed, 512));

// favicon.ico: one 32×32 PNG in an ICO container (6-byte header + one 16-byte directory entry).
const image = await png(rounded, 32);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(image.length, 14); header.writeUInt32LE(22, 18);
writeFileSync("public/favicon.ico", Buffer.concat([header, image]));
console.log("icons written to public/");

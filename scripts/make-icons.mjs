// Renders the app icons in public/: the PWA and Apple icons from the Atlas mark (scripts/brand-mark.mjs, the same
// «atlas↗» as the site header and the mobile apps), favicon.ico from public/favicon.svg (the word is unreadable at
// 16-32 px, so the tab keeps the arrow). Run after changing either:
//   node scripts/make-icons.mjs
// sharp is installed with the toolchain (next and miniflare depend on it).
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { iconSvg } from "./brand-mark.mjs";

const render = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
// iOS and Android mask icons themselves, so every variant fills the whole square; the maskable one keeps the mark
// inside the 80 % safe circle.
const full = iconSvg({ size: 1024, reach: 0.42 });
writeFileSync("public/apple-touch-icon.png", await render(full, 180));
writeFileSync("public/icon-192.png", await render(full, 192));
writeFileSync("public/icon-512.png", await render(full, 512));
writeFileSync("public/icon-maskable-512.png", await render(iconSvg({ size: 1024, reach: 0.36 }), 512));

// favicon.ico: one 32×32 PNG in an ICO container (6-byte header + one 16-byte directory entry).
const image = await sharp(readFileSync("public/favicon.svg"), { density: 72 * (32 / 40) }).resize(32, 32).png({ compressionLevel: 9 }).toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(image.length, 14); header.writeUInt32LE(22, 18);
writeFileSync("public/favicon.ico", Buffer.concat([header, image]));
console.log("icons written to public/");

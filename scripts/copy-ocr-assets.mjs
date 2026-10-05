// Copies the in-browser OCR engine (Tesseract.js worker, WebAssembly cores and the English model) into
// public/ocr/, so the passport page reads the machine-readable zone without any third-party service.
// Runs before `npm run dev` and `npm run build`; public/ocr/ is not committed.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const target = new URL("../public/ocr/", import.meta.url);
const root = (pkg) => dirname(require.resolve(`${pkg}/package.json`));
const files = [
  [join(root("tesseract.js"), "dist", "worker.min.js"), "worker.min.js"],
  ...["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"].map((name) => [join(root("tesseract.js-core"), name), name]),
  [join(root("@tesseract.js-data/eng"), "4.0.0_best_int", "eng.traineddata.gz"), "eng.traineddata.gz"],
];
mkdirSync(target, { recursive: true });
let copied = 0;
for (const [from, name] of files) {
  const to = new URL(name, target);
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
  copyFileSync(from, to);
  copied++;
}
if (copied) console.log(`OCR assets: ${copied} file(s) copied to public/ocr/`);

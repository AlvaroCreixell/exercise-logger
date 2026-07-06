// One-off PWA icon generator: renders public/icons/icon-source.svg to the
// four PNG sizes the manifest references. Run: node scripts/generate-icons.mjs
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(here, "../public/icons");
const svg = await readFile(path.join(iconsDir, "icon-source.svg"));

const SIZES = [192, 256, 384, 512];

for (const size of SIZES) {
  const out = path.join(iconsDir, `icon-${size}.png`);
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(out);
  console.log(`wrote ${out}`);
}

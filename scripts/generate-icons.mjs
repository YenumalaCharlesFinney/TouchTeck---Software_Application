// One-off icon generator: pads the transparent TouchTeck logo onto a dark
// navy square canvas (matching the app's own brand background) and emits
// Windows .ico, Mac .icns, and a web favicon.ico from a single source PNG.
// Pure-JS (sharp + png2icons), no macOS `iconutil` needed to build the .icns.
import sharp from 'sharp';
import png2icons from 'png2icons';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LOGO_PATH = path.join(ROOT, 'public', 'logo.png');
const CANVAS_SIZE = 1024;
const BG_COLOR = { r: 11, g: 15, b: 25, alpha: 1 }; // matches --bg-primary #0b0f19

async function main() {
  mkdirSync(path.join(ROOT, 'build'), { recursive: true });

  const { width, height } = await sharp(LOGO_PATH).metadata();
  const targetHeight = Math.round(CANVAS_SIZE * 0.78);
  const targetWidth = Math.round((width / height) * targetHeight);

  const resizedLogo = await sharp(LOGO_PATH)
    .resize(targetWidth, targetHeight, { fit: 'inside' })
    .toBuffer();

  const squareIconBuffer = await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([{ input: resizedLogo, gravity: 'center' }])
    .png()
    .toBuffer();

  const icoOutput = png2icons.createICO(squareIconBuffer, png2icons.BICUBIC2, 0, false, true);
  if (!icoOutput) throw new Error('Failed to generate .ico');
  writeFileSync(path.join(ROOT, 'build', 'icon.ico'), icoOutput);
  writeFileSync(path.join(ROOT, 'public', 'favicon.ico'), icoOutput);

  const icnsOutput = png2icons.createICNS(squareIconBuffer, png2icons.BICUBIC2, 0);
  if (!icnsOutput) throw new Error('Failed to generate .icns');
  writeFileSync(path.join(ROOT, 'build', 'icon.icns'), icnsOutput);

  console.log('Generated build/icon.ico, build/icon.icns, public/favicon.ico');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

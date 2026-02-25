const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const BG = [15, 20, 26, 255];
const SURFACE = [22, 29, 36, 255];
const PRIMARY = [47, 128, 237, 255];
const LIGHT = [234, 240, 246, 255];

function setPixel(png, x, y, rgba) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = rgba[0];
  png.data[idx + 1] = rgba[1];
  png.data[idx + 2] = rgba[2];
  png.data[idx + 3] = rgba[3];
}

function fillRect(png, x0, y0, w, h, rgba) {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      setPixel(png, x, y, rgba);
    }
  }
}

function fillRoundedRect(png, x0, y0, w, h, r, rgba) {
  const x1 = x0 + w - 1;
  const y1 = y0 + h - 1;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
      const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPixel(png, x, y, rgba);
    }
  }
}

function drawCRing(png, cx, cy, radius, thickness, color, gapX) {
  const inner = radius - thickness;
  const outerSq = radius * radius;
  const innerSq = inner * inner;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const d = dx * dx + dy * dy;
      if (d <= outerSq && d >= innerSq && x < gapX) {
        setPixel(png, x, y, color);
      }
    }
  }
}

function drawLogo(png, useLightMark = false) {
  fillRect(png, 0, 0, png.width, png.height, BG);

  const markColor = useLightMark ? LIGHT : PRIMARY;
  const cx = png.width / 2;
  const cy = png.height / 2;
  const radius = Math.round(png.width * 0.31);
  const thickness = Math.max(8, Math.round(png.width * 0.1));
  drawCRing(png, cx, cy, radius, thickness, markColor, Math.round(png.width * 0.68));

  const parcelSize = Math.round(png.width * 0.24);
  const px = Math.round(cx - parcelSize * 0.42);
  const py = Math.round(cy - parcelSize * 0.5);
  fillRoundedRect(png, px, py, parcelSize, parcelSize, Math.round(parcelSize * 0.12), SURFACE);

  const stroke = Math.max(3, Math.round(parcelSize * 0.08));
  fillRoundedRect(png, px, py, parcelSize, stroke, Math.round(parcelSize * 0.1), markColor);
  fillRoundedRect(png, px, py + parcelSize - stroke, parcelSize, stroke, Math.round(parcelSize * 0.1), markColor);
  fillRoundedRect(png, px, py, stroke, parcelSize, Math.round(parcelSize * 0.1), markColor);
  fillRoundedRect(png, px + parcelSize - stroke, py, stroke, parcelSize, Math.round(parcelSize * 0.1), markColor);

  const notch = Math.round(parcelSize * 0.23);
  for (let y = 0; y < notch; y += 1) {
    for (let x = 0; x < notch - y; x += 1) {
      setPixel(png, px + parcelSize - 1 - x, py + y, BG);
    }
  }
}

function writePng(filePath, size, useLightMark = false) {
  const png = new PNG({ width: size, height: size });
  drawLogo(png, useLightMark);
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

const imagesDir = path.resolve(__dirname, "..", "assets", "images");

writePng(path.join(imagesDir, "icon.png"), 1024);
writePng(path.join(imagesDir, "favicon.png"), 256);
writePng(path.join(imagesDir, "splash-icon.png"), 1024, true);
writePng(path.join(imagesDir, "android-icon-foreground.png"), 1024);
writePng(path.join(imagesDir, "android-icon-monochrome.png"), 1024, true);
writePng(path.join(imagesDir, "android-icon-background.png"), 1024);

console.log("Colib brand assets generated.");

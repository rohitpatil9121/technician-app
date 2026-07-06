// Build @capacitor/assets source images from the Oasis logo. For the app icon a
// wide wordmark looks tiny, so we use just the round emblem (the water-drop +
// globe "O" mark): trim the logo, then crop the left square. Centre it on a
// white square (legacy/round) and within the adaptive safe-zone (foreground).
import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("assets", { recursive: true });
const SIZE = 1024;
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 255, g: 255, b: 255, alpha: 0 };

// Emblem = left square of the trimmed logo.
const trimmed = await sharp("public/logo.png").trim().toBuffer();
const m = await sharp(trimmed).metadata();
const emblem = await sharp(trimmed)
  .extract({ left: 0, top: 0, width: Math.min(m.height, m.width), height: m.height })
  .toBuffer();

async function centred(innerSize, background, out) {
  const fg = await sharp(emblem).resize({ width: innerSize, height: innerSize, fit: "contain", background: CLEAR }).toBuffer();
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background } })
    .composite([{ input: fg, gravity: "center" }])
    .png()
    .toFile(out);
}

// Legacy + round: emblem on white, filling most of the square.
await centred(800, WHITE, "assets/icon-only.png");
// Adaptive foreground: emblem within the ~66% safe zone, transparent.
await centred(620, CLEAR, "assets/icon-foreground.png");
// Adaptive background: plain white.
await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: WHITE } })
  .png()
  .toFile("assets/icon-background.png");

console.log("Icon sources (emblem) written to assets/");

// Build @capacitor/assets splash sources from the Oasis logo: the full logo
// centred on a white square. White (not the brand gradient) so the navy logo
// stays clearly visible; same for dark mode.
import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("assets", { recursive: true });
const SIZE = 2732;
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

const logo = await sharp("public/logo.png").resize({ width: 1200, fit: "inside" }).toBuffer();
for (const out of ["assets/splash.png", "assets/splash-dark.png"]) {
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: WHITE } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(out);
}
console.log("Splash sources written to assets/");

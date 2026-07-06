import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";

// Open the phone camera (or gallery) and return the photo as a base64 data URL.
// Kept small (width + quality) so the upload stays light.
export async function takePhoto() {
  if (!Capacitor.isNativePlatform()) throw new Error("Camera is available in the installed app only.");
  const photo = await Camera.getPhoto({
    quality: 55,
    width: 1024,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Prompt,
  });
  return photo.dataUrl; // "data:image/jpeg;base64,…"
}

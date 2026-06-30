// Phone push notifications (Android native only, via @capacitor/push-notifications
// → FCM). On web/dev this is a no-op. Sends the device token to the backend so
// assignment pushes reach this technician; tapping a push opens the job.
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { api } from "./api.js";

let listenersSet = false;

export async function registerPush(onOpen) {
  if (!Capacitor.isNativePlatform()) return; // browser / dev build

  if (!listenersSet) {
    listenersSet = true;
    await PushNotifications.addListener("registration", (token) => {
      api.savePushToken(token.value).catch(() => {});
    });
    await PushNotifications.addListener("registrationError", () => {});
    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const ticketId = action.notification?.data?.ticketId;
      if (ticketId && onOpen) onOpen(ticketId);
    });
  }

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return;

  await PushNotifications.register();
}

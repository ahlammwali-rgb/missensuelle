export type SerializedPushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent: string;
};

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Retrieves (or creates, when permission is already granted) the active Web Push subscription
 * and serializes its endpoint + VAPID encryption keys for server persistence.
 */
export async function ensurePushSubscription(
  publicKey: string,
  subscribeIfMissing: boolean = true
): Promise<SerializedPushSubscription | null> {
  if (
    typeof window === "undefined" ||
    !publicKey ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return null;
  }
  if ("Notification" in window && Notification.permission !== "granted") {
    return null;
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub && subscribeIfMissing) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
    });
  }
  if (!sub || !sub.endpoint) return null;

  const p256dh = arrayBufferToBase64(sub.getKey ? sub.getKey("p256dh") : null);
  const auth = arrayBufferToBase64(sub.getKey ? sub.getKey("auth") : null);
  if (!p256dh || !auth) return null;

  return {
    endpoint: sub.endpoint,
    expirationTime: sub.expirationTime ?? null,
    keys: { p256dh, auth },
    userAgent: navigator.userAgent,
  };
}

import * as webpushModule from "web-push";
import {
  getSavedPushSubscriptions,
  removeSavedPushSubscription,
  type PushSubscriptionRecord,
} from "./persistentStore";

const webpush: typeof webpushModule =
  (webpushModule as any).default?.setVapidDetails
    ? (webpushModule as any).default
    : webpushModule;

export const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  "BMvyGR3wNGrZUudSv45zDJ19wlTHcp1BWUvnzbGuNLvcC_2t4G1EwgET4GZoC4PcQbeb8OeppISvI-fuTzYFOcg";

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "I12SclTEJ51NxHRfyTVI2iRfB2OOtPL3ABQjCXtRZ1s";

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:contact@missensuelle.shop";

try {
  if (typeof webpush.setVapidDetails === "function") {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log("[WebPush] VAPID details configured successfully");
  }
} catch (err) {
  console.error("[WebPush] Error setting VAPID details:", err);
}

export interface AdminPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  type?: "new_order" | "urgent_alert" | "victory" | "abandoned";
  data?: Record<string, unknown>;
}

export async function sendAdminPushNotification(
  payload: AdminPushPayload
): Promise<{ successCount: number; failureCount: number }> {
  const subscriptions = getSavedPushSubscriptions();
  if (!subscriptions || subscriptions.length === 0) {
    console.log("[WebPush] No push subscriptions registered yet");
    return { successCount: 0, failureCount: 0 };
  }

  const notificationString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/icon-192x192.png",
    tag: payload.tag || "general",
    type: payload.type || "new_order",
    data: payload.data || { url: "/admin" },
  });

  let successCount = 0;
  let failureCount = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          sub as unknown as webpush.PushSubscription,
          notificationString,
          {
            TTL: 86400, // 24 hours delivery window
            urgency: payload.type === "urgent_alert" ? "high" : "normal",
          }
        );
        successCount++;
        console.log(`[WebPush] Push sent successfully to endpoint ${sub.endpoint.slice(0, 45)}...`);
      } catch (err: any) {
        failureCount++;
        const statusCode = err?.statusCode || err?.status;
        console.warn(`[WebPush] Failed to send push to ${sub.endpoint.slice(0, 45)}... status=${statusCode}`);
        // If expired or gone (404 or 410), automatically prune
        if (statusCode === 404 || statusCode === 410) {
          console.log(`[WebPush] Pruning expired subscription: ${sub.endpoint.slice(0, 45)}...`);
          removeSavedPushSubscription(sub.endpoint);
        }
      }
    })
  );

  return { successCount, failureCount };
}

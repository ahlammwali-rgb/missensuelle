import * as webpushModule from "web-push";
import {
  getSavedPushSubscriptions,
  hasSentVictoryTag,
  markSentVictoryTag,
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

const inFlightVictoryTags = new Set<string>();

export async function sendAdminPushNotification(
  payload: AdminPushPayload
): Promise<{ successCount: number; failureCount: number; skippedDuplicate?: boolean }> {
  const tag = (payload.tag || "general").trim();
  const isRealVictory = payload.type === "victory" && !tag.startsWith("test-");
  if (isRealVictory) {
    if (hasSentVictoryTag(tag) || inFlightVictoryTags.has(tag)) {
      return { successCount: 0, failureCount: 0, skippedDuplicate: true };
    }
    inFlightVictoryTags.add(tag);
    markSentVictoryTag(tag);
  }

  try {
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
      tag,
      type: payload.type || "new_order",
      url: typeof payload.data?.url === "string" ? payload.data.url : "/admin",
      data: payload.data || { url: "/admin" },
    });

    let successCount = 0;
    let failureCount = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            sub as unknown as webpushModule.PushSubscription,
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
          // If expired or gone (400/401/403/404/410), automatically prune stale endpoints
          if (
            statusCode === 400 ||
            statusCode === 401 ||
            statusCode === 403 ||
            statusCode === 404 ||
            statusCode === 410
          ) {
            console.log(`[WebPush] Pruning expired subscription: ${sub.endpoint.slice(0, 45)}...`);
            removeSavedPushSubscription(sub.endpoint);
          }
        }
      })
    );

    return { successCount, failureCount };
  } finally {
    if (isRealVictory) {
      inFlightVictoryTags.delete(tag);
    }
  }
}

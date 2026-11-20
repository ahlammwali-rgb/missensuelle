import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  ADMIN_PASSWORD_COOKIE,
  claimAdmin,
  createAdminPasswordToken,
  createStaffSessionToken,
  getAdminSetupStatus,
  verifyAdminPassword,
} from "./adminSetup";
import {
  adminCreateOrderSchema,
  discardDraftSchema,
  orderCarrierSchema,
  recordOrderInteractionSchema,
  recoveryStatusSchema,
  saveDraftSchema,
  staffMemberSchema,
  submitOrderSchema,
  checkoutOrderStatusSchema,
  updateOrderDetailsSchema,
  updateOrderStatusWithMetaSchema,
} from "../shared/checkout";
import {
  createAdminOrder,
  discardCheckoutDraft,
  convertAbandonedToOrder,
  deleteAbandonedCheckout,
  deleteAllAbandonedCheckouts,
  listAbandonedCheckouts,
  purgeAbandonedWithoutPhone,
  listCheckoutOrders,
  restoreClientBackupOrders,
  saveCheckoutDraft,
  submitCheckoutOrder,
  updateAbandonedCheckout,
  updateCheckoutOrderDetails,
  updateMemoryOrderStatus,
  setMemoryOrderCarrier,
  markMemoryOrderReturn,
  markOrderDelivered,
  recordOrderInteraction,
  deleteMemoryOrder,
  autoDeduplicateOrders,
  syncGoogleSheetOrders,
} from "./checkout";
import { fetchSheetRows, getStoredSheetConfig, setStoredSheetConfig } from "./googleSheet";
import { getDb, listStoreProducts, updateStoreOrderStatus } from "./db";
import {
  clearEcomCredentials,
  EcomError,
  getEcomLocations,
  getEcomStatus,
  getEcomTracking,
  getEcomTrackingBatch,
  getShippingRates,
  saveEcomCredentials,
  shipOrders,
} from "./ecomDelivery";
import {
  clearEcoTrackCredentials,
  EcoTrackError,
  getEcoTrackFees,
  getEcoTrackLocations,
  getEcoTrackProducts,
  getEcoTrackStatus,
  getEcoTrackTrackingBatch,
  saveEcoTrackCredentials,
  shipEcoTrackOrders,
  validateEcoTrackOrder,
} from "./ecotrackDelivery";
import { VAPID_PUBLIC_KEY, sendAdminPushNotification } from "./webPush";
import {
  appendStaffActivityLog,
  deleteStaffMember,
  findStaffMemberByCode,
  getNotificationPreferences,
  getStaffActivityLogs,
  getStaffMembers,
  savePushSubscriptionRecord,
  setNotificationPreferences,
  upsertStaffMember,
} from "./persistentStore";
import { triggerStoreSave } from "./checkout";
import {
  generateLandingDraft,
  generateLandingDraftInputSchema,
  getAiKeyStatus,
  saveRuntimeGeminiKey,
} from "./aiLanding";
import { z } from "zod";

function isOwnerUser(user: { openId?: string | null; loginMethod?: string | null } | null | undefined): boolean {
  if (!user) return false;
  return user.loginMethod !== "staff_code" && !String(user.openId || "").startsWith("staff:");
}

function resolveActor(
  user: { openId?: string | null; name?: string | null; email?: string | null; loginMethod?: string | null } | null | undefined,
  override?: { actorId?: string; actorName?: string }
): { actorId: string; actorName: string } {
  if (user && (user.loginMethod === "staff_code" || String(user.openId || "").startsWith("staff:"))) {
    const staffId = user.email || String(user.openId || "").replace(/^staff:/, "") || "staff";
    return {
      actorId: staffId,
      actorName: user.name || "Confirmateur",
    };
  }
  if (override?.actorId && override?.actorName) {
    return {
      actorId: override.actorId,
      actorName: override.actorName,
    };
  }
  return {
    actorId: "owner",
    actorName: "Admin (Patron)",
  };
}

async function ecomGuard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof EcomError) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    if (error instanceof EcoTrackError) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    throw error;
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    loginPassword: publicProcedure
      .input(z.object({ password: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        const isHttps = ctx.req.protocol === "https" || ctx.req.headers["x-forwarded-proto"] === "https";
        if (verifyAdminPassword(input.password)) {
          ctx.res.cookie(ADMIN_PASSWORD_COOKIE, createAdminPasswordToken(), {
            httpOnly: true,
            path: "/",
            sameSite: "lax",
            secure: isHttps,
            maxAge: 1000 * 60 * 60 * 24 * 30,
          });
          appendStaffActivityLog({
            actorId: "owner",
            actorName: "Admin (Patron)",
            type: "login",
            summary: "🔑 Connexion Propriétaire (Admin)",
          });
          triggerStoreSave();
          return { success: true, role: "owner" as const };
        }
        await listCheckoutOrders();
        const staff = findStaffMemberByCode(input.password);
        if (staff) {
          ctx.res.cookie(ADMIN_PASSWORD_COOKIE, createStaffSessionToken(staff.id), {
            httpOnly: true,
            path: "/",
            sameSite: "lax",
            secure: isHttps,
            maxAge: 1000 * 60 * 60 * 24 * 30,
          });
          appendStaffActivityLog({
            actorId: staff.id,
            actorName: staff.name,
            type: "login",
            summary: `🔑 Connexion Confirmateur (${staff.name})`,
          });
          triggerStoreSave();
          return { success: true, role: "staff" as const, staffName: staff.name };
        }
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Mot de passe ou code confirmateur incorrect." });
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      if (ctx.req.headers?.cookie?.includes(ADMIN_PASSWORD_COOKIE)) {
        ctx.res.clearCookie(ADMIN_PASSWORD_COOKIE, { path: "/", httpOnly: true, maxAge: -1 });
      }
      return { success: true } as const;
    }),
    setupStatus: publicProcedure.query(() => getAdminSetupStatus()),
    claimAdmin: protectedProcedure
      .input(z.object({ code: z.string().max(256) }))
      .mutation(({ ctx, input }) => claimAdmin(ctx.user, input.code)),
  }),
  store: router({
    products: publicProcedure.query(() => listStoreProducts()),
    submitOrder: publicProcedure.input(submitOrderSchema).mutation(({ input }) => submitCheckoutOrder(input)),
    // Compatibility alias: it accepts only the validated checkout DTO, never raw order objects.
    orders: publicProcedure.input(submitOrderSchema).mutation(({ input }) => submitCheckoutOrder(input)),
    shippingRates: publicProcedure.query(() => getShippingRates()),
    saveDraft: publicProcedure.input(saveDraftSchema).mutation(({ input }) => saveCheckoutDraft(input)),
    discardDraft: publicProcedure.input(discardDraftSchema).mutation(({ input }) => discardCheckoutDraft(input)),
  }),
  admin: router({
    // The UI may still send its search text; the server strips heavy per-order history arrays and returns historyCount instead.
    orders: adminProcedure
      .input(z.object({ query: z.string().optional() }).optional())
      .query(async () => {
        const all = await listCheckoutOrders();
        return all.map(({ history, ...rest }): typeof all[number] => ({
          ...rest,
          historyCount: Array.isArray(history) && history.length > 0 ? history.length : 1,
        }));
      }),
    orderHistory: adminProcedure
      .input(z.object({ dbId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const all = await listCheckoutOrders();
        return all.find(o => o.dbId === input.dbId)?.history ?? [];
      }),
    abandonedOrders: adminProcedure.query(() => listAbandonedCheckouts()),
    updateOrderStatus: adminProcedure
      .input(updateOrderStatusWithMetaSchema)
      .mutation(async ({ ctx, input }) => {
        const actor = resolveActor(ctx.user, { actorId: input.actorId, actorName: input.actorName });
        const db = await getDb();
        if (!db) {
          return updateMemoryOrderStatus(input.id, input.status, {
            nrpLevel: input.nrpLevel,
            postponedUntil: input.postponedUntil,
            postponedNote: input.postponedNote,
            cancelReason: input.cancelReason,
            actorId: actor.actorId,
            actorName: actor.actorName,
          });
        }
        return updateStoreOrderStatus(input.id, input.status);
      }),
    recordOrderInteraction: adminProcedure
      .input(recordOrderInteractionSchema)
      .mutation(({ ctx, input }) => {
        const actor = resolveActor(ctx.user, { actorId: input.actorId, actorName: input.actorName });
        return recordOrderInteraction(input, actor);
      }),
    markOrderDelivered: adminProcedure
      .input(z.object({ id: z.number().int().positive(), isDelivered: z.boolean().default(true) }))
      .mutation(({ ctx, input }) => {
        const actor = resolveActor(ctx.user);
        return markOrderDelivered(input.id, input.isDelivered, actor);
      }),
    setOrderCarrier: adminProcedure
      .input(z.object({ id: z.number().int().positive(), carrier: orderCarrierSchema }))
      .mutation(({ ctx, input }) => {
        const actor = resolveActor(ctx.user);
        return setMemoryOrderCarrier(input.id, input.carrier, actor);
      }),
    markReturnReceived: adminProcedure
      .input(z.object({ id: z.number().int().positive(), returnReceived: z.boolean().default(true) }))
      .mutation(({ ctx, input }) => {
        const actor = resolveActor(ctx.user);
        return markMemoryOrderReturn(input.id, input.returnReceived, actor);
      }),
    createOrder: adminProcedure
      .input(adminCreateOrderSchema)
      .mutation(({ ctx, input }) => {
        const actor = resolveActor(ctx.user);
        return createAdminOrder(input, actor);
      }),
    updateOrderDetails: adminProcedure
      .input(updateOrderDetailsSchema)
      .mutation(({ ctx, input }) => {
        const actor = resolveActor(ctx.user, { actorId: input.actorId, actorName: input.actorName });
        return updateCheckoutOrderDetails(input, actor);
      }),
    deleteOrder: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => {
        if (!isOwnerUser(ctx.user)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Seul le propriétaire peut supprimer définitivement une commande." });
        }
        return { deleted: deleteMemoryOrder(input.id) };
      }),
    staffData: adminProcedure.query(async ({ ctx }) => {
      await listCheckoutOrders();
      const isOwner = isOwnerUser(ctx.user);
      const currentActor = resolveActor(ctx.user);
      const allStaff = getStaffMembers();
      return {
        isOwner,
        currentActor,
        staff: isOwner
          ? allStaff
          : allStaff.map(s => (s.id === currentActor.actorId ? s : { ...s, code: "••••" })),
        activityLogs: getStaffActivityLogs(800),
      };
    }),
    staffUpsert: adminProcedure
      .input(staffMemberSchema)
      .mutation(async ({ ctx, input }) => {
        if (!isOwnerUser(ctx.user)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Seul le propriétaire peut gérer les employés et salaires." });
        }
        await listCheckoutOrders();
        const saved = upsertStaffMember(input);
        triggerStoreSave();
        return saved;
      }),
    staffDelete: adminProcedure
      .input(z.object({ id: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (!isOwnerUser(ctx.user)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Seul le propriétaire peut supprimer un employé." });
        }
        await listCheckoutOrders();
        const deleted = deleteStaffMember(input.id);
        triggerStoreSave();
        return { deleted };
      }),
    deduplicateOrders: adminProcedure
      .mutation(async () => {
        const orders = await listCheckoutOrders();
        return { total: orders.length };
      }),
    restoreOrders: adminProcedure
      .input(
        z.object({
          orders: z.array(
            z.object({
              id: z.string().min(1).max(64),
              createdAt: z.string().optional(),
              customer: z.string().optional(),
              phone: z.string().optional(),
              productId: z.string().optional(),
              product: z.string().optional(),
              quantity: z.number().optional(),
              total: z.number().optional(),
              color: z.string().optional(),
              size: z.string().optional(),
              delivery: z.enum(["home", "office"]).optional(),
              wilaya: z.string().optional(),
              commune: z.string().optional(),
              address: z.string().optional(),
              note: z.string().optional(),
              status: checkoutOrderStatusSchema.optional(),
            }),
          ),
        }),
      )
      .mutation(({ input }) => restoreClientBackupOrders(input.orders)),
    convertAbandoned: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        try {
          return await convertAbandonedToOrder(input.id);
        } catch (error) {
          if (error instanceof Error && error.name === "CheckoutValidationError") throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
          throw error;
        }
      }),
    purgeAbandonedNoPhone: adminProcedure.mutation(() => purgeAbandonedWithoutPhone(0)),
    updateAbandoned: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: recoveryStatusSchema }))
      .mutation(({ input }) => updateAbandonedCheckout(input.id, input.status)),
    deleteAbandoned: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteAbandonedCheckout(input.id)),
    deleteAllAbandoned: adminProcedure.mutation(() => deleteAllAbandonedCheckouts()),
    getVapidPublicKey: adminProcedure.query(() => ({
      publicKey: VAPID_PUBLIC_KEY,
    })),
    savePushSubscription: adminProcedure
      .input(
        z.object({
          endpoint: z.string().url(),
          expirationTime: z.number().nullable().optional(),
          keys: z.object({
            p256dh: z.string().min(1),
            auth: z.string().min(1),
          }),
          userAgent: z.string().optional(),
        })
      )
      .mutation(({ input }) => {
        savePushSubscriptionRecord({
          endpoint: input.endpoint,
          expirationTime: input.expirationTime ?? null,
          keys: input.keys,
          userAgent: input.userAgent,
        });
        triggerStoreSave();
        return { success: true };
      }),
    testPushNotification: adminProcedure
      .input(
        z.object({
          type: z.enum(["new_order", "urgent_alert", "victory"]),
          delaySeconds: z.number().int().min(0).max(60).default(0),
        })
      )
      .mutation(async ({ input }) => {
        const runTest = async () => {
          if (input.type === "new_order") {
            await sendAdminPushNotification({
              title: "🛍️ Test Commande : Cha-Ching ! 💰",
              body: "Amina B. (0550 12 34 56) · Doudoune Hiver Luxe · 9 800 DZD · Alger",
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-192x192.png",
              tag: `test-order-${Date.now()}`,
              type: "new_order",
              data: { url: "/admin", sound: "/sounds/shopify-chaching.mp3", type: "new_order" },
            });
          } else if (input.type === "urgent_alert") {
            await sendAdminPushNotification({
              title: "🚨 Test Intervention : Client Ne Répond Pas !",
              body: "Karim M. (0661 98 76 54) · Colis CMD-1049 · Oran · Rappel urgent !",
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-192x192.png",
              tag: `test-urgent-${Date.now()}`,
              type: "urgent_alert",
              data: { url: "/admin", sound: "/sounds/alert-urgent.wav", type: "urgent_alert" },
            });
          } else if (input.type === "victory") {
            await sendAdminPushNotification({
              title: "🎉 Test Livraison : Colis Livré !",
              body: "Sarah D. (0770 11 22 33) · Colis CMD-1052 · Blida · 11 500 DZD encaissés !",
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-192x192.png",
              tag: `test-victory-${Date.now()}`,
              type: "victory",
              data: { url: "/admin", sound: "/sounds/victory-delivered.wav", type: "victory" },
            });
          }
        };

        if (input.delaySeconds > 0) {
          setTimeout(runTest, input.delaySeconds * 1000);
          return { scheduled: true, delaySeconds: input.delaySeconds };
        } else {
          await runTest();
          return { scheduled: false, sent: true };
        }
      }),
    getNotificationPreferences: adminProcedure.query(() => {
      return getNotificationPreferences();
    }),
    setNotificationPreferences: adminProcedure
      .input(
        z.object({
          notifyNewOrder: z.boolean().optional(),
          notifyNeRepondPas: z.boolean().optional(),
          notifyAnnulee: z.boolean().optional(),
          notifyReportee: z.boolean().optional(),
          notifyLivre: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        const updated = setNotificationPreferences(input);
        triggerStoreSave();
        return updated;
      }),
    aiStatus: adminProcedure.query(() => getAiKeyStatus()),
    saveAiKey: adminProcedure
      .input(z.object({ apiKey: z.string().min(16).max(300) }))
      .mutation(async ({ ctx, input }) => {
        if (!isOwnerUser(ctx.user)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Seul le propriétaire peut configurer la clé API Gemini." });
        }
        try {
          return await saveRuntimeGeminiKey(input.apiKey);
        } catch (err) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err instanceof Error ? err.message : "Clé API Gemini refusée.",
          });
        }
      }),
    generateLandingDraft: adminProcedure
      .input(generateLandingDraftInputSchema)
      .mutation(async ({ input }) => {
        try {
          return await generateLandingDraft(input);
        } catch (err) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err instanceof Error ? err.message : "Échec de génération IA.",
          });
        }
      }),
  }),
  ecom: router({
    status: adminProcedure.query(() => getEcomStatus()),
    saveCredentials: adminProcedure
      .input(z.object({ key: z.string().min(1).max(512), token: z.string().min(1).max(512) }))
      .mutation(({ input }) => ecomGuard(() => saveEcomCredentials(input.key, input.token))),
    clearCredentials: adminProcedure.mutation(() => clearEcomCredentials()),
    locations: adminProcedure
      .input(z.object({ wilayaId: z.number().int().min(1).max(58) }))
      .query(({ input }) => ecomGuard(() => getEcomLocations(input.wilayaId))),
    ship: adminProcedure
      .input(
        z.object({
          confirmee: z.boolean().default(false),
          items: z
            .array(
              z.object({
                orderId: z.string().min(1).max(64),
                wilayaId: z.number().int().min(1).max(58).optional(),
                stopdesk: z.boolean(),
                commune: z.string().max(120).optional(),
                codeStopdesk: z.string().max(20).optional(),
                refArticle: z.string().max(64).optional(),
              }),
            )
            .min(1)
            .max(100),
        }),
      )
      .mutation(({ ctx, input }) =>
        ecomGuard(async () => {
          const actor = resolveActor(ctx.user);
          const orders = await listCheckoutOrders();
          const results = await shipOrders(orders, input.items, input.confirmee);
          const db = await getDb();
          for (const result of results) {
            if (!result.ok) continue;
            const order = orders.find(o => o.id === result.orderId);
            if (!order || order.status === "transferee") continue;
            if (!db) updateMemoryOrderStatus(order.dbId, "transferee", actor);
            else await updateStoreOrderStatus(order.dbId, "transferee");
          }
          return results;
        }),
      ),
      track: adminProcedure
        .input(z.object({ tracking: z.string().min(1) }))
        .query(({ input }) => ecomGuard(() => getEcomTracking(input.tracking))),
      trackBatch: adminProcedure
        .input(z.object({ trackings: z.array(z.string()).max(100) }))
        .query(({ input }) =>
          ecomGuard(async () => {
            const batch = await getEcomTrackingBatch(input.trackings);
            try {
              const ecomStatus = await getEcomStatus();
              const shipments = ecomStatus.shipments || {};
              const orders = await listCheckoutOrders();
              for (const order of orders) {
                if (order.isDelivered) continue;
                const sh = shipments[order.id];
                if (!sh?.tracking) continue;
                const trkData = batch[sh.tracking];
                if (!trkData) continue;
                const sit = (trkData.situation || "").toLowerCase();
                if (
                  sit.includes("livr") ||
                  sit.includes("encaiss") ||
                  sit.includes("recouvr") ||
                  Boolean(trkData.encaisser) ||
                  Boolean(trkData.recouvert)
                ) {
                  await markOrderDelivered(order.dbId, true, {
                    actorId: "system",
                    actorName: "E-com Delivery (Auto)",
                  });
                }
              }
            } catch {
              // Ignore auto-delivery sync error
            }
            return batch;
          })
        ),
  }),
  ecotrack: router({
    status: adminProcedure.query(() => getEcoTrackStatus()),
    saveCredentials: adminProcedure
      .input(
        z.object({
          baseUrl: z.string().min(3).max(512),
          token: z.string().min(1).max(512),
          label: z.string().max(120).optional(),
        })
      )
      .mutation(({ input }) => ecomGuard(() => saveEcoTrackCredentials(input.baseUrl, input.token, input.label))),
    clearCredentials: adminProcedure.mutation(() => clearEcoTrackCredentials()),
    fees: adminProcedure.query(() => ecomGuard(() => getEcoTrackFees())),
    products: adminProcedure.query(() => ecomGuard(() => getEcoTrackProducts())),
    locations: adminProcedure
      .input(z.object({ wilayaId: z.number().int().min(1).max(58) }))
      .query(({ input }) => ecomGuard(() => getEcoTrackLocations(input.wilayaId))),
    ship: adminProcedure
      .input(
        z.object({
          confirmee: z.boolean().default(false),
          items: z
            .array(
              z.object({
                orderId: z.string().min(1).max(64),
                wilayaId: z.number().int().min(1).max(58).optional(),
                stopdesk: z.boolean(),
                commune: z.string().max(120).optional(),
                deskCommune: z.string().max(120).optional(),
                refArticle: z.string().max(64).optional(),
              })
            )
            .min(1)
            .max(100),
        })
      )
      .mutation(({ ctx, input }) =>
        ecomGuard(async () => {
          const actor = resolveActor(ctx.user);
          const orders = await listCheckoutOrders();
          const results = await shipEcoTrackOrders(orders, input.items, input.confirmee);
          const db = await getDb();
          for (const result of results) {
            if (!result.ok) continue;
            const order = orders.find(o => o.id === result.orderId);
            if (!order) continue;
            await setMemoryOrderCarrier(order.dbId, "ecotrack", actor).catch(() => null);
            if (order.status === "transferee") continue;
            if (!db) updateMemoryOrderStatus(order.dbId, "transferee", actor);
            else await updateStoreOrderStatus(order.dbId, "transferee");
          }
          return results;
        })
      ),
    validateOrder: adminProcedure
      .input(z.object({ tracking: z.string().min(1).max(100) }))
      .mutation(({ input }) => ecomGuard(() => validateEcoTrackOrder(input.tracking))),
    trackBatch: adminProcedure
      .input(z.object({ trackings: z.array(z.string()).max(100) }))
      .query(({ input }) =>
        ecomGuard(async () => {
          const batch = await getEcoTrackTrackingBatch(input.trackings);
          try {
            const ecoStatus = await getEcoTrackStatus();
            const shipments = ecoStatus.shipments || {};
            const orders = await listCheckoutOrders();
            for (const order of orders) {
              if (order.isDelivered) continue;
              const sh = shipments[order.id];
              if (!sh?.tracking) continue;
              const trkData = batch[sh.tracking];
              if (!trkData) continue;
              const sit = `${trkData.situation || ""} ${trkData.etat_logistique || ""}`.toLowerCase();
              if (
                sit.includes("livr") ||
                sit.includes("encaiss") ||
                sit.includes("paye") ||
                Boolean(trkData.encaisser) ||
                Boolean(trkData.recouvert)
              ) {
                await markOrderDelivered(order.dbId, true, {
                  actorId: "system",
                  actorName: "EcoTrack (Auto)",
                });
              }
            }
          } catch {
            // Ignore auto-delivery sync error
          }
          return batch;
        })
      ),
  }),
  googleSheet: router({
    getConfig: adminProcedure.query(async () => {
      const config = getStoredSheetConfig();
      try {
        const rows = await fetchSheetRows(config.url);
        return {
          ...config,
          connected: true,
          rowCount: Math.max(0, rows.length - 1),
          error: null,
        };
      } catch (err) {
        return {
          ...config,
          connected: false,
          rowCount: 0,
          error: err instanceof Error ? err.message : "Impossible de lire le Google Sheet",
        };
      }
    }),
    saveConfig: adminProcedure
      .input(
        z.object({
          url: z.string().min(10),
          webhookUrl: z.string().optional(),
          autoSync: z.boolean().optional(),
        }),
      )
      .mutation(({ input }) => {
        return setStoredSheetConfig({
          url: input.url.trim(),
          webhookUrl: input.webhookUrl?.trim() || "",
          autoSync: input.autoSync ?? true,
        });
      }),
    syncOrders: adminProcedure
      .input(z.object({ url: z.string().optional(), force: z.boolean().optional() }).optional())
      .mutation(async ({ input }) => {
        return await syncGoogleSheetOrders(input?.url, input?.force ?? true);
      }),
  }),
});

export type AppRouter = typeof appRouter;

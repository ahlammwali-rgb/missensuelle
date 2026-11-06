import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  ADMIN_PASSWORD_COOKIE,
  claimAdmin,
  createAdminPasswordToken,
  getAdminSetupStatus,
  verifyAdminPassword,
} from "./adminSetup";
import {
  discardDraftSchema,
  recoveryStatusSchema,
  saveDraftSchema,
  submitOrderSchema,
  checkoutOrderStatusSchema,
  updateOrderDetailsSchema,
} from "../shared/checkout";
import {
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
  markMemoryOrderReturn,
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
import { z } from "zod";

async function ecomGuard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof EcomError) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    throw error;
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    loginPassword: publicProcedure
      .input(z.object({ password: z.string().min(1).max(256) }))
      .mutation(({ ctx, input }) => {
        if (!verifyAdminPassword(input.password)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Mot de passe administrateur incorrect." });
        }
        const isHttps = ctx.req.protocol === "https" || ctx.req.headers["x-forwarded-proto"] === "https";
        ctx.res.cookie(ADMIN_PASSWORD_COOKIE, createAdminPasswordToken(), {
          httpOnly: true,
          path: "/",
          sameSite: "lax",
          secure: isHttps,
          maxAge: 1000 * 60 * 60 * 24 * 30,
        });
        return { success: true } as const;
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
    // The UI may still send its search text; the server deliberately returns the complete array.
    orders: adminProcedure
      .input(z.object({ query: z.string().optional() }).optional())
      .query(() => listCheckoutOrders()),
    abandonedOrders: adminProcedure.query(() => listAbandonedCheckouts()),
    updateOrderStatus: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: checkoutOrderStatusSchema }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return updateMemoryOrderStatus(input.id, input.status);
        return updateStoreOrderStatus(input.id, input.status);
      }),
    markReturnReceived: adminProcedure
      .input(z.object({ id: z.number().int().positive(), returnReceived: z.boolean().default(true) }))
      .mutation(({ input }) => markMemoryOrderReturn(input.id, input.returnReceived)),
    updateOrderDetails: adminProcedure
      .input(updateOrderDetailsSchema)
      .mutation(({ input }) => updateCheckoutOrderDetails(input)),
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
      .mutation(({ input }) =>
        ecomGuard(async () => {
          const orders = await listCheckoutOrders();
          const results = await shipOrders(orders, input.items, input.confirmee);
          const db = await getDb();
          for (const result of results) {
            if (!result.ok) continue;
            const order = orders.find(o => o.id === result.orderId);
            if (!order) continue;
            if (!db) updateMemoryOrderStatus(order.dbId, "transferee");
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
        .query(({ input }) => ecomGuard(() => getEcomTrackingBatch(input.trackings))),
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
      .input(z.object({ url: z.string().optional() }).optional())
      .mutation(async ({ input }) => {
        return await syncGoogleSheetOrders(input?.url);
      }),
  }),
});

export type AppRouter = typeof appRouter;

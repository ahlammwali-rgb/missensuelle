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
  listAbandonedCheckouts,
  listCheckoutOrders,
  saveCheckoutDraft,
  submitCheckoutOrder,
  updateAbandonedCheckout,
  updateCheckoutOrderDetails,
  updateMemoryOrderStatus,
} from "./checkout";
import { getDb, listStoreProducts, updateStoreOrderStatus } from "./db";
import { z } from "zod";

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
    updateOrderDetails: adminProcedure
      .input(updateOrderDetailsSchema)
      .mutation(({ input }) => updateCheckoutOrderDetails(input)),
    updateAbandoned: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: recoveryStatusSchema }))
      .mutation(({ input }) => updateAbandonedCheckout(input.id, input.status)),
  }),
});

export type AppRouter = typeof appRouter;

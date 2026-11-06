import { z } from "zod";

export const checkoutItemSchema = z.object({
  productId: z.string().min(1).max(80),
  quantity: z.number().int().min(1).max(20),
  color: z.string().trim().max(80).default(""),
  size: z.string().trim().max(40).default(""),
});

export const checkoutPayloadSchema = z.object({
  source: z.enum(["abaya", "coat", "product", "cart"]),
  customer: z.string().trim().max(160).default(""),
  phone: z.string().trim().max(40).default(""),
  wilaya: z.string().trim().max(120).default(""),
  commune: z.string().trim().max(120).default(""),
  address: z.string().trim().max(500).default(""),
  note: z.string().trim().max(1000).default(""),
  delivery: z.enum(["home", "office"]).default("home"),
  items: z.array(checkoutItemSchema).min(1).max(20),
});

export const saveDraftSchema = z.object({
  token: z.string().uuid(),
  revision: z.number().int().min(1).max(2147483647),
  consent: z.literal(true),
  payload: checkoutPayloadSchema,
});
export const submitOrderSchema = z.object({ token: z.string().uuid(), payload: checkoutPayloadSchema });
export const discardDraftSchema = z.object({ token: z.string().uuid(), revision: z.number().int().min(1).max(2147483647) });
export const recoveryStatusSchema = z.enum(["new", "called", "ignored"]);
export const checkoutOrderStatusSchema = z.enum(["nouvelle", "confirmee", "annulee", "reportee", "ne_repond_pas", "transferee"]);

export const updateOrderDetailsSchema = z.object({
  id: z.number().int().positive(),
  customer: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(4).max(40),
  productId: z.string().trim().max(80).optional(),
  product: z.string().trim().min(1).max(300),
  quantity: z.number().int().min(1).max(100),
  total: z.number().int().min(0).max(10000000),
  color: z.string().trim().max(80).default(""),
  size: z.string().trim().max(40).default(""),
  delivery: z.enum(["home", "office"]).default("home"),
  wilaya: z.string().trim().min(1).max(120),
  commune: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).default(""),
  note: z.string().trim().max(1000).default(""),
});

export type UpdateOrderDetailsInput = z.infer<typeof updateOrderDetailsSchema>;
export type CheckoutPayload = z.infer<typeof checkoutPayloadSchema>;
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
export type SubmitOrderInput = z.infer<typeof submitOrderSchema>;
export type DiscardDraftInput = z.infer<typeof discardDraftSchema>;
export type SubmitOrderResult = { orderId: number; orderNumber: string; total: number; created: boolean };
export type SaveDraftResult = { sessionId: number; accepted: boolean };
export type CheckoutOrder = {
  dbId: number; id: string; createdAt: string; customer: string; phone: string; product: string;
  quantity: number; total: number; wilaya: string; commune: string; address: string; note: string;
  productId?: string; color?: string; size?: string; delivery?: "home" | "office";
  status: z.infer<typeof checkoutOrderStatusSchema>;
  returnReceived?: boolean;
  returnReceivedAt?: string;
};
export type AbandonedCheckout = {
  id: number; createdAt: string; updatedAt: string; customer: string; phone: string; product: string;
  quantity: number; total: number; wilaya: string; commune: string; address: string; note: string;
  color: string; size: string; delivery: "home" | "office";
  activity: "in_progress" | "abandoned";
  recoveryStatus: z.infer<typeof recoveryStatusSchema>;
};

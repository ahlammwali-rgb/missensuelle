import { z } from "zod";

export const checkoutItemSchema = z.object({
  productId: z.string().min(1).max(80),
  quantity: z.number().int().min(1).max(20),
  color: z.string().trim().max(300).default(""),
  size: z.string().trim().max(150).default(""),
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
  color: z.string().trim().max(300).default(""),
  size: z.string().trim().max(150).default(""),
  delivery: z.enum(["home", "office"]).default("home"),
  wilaya: z.string().trim().min(1).max(120),
  commune: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).default(""),
  note: z.string().trim().max(1000).default(""),
  actorId: z.string().trim().max(80).optional(),
  actorName: z.string().trim().max(120).optional(),
});

export const updateOrderStatusWithMetaSchema = z.object({
  id: z.number().int().positive(),
  status: checkoutOrderStatusSchema,
  nrpLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  postponedUntil: z.string().trim().max(80).optional().nullable(),
  postponedNote: z.string().trim().max(500).optional(),
  cancelReason: z.string().trim().max(300).optional(),
  actorId: z.string().trim().max(80).optional(),
  actorName: z.string().trim().max(120).optional(),
});

export const recordOrderInteractionSchema = z.object({
  id: z.number().int().positive(),
  type: z.enum(["call", "whatsapp"]),
  note: z.string().trim().max(500).optional(),
  actorId: z.string().trim().max(80).optional(),
  actorName: z.string().trim().max(120).optional(),
});

export const staffMemberSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).default(""),
  code: z.string().trim().min(2).max(80),
  avatarColor: z.string().trim().max(40).default("#ec4899"),
  baseSalary: z.number().int().min(0).max(10000000).default(0),
  commissionPerDelivered: z.number().int().min(0).max(1000000).default(150),
  upsellBonusPerDelivered: z.number().int().min(0).max(1000000).default(50),
  active: z.boolean().default(true),
});

export type OrderHistoryChange = {
  field: string;
  label: string;
  before: string;
  after: string;
};

export type OrderHistoryEventType =
  | "created"
  | "call"
  | "whatsapp"
  | "status_change"
  | "edit"
  | "postponed"
  | "shipped"
  | "delivered"
  | "return";

export type OrderHistoryEvent = {
  id: string;
  at: string;
  type: OrderHistoryEventType;
  actorId: string;
  actorName: string;
  summary: string;
  changes?: OrderHistoryChange[];
  meta?: {
    statusFrom?: string;
    statusTo?: string;
    nrpLevel?: 1 | 2 | 3;
    postponedUntil?: string | null;
    postponedNote?: string;
    cancelReason?: string;
    callNumber?: number;
    noPriorCallWarning?: boolean;
    rapidNrpWarning?: boolean;
    minutesSinceLastNrp?: number;
    upsellPack?: boolean;
    tracking?: string;
  };
};

export type StaffMember = {
  id: string;
  name: string;
  phone: string;
  code: string;
  avatarColor: string;
  baseSalary: number;
  commissionPerDelivered: number;
  upsellBonusPerDelivered: number;
  active: boolean;
  createdAt: string;
  lastSeenAt?: string;
};

export type StaffActivityLog = {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  orderDbId?: number;
  orderId?: string;
  customer?: string;
  phone?: string;
  type: OrderHistoryEventType | "login";
  summary: string;
  changes?: OrderHistoryChange[];
  warning?: string;
};

export type UpdateOrderDetailsInput = z.infer<typeof updateOrderDetailsSchema>;
export type UpdateOrderStatusWithMetaInput = z.infer<typeof updateOrderStatusWithMetaSchema>;
export type RecordOrderInteractionInput = z.infer<typeof recordOrderInteractionSchema>;
export type StaffMemberInput = z.infer<typeof staffMemberSchema>;
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
  nrpLevel?: 1 | 2 | 3;
  postponedUntil?: string | null;
  postponedNote?: string;
  postponedNotified?: boolean;
  cancelReason?: string;
  assignedToId?: string;
  assignedToName?: string;
  confirmedById?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  isDelivered?: boolean;
  deliveredAt?: string;
  initialQuantity?: number;
  upsellById?: string;
  upsellByName?: string;
  callCount?: number;
  whatsappCount?: number;
  lastCalledAt?: string;
  lastCalledBy?: string;
  lastNrpAt?: string;
  history?: OrderHistoryEvent[];
};
export type AbandonedCheckout = {
  id: number; createdAt: string; updatedAt: string; customer: string; phone: string; product: string;
  quantity: number; total: number; wilaya: string; commune: string; address: string; note: string;
  color: string; size: string; delivery: "home" | "office";
  activity: "in_progress" | "abandoned";
  recoveryStatus: z.infer<typeof recoveryStatusSchema>;
};

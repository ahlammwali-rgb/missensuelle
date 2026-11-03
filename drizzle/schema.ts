import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import type { CheckoutPayload } from "../shared/checkout";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const storeProducts = mysqlTable("store_products", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  categoryLabel: varchar("categoryLabel", { length: 120 }).notNull(),
  description: text("description").notNull(),
  image: text("image").notNull(),
  price: int("price").notNull(),
  oldPrice: int("oldPrice"),
  stock: int("stock").default(0).notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StoreProduct = typeof storeProducts.$inferSelect;
export type InsertStoreProduct = typeof storeProducts.$inferInsert;

export const storeOrders = mysqlTable("store_orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 40 }).notNull().unique(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  wilaya: varchar("wilaya", { length: 120 }).notNull(),
  commune: varchar("commune", { length: 120 }).notNull(),
  address: text("address").notNull(),
  note: text("note"),
  total: int("total").notNull(),
  status: mysqlEnum("status", ["nouvelle", "confirmee", "annulee", "reportee", "ne_repond_pas", "transferee"]).default("nouvelle").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StoreOrder = typeof storeOrders.$inferSelect;
export type InsertStoreOrder = typeof storeOrders.$inferInsert;

export const storeOrderItems = mysqlTable("store_order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => storeOrders.id),
  productId: int("productId").references(() => storeProducts.id),
  productName: varchar("productName", { length: 180 }).notNull(),
  unitPrice: int("unitPrice").notNull(),
  quantity: int("quantity").notNull(),
});

export type StoreOrderItem = typeof storeOrderItems.$inferSelect;
export type InsertStoreOrderItem = typeof storeOrderItems.$inferInsert;

export const storeCheckoutSessions = mysqlTable("store_checkout_sessions", {
  id: int("id").autoincrement().primaryKey(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  state: mysqlEnum("state", ["draft", "submitted", "discarded"]).default("draft").notNull(),
  payload: json("payload").$type<CheckoutPayload | null>(),
  revision: int("revision").default(0).notNull(),
  recoveryStatus: mysqlEnum("recoveryStatus", ["new", "called", "ignored"]).default("new").notNull(),
  orderId: int("orderId").references(() => storeOrders.id),
  consentedAt: timestamp("consentedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StoreCheckoutSession = typeof storeCheckoutSessions.$inferSelect;
export type InsertStoreCheckoutSession = typeof storeCheckoutSessions.$inferInsert;

export const storeAdminSetup = mysqlTable("store_admin_setup", {
  id: int("id").autoincrement().primaryKey(),
  codeHash: varchar("codeHash", { length: 64 }),
  expiresAt: timestamp("expiresAt").notNull(),
  claimedBy: int("claimedBy").references(() => users.id),
  claimedAt: timestamp("claimedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StoreAdminSetup = typeof storeAdminSetup.$inferSelect;
export type InsertStoreAdminSetup = typeof storeAdminSetup.$inferInsert;

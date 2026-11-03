import { and, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertStoreOrder, InsertStoreOrderItem, InsertUser, storeOrderItems, storeOrders, storeProducts, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listStoreProducts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(storeProducts).where(eq(storeProducts.isActive, 1)).orderBy(desc(storeProducts.createdAt));
}

export async function listStoreOrders(query?: string) {
  const db = await getDb();
  if (!db) return [];
  const search = query?.trim();
  const where = search ? or(like(storeOrders.orderNumber, `%${search}%`), like(storeOrders.phone, `%${search}%`), like(storeOrders.customerName, `%${search}%`)) : undefined;
  return db.select().from(storeOrders).where(where).orderBy(desc(storeOrders.createdAt));
}

export async function createStoreOrder(order: InsertStoreOrder, items: InsertStoreOrderItem[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const result = await tx.insert(storeOrders).values(order);
    const orderId = Number(result[0].insertId);
    if (items.length) await tx.insert(storeOrderItems).values(items.map(item => ({ ...item, orderId })));
    return { id: orderId, orderNumber: order.orderNumber };
  });
}

export async function updateStoreOrderStatus(id: number, status: InsertStoreOrder["status"]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(storeOrders).set({ status }).where(eq(storeOrders.id, id));
  return db.select().from(storeOrders).where(eq(storeOrders.id, id)).limit(1);
}

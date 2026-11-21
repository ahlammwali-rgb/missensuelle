import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { listCheckoutOrders, markOrderDelivered, registerCheckoutHttpRoutes, startGoogleSheetAutoSync } from "../checkout";
import { getEcoTrackStatus, getEcoTrackTrackingBatch, recordEcoTrackWebhookStatus } from "../ecotrackDelivery";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { publicTrackingScript } from "./siteTracking";

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  app.get("/api/tracking/bootstrap.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicTrackingScript());
  });
  registerOAuthRoutes(app);
  registerCheckoutHttpRoutes(app);
  app.get("/api/ecotrack/webhook", (_req, res) => {
    res.json({ ok: true, service: "ecotrack-webhook" });
  });
  app.post("/api/ecotrack/webhook", async (req, res) => {
    try {
      const payload = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
      const result = await recordEcoTrackWebhookStatus(payload);
      if (result.ok && result.isDelivered) {
        const orders = await listCheckoutOrders();
        const target = result.orderId
          ? orders.find(o => o.id === result.orderId)
          : undefined;
        if (target && !target.isDelivered && !target.returnReceived) {
          await markOrderDelivered(target.dbId, true, {
            actorId: "webhook",
            actorName: "DHD / EcoTrack Webhook",
          });
        }
      }
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Webhook error" });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on port ${port}`);
    startGoogleSheetAutoSync();
    const runEcoTrackAutoSync = async () => {
      try {
        const ecoStatus = await getEcoTrackStatus();
        if (!ecoStatus.configured) return;
        const orders = await listCheckoutOrders();
        const pending = orders.filter(
          o => !o.isDelivered && !o.returnReceived && (o.status === "transferee" || o.status === "confirmee")
        );
        const trackings = pending
          .map(o => ecoStatus.shipments[o.id]?.tracking)
          .filter((t): t is string => Boolean(t));
        if (trackings.length === 0) return;
        const batch = await getEcoTrackTrackingBatch(trackings.slice(0, 100));
        for (const order of pending) {
          const trkNum = ecoStatus.shipments[order.id]?.tracking;
          const trkData = trkNum ? batch[trkNum] : undefined;
          if (!trkData) continue;
          const sit = `${trkData.situation || ""} ${trkData.etat_logistique || ""}`
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          if (
            sit.includes("livr") ||
            sit.includes("encaiss") ||
            sit.includes("paye") ||
            sit.includes("recouvr") ||
            Boolean(trkData.encaisser) ||
            Boolean(trkData.recouvert)
          ) {
            await markOrderDelivered(order.dbId, true, {
              actorId: "system",
              actorName: "DHD / EcoTrack (Auto)",
            });
          }
        }
      } catch {
        // Ignore background sync failure
      }
    };
    setTimeout(() => void runEcoTrackAutoSync(), 25_000).unref();
    setInterval(() => void runEcoTrackAutoSync(), 5 * 60 * 1000).unref();
    if (process.env.NODE_ENV === "production") {
      const publicUrl = (process.env.RENDER_EXTERNAL_URL || "https://missensuelle.onrender.com").replace(/\/$/, "");
      setInterval(() => {
        fetch(`${publicUrl}/api/health`).catch(() => {});
      }, 10 * 60 * 1000).unref();
    }
  });
}

startServer().catch(error => { console.error(error); process.exit(1); });

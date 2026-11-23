import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import {
  ensureCheckoutStoreReady,
  listCheckoutOrders,
  markOrderDelivered,
  registerCheckoutHttpRoutes,
  restoreTransferredStatusFromCarrier,
  startGoogleSheetAutoSync,
} from "../checkout";
import { getServerPixelConfig } from "../persistentStore";
import { syncAllCarrierDeliveries } from "../carrierSync";
import { recordEcoTrackWebhookStatus } from "../ecotrackDelivery";
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
  const sendLiveBootstrap = async (_req: express.Request, res: express.Response) => {
    await ensureCheckoutStoreReady().catch(() => {});
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicTrackingScript(getServerPixelConfig()));
  };
  app.get("/api/tracking/bootstrap.js", sendLiveBootstrap);
  app.get(/^\/tracking\/bootstrap\.[a-f0-9]{16}\.js$/, sendLiveBootstrap);
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
        if (target && !target.returnReceived) {
          if (target.status !== "transferee") {
            await restoreTransferredStatusFromCarrier(target.dbId, {
              actorId: "webhook",
              actorName: "DHD / EcoTrack Webhook",
            });
          }
          if (!target.isDelivered) {
            await markOrderDelivered(target.dbId, true, {
              actorId: "webhook",
              actorName: "DHD / EcoTrack Webhook",
            });
          }
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
    const runCarrierAutoSync = async () => {
      try {
        await syncAllCarrierDeliveries({ includeEcom: true, includeEcoTrack: true });
      } catch {
        // Ignore background sync failure
      }
    };
    setTimeout(() => void runCarrierAutoSync(), 12_000).unref();
    setInterval(() => void runCarrierAutoSync(), 5 * 60 * 1000).unref();
    if (process.env.NODE_ENV === "production") {
      const publicUrl = (process.env.RENDER_EXTERNAL_URL || "https://missensuelle.onrender.com").replace(/\/$/, "");
      setInterval(() => {
        fetch(`${publicUrl}/api/health`).catch(() => {});
      }, 10 * 60 * 1000).unref();
    }
  });
}

startServer().catch(error => { console.error(error); process.exit(1); });

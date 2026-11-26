import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { isGcomePrimaryRequest } from "./publicConfig";

function applyGcomeHtmlMetadata(html: string, req: express.Request): string {
  const hostHeader = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const isPrimaryGcome = isGcomePrimaryRequest(hostHeader, process.env);
  const isGcomePath = req.originalUrl === "/gcome" || req.originalUrl.startsWith("/gcome/");
  const surfaceScript = `<script>window.__GCOME_SURFACE__=${JSON.stringify(
    isPrimaryGcome ? "gcome" : "storefront"
  )};</script>`;
  let next = html.replace("</head>", `${surfaceScript}\n  </head>`);
  if (isPrimaryGcome || isGcomePath) {
    next = next
      .replace(
        /<title>[\s\S]*?<\/title>/i,
        "<title>GCOME · Plateforme E-Commerce SaaS 3 en 1 — Algérie</title>"
      )
      .replace(
        /<meta name="description" content="[^"]*"\s*\/?>/i,
        `<meta name="description" content="Vends, confirme et livre sur 58 wilayas depuis une seule application mobile & dashboard : Boutique COD, Équipe confirmateurs, Transporteurs DHD/E-com & Finance IA." />\n    <meta property="og:title" content="GCOME · SaaS E-Commerce 3 en 1" />\n    <meta property="og:description" content="Boutique haute conversion, confirmation & livraison 58 wilayas dans un seul tableau de bord mobile-first." />\n    <meta property="og:image" content="/gcome-og.svg" />`
      )
      .replace(
        `<link rel="icon" type="image/png" href="/admin-pwa-icon.png" />`,
        `<link rel="icon" type="image/svg+xml" href="/gcome-icon.svg" />`
      );
  }
  return next;
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(applyGcomeHtmlMetadata(page, req));
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  let cachedIndexHtml: string | null = null;
  const loadIndexHtml = () => {
    if (!cachedIndexHtml) {
      const indexFile = path.resolve(distPath, "index.html");
      if (fs.existsSync(indexFile)) {
        cachedIndexHtml = fs.readFileSync(indexFile, "utf-8");
      }
    }
    return cachedIndexHtml;
  };

  app.use(
    express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        const normalized = filePath.replace(/\\/g, "/");
        if (normalized.endsWith(".html") || normalized.endsWith("/sw.js") || normalized.endsWith("/manifest.json")) {
          res.setHeader("Cache-Control", "no-cache");
        } else if (normalized.includes("/assets/") || normalized.includes("/tracking/bootstrap.")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (
          normalized.includes("/images/") ||
          normalized.includes("/manus-storage/") ||
          normalized.includes("/sounds/") ||
          normalized.includes("/icons/")
        ) {
          res.setHeader("Cache-Control", "public, max-age=604800");
        }
      },
    }),
  );

  // the app's not-found page keeps a real 404 status for crawlers
  app.get("/404", (_req, res) => {
    res.status(404).sendFile(path.resolve(distPath, "index.html"));
  });

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res) => {
    const html = loadIndexHtml();
    if (!html) {
      res.sendFile(path.resolve(distPath, "index.html"));
      return;
    }
    res.setHeader("Cache-Control", "no-cache");
    res.type("text/html").send(applyGcomeHtmlMetadata(html, req));
  });
}

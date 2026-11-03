import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { publicTrackingScript } from "../server/_core/siteTracking";

const root = new URL("../", import.meta.url);
const script = publicTrackingScript();
const hash = createHash("sha256").update(script).digest("hex").slice(0, 16);
const publicPath = `/tracking/bootstrap.${hash}.js`;
const outputDirectory = new URL("client/public/tracking/", root);
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(new URL(`bootstrap.${hash}.js`, outputDirectory), script);

const index = new URL("client/index.html", root);
const html = readFileSync(index, "utf8");
const matches = html.match(/\/tracking\/bootstrap\.[a-f0-9]{16}\.js/g) ?? [];
if (matches.length !== 1) throw new Error("L'en-tête doit contenir exactement un bootstrap publicitaire versionné.");
writeFileSync(index, html.replace(matches[0], publicPath));
console.log(`Bootstrap publicitaire généré : ${publicPath} (${fileURLToPath(outputDirectory)})`);

// Only these public values may reach the browser. Never serialize process.env.
export function isGcomePrimaryRequest(
  hostHeader?: string | null,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const flag = String(env.GCOME_PRIMARY_SITE || "").trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  const host = String(hostHeader || "").toLowerCase();
  return host.includes("gcome");
}

export function publicPlatformConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    projectId: env.MANUS_PROJECT_ID ?? "",
    oauthPortalUrl: env.MANUS_OAUTH_PORTAL_URL ?? "",
    apiUrl: env.MANUS_API_URL ?? "",
    apiBrowserKey: env.MANUS_API_BROWSER_KEY ?? "",
  };
}

export function publicPlatformScript(
  env: NodeJS.ProcessEnv = process.env,
  hostHeader?: string | null
): string {
  const json = JSON.stringify(publicPlatformConfig(env)).replaceAll("<", "\\u003c");
  const surface = isGcomePrimaryRequest(hostHeader, env) ? "gcome" : "storefront";
  return `window.__MANUS_CONFIG__=${json};window.__GCOME_SURFACE__=${JSON.stringify(surface)};`;
}

export function isGcomeStandaloneHost(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const win = window as Window & { __GCOME_SURFACE__?: string };
    if (win.__GCOME_SURFACE__ === "gcome") return true;
    const host = window.location.hostname.toLowerCase();
    if (host.includes("gcome")) return true;
    const surfaceParam = new URLSearchParams(window.location.search).get("surface");
    if (surfaceParam === "gcome") return true;
  } catch {
    // ignore browser env errors
  }
  return false;
}

/**
 * Resolves GCOME internal routes cleanly for BOTH:
 * - Separate Render domain (e.g. gcome-dz.onrender.com -> "/", "/tarifs", "/inscription", ...)
 * - Current storefront domain (missensuelle.onrender.com -> "/gcome", "/gcome/tarifs", ...)
 */
export function gcomeHref(subpath: string = "/"): string {
  const clean = subpath.startsWith("/") ? subpath : `/${subpath}`;
  if (isGcomeStandaloneHost()) {
    return clean;
  }
  if (clean === "/") return "/gcome";
  if (clean.startsWith("/#")) return `/gcome${clean}`;
  return `/gcome${clean}`;
}

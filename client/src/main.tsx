import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      gcTime: 5 * 60_000,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  startLogin();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

function trpcHeaders() {
  // Preview auto-login fallback: when the browser blocks iframe cookies
  // (Safari ITP / private browsing / WebView), the runtime mirrors the
  // session into sessionStorage so we can forward it as a Bearer token.
  // The regular OAuth cookie flow keeps working and takes priority server-side.
  try {
    const raw = sessionStorage.getItem("manus-cookie");
    if (raw) {
      const prefix = `${COOKIE_NAME}=`;
      const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
      const token = pair?.trim().slice(prefix.length);
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    }
  } catch {
    // sessionStorage unavailable
  }
  return {};
}

function trpcFetch(input: RequestInfo | URL, init?: RequestInit) {
  return globalThis.fetch(input, {
    ...(init ?? {}),
    credentials: "include",
  });
}

const singleTrpcLink = httpLink({
  url: "/api/trpc",
  transformer: superjson,
  headers: trpcHeaders,
  fetch: trpcFetch,
});

const batchTrpcLink = httpBatchLink({
  url: "/api/trpc",
  transformer: superjson,
  headers: trpcHeaders,
  fetch: trpcFetch,
});

const trpcClient = trpc.createClient({
  links: [
    // Keep heavy or external-API procedures unbatched so admin.orders never waits behind Google Sheets / EcoTrack / E-com.
    splitLink({
      condition(op) {
        return (
          op.path.startsWith("admin.") ||
          op.path.startsWith("ecom.") ||
          op.path.startsWith("ecotrack.") ||
          op.path.startsWith("googleSheet.")
        );
      },
      true: singleTrpcLink,
      false: batchTrpcLink,
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration ignored if blocked
    });
  });
}

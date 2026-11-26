import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { LanguageProvider } from "./components/StoreLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import type { CartLine, Product } from "./lib/store-data";
import { initializePixels } from "./lib/tracking";
import { isGcomeStandaloneHost } from "./lib/gcome-routing";

const Storefront = lazy(() => import("./pages/Storefront"));
const AdminPage = lazy(() => import("./pages/Admin"));
const GcomeHome = lazy(() => import("./pages/gcome/GcomeHome"));
const GcomePricing = lazy(() => import("./pages/gcome/GcomePricing"));
const GcomeSignup = lazy(() => import("./pages/gcome/GcomeSignup"));
const GcomeLogin = lazy(() => import("./pages/gcome/GcomeLogin"));
const GcomePayment = lazy(() => import("./pages/gcome/GcomePayment"));
const GcomePaymentResult = lazy(() =>
  import("./pages/gcome/GcomePayment").then(m => ({ default: m.GcomePaymentResult }))
);
const GcomeLegal = lazy(() => import("./pages/gcome/GcomeLegal"));

function RouteFallback() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }} role="status" aria-label="Chargement">
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: "3px solid rgba(148,163,184,0.28)",
          borderTopColor: "#7c3aed",
          animation: "spin 0.75s linear infinite",
        }}
      />
    </div>
  );
}

const CART_KEY = "miss-sensuelle-cart";

function isGcomeBrowserSurface(): boolean {
  if (typeof window === "undefined") return false;
  if (isGcomeStandaloneHost()) return true;
  const p = window.location.pathname;
  return p === "/gcome" || p.startsWith("/gcome/");
}

function AppRouter() {
  const [cart, setCart] = useState<CartLine[]>(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]") as CartLine[]; } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);
  const addToCart = (product: Product & { quantity?: number }) => setCart(current => { const existing = current.find(line => line.id === product.id); if (existing) return current.map(line => line.id === product.id ? { ...line, quantity: line.quantity + (product.quantity ?? 1) } : line); return [...current, { ...product, quantity: product.quantity ?? 1 }]; });
  const updateCart = (id: string, delta: number) => setCart(current => current.flatMap(line => line.id === id ? (line.quantity + delta > 0 ? [{ ...line, quantity: line.quantity + delta }] : []) : [line]));
  const standaloneGcome = isGcomeStandaloneHost();

  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/admin" component={AdminPage} />

        {/* Prefix /gcome/* active on both Storefront domain and standalone GCOME domain */}
        <Route path="/gcome" component={GcomeHome} />
        <Route path="/gcome/tarifs" component={GcomePricing} />
        <Route path="/gcome/inscription" component={GcomeSignup} />
        <Route path="/gcome/connexion" component={GcomeLogin} />
        <Route path="/gcome/paiement" component={GcomePayment} />
        <Route path="/gcome/paiement/succes">{() => <GcomePaymentResult mode="success" />}</Route>
        <Route path="/gcome/paiement/echec">{() => <GcomePaymentResult mode="failure" />}</Route>
        <Route path="/gcome/cgu">{() => <GcomeLegal kind="cgu" />}</Route>
        <Route path="/gcome/confidentialite">{() => <GcomeLegal kind="privacy" />}</Route>
        <Route path="/gcome/remboursement">{() => <GcomeLegal kind="refund" />}</Route>

        {/* When hosted on a separate Render domain (e.g. gcome-*.onrender.com), serve GCOME directly on root routes */}
        {standaloneGcome && <Route path="/" component={GcomeHome} />}
        {standaloneGcome && <Route path="/tarifs" component={GcomePricing} />}
        {standaloneGcome && <Route path="/inscription" component={GcomeSignup} />}
        {standaloneGcome && <Route path="/connexion" component={GcomeLogin} />}
        {standaloneGcome && <Route path="/paiement" component={GcomePayment} />}
        {standaloneGcome && <Route path="/paiement/succes">{() => <GcomePaymentResult mode="success" />}</Route>}
        {standaloneGcome && <Route path="/paiement/echec">{() => <GcomePaymentResult mode="failure" />}</Route>}
        {standaloneGcome && <Route path="/cgu">{() => <GcomeLegal kind="cgu" />}</Route>}
        {standaloneGcome && <Route path="/confidentialite">{() => <GcomeLegal kind="privacy" />}</Route>}
        {standaloneGcome && <Route path="/remboursement">{() => <GcomeLegal kind="refund" />}</Route>}

        <Route>
          {standaloneGcome ? (
            <GcomeHome />
          ) : (
            <Storefront cart={cart} onAdd={addToCart} onUpdate={updateCart} onClear={() => setCart([])} />
          )}
        </Route>
      </Switch>
    </Suspense>
  );
}

export default function App() {
  useEffect(() => {
    if (!isGcomeBrowserSurface()) {
      initializePixels();
    }
  }, []);
  return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><LanguageProvider><TooltipProvider><Toaster /><AppRouter /></TooltipProvider></LanguageProvider></ThemeProvider></ErrorBoundary>;
}

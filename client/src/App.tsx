import { useEffect, useState } from "react";
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { LanguageProvider } from "./components/StoreLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Storefront from "./pages/Storefront";
import AdminPage from "./pages/Admin";
import type { CartLine, Product } from "./lib/store-data";
import { initializePixels } from "./lib/tracking";

const CART_KEY = "miss-sensuelle-cart";

function AppRouter() {
  const [cart, setCart] = useState<CartLine[]>(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]") as CartLine[]; } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);
  const addToCart = (product: Product & { quantity?: number }) => setCart(current => { const existing = current.find(line => line.id === product.id); if (existing) return current.map(line => line.id === product.id ? { ...line, quantity: line.quantity + (product.quantity ?? 1) } : line); return [...current, { ...product, quantity: product.quantity ?? 1 }]; });
  const updateCart = (id: string, delta: number) => setCart(current => current.flatMap(line => line.id === id ? (line.quantity + delta > 0 ? [{ ...line, quantity: line.quantity + delta }] : []) : [line]));
  return <Switch><Route path="/admin" component={AdminPage} /><Route><Storefront cart={cart} onAdd={addToCart} onUpdate={updateCart} onClear={() => setCart([])} /></Route></Switch>;
}

export default function App() {
  useEffect(() => { initializePixels(); }, []);
  return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><LanguageProvider><TooltipProvider><Toaster /><AppRouter /></TooltipProvider></LanguageProvider></ThemeProvider></ErrorBoundary>;
}

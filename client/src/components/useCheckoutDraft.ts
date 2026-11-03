import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { CheckoutPayload, SaveDraftResult, SubmitOrderResult } from "@shared/checkout";
import { discardCheckoutDraft, saveCheckoutDraft, submitCheckoutOrder } from "@/lib/checkout-api";
import type { CheckoutDraftStatus } from "./CheckoutDraftNotice";

type CheckoutField = keyof Omit<CheckoutPayload, "source" | "items">;
type FieldAliases = Partial<Record<CheckoutField, string[]>>;

type Options = {
  formRef: RefObject<HTMLFormElement | null>;
  source: CheckoutPayload["source"];
  getItems: () => CheckoutPayload["items"];
  watchKey?: string | number;
  aliases?: FieldAliases;
};

type HookResult = {
  consent: boolean;
  setConsent: (checked: boolean) => void;
  draftStatus: CheckoutDraftStatus;
  draftError: string;
  pending: boolean;
  order: SubmitOrderResult | null;
  snapshot: () => CheckoutPayload | null;
  submitOrder: () => Promise<SubmitOrderResult | null>;
};

const STORAGE_KEY = "miss-sensuelle-checkout-token";
const DRAFT_DELAY = 800;

const defaultAliases: Record<CheckoutField, string[]> = {
  customer: ["customer"],
  phone: ["phone"],
  wilaya: ["wilaya"],
  commune: ["commune"],
  address: ["address"],
  note: ["note"],
  delivery: ["delivery"],
};

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.sessionStorage.getItem(key) || window.localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(key, value); return; } catch { /* fallback below */ }
  try { window.localStorage.setItem(key, value); } catch { /* private browsing can reject both */ }
}

function removeStorage(key: string): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(key); } catch { /* noop */ }
  try { window.localStorage.removeItem(key); } catch { /* noop */ }
}

function createUuid(): string | null {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.getRandomValues) return null;
  const bytes = new Uint8Array(16);
  cryptoObject.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function firstValue(form: FormData, names: string[]): string {
  for (const name of names) {
    const value = form.get(name);
    if (typeof value === "string") return value.trim();
  }
  return "";
}

function hasDraftData(payload: CheckoutPayload): boolean {
  return Boolean(
    payload.customer || payload.phone || payload.wilaya || payload.commune || payload.address || payload.note ||
    payload.items.some(item => Boolean(item.color || item.size)) || payload.delivery === "office",
  );
}

export function useCheckoutDraft({ formRef, source, getItems, watchKey, aliases = {} }: Options): HookResult {
  const [consent, setConsentState] = useState(false);
  const [draftStatus, setDraftStatus] = useState<CheckoutDraftStatus>("idle");
  const [draftError, setDraftError] = useState("");
  const [pending, setPending] = useState(false);
  const [order, setOrder] = useState<SubmitOrderResult | null>(null);
  const tokenRef = useRef<string | null>(null);
  const revisionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  const consentRef = useRef(false);
  const mountedRef = useRef(true);
  const getItemsRef = useRef(getItems);
  const optionsRef = useRef({ source, aliases });
  getItemsRef.current = getItems;
  optionsRef.current = { source, aliases };

  const ensureToken = useCallback((): string | null => {
    if (tokenRef.current) return tokenRef.current;
    const stored = readStorage(STORAGE_KEY);
    if (stored) { tokenRef.current = stored; return stored; }
    const created = createUuid();
    if (!created) return null;
    tokenRef.current = created;
    writeStorage(STORAGE_KEY, created);
    return created;
  }, []);

  const snapshot = useCallback((): CheckoutPayload | null => {
    const form = formRef.current;
    if (!form) return null;
    const formData = new FormData(form);
    const field = (name: CheckoutField) => firstValue(formData, [...(aliases[name] ?? []), ...defaultAliases[name]]);
    const items = getItemsRef.current();
    return {
      source: optionsRef.current.source,
      customer: field("customer"),
      phone: field("phone"),
      wilaya: field("wilaya"),
      commune: field("commune"),
      address: field("address"),
      note: field("note"),
      delivery: field("delivery") === "office" ? "office" : "home",
      items,
    };
  }, [aliases, formRef]);

  const save = useCallback(async (keepalive = false): Promise<SaveDraftResult | null> => {
    if (!consentRef.current) return null;
    const payload = snapshot();
    if (!payload || !hasDraftData(payload)) return null;
    const token = ensureToken();
    if (!token) {
      if (mountedRef.current) { setDraftStatus("error"); setDraftError("La sauvegarde temporaire n'est pas disponible sur cet appareil."); }
      return null;
    }
    const revision = ++revisionRef.current;
    if (mountedRef.current) { setDraftStatus("saving"); setDraftError(""); }
    try {
      const result = await saveCheckoutDraft({ token, revision, consent: true, payload }, keepalive);
      if (mountedRef.current && revision === revisionRef.current) setDraftStatus(result.accepted ? "saved" : "error");
      return result;
    } catch (error) {
      if (mountedRef.current && revision === revisionRef.current) {
        setDraftStatus("error");
        setDraftError(error instanceof Error ? error.message : "Impossible d'enregistrer le brouillon.");
      }
      return null;
    }
  }, [ensureToken, snapshot]);

  const scheduleSave = useCallback(() => {
    if (!consentRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { timerRef.current = null; void save(false); }, DRAFT_DELAY);
  }, [save]);

  const setConsent = useCallback((checked: boolean) => {
    consentRef.current = checked;
    setConsentState(checked);
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (checked) {
      setDraftError("");
      setDraftStatus("idle");
      scheduleSave();
      return;
    }
    const token = tokenRef.current;
    const revision = ++revisionRef.current;
    setDraftStatus("disabled");
    if (token) {
      void discardCheckoutDraft({ token, revision }).catch(error => {
        if (mountedRef.current) {
          setDraftStatus("error");
          setDraftError(error instanceof Error ? error.message : "Impossible d'effacer le brouillon.");
        }
      });
    }
  }, [scheduleSave]);

  const submitOrder = useCallback(async (): Promise<SubmitOrderResult | null> => {
    if (pendingRef.current) return null;
    const payload = snapshot();
    if (!payload) return null;
    const token = ensureToken();
    if (!token) {
      if (mountedRef.current) setDraftError("La session de commande n'est pas disponible. Réessaie.");
      return null;
    }
    pendingRef.current = true;
    if (mountedRef.current) { setPending(true); setDraftError(""); }
    try {
      const result = await submitCheckoutOrder(token, payload);
      removeStorage(STORAGE_KEY);
      if (mountedRef.current) setOrder(result);
      return result;
    } catch (error) {
      if (mountedRef.current) setDraftError(error instanceof Error ? error.message : "La commande n'a pas pu être enregistrée.");
      return null;
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) setPending(false);
    }
  }, [ensureToken, snapshot]);

  useEffect(() => {
    mountedRef.current = true;
    const form = formRef.current;
    if (!consent || !form) return;
    const onChange = () => scheduleSave();
    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
    return () => {
      form.removeEventListener("input", onChange);
      form.removeEventListener("change", onChange);
    };
  }, [consent, formRef, scheduleSave]);

  useEffect(() => {
    if (consent) scheduleSave();
  }, [consent, scheduleSave, watchKey]);

  useEffect(() => {
    const persistOnExit = () => { if (consentRef.current) void save(true); };
    window.addEventListener("pagehide", persistOnExit);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") persistOnExit(); });
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("pagehide", persistOnExit);
    };
  }, [save]);

  return { consent, setConsent, draftStatus, draftError, pending, order, snapshot, submitOrder };
}

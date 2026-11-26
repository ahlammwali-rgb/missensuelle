import type {
  CheckoutPayload,
  DiscardDraftInput,
  SaveDraftInput,
  SaveDraftResult,
  SubmitOrderResult,
} from "@shared/checkout";
import { readBrowserTrackingContext } from "./tracking";

export type CheckoutApiError = Error & { status?: number };

type CheckoutResponse = { error?: string };

async function postJson<T>(path: string, body: unknown, keepalive = false): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      keepalive,
    });
  } catch {
    throw new Error("Connexion impossible. Vérifie ta connexion puis réessaie.");
  }

  let data: (T & CheckoutResponse) | null = null;
  try {
    data = (await response.json()) as T & CheckoutResponse;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new Error(data?.error || "Le serveur n'a pas pu traiter la demande.") as CheckoutApiError;
    error.status = response.status;
    throw error;
  }
  if (!data) throw new Error("Réponse serveur invalide. Réessaie dans un instant.");
  return data;
}

export function saveCheckoutDraft(input: SaveDraftInput, keepalive = false): Promise<SaveDraftResult> {
  const payload = input.payload.tracking
    ? input.payload
    : { ...input.payload, tracking: readBrowserTrackingContext() };
  return postJson<SaveDraftResult>("/api/checkout/draft", { ...input, payload }, keepalive);
}

export function submitCheckoutOrder(token: string, payload: CheckoutPayload): Promise<SubmitOrderResult> {
  const enriched = payload.tracking
    ? payload
    : { ...payload, tracking: readBrowserTrackingContext() };
  return postJson<SubmitOrderResult>("/api/checkout/order", { token, payload: enriched });
}

export function discardCheckoutDraft(input: DiscardDraftInput, keepalive = true): Promise<{ ok: true }> {
  return postJson<{ ok: true }>("/api/checkout/discard", input, keepalive);
}

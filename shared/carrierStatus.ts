export type CarrierTrackingSummary = {
  tracking?: string;
  situation?: string | null;
  etat_logistique?: string | null;
  encaisser?: boolean;
  recouvert?: boolean;
  historique?: Array<{
    date?: string;
    ville?: number | string;
    situation?: string | null;
    commentaire?: string | null;
  }>;
};

export type CarrierSituationCategory =
  | "delivered"
  | "no_answer"
  | "postponed"
  | "returned"
  | "in_transit";

export function normCarrierText(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const DELIVERED_TOKEN_RE = /(?:^|[\s_/|,&()-])(?:livree?s?|delivered|encaissee?s?|recouvert?e?s?|recouvree?s?|payee?s?)(?:$|[\s_/|,&()-])/;
const NEGATED_DELIVERED_RE = /(?:^|[\s_/|,&()-])(?:non|pas|jamais)[\s_]+(?:livree?s?|delivered)/;
const NON_CASHED_OR_PAID_ONLY_RE = /(?:^|[\s_/|,&()-])non[\s_]+(?:encaissee?s?|recouvert?e?s?|payee?s?)/g;
const POSITIVE_DELIVERED_ONLY_RE = /(?:^|[\s_/|,&()-])(?:livree?s?|delivered|encaissee?s?|recouvert?e?s?|recouvree?s?|payee?s?)(?:$|[\s_/|,&()-])/;

const RETURNED_OR_CANCELLED_RE =
  /(?:^|[\s_/|,&()-])(?:retour\w*|refus\w*|annul\w*|echec|echoue\w*|non[\s_]+livr\w*)/;

const NO_ANSWER_RE = /ne[\s_]*repond\w*[\s_]*pas|sans[\s_]*reponse|injoignable|nrp|client[\s_]+injoignable/;
const POSTPONED_RE = /(?:^|[\s_/|,&()-])(?:report\w*|reprogramm\w*)(?:$|[\s_/|,&()-])/;

/**
 * Checks whether a single carrier status string explicitly denotes delivery/collection
 * (never matching "en livraison", "sorti(r) en livraison", "livreur", "livrable", or "retour_chez_livreur").
 */
export function isCarrierStatusTextDelivered(raw?: string | null): boolean {
  const norm = normCarrierText(raw);
  if (!norm) return false;
  if (NEGATED_DELIVERED_RE.test(norm)) return false;
  if (RETURNED_OR_CANCELLED_RE.test(norm)) return false;

  // Strip phrases like "non_encaisse" or "non_paye" so "livre_non_encaisse" -> still matches "livre",
  // and "encaisse_non_paye" -> still matches "encaisse", whereas standalone "non_paye" does NOT match!
  const withoutNegatedPayment = norm.replace(NON_CASHED_OR_PAID_ONLY_RE, " ");
  if (!DELIVERED_TOKEN_RE.test(withoutNegatedPayment)) return false;
  return POSITIVE_DELIVERED_ONLY_RE.test(withoutNegatedPayment);
}

/**
 * Checks whether a single carrier status string represents a return, refusal or cancellation.
 */
export function isCarrierStatusTextReturned(raw?: string | null): boolean {
  const norm = normCarrierText(raw);
  if (!norm) return false;
  return RETURNED_OR_CANCELLED_RE.test(norm);
}

/**
 * Evaluates full carrier tracking payload (current situation, logistics step, flags).
 * Intentionally relies on CURRENT state rather than scanning historical transit scans,
 * preventing cancelled or in-delivery parcels with older scans from turning into false positives.
 */
export function isCarrierTrackingDelivered(trk?: CarrierTrackingSummary | null): boolean {
  if (!trk || typeof trk !== "object") return false;

  const sitNorm = normCarrierText(trk.situation);
  const logNorm = normCarrierText(trk.etat_logistique);

  // If the current carrier situation explicitly indicates cancelled / returned / failed / refused,
  // it is NOT delivered (even if an older scan or recovery flag exists).
  if (RETURNED_OR_CANCELLED_RE.test(sitNorm) || RETURNED_OR_CANCELLED_RE.test(logNorm)) {
    return false;
  }

  if (Boolean(trk.encaisser) || Boolean(trk.recouvert)) {
    return true;
  }

  return isCarrierStatusTextDelivered(trk.situation) || isCarrierStatusTextDelivered(trk.etat_logistique);
}

export function isCarrierTrackingReturned(trk?: CarrierTrackingSummary | null): boolean {
  if (!trk || typeof trk !== "object") return false;
  return (
    isCarrierStatusTextReturned(trk.situation) ||
    isCarrierStatusTextReturned(trk.etat_logistique)
  );
}

export function classifyCarrierTracking(trk?: CarrierTrackingSummary | null): CarrierSituationCategory {
  if (!trk) return "in_transit";
  if (isCarrierTrackingReturned(trk)) return "returned";
  if (isCarrierTrackingDelivered(trk)) return "delivered";
  const combined = normCarrierText(`${trk.situation || ""} ${trk.etat_logistique || ""}`);
  if (NO_ANSWER_RE.test(combined)) return "no_answer";
  if (POSTPONED_RE.test(combined)) return "postponed";
  return "in_transit";
}

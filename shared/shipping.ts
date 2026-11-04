import { abayaWilayas } from "../client/src/lib/abaya-communes";

/** Produits à livraison gratuite : aucun frais de livraison n'est affiché ni ajouté au total. */
const FREE_SHIPPING_PRODUCTS = new Set(["p-007", "abaya-royal-emerald"]);

export function isFreeShippingProduct(productIdOrSlug: string) {
  return FREE_SHIPPING_PRODUCTS.has(productIdOrSlug);
}

/** Les wilayas du formulaire suivent l'ordre officiel : index + 1 = code wilaya E-com Delivery. */
export function wilayaIdFromName(name: string): number | null {
  const index = abayaWilayas.indexOf(name.trim());
  return index >= 0 ? index + 1 : null;
}

export type ShippingRate = { domicile: number; stopdesk: number };
export type ShippingRates = { configured: boolean; rates: Record<string, ShippingRate> };

/** Frais de livraison : 0 si tous les articles sont en livraison gratuite ou si le tarif est inconnu. */
export function shippingFeeFor(
  rates: Record<string, ShippingRate> | undefined,
  wilaya: string,
  delivery: "home" | "office",
  productIds: string[],
) {
  if (!productIds.length || productIds.every(isFreeShippingProduct)) return 0;
  const id = wilayaIdFromName(wilaya);
  const rate = id ? rates?.[String(id)] : undefined;
  if (!rate) return 0;
  return delivery === "office" ? rate.stopdesk : rate.domicile;
}

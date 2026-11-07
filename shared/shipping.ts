import { abayaCommunesByWilaya, abayaWilayas } from "../client/src/lib/abaya-communes";

/** Produits à livraison gratuite : aucun frais de livraison n'est affiché ni ajouté au total. */
const FREE_SHIPPING_PRODUCTS = new Set(["p-007", "abaya-royal-emerald"]);

export function isFreeShippingProduct(productIdOrSlug: string) {
  return FREE_SHIPPING_PRODUCTS.has(productIdOrSlug);
}

/** Normalise une chaîne arabe (retire les hamzas, tatweel, harakat, unifie ة/ه et ى/ي) */
export function normalizeArabic(text: string): string {
  return text
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
}

/** Normalise une chaîne latine/française (minuscules, sans accents ni ponctuation) */
export function normalizeLatin(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`\-_.,()/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Synonymes français, arabes et variantes courantes pour chacune des 58 wilayas (1 à 58) */
const WILAYA_ALIASES: Record<number, string[]> = {
  1: ["adrar", "أدرار", "ادرار"],
  2: ["chlef", "echlef", "el asnam", "الشلف", "شلف"],
  3: ["laghouat", "el aghouat", "الأغواط", "الاغواط", "اغواط"],
  4: ["oum el bouaghi", "oum bouaghi", "oeb", "أم البواقي", "ام البواقي", "ام بواقي"],
  5: ["batna", "باتنة", "باتنه"],
  6: ["bejaia", "bgayet", "bougie", "بجاية", "بجايه"],
  7: ["biskra", "بسكرة", "بسكره"],
  8: ["bechar", "بشار"],
  9: ["blida", "el boulaida", "البليدة", "البليده", "بليدة", "بليده"],
  10: ["bouira", "البويرة", "البويره", "بويرة", "بويره"],
  11: ["tamanrasset", "tamanghasset", "tam", "تمنراست", "تمراست", "تامنراست"],
  12: ["tebessa", "تبسة", "تبسه"],
  13: ["tlemcen", "تلمسان"],
  14: ["tiaret", "تيارت"],
  15: ["tizi ouzou", "tizi", "تيزي وزو", "تيزي"],
  16: ["alger", "algiers", "alger centre", "الجزائر", "الجزائر العاصمة", "العاصمة", "دزاير", "جزاير"],
  17: ["djelfa", "jelfa", "الجلفة", "الجلفه", "جلفة", "جلفه"],
  18: ["jijel", "جيجل"],
  19: ["setif", "stif", "سطيف"],
  20: ["saida", "سعيدة", "سعيده"],
  21: ["skikda", "سكيكدة", "سكيكده"],
  22: ["sidi bel abbes", "sba", "bel abbes", "سيدي بلعباس", "بلعباس"],
  23: ["annaba", "bone", "عنابة", "عنابه"],
  24: ["guelma", "قالمة", "قالمه"],
  25: ["constantine", "qacentina", "قسنطينة", "قسنطينه"],
  26: ["medea", "المدية", "المديه", "مدية", "مديه"],
  27: ["mostaganem", "mosta", "مستغانم"],
  28: ["msila", "m sila", "المسيلة", "المسيله", "مسيلة", "مسيله"],
  29: ["mascara", "معسكر"],
  30: ["ouargla", "wargla", "ورقلة", "ورقله"],
  31: ["oran", "wahran", "وهران", "وهرن"],
  32: ["el bayadh", "bayadh", "البيض", "بيض"],
  33: ["illizi", "ilizi", "إليزي", "اليزي"],
  34: ["bordj bou arreridj", "bba", "bordj", "برج بوعريريج", "برج بوعريرج", "البرج"],
  35: ["boumerdes", "بومرداس"],
  36: ["el tarf", "eltarf", "taref", "tarf", "الطارف", "طارف"],
  37: ["tindouf", "تندوف"],
  38: ["tissemsilt", "tisemsilt", "تيسمسيلت"],
  39: ["el oued", "oued souf", "eloued", "الوادي", "وادي سوف", "الواد"],
  40: ["khenchela", "khenchla", "خنشلة", "خنشله"],
  41: ["souk ahras", "soukahras", "سوق أهراس", "سوق اهراس"],
  42: ["tipaza", "tipasa", "تيبازة", "تيبازه"],
  43: ["mila", "ميلة", "ميله"],
  44: ["ain defla", "aindefla", "عين الدفلى", "عين الدفله", "عين دفلى"],
  45: ["naama", "el naama", "النعامة", "النعامه", "نعامة", "نعامه"],
  46: ["ain temouchent", "aintemouchent", "temouchent", "عين تموشنت", "عين تيموشنت"],
  47: ["ghardaia", "غرداية", "غردايه"],
  48: ["relizane", "ghilizane", "غليزان"],
  49: ["timimoun", "تيميمون"],
  50: ["bordj badji mokhtar", "bbm", "برج باجي مختار"],
  51: ["ouled djellal", "اولاد جلال", "أولاد جلال"],
  52: ["beni abbes", "بني عباس"],
  53: ["in salah", "ain salah", "عين صالح", "ان صالح", "إن صالح"],
  54: ["in guezzam", "ain guezzam", "عين قزام", "ان قزام", "إن قزام"],
  55: ["touggourt", "tougourt", "توقرت", "تقرت"],
  56: ["djanet", "janet", "جانت"],
  57: ["el mghair", "el meghair", "meghair", "mghair", "المغير", "مغير"],
  58: ["el meniaa", "el menia", "meniaa", "menia", "golea", "el golea", "المنيعة", "المنيعه", "منيعة", "منيعه"],
};

export const WILAYA_FRENCH_NAMES: Record<number, string> = {
  1: "Adrar",
  2: "Chlef",
  3: "Laghouat",
  4: "Oum El Bouaghi",
  5: "Batna",
  6: "Béjaïa",
  7: "Biskra",
  8: "Béchar",
  9: "Blida",
  10: "Bouira",
  11: "Tamanrasset",
  12: "Tébessa",
  13: "Tlemcen",
  14: "Tiaret",
  15: "Tizi Ouzou",
  16: "Alger",
  17: "Djelfa",
  18: "Jijel",
  19: "Sétif",
  20: "Saïda",
  21: "Skikda",
  22: "Sidi Bel Abbès",
  23: "Annaba",
  24: "Guelma",
  25: "Constantine",
  26: "Médéa",
  27: "Mostaganem",
  28: "M'Sila",
  29: "Mascara",
  30: "Ouargla",
  31: "Oran",
  32: "El Bayadh",
  33: "Illizi",
  34: "Bordj Bou Arréridj",
  35: "Boumerdès",
  36: "El Tarf",
  37: "Tindouf",
  38: "Tissemsilt",
  39: "El Oued",
  40: "Khenchela",
  41: "Souk Ahras",
  42: "Tipaza",
  43: "Mila",
  44: "Aïn Defla",
  45: "Naâma",
  46: "Aïn Témouchent",
  47: "Ghardaïa",
  48: "Relizane",
  49: "Timimoun",
  50: "Bordj Badji Mokhtar",
  51: "Ouled Djellal",
  52: "Béni Abbès",
  53: "In Salah",
  54: "In Guezzam",
  55: "Touggourt",
  56: "Djanet",
  57: "El M'Ghair",
  58: "El Meniaa",
};

/** Quartiers/communes fréquents écrits à la place de la wilaya */
const EXTRA_COMMUNE_TO_WILAYA: Record<string, { wilayaId: number; canonicalCommune?: string }> = {
  "كنستال": { wilayaId: 31, canonicalCommune: "وهران" },
  "canastel": { wilayaId: 31, canonicalCommune: "وهران" },
  "حاسي لفحل": { wilayaId: 58, canonicalCommune: "حاسي الفحل" },
  "مشرية": { wilayaId: 45, canonicalCommune: "المشرية" },
  "مشريه": { wilayaId: 45, canonicalCommune: "المشرية" },
  "mecheria": { wilayaId: 45, canonicalCommune: "المشرية" },
  "bohadjar": { wilayaId: 36, canonicalCommune: "بوحجار" },
  "bouhadjar": { wilayaId: 36, canonicalCommune: "بوحجار" },
  "drean": { wilayaId: 36, canonicalCommune: "الذرعان" },
  "draan": { wilayaId: 36, canonicalCommune: "الذرعان" },
  "soudania": { wilayaId: 16, canonicalCommune: "سويدانية" },
  "souidania": { wilayaId: 16, canonicalCommune: "سويدانية" },
  "ain allah": { wilayaId: 16, canonicalCommune: "دالي ابراهيم" },
  "dely ibrahim": { wilayaId: 16, canonicalCommune: "دالي ابراهيم" },
  "alger centre": { wilayaId: 16, canonicalCommune: "الجزائر الوسطى" },
  "hydra": { wilayaId: 16, canonicalCommune: "حيدرة" },
  "cheraga": { wilayaId: 16, canonicalCommune: "الشراقة" },
  "staoueli": { wilayaId: 16, canonicalCommune: "سطاوالي" },
  "baraki": { wilayaId: 16, canonicalCommune: "براقي" },
  "bordj el kiffan": { wilayaId: 16, canonicalCommune: "برج الكيفان" },
  "herraoua": { wilayaId: 16, canonicalCommune: "هراوة" },
  "bir khadem": { wilayaId: 16, canonicalCommune: "بئر خادم" },
  "birkhadem": { wilayaId: 16, canonicalCommune: "بئر خادم" },
  "السانيا": { wilayaId: 31, canonicalCommune: "السانية" },
  "es senia": { wilayaId: 31, canonicalCommune: "السانية" },
};

/** Index inversé : nom de commune arabe normalisé -> { wilayaId, communeAr } */
const COMMUNE_TO_WILAYA_INDEX = (() => {
  const map = new Map<string, { wilayaId: number; communeAr: string }>();
  abayaWilayas.forEach((wilayaAr, idx) => {
    const wilayaId = idx + 1;
    const communes = abayaCommunesByWilaya[wilayaAr] ?? [];
    for (const c of communes) {
      const norm = normalizeArabic(c);
      if (!map.has(norm)) {
        map.set(norm, { wilayaId, communeAr: c });
      }
      const withoutAl = norm.replace(/^ال/, "");
      if (withoutAl.length >= 3 && !map.has(withoutAl)) {
        map.set(withoutAl, { wilayaId, communeAr: c });
      }
    }
  });
  return map;
})();

/**
 * Résout le code officiel de la wilaya (1 à 58) à partir de n'importe quelle saisie :
 * - Arabe officiel ou sans hamza/ال ("الجزائر", "ام البواقي", "نعامة", "تقرت", "تمراست")
 * - Français / Latin ("Alger", "Oran", "taref", "Boumerdès", "El Meniaa")
 * - Numéro ("16", "16 - Alger", "09")
 * - Texte composite ("الذرعان ولاية الطارف", "ولاية المنيعة بلدية حاسي لفحل", "هراوة (الجزائر العاصمة)")
 * - Nom de commune/quartier saisi dans le champ wilaya ou commune ("كنستال", "Soudania")
 */
export function wilayaIdFromName(name: string, fallbackCommune?: string): number | null {
  const raw = (name || "").trim();
  if (!raw && !fallbackCommune) return null;

  // 1. Correspondance directe rapide avec abayaWilayas
  const directIdx = abayaWilayas.indexOf(raw);
  if (directIdx >= 0) return directIdx + 1;

  // 2. Code numérique au début (ex: "16", "16 - Alger", "04")
  const numMatch = raw.match(/^0?([1-9]|[1-4][0-9]|5[0-8])(?:\s*[-:.)]|\s*$)/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }

  const normAr = normalizeArabic(raw);
  const normArNoAl = normAr.replace(/^ال/, "");
  const normLat = normalizeLatin(raw);

  // 3. Correspondance exacte sur les alias arabes et français
  for (let id = 1; id <= 58; id++) {
    const officialAr = normalizeArabic(abayaWilayas[id - 1] || "");
    if (normAr === officialAr || (normArNoAl.length >= 3 && normArNoAl === officialAr.replace(/^ال/, ""))) {
      return id;
    }
    const aliases = WILAYA_ALIASES[id] ?? [];
    for (const alias of aliases) {
      if (
        normLat === normalizeLatin(alias) ||
        normAr === normalizeArabic(alias) ||
        (normArNoAl.length >= 3 && normArNoAl === normalizeArabic(alias).replace(/^ال/, ""))
      ) {
        return id;
      }
    }
  }

  // 4. Recherche de "ولاية <X>" explicite dans une chaîne composite
  const wilayaKeywordMatch = normAr.match(/ولايه\s+([^\s()،,-]+(?:\s+[^\s()،,-]+)?)/);
  if (wilayaKeywordMatch) {
    const candidate = wilayaKeywordMatch[1].replace(/\s+بلديه.*$/, "").trim();
    const idFromKeyword = wilayaIdFromName(candidate);
    if (idFromKeyword) return idFromKeyword;
  }

  // 5. Recherche d'inclusion d'un nom de wilaya dans une chaîne composite (ex: "الذرعان ولاية الطارف", "هراوة (الجزائر العاصمة)")
  for (let id = 1; id <= 58; id++) {
    const aliases = [abayaWilayas[id - 1], ...(WILAYA_ALIASES[id] ?? [])].filter(Boolean);
    for (const alias of aliases) {
      const aAr = normalizeArabic(alias);
      const aLat = normalizeLatin(alias);
      if (aAr.length >= 4 && normAr.includes(aAr)) return id;
      if (aLat.length >= 4 && normLat.split(" ").includes(aLat)) return id;
    }
  }

  // 6. Correspondance via les communes/quartiers connus (ex: "كنستال", "الذرعان", "مشرية")
  for (const [key, info] of Object.entries(EXTRA_COMMUNE_TO_WILAYA)) {
    if (normAr.includes(normalizeArabic(key)) || (normLat && normLat.includes(normalizeLatin(key)))) {
      return info.wilayaId;
    }
  }
  const directCommuneHit = COMMUNE_TO_WILAYA_INDEX.get(normAr) ?? COMMUNE_TO_WILAYA_INDEX.get(normArNoAl);
  if (directCommuneHit) return directCommuneHit.wilayaId;

  // 7. Si la commune en second paramètre contient le nom de la wilaya ou d'une commune connue (ex: commune = "كنستال وهران")
  if (fallbackCommune && fallbackCommune.trim() && fallbackCommune !== name) {
    return wilayaIdFromName(fallbackCommune);
  }

  return null;
}

/** Retourne le nom officiel arabe de la wilaya (ex: "الجزائر", "الطارف", "المنيعة") */
export function canonicalWilayaName(name: string, fallbackCommune?: string): string {
  const id = wilayaIdFromName(name, fallbackCommune);
  if (id && abayaWilayas[id - 1]) {
    return abayaWilayas[id - 1];
  }
  return name.trim();
}

/**
 * Unifie et nettoie la wilaya, la commune et l'adresse d'une commande
 * (notamment pour les imports Google Sheet / TikTok Lead Ads ou les saisies en français).
 */
export function normalizeOrderLocation(
  rawWilaya: string,
  rawCommune: string,
  rawAddress = "",
): { wilaya: string; commune: string; address: string; wilayaId: number | null } {
  const wid = wilayaIdFromName(rawWilaya, rawCommune);
  if (!wid) {
    return {
      wilaya: rawWilaya.trim(),
      commune: rawCommune.trim(),
      address: rawAddress.trim(),
      wilayaId: null,
    };
  }

  const canonicalWilaya = abayaWilayas[wid - 1] || rawWilaya.trim();
  const wilayaCommunes = abayaCommunesByWilaya[canonicalWilaya] ?? [];

  let resolvedCommune = rawCommune.trim();
  let resolvedAddress = rawAddress.trim();

  // Vérifie si rawCommune est déjà une commune officielle de cette wilaya
  const findInWilayaCommunes = (candidate: string): string | null => {
    if (!candidate) return null;
    const cNorm = normalizeArabic(candidate);
    const cNormNoAl = cNorm.replace(/^ال/, "");
    const cLat = normalizeLatin(candidate);

    for (const [key, info] of Object.entries(EXTRA_COMMUNE_TO_WILAYA)) {
      if (info.wilayaId === wid && info.canonicalCommune) {
        if (cNorm.includes(normalizeArabic(key)) || (cLat && cLat.includes(normalizeLatin(key)))) {
          return info.canonicalCommune;
        }
      }
    }

    for (const official of wilayaCommunes) {
      const oNorm = normalizeArabic(official);
      const oNormNoAl = oNorm.replace(/^ال/, "");
      if (cNorm === oNorm || (cNormNoAl.length >= 3 && cNormNoAl === oNormNoAl)) {
        return official;
      }
    }
    for (const official of wilayaCommunes) {
      const oNorm = normalizeArabic(official);
      if (oNorm.length >= 4 && cNorm.includes(oNorm)) {
        return official;
      }
    }
    return null;
  };

  const matchedFromCommune = findInWilayaCommunes(rawCommune);
  if (matchedFromCommune) {
    resolvedCommune = matchedFromCommune;
  } else {
    // Cherche si une commune distincte du nom de la wilaya a été écrite dans le champ wilaya
    // (ex: "الذرعان ولاية الطارف" ou "ولاية المنيعة بلدية حاسي لفحل" ou "هراوة (الجزائر العاصمة)")
    const matchedFromWilayaText =
      normalizeArabic(rawWilaya) !== normalizeArabic(canonicalWilaya)
        ? findInWilayaCommunes(rawWilaya)
        : null;
    if (matchedFromWilayaText && normalizeArabic(matchedFromWilayaText) !== normalizeArabic(canonicalWilaya)) {
      if (rawCommune.trim() && rawCommune.trim() !== matchedFromWilayaText && !resolvedAddress.includes(rawCommune.trim())) {
        resolvedAddress = [rawCommune.trim(), resolvedAddress].filter(Boolean).join(" — ");
      }
      resolvedCommune = matchedFromWilayaText;
    } else if (!resolvedCommune) {
      resolvedCommune = canonicalWilaya;
    }
  }

  return {
    wilaya: canonicalWilaya,
    commune: resolvedCommune,
    address: resolvedAddress,
    wilayaId: wid,
  };
}

/** Translitère un nom de commune arabe en phonétique latine simplifiée pour comparer avec les communes E-com Delivery */
function transliterateArabicToLatin(text: string): string {
  const norm = normalizeArabic(text).replace(/ه\b/g, "ا");
  const map: Record<string, string> = {
    ا: "a",
    ب: "b",
    ت: "t",
    ث: "th",
    ج: "dj",
    ح: "h",
    خ: "kh",
    د: "d",
    ذ: "d",
    ر: "r",
    ز: "z",
    س: "s",
    ش: "ch",
    ص: "s",
    ض: "d",
    ط: "t",
    ظ: "z",
    ع: "a",
    غ: "gh",
    ف: "f",
    ق: "k",
    ك: "k",
    ل: "l",
    م: "m",
    ن: "n",
    ه: "h",
    و: "ou",
    ي: "i",
    " ": " ",
  };
  let out = "";
  for (const ch of norm) {
    out += map[ch] ?? ch;
  }
  return normalizeLatin(out);
}

function consonantSkeleton(latin: string): string {
  return normalizeLatin(latin)
    .replace(/\b(el|al|ain|ben|beni|bir|bordj|bou|dar|djebel|hai|hassi|ksar|oued|ouled|sidi|souk|tizi)\b/g, m => m[0])
    .replace(/gh/g, "r")
    .replace(/[gq]/g, "k")
    .replace(/[aeiouy\s]/g, "")
    .replace(/(.)\1+/g, "$1");
}

/**
 * Trouve automatiquement la commune E-com Delivery correspondante à partir de la commune de la commande
 * (que la commune cliente soit en arabe, en français, ou un quartier/cité).
 */
export function matchEcomCommune(
  wilayaNameOrId: string | number,
  clientCommune: string,
  ecomCommunes: string[],
): string {
  if (!ecomCommunes.length) return "";
  const raw = (clientCommune || "").trim();
  if (!raw) return ecomCommunes[0];

  const clientLat = normalizeLatin(raw);
  const clientAr = normalizeArabic(raw);

  // 1. Correspondance exacte ou insensible aux accents/casse avec la liste E-com
  const exact = ecomCommunes.find(c => normalizeLatin(c) === clientLat || normalizeArabic(c) === clientAr);
  if (exact) return exact;

  // 2. Correspondance partielle directe en latin
  if (clientLat.length >= 3 && /[a-z]/.test(clientLat)) {
    const partial = ecomCommunes.find(
      c => normalizeLatin(c).includes(clientLat) || clientLat.includes(normalizeLatin(c)),
    );
    if (partial) return partial;
  }

  // 3. Si la commune est en arabe, on compare la translittération phonétique et la position dans abayaCommunesByWilaya
  const wid = typeof wilayaNameOrId === "number" ? wilayaNameOrId : wilayaIdFromName(wilayaNameOrId, clientCommune);
  const canonicalWilaya = wid ? abayaWilayas[wid - 1] : undefined;
  const officialArCommunes = canonicalWilaya ? (abayaCommunesByWilaya[canonicalWilaya] ?? []) : [];

  const translitClient = transliterateArabicToLatin(raw);
  const translitClientNoAl = transliterateArabicToLatin(clientAr.replace(/^ال/, ""));
  const skelClient = consonantSkeleton(translitClient);
  const skelClientNoAl = consonantSkeleton(translitClientNoAl);

  let bestMatch = "";
  let bestScore = 0;

  for (const ec of ecomCommunes) {
    const ecNorm = normalizeLatin(ec);
    const ecNoAl = ecNorm.replace(/^el\s+/, "");
    const ecSkel = consonantSkeleton(ecNorm);
    const ecSkelNoAl = consonantSkeleton(ecNoAl);

    let score = 0;
    if (ecNorm === translitClient || ecNoAl === translitClientNoAl) {
      score = 100;
    } else if (ecNorm.includes(translitClientNoAl) && translitClientNoAl.length >= 4) {
      score = 85;
    } else if (translitClient.includes(ecNoAl) && ecNoAl.length >= 4) {
      score = 80;
    } else if (ecSkel.length >= 3 && (ecSkel === skelClient || ecSkelNoAl === skelClientNoAl)) {
      score = 75;
    } else if (ecSkelNoAl.length >= 3 && skelClientNoAl.length >= 3 && (ecSkelNoAl.startsWith(skelClientNoAl) || skelClientNoAl.startsWith(ecSkelNoAl))) {
      score = 60;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = ec;
    }
  }

  if (bestScore >= 60 && bestMatch) {
    return bestMatch;
  }

  // 4. Si le client a écrit le chef-lieu ou une cité ("Hay ...", "Cite ..."), on sélectionne la commune chef-lieu de la wilaya
  if (wid && WILAYA_FRENCH_NAMES[wid]) {
    const chefLieuFr = normalizeLatin(WILAYA_FRENCH_NAMES[wid]);
    const chefLieuMatch = ecomCommunes.find(c => {
      const n = normalizeLatin(c);
      return n === chefLieuFr || n.includes(chefLieuFr) || (wid === 16 && n.includes("alger"));
    });
    if (chefLieuMatch) return chefLieuMatch;
  }

  // 5. Fallback par index proportionnel si la commune fait partie de la liste officielle arabe
  const arIdx = officialArCommunes.findIndex(c => normalizeArabic(c) === clientAr);
  if (arIdx >= 0 && officialArCommunes.length === ecomCommunes.length) {
    return ecomCommunes[arIdx];
  }

  return ecomCommunes[0];
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

import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const DATA_DIR = path.resolve(process.cwd(), ".data");
const RUNTIME_KEY_FILE = path.join(DATA_DIR, "gemini-runtime.json");

const TEXT_VISION_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
] as const;

const IMAGE_EDIT_MODEL = "gemini-nano-banana-2.1";

export const aiTemplateSchema = z.enum([
  "doudoune",
  "extensions",
  "abaya",
  "coat",
  "badil",
  "pyjama",
]);

export const generateLandingDraftInputSchema = z.object({
  imageDataUrl: z.string().min(20).max(12_000_000),
  description: z.string().trim().min(3).max(2000),
  variantsHint: z.string().trim().max(600).optional().default(""),
  price: z.number().int().min(0).max(1_000_000).optional(),
  packPrice: z.number().int().min(0).max(2_000_000).optional(),
  templateId: aiTemplateSchema,
  generateStudioImages: z.boolean().optional().default(false),
});

export type GenerateLandingDraftInput = z.infer<typeof generateLandingDraftInputSchema>;

type GeneratedDraftSchemaOutput = {
  name: string;
  arName: string;
  slug: string;
  category: "mode" | "vestes" | "beaute" | "lentilles" | "extensions";
  categoryLabel: string;
  arCategoryLabel: string;
  badge: string;
  description: string;
  arDescription: string;
  suggestedPrice: number;
  suggestedOldPrice: number;
  suggestedPackPrice: number;
  details: string[];
  heroHeadlineAr: string;
  heroSubheadlineAr: string;
  heroBadgeAr: string;
  promoBannerAr: string;
  ctaLabelAr: string;
  offer1LabelAr: string;
  offer2LabelAr: string;
  colorSwatches: Array<{ name: string; hex: string }>;
  sizes: Array<{ label: string; hint: string }>;
  trustItems: Array<{ icon: string; label: string }>;
  reviews: Array<{ author: string; city: string; rating: number; text: string }>;
};

const LANDING_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", description: "Nom commercial court en français (2-5 mots)" },
    arName: { type: "string", description: "Nom commercial accrocheur en arabe (2-5 mots)" },
    slug: { type: "string", description: "Slug URL kebab-case ASCII sans accents ni espaces" },
    category: { type: "string", enum: ["mode", "vestes", "beaute", "lentilles", "extensions"] },
    categoryLabel: { type: "string", description: "Label catégorie court en français" },
    arCategoryLabel: { type: "string", description: "Label catégorie court en arabe" },
    badge: { type: "string", description: "Badge promo court ex: عرض خاص ou 2+1 مجاناً" },
    description: { type: "string", description: "Description commerciale courte en français (1-2 phrases)" },
    arDescription: { type: "string", description: "Description commerciale persuasive en arabe algérien/moderne" },
    suggestedPrice: { type: "integer", description: "Prix unitaire en DZD" },
    suggestedOldPrice: { type: "integer", description: "Ancien prix barré plus élevé en DZD" },
    suggestedPackPrice: { type: "integer", description: "Prix offre duo ou 2+1 en DZD (0 si offre simple)" },
    details: {
      type: "array",
      items: { type: "string" },
      description: "4 à 5 avantages produit courts en arabe orientés conversion",
    },
    heroHeadlineAr: { type: "string", description: "Titre principal Hero en arabe très accrocheur" },
    heroSubheadlineAr: { type: "string", description: "Sous-titre Hero persuasif en arabe" },
    heroBadgeAr: { type: "string", description: "Mini badge urgence ou qualité en arabe" },
    promoBannerAr: { type: "string", description: "Texte ruban offre en arabe (paiement à la livraison + remise)" },
    ctaLabelAr: { type: "string", description: "Texte bouton commande en arabe ex: اطلبي الآن 👆" },
    offer1LabelAr: { type: "string", description: "Libellé offre 1 pièce ex: قطعة واحدة" },
    offer2LabelAr: { type: "string", description: "Libellé offre 2 pièces ou pack ex: قطعتان بسعر مخفض" },
    colorSwatches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "Nom de la couleur ou variante en arabe" },
          hex: { type: "string", description: "Code couleur hexadécimal valide ex: #e0145f" },
        },
        required: ["name", "hex"],
      },
      description: "Couleurs ou variantes détectées / demandées (au moins 1)",
    },
    sizes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string", description: "Taille ex: S, M, L, XL ou 36, 37... ou vide si cosmétique" },
          hint: { type: "string", description: "Indication poids/mesure ex: 50-60 Kg ou vide" },
        },
        required: ["label", "hint"],
      },
      description: "Tailles si le produit est un vêtement/chaussure, tableau vide [] si cosmétique/accessoire sans taille",
    },
    trustItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          icon: { type: "string", description: "Un seul emoji ex: 🚚" },
          label: { type: "string", description: "Libellé confiance court en arabe" },
        },
        required: ["icon", "label"],
      },
      description: "Exactement 3 badges de réassurance en arabe",
    },
    reviews: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          author: { type: "string", description: "Prénom féminin algérien + initiale ex: سارة ب." },
          city: { type: "string", description: "Wilaya algérienne ex: الجزائر العاصمة" },
          rating: { type: "integer", description: "Note sur 5 (5)" },
          text: { type: "string", description: "Avis naturel et crédible en arabe algérien" },
        },
        required: ["author", "city", "rating", "text"],
      },
      description: "Exactement 3 avis clientes crédibles adaptés à ce produit",
    },
  },
  required: [
    "name",
    "arName",
    "slug",
    "category",
    "categoryLabel",
    "arCategoryLabel",
    "badge",
    "description",
    "arDescription",
    "suggestedPrice",
    "suggestedOldPrice",
    "suggestedPackPrice",
    "details",
    "heroHeadlineAr",
    "heroSubheadlineAr",
    "heroBadgeAr",
    "promoBannerAr",
    "ctaLabelAr",
    "offer1LabelAr",
    "offer2LabelAr",
    "colorSwatches",
    "sizes",
    "trustItems",
    "reviews",
  ],
};

function readRuntimeStoredKey(): string {
  try {
    if (!fs.existsSync(RUNTIME_KEY_FILE)) return "";
    const parsed = JSON.parse(fs.readFileSync(RUNTIME_KEY_FILE, "utf8")) as { apiKey?: string };
    return typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "";
  } catch {
    return "";
  }
}

export function getResolvedGeminiApiKey(): string {
  const fromEnv = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  if (fromEnv) return fromEnv;
  return readRuntimeStoredKey();
}

export function getAiKeyStatus() {
  const fromEnv = Boolean((process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim());
  const fromRuntime = Boolean(!fromEnv && readRuntimeStoredKey());
  return {
    configured: fromEnv || fromRuntime,
    source: fromEnv ? ("env" as const) : fromRuntime ? ("runtime" as const) : ("none" as const),
    textModels: [...TEXT_VISION_MODELS],
    imageModel: IMAGE_EDIT_MODEL,
  };
}

export async function saveRuntimeGeminiKey(rawKey: string) {
  const apiKey = rawKey.trim();
  if (!apiKey || apiKey.length < 16) {
    throw new Error("Clé API Gemini invalide.");
  }
  const ai = new GoogleGenAI({ apiKey });
  await ai.interactions.create({
    model: "gemini-3.5-flash-lite",
    input: "OK",
    store: false,
  });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(RUNTIME_KEY_FILE, JSON.stringify({ apiKey, savedAt: new Date().toISOString() }, null, 2), "utf8");
  return getAiKeyStatus();
}

async function resolveImagePayload(imageDataUrl: string): Promise<{ mimeType: string; base64: string }> {
  const dataMatch = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (dataMatch) {
    return { mimeType: dataMatch[1], base64: dataMatch[2] };
  }
  if (/^https?:\/\//i.test(imageDataUrl)) {
    const res = await fetch(imageDataUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error("Impossible de télécharger l'image fournie.");
    const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    return { mimeType, base64: buf.toString("base64") };
  }
  throw new Error("Format d'image invalide. Importe une photo JPG, PNG ou WebP.");
}

function sanitizeSlug(raw: string, fallbackName: string): string {
  const candidate = (raw || fallbackName || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return candidate || `produit-${Date.now()}`;
}

function normalizeHex(rawHex: string | undefined, idx: number): string {
  const cleaned = (rawHex || "").trim();
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(cleaned)) return cleaned;
  const fallbacks = ["#111827", "#f8fafc", "#e0145f", "#0d6b4b", "#d4a73c", "#8b5cf6"];
  return fallbacks[idx % fallbacks.length];
}

function templateInstruction(templateId: GenerateLandingDraftInput["templateId"]): string {
  switch (templateId) {
    case "pyjama":
      return "Template Style Rose & Or Multi-couleurs + Tailles : très populaire en mobile Ads (offres 1 pièce vs Pack duo/2+1, choix multi-couleurs, tailles avec fourchette poids si vêtement, confiance COD).";
    case "badil":
      return "Template Style Beauté & Soin Rose/Or Haute Conversion : direct, offres duo/2+1, axé bénéfices rapides et résultat visuel.";
    case "abaya":
      return "Template Style Mode & Lookbook Luxe Émeraude/Or : positionnement premium/royal, détails qualité, preuve sociale forte (avis clientes algériennes), échange garanti.";
    case "doudoune":
      return "Template Style Offre Urgence + Pack Duo : urgence temporelle, mise en avant nette du Pack 2 pièces (économie immédiate).";
    case "extensions":
      return "Template Style 1 Achetée = 1 Offerte (ou Duo Variantes) : orienté choix de 2 teintes/variantes au meilleur prix pack.";
    case "coat":
      return "Template Style Éditorial Chic & Focus Détails 360° : mise en avant de la coupe, finitions, confort et style raffiné.";
  }
}

export async function generateLandingDraft(input: GenerateLandingDraftInput) {
  const parsedInput = generateLandingDraftInputSchema.parse(input);
  const apiKey = getResolvedGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Clé API Gemini manquante. Ajoute GEMINI_API_KEY dans Render (ou saisis-la ci-dessous)."
    );
  }

  const { mimeType, base64 } = await resolveImagePayload(parsedInput.imageDataUrl);
  const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });

  const priceHint = parsedInput.price && parsedInput.price > 0
    ? `Prix unitaire souhaité par le vendeur : ${parsedInput.price} DA.`
    : "Estime un prix cohérent avec le marché e-commerce algérien (entre 1500 et 9500 DA).";
  const packHint = parsedInput.packPrice && parsedInput.packPrice > 0
    ? `Prix Pack / Duo souhaité : ${parsedInput.packPrice} DA.`
    : "Propose un prix Pack avantageux (ex: ~1.65x le prix unitaire) pour booster le panier moyen.";

  const prompt = [
    "Tu es le meilleur expert e-commerce COD (Cash On Delivery) en Algérie pour la boutique féminine Miss Sensuelle.",
    "Analyse attentivement la PHOTO PRODUIT ci-jointe ainsi que les notes du vendeur, puis génère TOUTE la structure marketing de la landing page au format JSON strict.",
    "",
    `Style de Template choisi : ${templateInstruction(parsedInput.templateId)}`,
    `Description vendeur : ${parsedInput.description}`,
    parsedInput.variantsHint ? `Variantes / couleurs / tailles indiquées : ${parsedInput.variantsHint}` : "Déduis les variantes/couleurs/tailles logiques d'après le produit visible sur la photo.",
    priceHint,
    packHint,
    "",
    "Règles importantes :",
    "- Rédige les textes clients dans un arabe fluide, chaleureux et persuasif (style Algérie e-commerce féminin) + un titre/description courts en français pour le catalogue admin.",
    "- Pas de promesses médicales trompeuses.",
    "- Pour `sizes` : si c'est un vêtement (robe, pyjama, abaya, veste, manteau), mets ex: S (45-55 Kg), M (55-65 Kg), L (65-75 Kg), XL (75-85 Kg). Si c'est chaussures, mets 36 à 41. Si c'est beauté/soin/sac/extension/bijou sans taille, renvoie `[]`.",
    "- Pour `colorSwatches` : respecte les couleurs citées par le vendeur ou visibles sur la photo, avec un `hex` précis pour chacune.",
    "- Pour `reviews` : 3 avis de clientes algériennes (Alger, Oran, Constantine, Blida, Sétif...) parlant exactement de ce produit.",
  ].join("\n");

  let resultData: GeneratedDraftSchemaOutput | null = null;
  let modelUsed = "";
  let lastError: unknown = null;

  for (const model of TEXT_VISION_MODELS) {
    try {
      const interaction = await ai.interactions.create({
        model,
        store: false,
        response_format: LANDING_JSON_SCHEMA,
        input: [
          { type: "text", text: prompt },
          { type: "image", data: base64, mime_type: mimeType },
        ],
      });
      const text = interaction.output_text?.trim();
      if (!text) {
        throw new Error(`Réponse vide reçue de ${model}`);
      }
      resultData = JSON.parse(text) as GeneratedDraftSchemaOutput;
      modelUsed = model;
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!resultData) {
    const msg = lastError instanceof Error ? lastError.message : "Échec de génération IA Gemini.";
    throw new Error(`Impossible de générer la landing page : ${msg}`);
  }

  const finalPrice =
    parsedInput.price && parsedInput.price > 0 ? parsedInput.price : Math.max(500, Math.round(resultData.suggestedPrice || 2500));
  const finalPackPrice =
    parsedInput.packPrice && parsedInput.packPrice > 0
      ? parsedInput.packPrice
      : Math.max(0, Math.round(resultData.suggestedPackPrice || Math.round(finalPrice * 1.65)));
  const finalOldPrice = Math.max(finalPrice + 500, Math.round(resultData.suggestedOldPrice || Math.round(finalPrice * 1.4)));

  const cleanSwatches = (resultData.colorSwatches ?? [])
    .filter(s => s?.name?.trim())
    .slice(0, 6)
    .map((s, idx) => ({
      name: s.name.trim(),
      hex: normalizeHex(s.hex, idx),
    }));
  if (cleanSwatches.length === 0) {
    cleanSwatches.push({ name: "الأصلية", hex: "#e0145f" });
  }

  const cleanSizes = (resultData.sizes ?? [])
    .filter(s => s?.label?.trim())
    .slice(0, 6)
    .map(s => ({ label: s.label.trim(), hint: (s.hint || "").trim() || undefined }));

  const generatedImages: string[] = [];
  let imageNotice = "";

  if (parsedInput.generateStudioImages) {
    try {
      const imgPrompt = `Create a luxury feminine e-commerce studio product hero banner photograph featuring this exact product cleanly centered on a soft editorial pastel-and-gold studio pedestal with subtle warm rim lighting. Keep the product identity, texture, pattern, and silhouette 100% faithful to the reference image. No watermarks, no random text.`;
      const imgInteraction = await ai.interactions.create({
        model: IMAGE_EDIT_MODEL,
        store: false,
        response_modalities: ["image"],
        input: [
          { type: "text", text: imgPrompt },
          { type: "image", data: base64, mime_type: mimeType },
        ],
      });
      const outImg = imgInteraction.output_image;
      if (outImg?.data) {
        const outMime = outImg.mime_type || "image/png";
        generatedImages.push(`data:${outMime};base64,${outImg.data}`);
      }
    } catch (err) {
      const errText = err instanceof Error ? err.message : String(err);
      if (errText.includes("429") || errText.toLowerCase().includes("free tier") || errText.toLowerCase().includes("rate limit")) {
        imageNotice =
          "Génération d'images IA (Nano Banana 2.1) non disponible en Free Tier sans crédit $5 sur Google AI Studio. Ta photo d'origine a été intégrée automatiquement dans le template.";
      } else {
        imageNotice = `Visuels IA optionnels non générés (${errText.slice(0, 120)}). Photo d'origine conservée.`;
      }
    }
  }

  const slug = sanitizeSlug(resultData.slug, resultData.name);

  return {
    name: resultData.name.trim(),
    arName: resultData.arName.trim(),
    slug,
    category: resultData.category,
    categoryLabel: resultData.categoryLabel.trim() || "Mode femme",
    arCategoryLabel: resultData.arCategoryLabel.trim() || "أزياء وجمال",
    badge: resultData.badge.trim() || "عرض خاص",
    description: resultData.description.trim(),
    arDescription: resultData.arDescription.trim(),
    price: finalPrice,
    oldPrice: finalOldPrice,
    packPrice: finalPackPrice > 0 ? finalPackPrice : undefined,
    details: (resultData.details ?? []).map(d => d.trim()).filter(Boolean).slice(0, 6),
    colors: cleanSwatches.map(c => c.name),
    generatedImages,
    imageNotice,
    modelUsed,
    landingConfig: {
      heroHeadlineAr: resultData.heroHeadlineAr.trim(),
      heroSubheadlineAr: resultData.heroSubheadlineAr.trim(),
      heroBadgeAr: resultData.heroBadgeAr.trim(),
      promoBannerAr: resultData.promoBannerAr.trim(),
      ctaLabelAr: resultData.ctaLabelAr.trim() || "اطلبي الآن 👆",
      offer1LabelAr: resultData.offer1LabelAr.trim() || "قطعة واحدة",
      offer2LabelAr: resultData.offer2LabelAr.trim() || "قطعتان بسعر مخفض",
      colorSwatches: cleanSwatches,
      sizes: cleanSizes,
      trustItems: (resultData.trustItems ?? []).slice(0, 3),
      reviews: (resultData.reviews ?? []).slice(0, 3),
      aiGeneratedAt: new Date().toISOString(),
      aiModel: modelUsed,
    },
  };
}

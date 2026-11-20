import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  ImagePlus,
  KeyRound,
  Loader2,
  Plus,
  Settings2,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import type {
  LandingTemplateId,
  Product,
  ProductLandingConfig,
} from "@/lib/store-data";

export type AiTemplateId =
  | "pyjama"
  | "badil"
  | "abaya"
  | "doudoune"
  | "extensions"
  | "coat";

export type AiTemplateMeta = {
  id: AiTemplateId;
  title: string;
  subtitle: string;
  bestFor: string;
  previewImage: string;
  accentColor: string;
  secondaryColor: string;
  bgGradient: string;
  hasPackOffer: boolean;
};

export const AI_WIZARD_TEMPLATES: AiTemplateMeta[] = [
  {
    id: "pyjama",
    title: "Rose & Or · Multi-couleurs",
    subtitle: "Landing mobile RTL ultra-rapide avec sélection de couleurs & tailles",
    bestFor: "Pyjamas, Lingerie, Ensembles",
    previewImage: "/images/pyjama/01-pyjama.jpg",
    accentColor: "#e0145f",
    secondaryColor: "#d4a73c",
    bgGradient: "linear-gradient(135deg, #fff1f5 0%, #ffdbe7 100%)",
    hasPackOffer: true,
  },
  {
    id: "badil",
    title: "Beauté Rose & Or · 2+1",
    subtitle: "Design cosmétique haute conversion avec offres Duo / 2+1 & communes",
    bestFor: "Beauté, Soins, Maquillage",
    previewImage: "/images/badil/01-badil.jpg",
    accentColor: "#ff2d78",
    secondaryColor: "#d4a73c",
    bgGradient: "linear-gradient(135deg, #fff0f6 0%, #ffd4e3 100%)",
    hasPackOffer: true,
  },
  {
    id: "abaya",
    title: "Émeraude & Or Royal",
    subtitle: "Lookbook luxe avec ruban royal, compteur & avis clientes vérifiées",
    bestFor: "Abayas, Robes, Tenues Chic",
    previewImage: "/manus-storage/v-hero_de8d807e.jpg",
    accentColor: "#0c6b4b",
    secondaryColor: "#c9a23f",
    bgGradient: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
    hasPackOffer: false,
  },
  {
    id: "doudoune",
    title: "Urgence & Pack Duo",
    subtitle: "Compte à rebours d'urgence + offre 2ème pièce à prix réduit",
    bestFor: "Vestes, Doudounes, Bestsellers",
    previewImage: "/manus-storage/doudoune-bg.jpg",
    accentColor: "#17307e",
    secondaryColor: "#e0112b",
    bgGradient: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
    hasPackOffer: true,
  },
  {
    id: "extensions",
    title: "Slider Variantes · 1+1",
    subtitle: "Carousel horizontal des teintes/variantes + offre 1 achetée = 1 offerte",
    bestFor: "Extensions, Accessoires, Teintes",
    previewImage: "/manus-storage/ext-m2-hero.jpg",
    accentColor: "#b45309",
    secondaryColor: "#d49b27",
    bgGradient: "linear-gradient(135deg, #fffbeb 0%, #fde68a 100%)",
    hasPackOffer: true,
  },
  {
    id: "coat",
    title: "Éditorial Chic 360°",
    subtitle: "Présentation éditoriale élégante avec points forts & pastilles couleurs",
    bestFor: "Manteaux, Blazers, Prêt-à-porter",
    previewImage: "/manus-storage/1000012735_a03c5d58.jpg",
    accentColor: "#6d28d9",
    secondaryColor: "#111827",
    bgGradient: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
    hasPackOffer: false,
  },
];

const QUICK_IDEAS = [
  {
    label: "Pyjama / Détente",
    template: "pyjama" as AiTemplateId,
    description:
      "Ensemble pyjama d'été en satin doux et respirant avec finition dentelle élégante, ultra confortable pour la maison.",
    variants: "Rose poudré, Noir, Champagne, Mauve · Tailles S à XL",
  },
  {
    label: "Sérum / Beauté",
    template: "badil" as AiTemplateId,
    description:
      "Soin beauté éclat naturel à absorption rapide, hydrate en profondeur et illumine le teint dès les premières utilisations.",
    variants: "",
  },
  {
    label: "Abaya / Robe",
    template: "abaya" as AiTemplateId,
    description:
      "Abaya fluide coupe royale au tombé impeccable, tissu léger infroissable idéal pour sorties et occasions.",
    variants: "Émeraude, Noir, Beige · Tailles S à XXL",
  },
  {
    label: "Veste / Manteau",
    template: "doudoune" as AiTemplateId,
    description:
      "Veste chaude et légère coupe moderne avec finitions soignées, parfaite pour l'automne et l'hiver.",
    variants: "Noir, Blanc cassé, Bleu ciel · Tailles S à XL",
  },
];

function toAiTemplateId(tpl?: LandingTemplateId): AiTemplateId {
  if (
    tpl === "pyjama" ||
    tpl === "badil" ||
    tpl === "abaya" ||
    tpl === "doudoune" ||
    tpl === "extensions" ||
    tpl === "coat"
  ) {
    return tpl;
  }
  return "pyjama";
}

function compressImageFile(file: File, maxDim = 1080, quality = 0.84): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = String(reader.result || "");
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const webp = canvas.toDataURL("image/webp", quality);
          if (webp && webp.startsWith("data:image/webp") && webp.length < rawDataUrl.length) {
            resolve(webp);
            return;
          }
          const jpeg = canvas.toDataURL("image/jpeg", quality);
          resolve(jpeg.length < rawDataUrl.length ? jpeg : rawDataUrl);
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function AiLandingCreatorWizard({
  initialTemplate,
  initialProduct,
  onCancel,
  onPublish,
  onOpenAdvanced,
}: {
  initialTemplate?: LandingTemplateId;
  initialProduct?: Product | null;
  onCancel: () => void;
  onPublish: (product: Product) => void;
  onOpenAdvanced: (product: Product) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [templateId, setTemplateId] = useState<AiTemplateId>(() =>
    toAiTemplateId(initialProduct?.landingTemplate ?? initialTemplate)
  );
  const [photoDataUrl, setPhotoDataUrl] = useState<string>(() => initialProduct?.image || "");
  const [description, setDescription] = useState<string>(
    () => initialProduct?.arDescription || initialProduct?.description || ""
  );
  const [variantsHint, setVariantsHint] = useState<string>(
    () => (initialProduct?.colors ?? []).join(", ")
  );
  const [unitPriceInput, setUnitPriceInput] = useState<string>(
    () => (initialProduct?.price && initialProduct.price > 0 ? String(initialProduct.price) : "")
  );
  const [packPriceInput, setPackPriceInput] = useState<string>(() =>
    initialProduct?.packPrice && initialProduct.packPrice > 0
      ? String(initialProduct.packPrice)
      : ""
  );
  const [generateStudioImages, setGenerateStudioImages] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [noticeMsg, setNoticeMsg] = useState("");
  const [showKeyBox, setShowKeyBox] = useState(false);
  const [runtimeKey, setRuntimeKey] = useState("");
  const [draftProduct, setDraftProduct] = useState<Product | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [newSizeLabel, setNewSizeLabel] = useState("");
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#e0145f");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const aiStatusQuery = trpc.admin.aiStatus.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const saveAiKeyMutation = trpc.admin.saveAiKey.useMutation({
    onSuccess: () => {
      void aiStatusQuery.refetch();
      setRuntimeKey("");
      setShowKeyBox(false);
      setErrorMsg("");
      setNoticeMsg(
        "Clé Gemini activée sur ce serveur ✅ (ajoute aussi GEMINI_API_KEY dans Render → Environment Variables pour qu'elle reste après redémarrage)."
      );
    },
    onError: err => {
      setErrorMsg(err.message || "Clé API Gemini refusée.");
    },
  });

  const generateMutation = trpc.admin.generateLandingDraft.useMutation();

  const activeTpl =
    AI_WIZARD_TEMPLATES.find(t => t.id === templateId) ?? AI_WIZARD_TEMPLATES[0];

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsCompressing(true);
    setErrorMsg("");
    const compressed = await compressImageFile(files[0], 1080, 0.84);
    setPhotoDataUrl(compressed);
    setIsCompressing(false);
  };

  const handleGenerate = async () => {
    if (!photoDataUrl) {
      setErrorMsg("Importe d'abord 1 photo du produit.");
      setStep(1);
      return;
    }
    if (description.trim().length < 3) {
      setErrorMsg("Ajoute une courte description (au moins 3 caractères).");
      setStep(1);
      return;
    }
    setErrorMsg("");
    setNoticeMsg("");

    const parsedUnit = Number(unitPriceInput);
    const parsedPack = Number(packPriceInput);

    try {
      const draft = await generateMutation.mutateAsync({
        imageDataUrl: photoDataUrl,
        description: description.trim(),
        variantsHint: variantsHint.trim(),
        price: Number.isFinite(parsedUnit) && parsedUnit > 0 ? Math.round(parsedUnit) : undefined,
        packPrice: Number.isFinite(parsedPack) && parsedPack > 0 ? Math.round(parsedPack) : undefined,
        templateId,
        generateStudioImages,
      });

      const primaryPhoto = draft.generatedImages?.[0] || photoDataUrl;
      const mergedGallery = Array.from(
        new Set([photoDataUrl, ...(draft.generatedImages ?? [])].filter(Boolean))
      );

      const rawSwatches = draft.landingConfig?.colorSwatches ?? [];
      const hasVariants =
        Boolean(variantsHint.trim()) ||
        rawSwatches.length > 1 ||
        Boolean(rawSwatches[0]?.name && rawSwatches[0].name !== "الأصلية");

      const swatches = hasVariants ? rawSwatches : [];
      const builtVariants = swatches.map((sw, idx) => ({
        name: sw.name,
        image: draft.generatedImages?.[idx] || photoDataUrl,
      }));

      const builtProduct: Product = {
        id: initialProduct?.id || `p-${Date.now()}`,
        slug: initialProduct?.id ? initialProduct.slug : draft.slug,
        name: draft.name,
        arName: draft.arName,
        category: draft.category,
        categoryLabel: draft.categoryLabel,
        arCategoryLabel: draft.arCategoryLabel,
        badge: draft.badge,
        description: draft.description,
        arDescription: draft.arDescription,
        price: draft.price,
        oldPrice: draft.oldPrice,
        packPrice: draft.packPrice,
        image: primaryPhoto,
        gallery: mergedGallery,
        details: draft.details,
        colors: swatches.map(s => s.name),
        variantImages: builtVariants,
        accent: activeTpl.accentColor,
        stock: initialProduct?.stock ?? 25,
        landingTemplate: templateId,
        landingConfig: {
          ...draft.landingConfig,
          colorSwatches: swatches,
        },
      };

      setDraftProduct(builtProduct);
      setStep(3);
      if (draft.imageNotice) {
        setNoticeMsg(`✨ Page générée avec ${draft.modelUsed} ! (${draft.imageNotice})`);
      } else {
        setNoticeMsg(`✨ Page générée avec ${draft.modelUsed} !`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erreur lors de la génération IA.");
    }
  };

  const updateDraft = <K extends keyof Product>(key: K, value: Product[K]) => {
    setDraftProduct(curr => (curr ? { ...curr, [key]: value } : curr));
  };

  const updateConfig = <K extends keyof ProductLandingConfig>(
    key: K,
    value: ProductLandingConfig[K]
  ) => {
    setDraftProduct(curr =>
      curr
        ? {
            ...curr,
            landingConfig: {
              ...(curr.landingConfig ?? {}),
              [key]: value,
            },
          }
        : curr
    );
  };

  const handleRemoveColor = (index: number) => {
    if (!draftProduct) return;
    const nextSwatches = (draftProduct.landingConfig?.colorSwatches ?? []).filter(
      (_, i) => i !== index
    );
    setDraftProduct({
      ...draftProduct,
      colors: nextSwatches.map(s => s.name),
      variantImages: nextSwatches.map(s => ({ name: s.name, image: draftProduct.image })),
      landingConfig: {
        ...(draftProduct.landingConfig ?? {}),
        colorSwatches: nextSwatches,
      },
    });
  };

  const handleAddColor = () => {
    if (!draftProduct || !newColorName.trim()) return;
    const name = newColorName.trim();
    const nextSwatches = [
      ...(draftProduct.landingConfig?.colorSwatches ?? []),
      { name, hex: newColorHex },
    ];
    setDraftProduct({
      ...draftProduct,
      colors: nextSwatches.map(s => s.name),
      variantImages: nextSwatches.map(s => ({ name: s.name, image: draftProduct.image })),
      landingConfig: {
        ...(draftProduct.landingConfig ?? {}),
        colorSwatches: nextSwatches,
      },
    });
    setNewColorName("");
  };

  const handleAddSize = () => {
    if (!draftProduct || !newSizeLabel.trim()) return;
    const nextSizes = [
      ...(draftProduct.landingConfig?.sizes ?? []),
      { label: newSizeLabel.trim() },
    ];
    updateConfig("sizes", nextSizes);
    setNewSizeLabel("");
  };

  const handlePublishNow = () => {
    if (!draftProduct) return;
    onPublish(draftProduct);
    setPublishedSlug(draftProduct.slug);
  };

  if (publishedSlug) {
    const publicPath = `/produit/${publishedSlug}`;
    const fullUrl = `${window.location.origin}${publicPath}`;
    return (
      <div
        className="ai-wizard-shell"
        style={{
          background: "linear-gradient(135deg, #fff5f8 0%, #ffffff 55%, #ecfdf5 100%)",
          border: "1.5px solid rgba(16, 185, 129, 0.38)",
          borderRadius: 22,
          padding: 28,
          textAlign: "center",
          display: "grid",
          gap: 14,
          justifyItems: "center",
        }}
      >
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 12px 28px rgba(16,185,129,0.28)",
          }}
        >
          <Check size={28} />
        </div>
        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
          Ta Landing Page IA est en ligne ! 🚀
        </h3>
        <p style={{ margin: 0, color: "#475569", maxWidth: 520, fontSize: 14 }}>
          Le produit est enregistré avec formulaire COD 58 wilayas, suivi paniers abandonnés et Meta / TikTok Pixels prêts pour tes campagnes.
        </p>
        <div
          dir="ltr"
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "10px 16px",
            fontWeight: 700,
            fontSize: 13,
            color: "#0f172a",
            wordBreak: "break-all",
          }}
        >
          {fullUrl}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            className="button button-light"
            onClick={() => {
              void navigator.clipboard?.writeText(fullUrl);
              setCopiedLink(true);
              window.setTimeout(() => setCopiedLink(false), 2500);
            }}
          >
            <Copy size={15} /> {copiedLink ? "Lien copié ✓" : "Copier le lien TikTok/Meta"}
          </button>
          <a
            href={publicPath}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-gradient"
          >
            <ExternalLink size={15} /> Ouvrir la Landing Page
          </a>
          <button type="button" className="button button-dark" onClick={onCancel}>
            Retour au Catalogue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="ai-wizard-shell"
      style={{
        background: "linear-gradient(160deg, #ffffff 0%, #fff7fa 60%, #fdf8ee 100%)",
        border: "1.5px solid rgba(224, 20, 95, 0.24)",
        borderRadius: 22,
        padding: 20,
        boxShadow: "0 18px 46px rgba(15, 23, 42, 0.07)",
        display: "grid",
        gap: 18,
      }}
    >
      {/* En-tête Studio IA + Statut Gemini + Stepper 3 étapes */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          paddingBottom: 14,
          borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "linear-gradient(135deg, #e0145f, #d4a73c)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 8px 18px rgba(224,20,95,0.28)",
            }}
          >
            <Wand2 size={22} />
          </div>
          <div>
            <span className="eyebrow" style={{ color: "#be185d" }}>
              Studio IA Séparé · Mode Express
            </span>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              1 Photo → Landing Page COD en 10 secondes
            </h3>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              background: aiStatusQuery.data?.configured
                ? "rgba(16, 185, 129, 0.14)"
                : "rgba(245, 158, 11, 0.16)",
              color: aiStatusQuery.data?.configured ? "#065f46" : "#92400e",
            }}
          >
            {aiStatusQuery.data?.configured ? <Check size={14} /> : <KeyRound size={14} />}
            {aiStatusQuery.data?.configured
              ? `Gemini prêt (${aiStatusQuery.data.source === "env" ? "Env" : "Serveur"})`
              : "Clé Gemini requise"}
          </span>
          <button
            type="button"
            className="button button-light"
            style={{ padding: "6px 12px", fontSize: 12 }}
            onClick={() => setShowKeyBox(v => !v)}
          >
            <KeyRound size={13} /> Clé API
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onCancel}
            aria-label="Fermer le Studio IA"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {showKeyBox && (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: "#fff",
            border: "1px solid #e2e8f0",
            display: "grid",
            gap: 8,
          }}
        >
          <small style={{ color: "#475569", lineHeight: 1.5 }}>
            Colle ta clé Google AI Studio (<code>AQ...</code> ou <code>AIza...</code>). Pour qu'elle reste permanente sur Render, ajoute aussi <code>GEMINI_API_KEY</code> dans Render &rarr; Environment Variables.
          </small>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="password"
              value={runtimeKey}
              onChange={e => setRuntimeKey(e.target.value)}
              placeholder="Coller la clé API Gemini..."
              style={{
                flex: "1 1 240px",
                minHeight: 40,
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
              }}
            />
            <button
              type="button"
              className="button button-dark"
              disabled={saveAiKeyMutation.isPending || runtimeKey.trim().length < 16}
              onClick={() => saveAiKeyMutation.mutate({ apiKey: runtimeKey.trim() })}
            >
              {saveAiKeyMutation.isPending ? "Vérification..." : "Activer la clé"}
            </button>
          </div>
        </div>
      )}

      {/* Stepper visuel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
        }}
      >
        {[
          { n: 1 as const, label: "1. Photo & Infos" },
          { n: 2 as const, label: "2. Design & Génération" },
          { n: 3 as const, label: "3. Aperçu Mobile & Publier" },
        ].map(item => {
          const isCurrent = step === item.n;
          const isDone = step > item.n || (item.n === 3 && Boolean(draftProduct));
          const clickable = item.n < 3 || Boolean(draftProduct);
          return (
            <button
              key={item.n}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && setStep(item.n)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: isCurrent
                  ? "2px solid #e0145f"
                  : "1px solid rgba(15, 23, 42, 0.1)",
                background: isCurrent
                  ? "linear-gradient(135deg, rgba(224,20,95,0.12), rgba(212,167,60,0.12))"
                  : isDone
                    ? "rgba(16, 185, 129, 0.08)"
                    : "#fff",
                color: isCurrent ? "#9d174d" : isDone ? "#065f46" : "#64748b",
                fontWeight: 800,
                fontSize: 13,
                cursor: clickable ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {isDone && !isCurrent ? <Check size={14} /> : null}
              {item.label}
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.28)",
            color: "#b91c1c",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {noticeMsg && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(16,185,129,0.12)",
            border: "1px solid rgba(16,185,129,0.3)",
            color: "#065f46",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {noticeMsg}
        </div>
      )}

      {/* ÉTAPE 1 : PHOTO + INFOS PRODUIT */}
      {step === 1 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
            gap: 18,
          }}
        >
          {/* Dropzone Photo */}
          <div
            onDragOver={e => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setIsDragging(false);
              void handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: isDragging
                ? "2px solid #e0145f"
                : "2px dashed rgba(224,20,95,0.38)",
              borderRadius: 18,
              padding: 20,
              background: isDragging ? "rgba(224,20,95,0.06)" : "#fff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              minHeight: 260,
              cursor: "pointer",
              textAlign: "center",
              transition: "all .15s",
            }}
          >
            {photoDataUrl ? (
              <img
                src={photoDataUrl}
                alt="Photo produit"
                style={{
                  width: 175,
                  height: 175,
                  objectFit: "cover",
                  borderRadius: 16,
                  border: "2px solid #e0145f",
                  boxShadow: "0 10px 24px rgba(224,20,95,0.18)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 18,
                  background: "rgba(224,20,95,0.1)",
                  color: "#e0145f",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <ImagePlus size={32} />
              </div>
            )}
            <div>
              <strong style={{ display: "block", fontSize: 15, marginBottom: 4 }}>
                {isCompressing
                  ? "Compression HD en cours..."
                  : photoDataUrl
                    ? "Photo prête pour Gemini Vision ✓"
                    : "Dépose ou choisis 1 photo produit"}
              </strong>
              <small style={{ color: "#64748b", fontSize: 12 }}>
                L'IA analyse automatiquement la texture, les couleurs et le style sur ta photo.
              </small>
            </div>
            <button
              type="button"
              className="upload-inline"
              onClick={e => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload size={14} /> {photoDataUrl ? "Changer la photo" : "Choisir depuis l'appareil"}
            </button>
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept="image/*"
              onChange={e => void handleFiles(e.target.files)}
            />
          </div>

          {/* Infos rapides + Chips */}
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <div>
              <span style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                ⚡ Modèles d'inspiration rapide :
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {QUICK_IDEAS.map(idea => (
                  <button
                    key={idea.label}
                    type="button"
                    onClick={() => {
                      setDescription(idea.description);
                      setVariantsHint(idea.variants);
                      setTemplateId(idea.template);
                    }}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(224,20,95,0.28)",
                      background: "#fff",
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#9d174d",
                      cursor: "pointer",
                    }}
                  >
                    + {idea.label}
                  </button>
                ))}
              </div>
            </div>

            <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 700 }}>
              Décris ton produit en 1 ou 2 phrases *
              <textarea
                rows={4}
                placeholder="Ex: Ensemble pyjama été satin doux avec dentelle, léger et confortable pour la maison..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 700 }}>
              Variantes / Couleurs / Tailles (optionnel)
              <input
                placeholder="Ex: Noir, Rose, Beige · Tailles S à XL (laisse vide pour cosmétique)"
                value={variantsHint}
                onChange={e => setVariantsHint(e.target.value)}
                style={{
                  minHeight: 40,
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700 }}>
                Prix 1 pièce (DA, opt.)
                <input
                  type="number"
                  min="0"
                  placeholder="Suggéré par l'IA"
                  value={unitPriceInput}
                  onChange={e => setUnitPriceInput(e.target.value)}
                  style={{
                    minHeight: 40,
                    padding: "8px 12px",
                    borderRadius: 12,
                    border: "1px solid #cbd5e1",
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700 }}>
                Prix Pack / Duo (DA, opt.)
                <input
                  type="number"
                  min="0"
                  placeholder="Suggéré par l'IA"
                  value={packPriceInput}
                  onChange={e => setPackPriceInput(e.target.value)}
                  style={{
                    minHeight: 40,
                    padding: "8px 12px",
                    borderRadius: 12,
                    border: "1px solid #cbd5e1",
                  }}
                />
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 6 }}>
              <button
                type="button"
                className="button button-gradient"
                onClick={() => {
                  if (!photoDataUrl) {
                    setErrorMsg("Importe d'abord 1 photo du produit.");
                    return;
                  }
                  if (description.trim().length < 3) {
                    setErrorMsg("Écris une courte description du produit.");
                    return;
                  }
                  setErrorMsg("");
                  setStep(2);
                }}
              >
                Étape suivante : Choisir le Design <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÉTAPE 2 : CHOIX VISUEL DU TEMPLATE + GÉNÉRATION IA */}
      {step === 2 && (
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 12,
            }}
          >
            {AI_WIZARD_TEMPLATES.map(tpl => {
              const selected = templateId === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplateId(tpl.id)}
                  style={{
                    textAlign: "left",
                    borderRadius: 16,
                    padding: 12,
                    border: selected
                      ? `2.5px solid ${tpl.accentColor}`
                      : "1.5px solid #e2e8f0",
                    background: selected ? tpl.bgGradient : "#fff",
                    cursor: "pointer",
                    display: "grid",
                    gap: 8,
                    boxShadow: selected
                      ? `0 10px 24px ${tpl.accentColor}24`
                      : "0 2px 8px rgba(15,23,42,0.04)",
                  }}
                >
                  <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", height: 120 }}>
                    <img
                      src={tpl.previewImage}
                      alt={tpl.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        background: tpl.accentColor,
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 999,
                      }}
                    >
                      {tpl.bestFor}
                    </span>
                    {selected && (
                      <span
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          background: "#10b981",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 900,
                          padding: "3px 9px",
                          borderRadius: 999,
                        }}
                      >
                        ✓ Choisi
                      </span>
                    )}
                  </div>
                  <div>
                    <strong style={{ display: "block", fontSize: 14, color: "#0f172a" }}>
                      {tpl.title}
                    </strong>
                    <small style={{ display: "block", fontSize: 12, color: "#475569", marginTop: 2 }}>
                      {tpl.subtitle}
                    </small>
                  </div>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 14,
              background: "#fff",
              border: "1px solid #e2e8f0",
            }}
          >
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={generateStudioImages}
                onChange={e => setGenerateStudioImages(e.target.checked)}
              />
              Générer un visuel studio IA (Nano Banana 2.1 — nécessite compte Google AI Studio facturé $5+)
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="button button-light"
                onClick={() => setStep(1)}
              >
                <ArrowLeft size={15} /> Retour
              </button>
              <button
                type="button"
                className="button button-gradient"
                disabled={generateMutation.isPending || !aiStatusQuery.data?.configured}
                onClick={() => void handleGenerate()}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="spin" /> Génération IA en cours (3–8 s)...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Générer ma Landing Page par IA
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÉTAPE 3 : APERÇU MOBILE LIVE + ÉDITION RAPIDE + PUBLICATION */}
      {step === 3 && draftProduct && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* Panneau d'édition rapide */}
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong style={{ fontSize: 15 }}>✏️ Ajustement rapide avant publication</strong>
              <button
                type="button"
                className="button button-light"
                style={{ padding: "5px 10px", fontSize: 12 }}
                onClick={() => setStep(2)}
              >
                Changer de template / Re-générer
              </button>
            </div>

            <div className="product-admin-grid">
              <label>
                Nom Produit (FR)
                <input
                  value={draftProduct.name}
                  onChange={e => updateDraft("name", e.target.value)}
                />
              </label>
              <label>
                Slug URL
                <input
                  dir="ltr"
                  value={draftProduct.slug}
                  onChange={e => updateDraft("slug", e.target.value)}
                />
              </label>
              <label>
                Prix 1 Pièce (DA)
                <input
                  type="number"
                  min="0"
                  value={draftProduct.price}
                  onChange={e => updateDraft("price", Number(e.target.value) || 0)}
                />
              </label>
              <label>
                Ancien Prix Barré (DA)
                <input
                  type="number"
                  min="0"
                  value={draftProduct.oldPrice ?? ""}
                  onChange={e =>
                    updateDraft("oldPrice", e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </label>
              <label>
                Prix Pack / Offre 2 (DA)
                <input
                  type="number"
                  min="0"
                  value={draftProduct.packPrice ?? ""}
                  onChange={e =>
                    updateDraft("packPrice", e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </label>
              <label>
                Bouton CTA (Arabe)
                <input
                  dir="rtl"
                  value={draftProduct.landingConfig?.ctaLabelAr ?? ""}
                  onChange={e => updateConfig("ctaLabelAr", e.target.value)}
                />
              </label>
              <label className="wide-field">
                Titre Hero Arabe
                <input
                  dir="rtl"
                  value={draftProduct.landingConfig?.heroHeadlineAr ?? ""}
                  onChange={e => updateConfig("heroHeadlineAr", e.target.value)}
                />
              </label>
              <label className="wide-field">
                Sous-titre Hero Arabe
                <input
                  dir="rtl"
                  value={draftProduct.landingConfig?.heroSubheadlineAr ?? ""}
                  onChange={e => updateConfig("heroSubheadlineAr", e.target.value)}
                />
              </label>
              <label>
                Offre 1 (AR)
                <input
                  dir="rtl"
                  value={draftProduct.landingConfig?.offer1LabelAr ?? ""}
                  onChange={e => updateConfig("offer1LabelAr", e.target.value)}
                />
              </label>
              <label>
                Offre 2 / Pack (AR)
                <input
                  dir="rtl"
                  value={draftProduct.landingConfig?.offer2LabelAr ?? ""}
                  onChange={e => updateConfig("offer2LabelAr", e.target.value)}
                />
              </label>
            </div>

            {/* Couleurs */}
            <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
              <strong style={{ fontSize: 12.5, display: "block", marginBottom: 6 }}>
                🎨 Couleurs / Variantes ({draftProduct.landingConfig?.colorSwatches?.length ?? 0})
              </strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {(draftProduct.landingConfig?.colorSwatches ?? []).map((sw, idx) => (
                  <span
                    key={`${sw.name}-${idx}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <i
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: "50%",
                        background: sw.hex,
                        display: "inline-block",
                      }}
                    />
                    {sw.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveColor(idx)}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: 0,
                        color: "#ef4444",
                        display: "inline-flex",
                      }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="color"
                  value={newColorHex}
                  onChange={e => setNewColorHex(e.target.value)}
                  style={{ width: 34, height: 34, padding: 2, borderRadius: 8, border: "1px solid #cbd5e1" }}
                />
                <input
                  placeholder="Ajouter couleur (ex: وردي)"
                  value={newColorName}
                  onChange={e => setNewColorName(e.target.value)}
                  style={{ flex: 1, minHeight: 34, padding: "4px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12 }}
                />
                <button
                  type="button"
                  className="button button-light"
                  style={{ padding: "5px 10px", fontSize: 12 }}
                  onClick={handleAddColor}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            {/* Tailles */}
            <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <strong style={{ fontSize: 12.5 }}>
                  📏 Tailles ({draftProduct.landingConfig?.sizes?.length ?? 0})
                </strong>
                {(draftProduct.landingConfig?.sizes?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => updateConfig("sizes", [])}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#ef4444",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Trash2 size={12} /> Sans taille (Cosmétique)
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {(draftProduct.landingConfig?.sizes ?? []).map((sz, idx) => (
                  <span
                    key={`${sz.label}-${idx}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "3px 10px",
                      borderRadius: 8,
                      background: "#fdf2f8",
                      border: "1px solid #fbcfe8",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {sz.label}
                    <button
                      type="button"
                      onClick={() =>
                        updateConfig(
                          "sizes",
                          (draftProduct.landingConfig?.sizes ?? []).filter((_, i) => i !== idx)
                        )
                      }
                      style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, color: "#be185d" }}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  placeholder="Ajouter taille (ex: XL)"
                  value={newSizeLabel}
                  onChange={e => setNewSizeLabel(e.target.value)}
                  style={{ flex: 1, minHeight: 34, padding: "4px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12 }}
                />
                <button
                  type="button"
                  className="button button-light"
                  style={{ padding: "5px 10px", fontSize: 12 }}
                  onClick={handleAddSize}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 8 }}>
              <button
                type="button"
                className="button button-gradient"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={handlePublishNow}
              >
                <Sparkles size={16} /> Publier la Landing Page maintenant
              </button>
              <button
                type="button"
                className="button button-light"
                onClick={() => onOpenAdvanced(draftProduct)}
                title="Ajouter d'autres photos galerie ou ajuster le stock"
              >
                <Settings2 size={15} /> Éditeur avancé
              </button>
            </div>
          </div>

          {/* Aperçu Téléphone Live RTL */}
          <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 800,
                color: "#475569",
              }}
            >
              <Smartphone size={14} /> Aperçu Live Mobile (Template : {activeTpl.title})
            </span>

            <div
              dir="rtl"
              lang="ar"
              style={{
                width: "100%",
                maxWidth: 340,
                borderRadius: 28,
                border: "8px solid #1e293b",
                background: "#fff",
                overflow: "hidden",
                boxShadow: "0 22px 50px rgba(15,23,42,0.22)",
                fontFamily: '"Cairo", "Tajawal", system-ui, sans-serif',
              }}
            >
              {draftProduct.landingConfig?.promoBannerAr && (
                <div
                  style={{
                    background: `linear-gradient(90deg, ${activeTpl.accentColor}, ${activeTpl.secondaryColor})`,
                    color: "#fff",
                    textAlign: "center",
                    padding: "6px 10px",
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {draftProduct.landingConfig.promoBannerAr}
                </div>
              )}

              <div style={{ position: "relative" }}>
                <img
                  src={draftProduct.image}
                  alt={draftProduct.arName || draftProduct.name}
                  style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
                />
                {draftProduct.landingConfig?.heroBadgeAr && (
                  <span
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      background: activeTpl.accentColor,
                      color: "#fff",
                      fontSize: 10.5,
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: 999,
                    }}
                  >
                    {draftProduct.landingConfig.heroBadgeAr}
                  </span>
                )}
              </div>

              <div style={{ padding: 12, background: activeTpl.bgGradient, display: "grid", gap: 8 }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#111827" }}>
                  {draftProduct.landingConfig?.heroHeadlineAr || draftProduct.arName || draftProduct.name}
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: "#334155", lineHeight: 1.5 }}>
                  {draftProduct.landingConfig?.heroSubheadlineAr || draftProduct.arDescription}
                </p>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong dir="ltr" style={{ fontSize: 17, color: activeTpl.accentColor, fontWeight: 900 }}>
                    {draftProduct.price} DA
                  </strong>
                  {draftProduct.oldPrice ? (
                    <del dir="ltr" style={{ fontSize: 12, color: "#64748b" }}>
                      {draftProduct.oldPrice} DA
                    </del>
                  ) : null}
                </div>

                {/* Offres */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: draftProduct.packPrice ? "1fr 1fr" : "1fr",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      background: "#fff",
                      border: `1.5px solid ${activeTpl.accentColor}`,
                      borderRadius: 10,
                      padding: "6px 8px",
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {draftProduct.landingConfig?.offer1LabelAr || "قطعة واحدة"}
                    <div dir="ltr" style={{ color: activeTpl.accentColor }}>
                      {draftProduct.price} DA
                    </div>
                  </div>
                  {draftProduct.packPrice ? (
                    <div
                      style={{
                        background: "#fff",
                        border: `2px solid ${activeTpl.secondaryColor}`,
                        borderRadius: 10,
                        padding: "6px 8px",
                        textAlign: "center",
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {draftProduct.landingConfig?.offer2LabelAr || "قطعتان"}
                      <div dir="ltr" style={{ color: activeTpl.accentColor }}>
                        {draftProduct.packPrice} DA
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Pastilles couleurs */}
                {(draftProduct.landingConfig?.colorSwatches?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {draftProduct.landingConfig!.colorSwatches!.map((sw, idx) => (
                      <span
                        key={`${sw.name}-${idx}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          background: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: 999,
                          padding: "2px 8px",
                          fontSize: 10.5,
                          fontWeight: 700,
                        }}
                      >
                        <i style={{ width: 8, height: 8, borderRadius: "50%", background: sw.hex }} />
                        {sw.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tailles */}
                {(draftProduct.landingConfig?.sizes?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {draftProduct.landingConfig!.sizes!.map((sz, idx) => (
                      <span
                        key={`${sz.label}-${idx}`}
                        style={{
                          background: "#fff",
                          border: "1px solid #cbd5e1",
                          borderRadius: 6,
                          padding: "2px 7px",
                          fontSize: 10.5,
                          fontWeight: 800,
                        }}
                      >
                        {sz.label}
                      </span>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    background: `linear-gradient(90deg, ${activeTpl.accentColor}, ${activeTpl.secondaryColor})`,
                    color: "#fff",
                    borderRadius: 12,
                    padding: "9px 12px",
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  🛒 {draftProduct.landingConfig?.ctaLabelAr || "اطلبي الآن"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

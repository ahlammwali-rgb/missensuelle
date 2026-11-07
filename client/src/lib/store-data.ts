import { coatImages } from "./coat-images";
import { replaceAnnotatedAbayaPhotos } from "./abaya-gallery";

export type CategoryId = "mode" | "vestes" | "beaute" | "lentilles" | "extensions";

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: CategoryId;
  categoryLabel: string;
  price: number;
  oldPrice?: number;
  badge?: string;
  description: string;
  details: string[];
  colors: string[];
  image: string;
  gallery?: string[];
  arName?: string;
  arCategoryLabel?: string;
  arDescription?: string;
  accent: string;
  stock: number;
};

export type CartLine = Product & { quantity: number };

import type { OrderHistoryEvent } from "@shared/checkout";

export type OrderStatus = "nouvelle" | "confirmee" | "annulee" | "reportee" | "ne_repond_pas" | "transferee";

export type Order = {
  id: string;
  dbId?: number;
  createdAt: string;
  customer: string;
  phone: string;
  product: string;
  quantity: number;
  total: number;
  wilaya: string;
  commune: string;
  address: string;
  note: string;
  productId?: string;
  color?: string;
  size?: string;
  delivery?: "home" | "office";
  status: OrderStatus;
  nrpLevel?: 1 | 2 | 3;
  postponedUntil?: string | null;
  postponedNote?: string;
  cancelReason?: string;
  assignedToId?: string;
  assignedToName?: string;
  confirmedById?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  isDelivered?: boolean;
  deliveredAt?: string;
  initialQuantity?: number;
  upsellById?: string;
  upsellByName?: string;
  callCount?: number;
  whatsappCount?: number;
  lastCalledAt?: string;
  lastCalledBy?: string;
  history?: OrderHistoryEvent[];
};

export const heroImage = "/manus-storage/async-images/vHn8VKRbVex1NUkhameC59/image-1.webp";
export const fashionImage = "/manus-storage/async-images/vHn8VKRbVex1NUkhameC59/image-2.webp";
export const beautyImage = "/manus-storage/async-images/vHn8VKRbVex1NUkhameC59/image-3.webp";
export const ensembleImage = "/manus-storage/async-images/uM7lQJWYdXHIVBYkKtIu8c/image-1.webp";
export const lensesImage = "/manus-storage/async-images/uM7lQJWYdXHIVBYkKtIu8c/image-2.webp";
export const extensionsImage = "/manus-storage/async-images/uM7lQJWYdXHIVBYkKtIu8c/image-3.webp";
export const cosmeticsImage = "/manus-storage/async-images/uM7lQJWYdXHIVBYkKtIu8c/image-4.webp";
export const modeCategoryImage = "/manus-storage/async-images/rXqVD5q2CsHdWeNrb3KyKO/image-1.webp";
export const firstProductImage = "/manus-storage/1000012735_a03c5d58.jpg";
export const firstProductFront = "/manus-storage/async-images/CiRxshIVQV0OT7GfuQSZCa/image-1.webp";
export const firstProductSide = "/manus-storage/async-images/CiRxshIVQV0OT7GfuQSZCa/image-2.webp";
export const firstProductDetail = "/manus-storage/async-images/CiRxshIVQV0OT7GfuQSZCa/image-3.webp";
export const firstProductBack = "/manus-storage/async-images/CiRxshIVQV0OT7GfuQSZCa/image-4.webp";
export const firstProductStudio = "/manus-storage/async-images/CiRxshIVQV0OT7GfuQSZCa/image-5.webp";
export const darkHeroImage = "/manus-storage/async-images/0hc4X2YTIUTeF6KMLLedug/image-1.webp";
export const emeraldAbayaFront = "/manus-storage/async-images/CuDXkPw4pGwGzy74dcjWuN/image-1.webp";
export const emeraldAbayaBack = "/manus-storage/async-images/CuDXkPw4pGwGzy74dcjWuN/image-2.webp";
export const emeraldAbayaDetail = "/manus-storage/async-images/CuDXkPw4pGwGzy74dcjWuN/image-3.webp";
export const emeraldAbayaSide = "/manus-storage/async-images/CuDXkPw4pGwGzy74dcjWuN/image-4.webp";
export const maquetteAbayaHero = "/manus-storage/v-hero_de8d807e.jpg";
export const maquetteAbayaT1 = "/manus-storage/v-t1_a8d96eaa.jpg";
export const maquetteAbayaT2 = "/manus-storage/v-t2_79ddb4ca.jpg";
export const maquetteAbayaT3 = "/manus-storage/v-t3_94820277.jpg";
export const maquetteAbayaT4 = "/manus-storage/v-t4_df9c43b8.jpg";
export const maquetteAbayaT5 = "/manus-storage/v-t5_c7412f43.jpg";

export const categories: { id: CategoryId; label: string; arLabel: string; kicker: string; color: string; image: string; count: string }[] = [
  { id: "mode", label: "Mode femme", arLabel: "أزياء نسائية", kicker: "Soft tailoring", color: "chick", image: modeCategoryImage, count: "12 looks" },
  { id: "vestes", label: "Vestes & ensembles", arLabel: "سترات وأطقم", kicker: "Power pieces", color: "lilac", image: ensembleImage, count: "8 pièces" },
  { id: "beaute", label: "Beauté", arLabel: "جمال", kicker: "Glow routine", color: "mint", image: cosmeticsImage, count: "16 essentiels" },
  { id: "lentilles", label: "Lentilles de couleur", arLabel: "عدسات ملونة", kicker: "Change de regard", color: "orange", image: lensesImage, count: "6 teintes" },
  { id: "extensions", label: "Extensions cheveux", arLabel: "وصلات شعر", kicker: "Extra volume", color: "rose", image: extensionsImage, count: "9 textures" },
];

export const products: Product[] = [
  {
    id: "p-001",
    slug: "blazer-lilac-dream",
    name: "Manteau Icon",
    category: "vestes",
    categoryLabel: "Vestes & ensembles",
    price: 9700,
    oldPrice: 12900,
    badge: "Best-seller",
    description: "Un manteau hivernal élégant avec col et poignets en fausse fourrure, boutons dorés et une coupe féminine évasée.",
    details: ["Col et poignets en fausse fourrure", "Boutons dorés", "Coupe féminine évasée", "Tailles S à XXL"],
    colors: ["Noir", "Blanc"],
    image: coatImages.black.hero,
    gallery: [coatImages.black.hero, coatImages.black.collar, coatImages.black.buttons, coatImages.black.cuffs, coatImages.black.back, coatImages.black.mannequin],
    arName: "معطف شتوي فاخر",
    arCategoryLabel: "سترات و أطقم",
    arDescription: "فرو ناعم عند الياقة والأكمام، أزرار ذهبية فخمة، وقصة أنثوية واسعة تمنحك إطلالة راقية ودافئة.",
    accent: "#9B82F6",
    stock: 14,
  },
  {
    id: "p-002",
    slug: "ensemble-cloud-nine",
    name: "Ensemble Cloud Nine",
    category: "mode",
    categoryLabel: "Mode femme",
    price: 8200,
    badge: "Nouveau",
    description: "Le duo facile à porter quand tu veux être confortable, coordonnée et absolument canon.",
    details: ["Top + pantalon assorti", "Maille douce et stretch", "Tailles S à L"],
    colors: ["Bleu glacier", "Beige", "Noir"],
    image: ensembleImage,
    gallery: [ensembleImage, fashionImage, darkHeroImage, beautyImage, firstProductStudio, cosmeticsImage],
    accent: "#6FA8FF",
    stock: 9,
  },
  {
    id: "p-003",
    slug: "gloss-peach-plump",
    name: "Gloss Peach Plump",
    category: "beaute",
    categoryLabel: "Beauté",
    price: 1800,
    oldPrice: 2200,
    badge: "Glow pick",
    description: "Un voile brillant et confortable pour des lèvres glossy sans effet collant.",
    details: ["Fini miroir pêche", "Texture légère", "Format sac à main"],
    colors: ["Peach", "Rose nude", "Cherry"],
    image: cosmeticsImage,
    gallery: [cosmeticsImage, beautyImage, lensesImage, heroImage, firstProductDetail, fashionImage],
    accent: "#FF9A70",
    stock: 28,
  },
  {
    id: "p-004",
    slug: "lentilles-honey-haze",
    name: "Lentilles Honey Haze",
    category: "lentilles",
    categoryLabel: "Lentilles de couleur",
    price: 3200,
    badge: "Regard signature",
    description: "Une teinte miel subtile pour illuminer le regard tout en gardant un rendu naturel.",
    details: ["Teinte honey hazel", "Confort journalier", "Étui inclus"],
    colors: ["Honey", "Olive", "Grey"],
    image: lensesImage,
    gallery: [lensesImage, beautyImage, cosmeticsImage, heroImage, firstProductDetail, extensionsImage],
    accent: "#F5AF4F",
    stock: 19,
  },
  {
    id: "p-005",
    slug: "extensions-silk-wave",
    name: "Extensions Cheveux Naturel",
    category: "extensions",
    categoryLabel: "Extensions cheveux",
    price: 2700,
    oldPrice: 3500,
    badge: "Offre 2 700 DA",
    description: "Extensions cheveux naturel 50%, longueur et volume instantanés, pose facile et tenue longue durée.",
    details: ["Cheveux naturels 50%", "Pose facile et rapide", "Volume et longueur immédiats", "Longue durée de vie"],
    colors: ["شاتان فونس", "أسود", "بني غامق", "شاتان روكس", "أشقر فاتح", "نور بالياح غري"],
    image: "/manus-storage/extensions-poster.jpg",
    gallery: ["/manus-storage/extensions-poster.jpg", extensionsImage, beautyImage, fashionImage, heroImage, firstProductStudio],
    arName: "إكستنشن الشعر — طول أكبر وكثافة أكثر",
    arCategoryLabel: "وصلات شعر",
    arDescription: "إكستنشن شعر طبيعي 50% بمظهر أنثوي رائع، سهل التركيب ويدوم لفترة طويلة.",
    accent: "#c0307f",
    stock: 30,
  },
  {
    id: "p-006",
    slug: "robe-satin-sunset",
    name: "Robe Satin Sunset",
    category: "mode",
    categoryLabel: "Mode femme",
    price: 5900,
    badge: "Only a few",
    description: "La robe satinée qui capte la lumière et fait tout le travail côté allure.",
    details: ["Bretelles réglables", "Satin fluide", "Tailles S à XL"],
    colors: ["Orange sunset", "Rose blush", "Noir"],
    image: fashionImage,
    gallery: [fashionImage, ensembleImage, darkHeroImage, beautyImage, firstProductFront, cosmeticsImage],
    accent: "#F08268",
    stock: 5,
  },
  {
    id: "p-007",
    slug: "abaya-royal-emerald",
    name: "Abaya Royal Emerald",
    category: "mode",
    categoryLabel: "Mode femme",
    price: 7500,
    oldPrice: 14000,
    badge: "Livraison Gratuite",
    description: "Une silhouette emerald majestueuse, fluide et confortable, avec une broderie signature qui attire tous les regards.",
    details: ["Velours emerald doux", "Broderie décorative premium", "Coupe ample et confortable", "Tailles S à XL"],
    colors: ["Emerald", "Noir"],
    image: maquetteAbayaHero,
    gallery: replaceAnnotatedAbayaPhotos([maquetteAbayaHero, maquetteAbayaT1, maquetteAbayaT2, maquetteAbayaT3, maquetteAbayaT4, maquetteAbayaT5]),
    arName: "عباية رويال إيميرالد",
    arCategoryLabel: "أزياء نسائية",
    arDescription: "عباية خضراء فاخرة بقصة أنيقة وتفاصيل مطرزة تمنحك حضوراً مميزاً في كل مناسبة.",
    accent: "#0c6b4b",
    stock: 12,
  },
  {
    id: "p-008",
    slug: "doudoune-hiver-luxe",
    name: "Doudoune Hiver de Luxe",
    category: "vestes",
    categoryLabel: "Vestes & Manteaux",
    price: 7600,
    oldPrice: 9000,
    badge: "Offre spéciale",
    description: "Doudoune d'hiver luxueuse avec col en fourrure douce, isolation thermique optimale et coupe moderne.",
    details: ["Fourrure luxueuse douce", "Excellente isolation contre le froid", "Coupe moderne et légère", "Tailles S à XXL"],
    colors: ["أزرق سماوي", "أبيض", "أسود"],
    image: "/manus-storage/doudoune-bg.jpg",
    gallery: [
      "/manus-storage/doudoune-bg.jpg",
      "/manus-storage/doudoune-white.jpg",
      "/manus-storage/doudoune-blue.jpg",
      "/manus-storage/doudoune-black.jpg",
    ],
    arName: "دواقون شتوية فاخرة",
    arCategoryLabel: "معاطف و دواقون",
    arDescription: "دواقون شتوية فاخرة بفراء ناعم وعزل ممتاز للبرد تمنحك الدفء والأناقة والراحة.",
    accent: "#17307e",
    stock: 25,
  },
];

export const wilayas = [
  "Alger", "Blida", "Boumerdès", "Oran", "Constantine", "Sétif", "Tizi Ouzou", "Béjaïa", "Tipaza", "Annaba", "Batna", "Biskra", "Chlef", "Djelfa", "Médéa", "Mostaganem", "Tlemcen", "Mascara", "Ouargla", "Bordj Bou Arréridj",
];

export const formatDZD = (value: number) => `${new Intl.NumberFormat("fr-DZ").format(value)} DA`;
export const getProduct = (slug: string) => {
  const normalizedSlug =
    slug === "extensions-cheveux" || slug === "extensions"
      ? "extensions-silk-wave"
      : slug;
  return (
    getCatalogProducts().find(product => product.slug === normalizedSlug) ??
    products.find(product => product.slug === normalizedSlug)
  );
};


export const CATALOG_STORAGE_KEY = "miss-sensuelle-catalog";

export function getCatalogProducts(): Product[] {
  if (typeof window === "undefined") return products;
  try {
    const saved = JSON.parse(localStorage.getItem(CATALOG_STORAGE_KEY) || "null") as Product[] | null;
    if (!Array.isArray(saved)) return products;
    // Migration additive : les catalogues déjà enregistrés avant l'ajout de l'Abaya
    // sont conservés, mais les nouveaux produits intégrés au code sont ajoutés une fois.
    let colorsChanged = false;
    const canonicalExtensions = products.find(p => p.id === "p-005")!;
    const normalized = saved.map(product => {
      if (product.id === "p-001" && product.image === firstProductImage) {
        colorsChanged = true;
        return {
          ...product,
          name: product.name === "Blazer Lilac Dream" ? "Manteau Icon" : product.name,
          image: coatImages.black.hero,
          gallery: product.gallery?.[0] === firstProductImage ? products[0].gallery : product.gallery,
          colors: JSON.stringify(product.colors) === JSON.stringify(["Lilac", "Ivoire", "Bleu ciel"]) ? ["Noir", "Blanc"] : product.colors,
        };
      }
      if (product.id === "p-005" && (product.price === 9800 || product.image === extensionsImage)) {
        colorsChanged = true;
        return {
          ...product,
          name: canonicalExtensions.name,
          price: canonicalExtensions.price,
          oldPrice: canonicalExtensions.oldPrice,
          badge: canonicalExtensions.badge,
          description: canonicalExtensions.description,
          details: canonicalExtensions.details,
          colors: canonicalExtensions.colors,
          image: canonicalExtensions.image,
          gallery: canonicalExtensions.gallery,
          arName: canonicalExtensions.arName,
          arCategoryLabel: canonicalExtensions.arCategoryLabel,
          arDescription: canonicalExtensions.arDescription,
          accent: canonicalExtensions.accent,
          stock: Math.max(product.stock || 0, canonicalExtensions.stock),
        };
      }
      if (product.id !== "p-007") return product;
      const colors = product.colors.filter(color => color.trim().toLowerCase() !== "bordeaux");
      const gallery = product.gallery ? replaceAnnotatedAbayaPhotos(product.gallery) : product.gallery;
      const galleryChanged = gallery?.some((image, index) => image !== product.gallery?.[index]) ?? false;
      const priceChanged = product.price === 9600;
      if (colors.length === product.colors.length && !galleryChanged && !priceChanged) return product;
      colorsChanged = true;
      return {
        ...product,
        colors,
        ...(galleryChanged ? { gallery } : {}),
        ...(priceChanged ? { price: 7500 } : {}),
      };
    });
    const savedIds = new Set(normalized.map(product => product.id));
    const missingBuiltIns = products.filter(
      product =>
        (product.id === "p-007" || (normalized.length >= 7 && product.id === "p-008")) &&
        !savedIds.has(product.id),
    );
    if (missingBuiltIns.length || colorsChanged) {
      const migrated = [...normalized, ...missingBuiltIns];
      localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return normalized;
  } catch {
    return products;
  }
}

export function saveCatalogProducts(next: Product[]) {
  if (typeof window !== "undefined") localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(next));
}

export function adjustProductStock(productIdentifier: string, delta: number): Product | null {
  if (typeof window === "undefined" || !productIdentifier) return null;
  const catalog = getCatalogProducts();
  const raw = productIdentifier.trim().toLowerCase();

  let targetIndex = catalog.findIndex(p => p.id.toLowerCase() === raw || p.slug.toLowerCase() === raw);
  if (targetIndex === -1) {
    targetIndex = catalog.findIndex(p => p.name.toLowerCase() === raw);
  }
  if (targetIndex === -1) {
    targetIndex = catalog.findIndex(p => raw.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(raw));
  }
  if (targetIndex === -1) {
    if (raw.includes("abaya")) targetIndex = catalog.findIndex(p => p.id === "p-007" || p.slug.includes("abaya"));
    else if (raw.includes("manteau") || raw.includes("blazer") || raw.includes("coat")) targetIndex = catalog.findIndex(p => p.id === "p-001" || p.slug.includes("blazer"));
  }

  if (targetIndex === -1) return null;
  const current = catalog[targetIndex];
  const newStock = Math.max(0, (current.stock || 0) + delta);
  const updatedProduct = { ...current, stock: newStock };
  const nextCatalog = [...catalog];
  nextCatalog[targetIndex] = updatedProduct;
  saveCatalogProducts(nextCatalog);
  return updatedProduct;
}

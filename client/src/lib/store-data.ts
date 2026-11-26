import type { OrderAttribution } from "@shared/checkout";
import { coatImages } from "./coat-images";
import { replaceAnnotatedAbayaPhotos } from "./abaya-gallery";

export type CategoryId = "mode" | "vestes" | "beaute" | "lentilles" | "extensions";

export type LandingTemplateId = "doudoune" | "extensions" | "abaya" | "coat" | "perruque" | "badil" | "pyjama" | "petit-meche" | "standard";

export type ProductVariantImage = {
  name: string;
  image: string;
};

export type ProductLandingConfig = {
  heroHeadlineAr?: string;
  heroSubheadlineAr?: string;
  heroBadgeAr?: string;
  promoBannerAr?: string;
  ctaLabelAr?: string;
  offer1LabelAr?: string;
  offer2LabelAr?: string;
  colorSwatches?: Array<{ name: string; hex: string }>;
  sizes?: Array<{ label: string; hint?: string }>;
  trustItems?: Array<{ icon: string; label: string }>;
  reviews?: Array<{ author: string; city: string; rating: number; text: string }>;
  aiGeneratedAt?: string;
  aiModel?: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: CategoryId;
  categoryLabel: string;
  price: number;
  oldPrice?: number;
  packPrice?: number;
  landingTemplate?: LandingTemplateId;
  landingConfig?: ProductLandingConfig;
  variantImages?: ProductVariantImage[];
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
  carrier?: "ecom" | "ecotrack";
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
  historyCount?: number;
  history?: OrderHistoryEvent[];
  attribution?: OrderAttribution;
};

export const heroImage = "/manus-storage/v-hero_de8d807e.jpg";
export const fashionImage = "/manus-storage/1000013293_30889d5d.jpg";
export const beautyImage = "/manus-storage/cat-beaute.jpg";
export const ensembleImage = "/manus-storage/doudoune-blue.jpg";
export const lensesImage = "/manus-storage/cat-lentilles.jpg";
export const extensionsImage = "/manus-storage/ext-vrait-1.jpg";
export const cosmeticsImage = "/manus-storage/cat-beaute.jpg";
export const modeCategoryImage = "/manus-storage/v-hero_de8d807e.jpg";
export const firstProductImage = "/manus-storage/black-hero_45977cd9.jpg";
export const firstProductFront = "/manus-storage/black-hero_45977cd9.jpg";
export const firstProductSide = "/manus-storage/black-collar_25ae4449.jpg";
export const firstProductDetail = "/manus-storage/black-buttons_7aff8a91.jpg";
export const firstProductBack = "/manus-storage/black-back_25e055ff.jpg";
export const firstProductStudio = "/manus-storage/black-man_fb37a47b.jpg";
export const darkHeroImage = "/manus-storage/1000013293_30889d5d.jpg";
export const emeraldAbayaFront = "/manus-storage/v-hero_de8d807e.jpg";
export const emeraldAbayaBack = "/manus-storage/v-t1_a8d96eaa.jpg";
export const emeraldAbayaDetail = "/manus-storage/v-t2_79ddb4ca.jpg";
export const emeraldAbayaSide = "/manus-storage/v-t3_94820277.jpg";
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
    landingTemplate: "coat",
    badge: "Best-seller",
    description: "Un manteau hivernal élégant avec col et poignets en fausse fourrure, boutons dorés et une coupe féminine évasée.",
    details: ["Col et poignets en fausse fourrure", "Boutons dorés", "Coupe féminine évasée", "Tailles S à XXL"],
    colors: ["Noir", "Blanc"],
    variantImages: [
      { name: "Noir", image: coatImages.black.hero },
      { name: "Blanc", image: coatImages.white.hero },
    ],
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
    price: 4700,
    oldPrice: 5900,
    packPrice: 4700,
    landingTemplate: "extensions",
    badge: "Offre 4 700 DA",
    description: "Extensions cheveux naturel 50%, longueur et volume instantanés, pose facile et tenue longue durée.",
    details: ["Cheveux naturels 60%", "Pose facile et rapide", "Volume et longueur immédiats", "Longue durée de vie"],
    colors: ["أسود طبيعي", "بني غامق", "شاتان فاتح", "شاتين روكس", "أشقر فاتح", "أسود بالياج رمادي"],
    variantImages: [
      { name: "أسود طبيعي", image: "/manus-storage/ext-vrait-2.jpg" },
      { name: "بني غامق", image: "/manus-storage/ext-vrait-3.jpg" },
      { name: "شاتان فاتح", image: "/manus-storage/ext-vrait-4.jpg" },
      { name: "شاتين روكس", image: "/manus-storage/ext-vrait-5.jpg" },
      { name: "أشقر فاتح", image: "/manus-storage/ext-vrait-6.jpg" },
      { name: "أسود بالياج رمادي", image: "/manus-storage/ext-vrait-7.jpg" },
    ],
    image: "/manus-storage/ext-vrait-1.jpg",
    gallery: ["/manus-storage/ext-vrait-12.jpg", "/manus-storage/ext-vrait-13.jpg"],
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
    landingTemplate: "abaya",
    badge: "Livraison Gratuite",
    description: "Une silhouette emerald majestueuse, fluide et confortable, avec une broderie signature qui attire tous les regards.",
    details: ["Velours emerald doux", "Broderie décorative premium", "Coupe ample et confortable", "Tailles S à XL"],
    colors: ["Emerald", "Noir"],
    variantImages: [
      { name: "Emerald", image: maquetteAbayaHero },
      { name: "Noir", image: emeraldAbayaBack },
    ],
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
    packPrice: 12900,
    landingTemplate: "doudoune",
    badge: "Offre spéciale",
    description: "Doudoune d'hiver luxueuse avec col en fourrure douce, isolation thermique optimale et coupe moderne.",
    details: ["Fourrure luxueuse douce", "Excellente isolation contre le froid", "Coupe moderne et légère", "Tailles S à XXL"],
    colors: ["أزرق سماوي", "أبيض", "أسود"],
    variantImages: [
      { name: "أزرق سماوي", image: "/manus-storage/doudoune-blue.jpg" },
      { name: "أبيض", image: "/manus-storage/doudoune-white.jpg" },
      { name: "أسود", image: "/manus-storage/doudoune-black.jpg" },
    ],
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
  {
    id: "p-009",
    slug: "perruque-longue",
    name: "Perruque Longue Naturelle",
    category: "extensions",
    categoryLabel: "Extensions cheveux",
    price: 8000,
    oldPrice: 12000,
    landingTemplate: "perruque",
    badge: "Nouveau",
    description: "Perruque longue soyeuse à effet naturel avec 5 nuances tendance.",
    details: ["5 couleurs disponibles", "Effet naturel et volume soyeux", "Confortable et facile à poser", "Paiement à la livraison"],
    colors: ["بلاتيني", "ميلي رويو", "شتلين غامق", "شتلين فاتح", "أسود"],
    variantImages: [
      { name: "بلاتيني", image: "/manus-storage/perruque-v1.jpg" },
      { name: "ميلي رويو", image: "/manus-storage/perruque-v2.jpg" },
      { name: "شتلين غامق", image: "/manus-storage/perruque-v3.jpg" },
      { name: "شتلين فاتح", image: "/manus-storage/perruque-v4.jpg" },
      { name: "أسود", image: "/manus-storage/perruque-v5.jpg" },
    ],
    image: "/manus-storage/perruque-hero.jpg",
    gallery: [
      "/manus-storage/perruque-hero.jpg",
      "/manus-storage/perruque-banner.jpg",
      "/manus-storage/perruque-detail.jpg",
      "/manus-storage/perruque-v1.jpg",
      "/manus-storage/perruque-v2.jpg",
      "/manus-storage/perruque-v3.jpg",
      "/manus-storage/perruque-v4.jpg",
      "/manus-storage/perruque-v5.jpg",
    ],
    arName: "بيروكه طويلة",
    arCategoryLabel: "شعر طبيعي",
    arDescription: "بيروكه طويلة ناعمة بمظهر طبيعي متوفرة بـ 5 ألوان أنيقة.",
    accent: "#df407f",
    stock: 30,
  },
  {
    id: "p-010",
    slug: "badil-microblading",
    name: "Badil Microblading",
    category: "beaute",
    categoryLabel: "Beauté & Maquillage",
    price: 1800,
    oldPrice: 2800,
    packPrice: 3000,
    landingTemplate: "badil",
    badge: "2 + 1 مجاناً",
    description: "Stickers sourcils effet microblading naturel, résistants à l'eau jusqu'à 6 jours.",
    details: [
      "نتيجة طبيعية ومذهلة تدوم حتى 6 أيام",
      "مقاوم للماء والعرق وخفيف على الجلد",
      "عرض خاص: لوحة بـ 1800 DA أو لوحتين + الثالثة مجاناً بـ 3000 DA",
      "توصيل سريع 58 ولاية مع الدفع عند الاستلام",
    ],
    colors: ["لوحة واحدة", "لوحتان + الثالثة مجانا"],
    image: "/images/badil/01-badil.jpg",
    gallery: [
      "/images/badil/01-badil.jpg",
      "/images/badil/02-badil.jpg",
      "/images/badil/03-badil.jpg",
      "/images/badil/04-badil.jpg",
      "/images/badil/05-badil.jpg",
      "/images/badil/06-badil.jpg",
      "/images/badil/07-badil.jpg",
      "/images/badil/08-badil.jpg",
    ],
    arName: "بديل الميكروبلايدينغ",
    arCategoryLabel: "جمال ومكياج",
    arDescription: "بديل الميكروبلايدينغ لحواجب طبيعية ومثالية في ثوانٍ، مقاوم للماء ويدوم حتى 6 أيام.",
    accent: "#e0145f",
    stock: 50,
  },
  {
    id: "p-011",
    slug: "pyjama-ete",
    name: "Pyjama Été Sensuelle",
    category: "mode",
    categoryLabel: "Pyjamas & Détente",
    price: 1800,
    oldPrice: 2800,
    packPrice: 3000,
    landingTemplate: "pyjama",
    badge: "2 + 1 مجاناً",
    description: "Pyjama d'été femme coupe confortable, tissu léger et respirant disponible en 5 couleurs tendance (S à XL).",
    details: [
      "قماش صيفي خفيف وبارد مريح جداً للبيت",
      "متوفرة بـ 5 ألوان أنيقة: أبيض، أصفر، وردي، موف، خوخي",
      "مقاسات متعددة: S (45-55Kg) • M (55-65Kg) • L (65-75Kg) • XL (75-85Kg)",
      "عرض خاص: قطعة بـ 1800 DA أو قطعتين + الثالثة مجاناً بـ 3000 DA",
      "توصيل سريع 58 ولاية مع الدفع عند الاستلام",
    ],
    colors: ["أبيض", "أصفر", "وردي", "موف", "خوخي"],
    image: "/images/pyjama/01-pyjama.jpg",
    gallery: [
      "/images/pyjama/01-pyjama.jpg",
      "/images/pyjama/02-pyjama.jpg",
      "/images/pyjama/03-pyjama.jpg",
      "/images/pyjama/04-pyjama.jpg",
      "/images/pyjama/05-pyjama.jpg",
      "/images/pyjama/06-pyjama.jpg",
    ],
    arName: "بيجامة صيفية سنسويل",
    arCategoryLabel: "بيجامات وملابس منزلية",
    arDescription: "بيجامة صيفية خفيفة ومريحة بألوان جذابة وعرض 2+1 مجاناً.",
    accent: "#e0145f",
    stock: 60,
  },
  {
    id: "p-012",
    slug: "petit-meche",
    name: "Petit Mèche",
    category: "extensions",
    categoryLabel: "Extensions cheveux",
    price: 2500,
    oldPrice: 3500,
    landingTemplate: "petit-meche",
    badge: "عرض خاص",
    description: "Extension Petit Mèche Miss Sensuelle effet naturel invisible, pose facile en quelques secondes en 5 nuances.",
    details: [
      "تمنحك كثافة وطولاً طبيعياً في ثوانٍ بدون أي ضرر للشعر",
      "متوفرة بـ 5 ألوان جذابة: أسود، شاتين كلير، بلوند ذهبي طبيعي، شاتين فونسي، بلوند بلاتين",
      "عرض خاص: 2500 DA فقط بدلاً من 3500 DA",
      "توصيل سريع 58 ولاية مع الدفع عند الاستلام",
    ],
    colors: ["أسود", "شاتين كلير", "بلوند ذهبي طبيعي", "شاتين فونسي", "بلوند بلاتين"],
    variantImages: [
      { name: "أسود", image: "/images/petit-meche/variants/noir.jpg" },
      { name: "شاتين كلير", image: "/images/petit-meche/variants/chatain-clair.jpg" },
      { name: "بلوند ذهبي طبيعي", image: "/images/petit-meche/variants/blond-dore.jpg" },
      { name: "شاتين فونسي", image: "/images/petit-meche/variants/chatain-fonce.jpg" },
      { name: "بلوند بلاتين", image: "/images/petit-meche/variants/blond-platine.jpg" },
    ],
    image: "/images/petit-meche/01-petit-meche.jpg",
    gallery: [
      "/images/petit-meche/01-petit-meche.jpg",
      "/images/petit-meche/variants/noir.jpg",
      "/images/petit-meche/03-petit-meche.jpg",
      "/images/petit-meche/04-petit-meche.jpg",
      "/images/petit-meche/05-petit-meche.jpg",
      "/images/petit-meche/06-petit-meche.jpg",
    ],
    arName: "بيتي ميش",
    arCategoryLabel: "وصلات الشعر",
    arDescription: "وصلات شعر Petit Mèche بمظهر طبيعي وتركيب سريع بـ 5 ألوان رائعة.",
    accent: "#7d0c2a",
    stock: 50,
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

const EXTENSION_SHADE_ALIASES: Record<string, string> = {
  "نور بليلح غري": "أسود بالياج رمادي",
  "نور بليلج غري": "أسود بالياج رمادي",
  "بني عسلي": "شاتان فاتح",
};

export function normalizeExtensionShadeName(name: string): string {
  return EXTENSION_SHADE_ALIASES[name.trim()] ?? name;
}

function migrateExtensionShadeInProduct(product: Product): { product: Product; changed: boolean } {
  let changed = false;
  let nextColors = product.colors;
  if (Array.isArray(product.colors)) {
    const mapped = product.colors.map(c => normalizeExtensionShadeName(c));
    if (mapped.some((c, idx) => c !== product.colors[idx])) {
      nextColors = mapped;
      changed = true;
    }
  }
  let nextVariantImages = product.variantImages;
  if (Array.isArray(product.variantImages)) {
    const mapped = product.variantImages.map(v => ({
      ...v,
      name: normalizeExtensionShadeName(v.name),
    }));
    if (mapped.some((v, idx) => v.name !== product.variantImages?.[idx]?.name)) {
      nextVariantImages = mapped;
      changed = true;
    }
  }
  let nextLandingConfig = product.landingConfig;
  if (product.landingConfig?.colorSwatches) {
    const mappedSw = product.landingConfig.colorSwatches.map(sw => ({
      ...sw,
      name: normalizeExtensionShadeName(sw.name),
    }));
    if (mappedSw.some((sw, idx) => sw.name !== product.landingConfig?.colorSwatches?.[idx]?.name)) {
      nextLandingConfig = { ...product.landingConfig, colorSwatches: mappedSw };
      changed = true;
    }
  }
  if (!changed) return { product, changed: false };
  return {
    product: {
      ...product,
      colors: nextColors,
      ...(nextVariantImages ? { variantImages: nextVariantImages } : {}),
      ...(nextLandingConfig ? { landingConfig: nextLandingConfig } : {}),
    },
    changed: true,
  };
}

export function getCatalogProducts(): Product[] {
  if (typeof window === "undefined") return products;
  try {
    const saved = JSON.parse(localStorage.getItem(CATALOG_STORAGE_KEY) || "null") as Product[] | null;
    if (!Array.isArray(saved)) return products;
    // Migration additive : les catalogues déjà enregistrés avant l'ajout de l'Abaya
    // sont conservés, mais les nouveaux produits intégrés au code sont ajoutés une fois.
    let colorsChanged = false;
    const canonicalExtensions = products.find(p => p.id === "p-005")!;
    const normalized = saved.map(rawProduct => {
      const migrated = migrateExtensionShadeInProduct(rawProduct);
      if (migrated.changed) colorsChanged = true;
      const product = migrated.product;
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
      if (product.id === "p-005" && (product.price === 9800 || product.price === 2700 || product.packPrice === 4500 || product.image === extensionsImage)) {
        colorsChanged = true;
        return {
          ...product,
          name: canonicalExtensions.name,
          price: canonicalExtensions.price,
          oldPrice: canonicalExtensions.oldPrice,
          packPrice: canonicalExtensions.packPrice,
          badge: canonicalExtensions.badge,
          description: canonicalExtensions.description,
          details: canonicalExtensions.details,
          colors: canonicalExtensions.colors,
          variantImages: canonicalExtensions.variantImages,
          image: canonicalExtensions.image,
          gallery: canonicalExtensions.gallery,
          arName: canonicalExtensions.arName,
          arCategoryLabel: canonicalExtensions.arCategoryLabel,
          arDescription: canonicalExtensions.arDescription,
          accent: canonicalExtensions.accent,
          stock: Math.max(product.stock || 0, canonicalExtensions.stock),
        };
      }
      if (product.id === "p-012") {
        const canonicalPetitMeche = products.find(item => item.id === "p-012");
        const hasLegacyGallery = (product.gallery ?? []).includes("/images/petit-meche/02-petit-meche.jpg");
        const hasNewVariants =
          Array.isArray(product.variantImages) &&
          product.variantImages.some(v => v.image?.includes("/images/petit-meche/variants/"));
        if (canonicalPetitMeche && (!hasNewVariants || hasLegacyGallery)) {
          colorsChanged = true;
          return {
            ...product,
            details: canonicalPetitMeche.details,
            colors: canonicalPetitMeche.colors,
            variantImages: canonicalPetitMeche.variantImages,
            gallery: canonicalPetitMeche.gallery,
          };
        }
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
        (product.id === "p-007" ||
          (normalized.length >= 7 && product.id === "p-008") ||
          product.id === "p-009" ||
          product.id === "p-010" ||
          product.id === "p-011" ||
          product.id === "p-012") &&
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

export function getProductVariantOptions(product: Product | undefined): ProductVariantImage[] {
  if (!product) return [{ name: "Noir", image: "" }];
  if (product.variantImages && product.variantImages.length > 0) {
    return product.variantImages.map((v, idx) => ({
      name: v.name || product.colors?.[idx] || `اللون ${idx + 1}`,
      image: v.image || product.gallery?.[idx] || product.image || "",
    }));
  }
  const isDoudoune = product.id === "p-008" || product.slug === "doudoune-hiver-luxe";
  if (isDoudoune) {
    const dCols = product.colors?.length ? product.colors : ["أزرق سماوي", "أبيض", "أسود"];
    const dImgs = [
      "/manus-storage/doudoune-blue.jpg",
      "/manus-storage/doudoune-white.jpg",
      "/manus-storage/doudoune-black.jpg",
    ];
    return dCols.map((c, idx) => ({
      name: c,
      image: product.gallery?.[idx] || dImgs[idx] || product.image,
    }));
  }
  const isExtensions =
    product.id === "p-005" ||
    product.slug === "extensions-silk-wave" ||
    product.slug === "extensions-cheveux";
  if (isExtensions) {
    return [
      { name: "أسود طبيعي", image: "/manus-storage/ext-m2-v1.jpg" },
      { name: "بني غامق", image: "/manus-storage/ext-m2-v2.jpg" },
      { name: "شاتان فاتح", image: "/manus-storage/ext-m2-v3.jpg" },
      { name: "شاتين روكس", image: "/manus-storage/ext-m2-v4.jpg" },
      { name: "أشقر فاتح", image: "/manus-storage/ext-m2-v5.jpg" },
      { name: "أسود بالياج رمادي", image: "/manus-storage/ext-m2-v6.jpg" },
    ];
  }
  if (product.colors && product.colors.length > 0) {
    return product.colors.map((c, idx) => ({
      name: c,
      image: product.gallery?.[idx] || product.image || "",
    }));
  }
  if (product.gallery && product.gallery.length > 0) {
    return product.gallery.map((img, idx) => ({
      name: `اللون ${idx + 1}`,
      image: img,
    }));
  }
  return [{ name: "Standard", image: product.image || "" }];
}

export function saveCatalogProducts(next: Product[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("miss-sensuelle-catalog-updated"));
  void fetch("/api/checkout/catalog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ products: next }),
  }).catch(() => {});
}

let catalogSyncStarted = false;
let catalogSyncCompleted = false;

export function isCatalogSyncDone(): boolean {
  return catalogSyncCompleted;
}

export function syncCatalogFromServer() {
  if (typeof window === "undefined") return;
  if (catalogSyncStarted) return;
  catalogSyncStarted = true;
  void fetch("/api/checkout/catalog")
    .then(r => (r.ok ? r.json() : null))
    .then((data: { products?: Product[] } | null) => {
      const serverProducts = data?.products;
      if (!Array.isArray(serverProducts) || serverProducts.length === 0) return;
      const localProducts = getCatalogProducts();
      const byId = new Map<string, Product>();
      for (const p of localProducts) {
        if (p && p.id) byId.set(p.id, p);
      }
      let changed = false;
      for (const rawSp of serverProducts) {
        if (!rawSp || !rawSp.id) continue;
        const sp = migrateExtensionShadeInProduct(rawSp).product;
        const existing = byId.get(sp.id);
        if (!existing || JSON.stringify(existing) !== JSON.stringify(sp)) {
          byId.set(sp.id, sp);
          changed = true;
        }
      }
      if (changed) {
        const merged = Array.from(byId.values());
        localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent("miss-sensuelle-catalog-updated"));
      }
    })
    .catch(() => {})
    .finally(() => {
      catalogSyncCompleted = true;
      window.dispatchEvent(new CustomEvent("miss-sensuelle-catalog-synced"));
    });
}

if (typeof window !== "undefined") {
  syncCatalogFromServer();
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

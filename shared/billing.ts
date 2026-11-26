import { z } from "zod";

export const GCOME_ANNUAL_DISCOUNT_PCT = 20;

export type GcomePlanId = "starter" | "pro" | "business" | "owner_unlimited";
export type GcomePaidPlanId = "starter" | "pro" | "business";
export type GcomeBillingCycle = "monthly" | "yearly";
export type GcomePaymentMethod = "chargily" | "ccp" | "card";

export interface GcomePlanDefinition {
  id: GcomePaidPlanId;
  nameFr: string;
  nameAr: string;
  taglineFr: string;
  taglineAr: string;
  monthlyPriceDzd: number;
  trialDays: number;
  badgeFr?: string;
  badgeAr?: string;
  recommended?: boolean;
  limits: {
    ordersPerMonth: number | null;
    staffMembers: number | null;
    stores: number;
    maxPixels: number | null;
    carriers: "single" | "all";
  };
  featuresFr: string[];
  featuresAr: string[];
  ctaFr: string;
  ctaAr: string;
}

export const GCOME_PLANS: readonly GcomePlanDefinition[] = [
  {
    id: "starter",
    nameFr: "Starter",
    nameAr: "ستارتر",
    taglineFr: "Pour lancer ta première boutique COD en Algérie sans prise de tête.",
    taglineAr: "لإطلاق متجرك الأول بنظام الدفع عند الاستلام بسهولة تامة.",
    monthlyPriceDzd: 2900,
    trialDays: 14,
    limits: {
      ordersPerMonth: 300,
      staffMembers: 1,
      stores: 1,
      maxPixels: 1,
      carriers: "single",
    },
    featuresFr: [
      "Jusqu'à 300 commandes / mois",
      "1 boutique & templates haute conversion",
      "1 membre d'équipe (Admin)",
      "1 transporteur connecté (EcoTrack/DHD ou E-com)",
      "1 Pixel Meta / TikTok + CAPI serveur",
      "App Mobile PWA & alertes commandes",
    ],
    featuresAr: [
      "حتى 300 طلب شهرياً",
      "متجر واحد وصفحات هبوط عالية التحويل",
      "عضو فريق واحد (المدير)",
      "شركة توصيل واحدة (DHD/EcoTrack أو E-com)",
      "بيكسل Meta أو TikTok واحد + CAPI السيرفر",
      "تطبيق هاتف PWA مع إشعارات فورية",
    ],
    ctaFr: "Essai gratuit 14 jours",
    ctaAr: "تجربة مجانية 14 يوماً",
  },
  {
    id: "pro",
    nameFr: "Pro",
    nameAr: "برو ⭐",
    taglineFr: "Le 3 en 1 complet : boutique, confirmatrices, DHD & Finance IA.",
    taglineAr: "الباقة المتكاملة 3 في 1: المتجر، فريق التأكيد، التوصيل والمالية الذكية.",
    monthlyPriceDzd: 6900,
    trialDays: 14,
    badgeFr: "Le plus populaire",
    badgeAr: "الأكثر طلباً",
    recommended: true,
    limits: {
      ordersPerMonth: 2000,
      staffMembers: 5,
      stores: 1,
      maxPixels: null,
      carriers: "all",
    },
    featuresFr: [
      "Jusqu'à 2 000 commandes / mois",
      "5 membres d'équipe (confirmateurs + commissions)",
      "Tous transporteurs (EcoTrack/DHD + E-com Delivery)",
      "Multi-Pixels Meta & TikTok illimités + CAPI",
      "Relances paniers abandonnés & synchro Google Sheets",
      "Suivi colis temps réel + alertes Retours & Livrés",
      "Studio IA créateur de landing pages inclus",
    ],
    featuresAr: [
      "حتى 2000 طلب شهرياً",
      "5 أعضاء في الفريق (مؤكدات الطلبات + العمولات)",
      "جميع شركات التوصيل (EcoTrack/DHD + E-com)",
      "بيكسلات متعددة غير محدودة + حماية CAPI",
      "استرجاع السلات المتروكة ومزامنة Google Sheets",
      "تتبع فوري للطرود وتنبيهات التوصيل والمرتجعات",
      "استوديو الذكاء الاصطناعي لإنشاء صفحات الهبوط",
    ],
    ctaFr: "Démarrer l'essai Pro 14j",
    ctaAr: "ابدأ تجربة Pro المجانية",
  },
  {
    id: "business",
    nameFr: "Business",
    nameAr: "بيزنس",
    taglineFr: "Pour les gros volumes, équipes multi-confirmateurs & pilotage ROAS.",
    taglineAr: "للمتاجر الكبرى والفرق الكبيرة مع تحليل الربح الصافي والحملات.",
    monthlyPriceDzd: 14900,
    trialDays: 0,
    badgeFr: "Scale & Finance IA",
    badgeAr: "توسع بدون حدود",
    limits: {
      ordersPerMonth: null,
      staffMembers: null,
      stores: 3,
      maxPixels: null,
      carriers: "all",
    },
    featuresFr: [
      "Commandes illimitées chaque mois",
      "Membres & confirmateurs illimités",
      "Tous transporteurs + API & Webhooks temps réel",
      "Finance IA avancée (lots FIFO, bénéfice net, ROAS FB/TikTok)",
      "Jusqu'à 3 boutiques & domaines personnalisés",
      "Accompagnement prioritaire WhatsApp 7j/7",
    ],
    featuresAr: [
      "طلبات غير محدودة كل شهر",
      "عدد غير محدود من الأعضاء ومؤكدي الطلبات",
      "كل شركات التوصيل + ربط API و Webhook فوري",
      "المالية بالذكاء الاصطناعي (FIFO، صافي الربح، ROAS)",
      "حتى 3 متاجر مع ربط النطاق الخاص بك",
      "دعم ومرافقة VIP عبر واتساب طوال الأسبوع",
    ],
    ctaFr: "Demander une démo / Démarrer",
    ctaAr: "اطلب عرضاً أو اشترك الآن",
  },
] as const;

export interface GcomeComparisonRow {
  categoryFr: string;
  categoryAr: string;
  featureFr: string;
  featureAr: string;
  starterFr: string;
  starterAr: string;
  proFr: string;
  proAr: string;
  businessFr: string;
  businessAr: string;
}

export const GCOME_COMPARISON_MATRIX: readonly GcomeComparisonRow[] = [
  {
    categoryFr: "Volume & Boutiques",
    categoryAr: "الطلبات والمتاجر",
    featureFr: "Commandes mensuelles",
    featureAr: "عدد الطلبات شهرياً",
    starterFr: "300 / mois",
    starterAr: "300 / شهر",
    proFr: "2 000 / mois",
    proAr: "2,000 / شهر",
    businessFr: "Illimitées",
    businessAr: "غير محدودة",
  },
  {
    categoryFr: "Volume & Boutiques",
    categoryAr: "الطلبات والمتاجر",
    featureFr: "Landing pages & Studio IA",
    featureAr: "صفحات الهبوط واستوديو IA",
    starterFr: "Templates inclus",
    starterAr: "قوالب جاهزة",
    proFr: "Templates + Studio IA",
    proAr: "قوالب + استوديو IA",
    businessFr: "Illimité + Sur-mesure",
    businessAr: "غير محدود + مخصص",
  },
  {
    categoryFr: "Équipe & Confirmation",
    categoryAr: "الفريق والتأكيد",
    featureFr: "Membres / Confirmateurs",
    featureAr: "أعضاء فريق التأكيد",
    starterFr: "1 membre",
    starterAr: "عضو واحد",
    proFr: "5 membres",
    proAr: "5 أعضاء",
    businessFr: "Illimités",
    businessAr: "غير محدود",
  },
  {
    categoryFr: "Équipe & Confirmation",
    categoryAr: "الفريق والتأكيد",
    featureFr: "Calcul automatique commissions",
    featureAr: "حساب العمولات والأجور تلقائياً",
    starterFr: "—",
    starterAr: "—",
    proFr: "Inclus",
    proAr: "متوفر",
    businessFr: "Avancé + export paie",
    businessAr: "متقدم + كشف أجور",
  },
  {
    categoryFr: "Équipe & Confirmation",
    categoryAr: "الفريق والتأكيد",
    featureFr: "Relance paniers abandonnés",
    featureAr: "استرجاع السلات المتروكة",
    starterFr: "Basique",
    starterAr: "أساسي",
    proFr: "Complet + alertes",
    proAr: "كامل + تنبيهات",
    businessFr: "Complet + prioritaire",
    businessAr: "كامل + أولوية",
  },
  {
    categoryFr: "Livraison & Pixels",
    categoryAr: "التوصيل والبيكسل",
    featureFr: "Transporteurs (EcoTrack/DHD, E-com)",
    featureAr: "شركات التوصيل 58 ولاية",
    starterFr: "1 transporteur",
    starterAr: "شركة واحدة",
    proFr: "Tous (multi-comptes)",
    proAr: "كل الشركات معاً",
    businessFr: "Tous + API & Webhooks",
    businessAr: "الكل + ربط API",
  },
  {
    categoryFr: "Livraison & Pixels",
    categoryAr: "التوصيل والبيكسل",
    featureFr: "Pixels Meta & TikTok + CAPI",
    featureAr: "بيكسلات فيسبوك وتيك توك + CAPI",
    starterFr: "1 pixel",
    starterAr: "بيكسل واحد",
    proFr: "Multi-pixels illimités",
    proAr: "متعدد غير محدود",
    businessFr: "Multi-pixels + CAPI dédié",
    businessAr: "غير محدود + CAPI متقدم",
  },
  {
    categoryFr: "Finance IA",
    categoryAr: "المالية الذكية",
    featureFr: "Bénéfice net, lots FIFO & ROAS réel",
    featureAr: "صافي الربح، المخزون و ROAS الحقيقي",
    starterFr: "Vue CA simple",
    starterAr: "إجمالي المبيعات",
    proFr: "Suivi livré & encaissé",
    proAr: "تتبع التحصيل والمرتجعات",
    businessFr: "Suite Finance IA & CFO",
    businessAr: "المالية الذكية كاملة",
  },
];

export function computeBillingPrice(
  planId: GcomePaidPlanId,
  cycle: GcomeBillingCycle
): {
  monthlyEquivalentDzd: number;
  totalChargedDzd: number;
  savingsPerYearDzd: number;
} {
  const plan = GCOME_PLANS.find(p => p.id === planId) ?? GCOME_PLANS[1];
  const baseMonthly = plan.monthlyPriceDzd;
  if (cycle === "yearly") {
    const discountedMonthly = Math.round(baseMonthly * (1 - GCOME_ANNUAL_DISCOUNT_PCT / 100));
    const totalYearly = discountedMonthly * 12;
    const fullYearly = baseMonthly * 12;
    return {
      monthlyEquivalentDzd: discountedMonthly,
      totalChargedDzd: totalYearly,
      savingsPerYearDzd: fullYearly - totalYearly,
    };
  }
  return {
    monthlyEquivalentDzd: baseMonthly,
    totalChargedDzd: baseMonthly,
    savingsPerYearDzd: 0,
  };
}

export interface GcomeSubscriptionState {
  planId: GcomePlanId;
  cycle: GcomeBillingCycle;
  status: "active" | "trialing" | "past_due" | "cancelled";
  isOwnerUnlimited: boolean;
  storeName: string;
  subdomain: string;
  startedAt: string;
  renewsAt: string;
  trialEndsAt: string | null;
  lastPaymentMethod?: GcomePaymentMethod | null;
}

export interface GcomeInvoiceRecord {
  id: string;
  createdAt: string;
  planId: GcomePaidPlanId;
  cycle: GcomeBillingCycle;
  amountDzd: number;
  paymentMethod: GcomePaymentMethod;
  status: "paid" | "pending_verification" | "preparation_mode" | "failed";
  reference?: string;
  customerName?: string;
  storeName?: string;
  phone?: string;
  ccpReceiptNote?: string;
  note?: string;
}

export interface GcomeSignupLead {
  id: string;
  createdAt: string;
  fullName: string;
  phone: string;
  email: string;
  storeName: string;
  subdomain: string;
  wilaya: string;
  monthlyVolume: string;
  planId: GcomePaidPlanId;
  cycle: GcomeBillingCycle;
  lang: "fr" | "ar";
  status: "new" | "contacted" | "activated" | "archived";
}

export interface PersistedBillingState {
  subscription: GcomeSubscriptionState;
  invoices: GcomeInvoiceRecord[];
  signupLeads: GcomeSignupLead[];
}

export function createDefaultBillingState(): PersistedBillingState {
  const nowIso = new Date().toISOString();
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    subscription: {
      planId: "owner_unlimited",
      cycle: "monthly",
      status: "active",
      isOwnerUnlimited: true,
      storeName: "Miss Sensuelle",
      subdomain: "missensuelle",
      startedAt: "2026-01-01T00:00:00.000Z",
      renewsAt: nextMonth || nowIso,
      trialEndsAt: null,
      lastPaymentMethod: null,
    },
    invoices: [],
    signupLeads: [],
  };
}

export const billingSignupSchema = z.object({
  fullName: z.string().trim().min(2, "Nom requis").max(120),
  phone: z.string().trim().min(8, "Téléphone requis").max(30),
  email: z.string().trim().email("Email invalide").max(160),
  storeName: z.string().trim().min(2, "Nom de boutique requis").max(100),
  subdomain: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/i, "Sous-domaine alphanumérique uniquement"),
  wilaya: z.string().trim().min(2).max(80).default("Alger"),
  monthlyVolume: z.string().trim().max(40).default("100-500"),
  planId: z.enum(["starter", "pro", "business"]).default("pro"),
  cycle: z.enum(["monthly", "yearly"]).default("monthly"),
  lang: z.enum(["fr", "ar"]).default("fr"),
});

export const billingCheckoutSchema = z.object({
  planId: z.enum(["starter", "pro", "business"]),
  cycle: z.enum(["monthly", "yearly"]).default("monthly"),
  paymentMethod: z.enum(["chargily", "ccp", "card"]),
  customerName: z.string().trim().min(2).max(120).optional(),
  storeName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  ccpReference: z.string().trim().max(120).optional(),
  ccpReceiptNote: z.string().trim().max(500).optional(),
  signupId: z.string().trim().max(80).optional(),
});

export const billingRequestUpgradeSchema = z.object({
  planId: z.enum(["starter", "pro", "business"]),
  cycle: z.enum(["monthly", "yearly"]).default("monthly"),
  paymentMethod: z.enum(["chargily", "ccp", "card"]).default("chargily"),
  note: z.string().trim().max(300).optional(),
});

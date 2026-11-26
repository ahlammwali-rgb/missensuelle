import { useId } from "react";

export type GcomeLogoConcept = "trinity" | "arrow" | "crown";
export type GcomeLogoVariant = "icon" | "compact" | "full";

export const GCOME_LOGO_CONCEPTS: ReadonlyArray<{
  id: GcomeLogoConcept;
  titleFr: string;
  titleAr: string;
  descFr: string;
  descAr: string;
}> = [
  {
    id: "trinity",
    titleFr: "Concept 1 · Monogramme « G » 3 couches (Recommandé)",
    titleAr: "التصميم 1 · حرف G ثلاثي الطبقات (موصى به)",
    descFr: "3 rubans imbriqués (Boutique, Commandes, Livraison) qui forment un G sculptural.",
    descAr: "3 طبقات متداخلة (المتجر، الطلبات، التوصيل) تشكّل حرف G عصري.",
  },
  {
    id: "arrow",
    titleFr: "Concept 2 · G + Flèche d'expédition",
    titleAr: "التصميم 2 · G + سهم الشحن السريع",
    descFr: "Un G géométrique dont la barre centrale lance une flèche dorée vers la livraison.",
    descAr: "حرف G هندسي ينطلق منه سهم ذهبي يرمز للسرعة والتوصيل.",
  },
  {
    id: "crown",
    titleFr: "Concept 3 · G + Sac + Couronne modernisé",
    titleAr: "التصميم 3 · G + حقيبة + تاج مطوّر",
    descFr: "L'ADN historique GCOME revisité avec un sac géométrique et une couronne or minimaliste.",
    descAr: "تطوير الشعار الأصلي بحقيبة تسوق عصرية وتاج ذهبي أنيق.",
  },
];

interface GcomeLogoProps {
  concept?: GcomeLogoConcept;
  variant?: GcomeLogoVariant;
  lang?: "fr" | "ar";
  subtitle?: string;
  size?: number;
  className?: string;
  tone?: "auto" | "light" | "dark";
}

export function GcomeMarkSvg({
  concept = "trinity",
  size = 40,
  className = "",
}: {
  concept?: GcomeLogoConcept;
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const vGrad = `gcomeViolet-${uid}`;
  const gGrad = `gcomeGold-${uid}`;
  const dGrad = `gcomeDeep-${uid}`;

  if (concept === "arrow") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={dGrad} x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B0764" />
            <stop offset="55%" stopColor="#5B21B6" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient id={vGrad} x1="12" y1="14" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DDD6FE" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>
          <linearGradient id={gGrad} x1="26" y1="36" x2="54" y2="14" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="#F5B301" />
            <stop offset="100%" stopColor="#FDE047" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="56" height="56" rx="16" fill={`url(#${dGrad})`} />
        <rect x="4.75" y="4.75" width="54.5" height="54.5" rx="15.25" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
        {/* Architectural C / G ring */}
        <path
          d="M44.5 21.2C41.3 17.9 36.8 16 32 16C23.16 16 16 23.16 16 32C16 40.84 23.16 48 32 48C40.1 48 46.8 41.98 47.85 34.2"
          stroke={`url(#${vGrad})`}
          strokeWidth="6.4"
          strokeLinecap="round"
        />
        {/* Kinetic gold express delivery arrow launching out of the G crossbar */}
        <path
          d="M30 33.5H43.5L51.5 21.5"
          stroke={`url(#${gGrad})`}
          strokeWidth="5.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M42.5 20.5H52.5V30.5"
          stroke={`url(#${gGrad})`}
          strokeWidth="4.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (concept === "crown") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={dGrad} x1="8" y1="8" x2="56" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4C1D95" />
            <stop offset="60%" stopColor="#6D28D9" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id={gGrad} x1="18" y1="6" x2="46" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#F5B301" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
        </defs>
        {/* Minimalist luxury 3-peak gold crown */}
        <path
          d="M19 18.5L22.5 9.5L32 14.5L41.5 9.5L45 18.5H19Z"
          fill={`url(#${gGrad})`}
        />
        <circle cx="22.5" cy="8.5" r="2" fill="#FDE047" />
        <circle cx="32" cy="7.5" r="2.3" fill="#FDE047" />
        <circle cx="41.5" cy="8.5" r="2" fill="#FDE047" />
        {/* Modernized sculpted geometric shopping bag with subtle handle */}
        <path
          d="M24 23V20.5C24 18.5 27.5 17 32 17C36.5 17 40 18.5 40 20.5V23"
          stroke="#C4B5FD"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <rect x="12" y="21" width="40" height="36" rx="12" fill={`url(#${dGrad})`} />
        <rect x="12.75" y="21.75" width="38.5" height="34.5" rx="11.25" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
        {/* Crisp bold G negative-space cutout + gold accent node */}
        <path
          d="M40.5 32.8C38.4 30.6 35.4 29.4 32 29.4C25.92 29.4 21 34.1 21 39.8C21 45.5 25.92 50.2 32 50.2C37.65 50.2 42 46.3 42.4 40.8H32.5"
          stroke="#FFFFFF"
          strokeWidth="4.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="42.2" cy="39.8" r="2.4" fill="#F5B301" />
      </svg>
    );
  }

  // Default: Concept 1 — Monogramme "G" 3 couches (Boutique + Commandes + Livraison 3-en-1)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={dGrad} x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E103B" />
          <stop offset="55%" stopColor="#4C1D95" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
        <linearGradient id={vGrad} x1="14" y1="14" x2="50" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C4B5FD" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id={gGrad} x1="26" y1="30" x2="52" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#F5B301" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill={`url(#${dGrad})`} />
      <rect x="4.75" y="4.75" width="54.5" height="54.5" rx="15.25" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      {/* Layer 1 (Back arc — Boutique & Landings) */}
      <path
        d="M46.5 21.5C42.9 16.9 37.4 14 31.2 14C20.6 14 12 22.4 12 32.8C12 43.2 20.6 51.6 31.2 51.6C38.1 51.6 44.1 48 47.4 42.6"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="5.2"
        strokeLinecap="round"
      />
      {/* Layer 2 (Middle vibrant violet arc — Commandes & CRM) */}
      <path
        d="M45.2 21.6C41.8 17.8 36.8 15.5 31.3 15.5C21.75 15.5 14 23.1 14 32.5C14 41.9 21.75 49.5 31.3 49.5C39.2 49.5 45.8 44.3 47.8 37.1"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Layer 3 (Inner orbital ring + Gold bar — Livraison & Finance 3-en-1) */}
      <path
        d="M39.5 25.4C37.4 23.3 34.5 22 31.3 22C25.6 22 21 26.7 21 32.5C21 38.3 25.6 43 31.3 43C36.6 43 40.9 39.1 41.5 34.1"
        stroke={`url(#${vGrad})`}
        strokeWidth="3.8"
        strokeLinecap="round"
      />
      <rect x="31" y="30" width="17.5" height="5.4" rx="2.7" fill={`url(#${gGrad})`} />
    </svg>
  );
}

export function GcomeLogo({
  concept = "trinity",
  variant = "compact",
  lang = "fr",
  subtitle,
  size,
  className = "",
  tone = "auto",
}: GcomeLogoProps) {
  const iconSize = size ?? (variant === "icon" ? 36 : variant === "full" ? 44 : 32);
  const resolvedSubtitle =
    subtitle ??
    (lang === "ar" ? "متجر · تأكيد · توصيل" : "Vendez · Confirmez · Livrez");

  if (variant === "icon") {
    return <GcomeMarkSvg concept={concept} size={iconSize} className={className} />;
  }

  return (
    <span
      className={`gcome-logo-lockup is-${variant} tone-${tone} ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: variant === "full" ? 11 : 8,
        direction: "ltr",
        userSelect: "none",
      }}
    >
      <GcomeMarkSvg concept={concept} size={iconSize} />
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          lineHeight: 1.05,
          textAlign: "left",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <strong
            className="gcome-logo-wordmark"
            style={{
              fontSize: variant === "full" ? 21 : 17,
              fontWeight: 900,
              letterSpacing: "-0.04em",
            }}
          >
            GCOME
          </strong>
          <span
            style={{
              fontSize: variant === "full" ? 10 : 9,
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #FDE047, #F5B301)",
              color: "#1E103B",
              letterSpacing: "0.04em",
            }}
          >
            3 EN 1
          </span>
        </span>
        <small
          className="gcome-logo-tagline"
          style={{
            fontSize: variant === "full" ? 11 : 9.5,
            fontWeight: 700,
            marginTop: 2,
            opacity: 0.78,
          }}
        >
          {resolvedSubtitle}
        </small>
      </span>
    </span>
  );
}

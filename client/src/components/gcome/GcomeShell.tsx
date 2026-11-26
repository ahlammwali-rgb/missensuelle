import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  CreditCard,
  Globe,
  Home,
  Layers3,
  LogIn,
  Moon,
  Rocket,
  Smartphone,
  Sun,
} from "lucide-react";
import { GcomeLogo, type GcomeLogoConcept } from "@/components/GcomeLogo";
import { useGcomeLang } from "@/lib/gcome-i18n";
import { gcomeHref, isGcomeStandaloneHost } from "@/lib/gcome-routing";
import { useTheme } from "@/contexts/ThemeContext";
import "@/pages/gcome/gcome-app.css";

interface GcomeShellProps {
  children: ReactNode;
  titleFr: string;
  titleAr: string;
  descriptionFr: string;
  descriptionAr: string;
  activeTab?: "home" | "three_in_one" | "previews" | "pricing" | "signup" | "login";
  logoConcept?: GcomeLogoConcept;
  hideDock?: boolean;
  hideFooter?: boolean;
}

export function GcomeShell({
  children,
  titleFr,
  titleAr,
  descriptionFr,
  descriptionAr,
  activeTab = "home",
  logoConcept = "trinity",
  hideDock = false,
  hideFooter = false,
}: GcomeShellProps) {
  const { lang, dir, toggleLang, tx } = useGcomeLang();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const standalone = isGcomeStandaloneHost();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Update SEO <title>, description, OG & SVG favicon when inside GCOME
  useEffect(() => {
    const prevTitle = document.title;
    const descMeta = document.querySelector('meta[name="description"]');
    const prevDesc = descMeta?.getAttribute("content") ?? "";
    const iconLink = document.querySelector('link[rel="icon"]');
    const prevIcon = iconLink?.getAttribute("href") ?? "";

    document.title = tx(titleFr, titleAr);
    if (descMeta) descMeta.setAttribute("content", tx(descriptionFr, descriptionAr));
    if (iconLink) iconLink.setAttribute("href", "/gcome-icon.svg");

    return () => {
      document.title = prevTitle;
      if (descMeta && prevDesc) descMeta.setAttribute("content", prevDesc);
      if (iconLink && prevIcon) iconLink.setAttribute("href", prevIcon);
    };
  }, [titleFr, titleAr, descriptionFr, descriptionAr, tx]);

  const scrollToHomeAnchor = (hashId: string) => {
    const target = document.getElementById(hashId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }
    return false;
  };

  const dockItems = [
    {
      id: "home" as const,
      href: gcomeHref("/"),
      anchor: "gc-hero",
      label: tx("Accueil", "الرئيسية"),
      icon: Home,
    },
    {
      id: "three_in_one" as const,
      href: gcomeHref("/#gc-3in1"),
      anchor: "gc-3in1",
      label: tx("3 en 1", "3 في 1"),
      icon: Layers3,
    },
    {
      id: "previews" as const,
      href: gcomeHref("/#gc-previews"),
      anchor: "gc-previews",
      label: tx("Aperçus", "معاينة"),
      icon: Smartphone,
    },
    {
      id: "pricing" as const,
      href: gcomeHref("/tarifs"),
      anchor: null,
      label: tx("Tarifs", "الأسعار"),
      icon: CreditCard,
    },
    {
      id: "signup" as const,
      href: gcomeHref("/inscription"),
      anchor: null,
      label: tx("Démarrer", "ابدأ"),
      icon: Rocket,
      isCta: true,
    },
  ];

  const isHomeRoute =
    location === "/gcome" || (standalone && (location === "/" || location === ""));

  return (
    <div className="gcome-app-shell" dir={dir} lang={lang}>
      {/* Top App Bar */}
      <header className={`gc-topbar${scrolled ? " is-scrolled" : ""}`}>
        <div className="gcome-container gc-topbar-inner">
          <Link href={gcomeHref("/")} aria-label="GCOME Accueil" style={{ textDecoration: "none" }}>
            <GcomeLogo concept={logoConcept} variant="compact" lang={lang} />
          </Link>

          <nav className="gc-nav-desktop" aria-label={tx("Navigation GCOME", "تصفح GCOME")}>
            <Link
              href={gcomeHref("/")}
              className={`gc-nav-link${activeTab === "home" ? " is-active" : ""}`}
            >
              {tx("Accueil", "الرئيسية")}
            </Link>
            <a
              href={gcomeHref("/#gc-3in1")}
              onClick={e => {
                if (isHomeRoute && scrollToHomeAnchor("gc-3in1")) e.preventDefault();
              }}
              className={`gc-nav-link${activeTab === "three_in_one" ? " is-active" : ""}`}
            >
              {tx("Le 3 en 1", "نظام 3 في 1")}
            </a>
            <a
              href={gcomeHref("/#gc-previews")}
              onClick={e => {
                if (isHomeRoute && scrollToHomeAnchor("gc-previews")) e.preventDefault();
              }}
              className={`gc-nav-link${activeTab === "previews" ? " is-active" : ""}`}
            >
              {tx("Aperçus", "واجهات حية")}
            </a>
            <Link
              href={gcomeHref("/tarifs")}
              className={`gc-nav-link${activeTab === "pricing" ? " is-active" : ""}`}
            >
              {tx("Tarifs", "الأسعار")}
            </Link>
            <a
              href={gcomeHref("/#gc-faq")}
              onClick={e => {
                if (isHomeRoute && scrollToHomeAnchor("gc-faq")) e.preventDefault();
              }}
              className="gc-nav-link"
            >
              {tx("FAQ", "الأسئلة")}
            </a>
          </nav>

          <div className="gc-top-actions">
            <button
              type="button"
              onClick={toggleLang}
              className="gc-pill-btn"
              title={tx("Passer en arabe", "التبديل إلى الفرنسية")}
              aria-label={tx("Changer de langue", "تغيير اللغة")}
            >
              <Globe size={14} />
              <span>{lang === "fr" ? "عربي" : "FR"}</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="gc-pill-btn"
              aria-label={tx("Mode clair ou sombre", "الوضع الليلي أو النهاري")}
              style={{ width: 36, padding: 0 }}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <Link href={gcomeHref("/connexion")} className="gc-pill-btn">
              <LogIn size={14} />
              <span className="gc-hide-xs">{tx("Connexion", "دخول")}</span>
            </Link>

            <Link href={gcomeHref("/inscription")} className="gc-pill-btn is-primary">
              <span>{tx("Essai 14j", "تجربة 14 يوم")}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      {!hideFooter && (
        <footer className="gc-footer">
          <div className="gcome-container">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 24,
                alignItems: "start",
              }}
            >
              <div>
                <GcomeLogo concept={logoConcept} variant="full" lang={lang} />
                <p style={{ marginTop: 12, fontSize: 13.5, color: "var(--gc-text-muted)", lineHeight: 1.6 }}>
                  {tx(
                    "La plateforme SaaS 3 en 1 conçue pour les e-commerçants en Algérie : boutique COD haute conversion, équipe de confirmation et livraison 58 wilayas.",
                    "منصة التجارة الإلكترونية 3 في 1 المصممة خصيصاً للسوق الجزائري: متجر عالي التحويل، فريق تأكيد، وشحن لـ 58 ولاية."
                  )}
                </p>
              </div>

              <div>
                <strong style={{ fontSize: 13.5, display: "block", marginBottom: 10 }}>
                  {tx("Produit", "المنصة")}
                </strong>
                <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
                  <Link href={gcomeHref("/")} className="gc-nav-link" style={{ padding: "2px 0" }}>
                    {tx("Accueil GCOME 3 en 1", "الصفحة الرئيسية GCOME")}
                  </Link>
                  <Link href={gcomeHref("/tarifs")} className="gc-nav-link" style={{ padding: "2px 0" }}>
                    {tx("Tarifs & Abonnements", "الأسعار والباقات")}
                  </Link>
                  <Link href={gcomeHref("/inscription")} className="gc-nav-link" style={{ padding: "2px 0" }}>
                    {tx("Créer une boutique (14j gratuits)", "إنشاء متجر (14 يوم مجاناً)")}
                  </Link>
                  <Link href={gcomeHref("/connexion")} className="gc-nav-link" style={{ padding: "2px 0" }}>
                    {tx("Connexion Tableau de bord", "تسجيل الدخول")}
                  </Link>
                </div>
              </div>

              <div>
                <strong style={{ fontSize: 13.5, display: "block", marginBottom: 10 }}>
                  {tx("Légal & Paiements", "القانونية والدفع")}
                </strong>
                <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
                  <Link href={gcomeHref("/paiement")} className="gc-nav-link" style={{ padding: "2px 0" }}>
                    {tx("Paiement CIB / Edahabia / CCP", "الدفع الإلكتروني أو البريدي")}
                  </Link>
                  <Link href={gcomeHref("/cgu")} className="gc-nav-link" style={{ padding: "2px 0" }}>
                    {tx("Conditions Générales (CGU)", "شروط الاستخدام")}
                  </Link>
                  <Link href={gcomeHref("/confidentialite")} className="gc-nav-link" style={{ padding: "2px 0" }}>
                    {tx("Politique de confidentialité", "سياسة الخصوصية")}
                  </Link>
                  <Link href={gcomeHref("/remboursement")} className="gc-nav-link" style={{ padding: "2px 0" }}>
                    {tx("Politique de remboursement", "سياسة الاسترجاع")}
                  </Link>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 26,
                paddingTop: 18,
                borderTop: "1px solid var(--gc-border)",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                fontSize: 12.5,
                color: "var(--gc-text-muted)",
              }}
            >
              <span>
                © {new Date().getFullYear()} GCOME DZ —{" "}
                {tx("Propulse les boutiques algériennes.", "محرك المتاجر الجزائرية.")}
              </span>
              {!standalone && (
                <Link href="/" style={{ color: "var(--gc-primary)", fontWeight: 700, textDecoration: "none" }}>
                  {tx("Voir la boutique démo (Miss Sensuelle) →", "زيارة متجر العرض (Miss Sensuelle) ←")}
                </Link>
              )}
            </div>
          </div>
        </footer>
      )}

      {/* Mobile-First Bottom Sticky App Navigation Dock */}
      {!hideDock && (
        <nav className="gc-mobile-dock" aria-label={tx("Barre d'application mobile", "شريط التطبيق السفلي")}>
          {dockItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            if (item.anchor && isHomeRoute) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToHomeAnchor(item.anchor!)}
                  className={`gc-dock-item${isActive ? " is-active" : ""}`}
                >
                  {isActive && <motion.span layoutId="gcDockPill" className="gc-dock-pill-bg" />}
                  <Icon size={17} />
                  <span>{item.label}</span>
                </button>
              );
            }
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`gc-dock-item${isActive ? " is-active" : ""}${item.isCta ? " gc-dock-cta" : ""}`}
              >
                {isActive && !item.isCta && (
                  <motion.span layoutId="gcDockPill" className="gc-dock-pill-bg" />
                )}
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

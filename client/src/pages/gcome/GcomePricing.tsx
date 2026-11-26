import { useState } from "react";
import { Link } from "wouter";
import { Check, Crown, HelpCircle, ShieldCheck } from "lucide-react";
import { GcomeShell } from "@/components/gcome/GcomeShell";
import { formatDzdLocale, useGcomeLang } from "@/lib/gcome-i18n";
import { gcomeHref } from "@/lib/gcome-routing";
import {
  computeBillingPrice,
  GCOME_COMPARISON_MATRIX,
  GCOME_PLANS,
  type GcomeBillingCycle,
  type GcomePaidPlanId,
} from "@shared/billing";

export default function GcomePricing() {
  const { lang, tx } = useGcomeLang();
  const [cycle, setCycle] = useState<GcomeBillingCycle>("monthly");
  const [mobilePlan, setMobilePlan] = useState<GcomePaidPlanId>("pro");
  const [matrixCategory, setMatrixCategory] = useState<string>("all");

  const categories = Array.from(
    new Set(GCOME_COMPARISON_MATRIX.map(r => (lang === "ar" ? r.categoryAr : r.categoryFr)))
  );

  const visibleRows =
    matrixCategory === "all"
      ? GCOME_COMPARISON_MATRIX
      : GCOME_COMPARISON_MATRIX.filter(
          r => (lang === "ar" ? r.categoryAr : r.categoryFr) === matrixCategory
        );

  return (
    <GcomeShell
      activeTab="pricing"
      titleFr="Tarifs GCOME · Abonnements SaaS en Dinars (DA)"
      titleAr="أسعار GCOME · خطط الاشتراك بالدينار الجزائري"
      descriptionFr="Choisis ton plan Starter, Pro ou Business en Dinars Algériens. Essai gratuit 14 jours sans carte requise et remise -20 % en annuel."
      descriptionAr="اختر باقة Starter أو Pro أو Business بالدينار الجزائري مع 14 يوم تجربة مجانية وخصم 20% للاشتراك السنوي."
    >
      <section className="gc-section">
        <div className="gcome-container">
          <div className="gc-section-head">
            <span className="gc-eyebrow">
              <Crown size={14} color="#F5B301" /> {tx("Tarifs & Abonnements", "الخطط والأسعار")}
            </span>
            <h1 className="gc-hero-title" style={{ marginTop: 12 }}>
              {tx("Des prix transparents en ", "أسعار واضحة بالدينار ")}
              <span className="is-accent">{tx("Dinars Algériens.", "بدون مفاجآت.")}</span>
            </h1>
            <p className="gc-section-sub">
              {tx(
                "Aucun pourcentage pris sur tes ventes. Tu gardes 100 % de ton chiffre d'affaires, avec 14 jours d'essai gratuit sur Starter & Pro.",
                "لا نأخذ أي عمولة على مبيعاتك. تحتفظ بـ 100% من أرباحك مع 14 يوماً تجربة مجانية."
              )}
            </p>

            {/* Billing cycle switcher */}
            <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
              <div className="gc-segmented">
                <button
                  type="button"
                  onClick={() => setCycle("monthly")}
                  className={`gc-segmented-btn${cycle === "monthly" ? " is-active" : ""}`}
                >
                  {tx("Facturation mensuelle", "دفع شهري")}
                </button>
                <button
                  type="button"
                  onClick={() => setCycle("yearly")}
                  className={`gc-segmented-btn${cycle === "yearly" ? " is-active" : ""}`}
                >
                  {tx("Annuel · Économise 20 %", "سنوي · وفّر 20%")}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Plan Switcher */}
          <div className="md:hidden" style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div className="gc-segmented">
              {GCOME_PLANS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setMobilePlan(p.id)}
                  className={`gc-segmented-btn${mobilePlan === p.id ? " is-active" : ""}`}
                >
                  {tx(p.nameFr, p.nameAr)}
                </button>
              ))}
            </div>
          </div>

          {/* Pricing Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {GCOME_PLANS.map(plan => {
              const p = computeBillingPrice(plan.id, cycle);
              const hideMobile = mobilePlan !== plan.id;
              return (
                <div
                  key={plan.id}
                  className={`gc-card ${hideMobile ? "hidden md:flex" : "flex"}`}
                  style={{
                    flexDirection: "column",
                    justifyContent: "space-between",
                    borderWidth: plan.recommended ? 2 : 1,
                    borderColor: plan.recommended ? "#7C3AED" : undefined,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h2 style={{ fontSize: 20, fontWeight: 900 }}>{tx(plan.nameFr, plan.nameAr)}</h2>
                      {plan.badgeFr && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 900,
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: plan.recommended
                              ? "linear-gradient(135deg, #FDE047, #F5B301)"
                              : "var(--gc-surface-muted)",
                            color: plan.recommended ? "#1E103B" : "var(--gc-primary)",
                          }}
                        >
                          {tx(plan.badgeFr, plan.badgeAr)}
                        </span>
                      )}
                    </div>
                    <p style={{ marginTop: 6, fontSize: 13, color: "var(--gc-text-muted)", minHeight: 38 }}>
                      {tx(plan.taglineFr, plan.taglineAr)}
                    </p>
                    <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 6 }}>
                      <strong style={{ fontSize: 32, fontWeight: 900 }}>
                        {formatDzdLocale(p.monthlyEquivalentDzd, lang)}
                      </strong>
                      <span style={{ fontSize: 13, color: "var(--gc-text-muted)", fontWeight: 700 }}>
                        {tx("/ mois", "/ شهر")}
                      </span>
                    </div>
                    {cycle === "yearly" && (
                      <small style={{ color: "#10B981", fontWeight: 800, display: "block", marginTop: 3 }}>
                        {tx(
                          `Facturé ${formatDzdLocale(p.totalChargedDzd, lang)}/an · Économie ${formatDzdLocale(p.savingsPerYearDzd, lang)}`,
                          `يُدفع ${formatDzdLocale(p.totalChargedDzd, lang)} سنوياً · توفير ${formatDzdLocale(p.savingsPerYearDzd, lang)}`
                        )}
                      </small>
                    )}

                    <ul style={{ marginTop: 18, padding: 0, listStyle: "none", display: "grid", gap: 9 }}>
                      {(lang === "ar" ? plan.featuresAr : plan.featuresFr).map((f, idx) => (
                        <li key={idx} style={{ display: "flex", gap: 8, fontSize: 13, alignItems: "flex-start" }}>
                          <Check size={16} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ marginTop: 22, display: "grid", gap: 8 }}>
                    <Link
                      href={`${gcomeHref("/inscription")}?plan=${plan.id}&cycle=${cycle}`}
                      className={plan.recommended ? "gc-btn-hero-primary" : "gc-btn-hero-secondary"}
                      style={{ width: "100%" }}
                    >
                      {tx(plan.ctaFr, plan.ctaAr)}
                    </Link>
                    <Link
                      href={`${gcomeHref("/paiement")}?plan=${plan.id}&cycle=${cycle}`}
                      style={{
                        textAlign: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--gc-primary)",
                        textDecoration: "none",
                      }}
                    >
                      {tx("Ou activer directement par CIB / CCP →", "أو التفعيل المباشر عبر الذهبية / CCP ←")}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile-Friendly Comparison Matrix */}
          <div className="gc-card" style={{ marginTop: 32 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 900 }}>
                  {tx("Comparatif détaillé des fonctionnalités", "مقارنة تفصيلية لجميع المميزات")}
                </h2>
                <small style={{ fontSize: 12.5, color: "var(--gc-text-muted)" }}>
                  {tx("Filtre par catégorie sur mobile pour lire sans effort :", "صفّي حسب القسم لسهولة القراءة على الهاتف:")}
                </small>
              </div>
              <div className="gc-segmented">
                <button
                  type="button"
                  onClick={() => setMatrixCategory("all")}
                  className={`gc-segmented-btn${matrixCategory === "all" ? " is-active" : ""}`}
                >
                  {tx("Tout", "الكل")}
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setMatrixCategory(cat)}
                    className={`gc-segmented-btn${matrixCategory === cat ? " is-active" : ""}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {visibleRows.map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 13,
                    borderRadius: 15,
                    background: "var(--gc-surface-muted)",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 13.5, fontWeight: 800 }}>
                      {tx(row.featureFr, row.featureAr)}
                    </strong>
                    <span style={{ fontSize: 11, color: "var(--gc-primary)", fontWeight: 800 }}>
                      {tx(row.categoryFr, row.categoryAr)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 8,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ padding: "6px 8px", borderRadius: 10, background: "var(--gc-surface)" }}>
                      <small style={{ display: "block", opacity: 0.65, fontSize: 10 }}>Starter</small>
                      <strong>{tx(row.starterFr, row.starterAr)}</strong>
                    </div>
                    <div style={{ padding: "6px 8px", borderRadius: 10, background: "var(--gc-surface)", border: "1px solid rgba(124,58,237,0.3)" }}>
                      <small style={{ display: "block", color: "#7C3AED", fontSize: 10, fontWeight: 800 }}>Pro ⭐</small>
                      <strong>{tx(row.proFr, row.proAr)}</strong>
                    </div>
                    <div style={{ padding: "6px 8px", borderRadius: 10, background: "var(--gc-surface)" }}>
                      <small style={{ display: "block", opacity: 0.65, fontSize: 10 }}>Business</small>
                      <strong>{tx(row.businessFr, row.businessAr)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Billing Trust Strip */}
          <div
            style={{
              marginTop: 22,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 12,
            }}
          >
            <div className="gc-card" style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <ShieldCheck size={22} color="#10B981" />
              <div>
                <strong style={{ fontSize: 13.5, display: "block" }}>{tx("CIB, Edahabia & CCP", "الذهبية، CIB و CCP")}</strong>
                <small style={{ fontSize: 12, color: "var(--gc-text-muted)" }}>
                  {tx("Paiement local adapté Algérie", "دفع محلي ميسّر في الجزائر")}
                </small>
              </div>
            </div>
            <div className="gc-card" style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <HelpCircle size={22} color="#7C3AED" />
              <div>
                <strong style={{ fontSize: 13.5, display: "block" }}>{tx("Changement à tout moment", "تغيير الباقة في أي وقت")}</strong>
                <small style={{ fontSize: 12, color: "var(--gc-text-muted)" }}>
                  {tx("Passe de Starter à Pro ou Business en 1 clic", "رقّي باقتك أو عدّلها بنقرة واحدة")}
                </small>
              </div>
            </div>
          </div>
        </div>
      </section>
    </GcomeShell>
  );
}

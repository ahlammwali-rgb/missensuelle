import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, Rocket, Sparkles, Store, User } from "lucide-react";
import { GcomeShell } from "@/components/gcome/GcomeShell";
import { formatDzdLocale, useGcomeLang } from "@/lib/gcome-i18n";
import { gcomeHref } from "@/lib/gcome-routing";
import { trpc } from "@/lib/trpc";
import {
  computeBillingPrice,
  GCOME_PLANS,
  type GcomeBillingCycle,
  type GcomePaidPlanId,
} from "@shared/billing";
import { wilayas } from "@/lib/store-data";

function slugifyStore(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function GcomeSignup() {
  const { lang, tx } = useGcomeLang();
  const [, navigate] = useLocation();
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initPlanRaw = params?.get("plan");
  const initCycleRaw = params?.get("cycle");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [storeName, setStoreName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [wilaya, setWilaya] = useState("Alger");
  const [monthlyVolume, setMonthlyVolume] = useState("100-500");
  const [planId, setPlanId] = useState<GcomePaidPlanId>(
    initPlanRaw === "starter" || initPlanRaw === "business" ? initPlanRaw : "pro"
  );
  const [cycle, setCycle] = useState<GcomeBillingCycle>(
    initCycleRaw === "yearly" ? "yearly" : "monthly"
  );
  const [errorMsg, setErrorMsg] = useState("");

  const signupMutation = trpc.billing.submitSignup.useMutation();
  const selectedPlan = GCOME_PLANS.find(p => p.id === planId) ?? GCOME_PLANS[1];
  const pricing = computeBillingPrice(planId, cycle);

  const handleNextStep1 = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (fullName.trim().length < 2 || phone.trim().length < 8 || !email.includes("@")) {
      setErrorMsg(
        tx(
          "Renseigne ton nom, numéro WhatsApp et email valide.",
          "يرجى إدخال الاسم ورقم الواتساب والبريد الإلكتروني الصحيح."
        )
      );
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const cleanSub = slugifyStore(subdomain || storeName);
    if (storeName.trim().length < 2 || cleanSub.length < 2) {
      setErrorMsg(
        tx(
          "Choisis un nom de boutique valide (min. 2 caractères).",
          "يرجى إدخال اسم متجر صالح (حرفين على الأقل)."
        )
      );
      return;
    }
    setSubdomain(cleanSub);
    setStep(3);
  };

  const handleFinish = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      const cleanSub = slugifyStore(subdomain || storeName) || "ma-boutique";
      const res = await signupMutation.mutateAsync({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        storeName: storeName.trim(),
        subdomain: cleanSub,
        wilaya,
        monthlyVolume,
        planId,
        cycle,
        lang,
      });
      const nextUrl = `${gcomeHref("/paiement")}?plan=${planId}&cycle=${cycle}&signupId=${encodeURIComponent(
        res.signupId
      )}&store=${encodeURIComponent(storeName.trim())}&name=${encodeURIComponent(fullName.trim())}&phone=${encodeURIComponent(phone.trim())}`;
      navigate(nextUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : tx("Erreur d'enregistrement", "حدث خطأ أثناء التسجيل"));
    }
  };

  return (
    <GcomeShell
      activeTab="signup"
      titleFr="Inscription GCOME · Créer ma boutique 3 en 1"
      titleAr="التسجيل في GCOME · أنشئ متجرك المتكامل"
      descriptionFr="Crée ton espace GCOME en 3 étapes rapides : compte, boutique et offre 14 jours d'essai gratuit."
      descriptionAr="أنشئ حساب متجرك في 3 خطوات بسيطة مع تجربة مجانية 14 يوماً."
    >
      <section className="gc-section" style={{ paddingTop: 26 }}>
        <div className="gcome-container" style={{ maxWidth: 620 }}>
          {/* App Stepper Progress */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontWeight: 800, color: "var(--gc-text-muted)", marginBottom: 8 }}>
              <span>{tx(`Étape ${step} sur 3`, `الخطوة ${step} من 3`)}</span>
              <span style={{ color: "var(--gc-primary)" }}>
                {step === 1
                  ? tx("1 · Ton compte", "1 · حسابك")
                  : step === 2
                    ? tx("2 · Ta boutique", "2 · متجرك")
                    : tx("3 · Ton offre", "3 · الباقة")}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "var(--gc-surface-muted)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${(step / 3) * 100}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #4C1D95, #7C3AED, #F5B301)",
                  transition: "width 0.25s ease",
                }}
              />
            </div>
          </div>

          <div className="gc-card">
            {step === 1 && (
              <form onSubmit={handleNextStep1} style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 13, background: "var(--gc-surface-muted)", display: "grid", placeItems: "center", color: "var(--gc-primary)" }}>
                    <User size={20} />
                  </span>
                  <div>
                    <h1 style={{ fontSize: 20, fontWeight: 900 }}>{tx("Crée ton compte GCOME", "أنشئ حسابك في GCOME")}</h1>
                    <small style={{ fontSize: 12.5, color: "var(--gc-text-muted)" }}>
                      {tx("14 jours gratuits · Aucune carte requise", "14 يوماً مجاناً · بدون بطاقة بنكية")}
                    </small>
                  </div>
                </div>

                <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
                  {tx("Nom complet", "الاسم الكامل")}
                  <input
                    className="gc-input"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder={tx("Ex: Amira Benali", "مثال: أميرة بن علي")}
                    required
                  />
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
                  {tx("Téléphone WhatsApp", "رقم الهاتف (واتساب)")}
                  <input
                    className="gc-input"
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="0550 00 00 00"
                    required
                  />
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
                  {tx("Email professionnel", "البريد الإلكتروني")}
                  <input
                    className="gc-input"
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="contact@maboutique.dz"
                    required
                  />
                </label>

                {errorMsg && (
                  <p style={{ color: "#EF4444", fontSize: 12.5, fontWeight: 700 }}>{errorMsg}</p>
                )}

                <button type="submit" className="gc-btn-hero-primary" style={{ width: "100%" }}>
                  <span>{tx("Continuer vers ma boutique", "متابعة لبيانات المتجر")}</span>
                  <ArrowRight size={17} />
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleNextStep2} style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 13, background: "var(--gc-surface-muted)", display: "grid", placeItems: "center", color: "var(--gc-primary)" }}>
                    <Store size={20} />
                  </span>
                  <div>
                    <h1 style={{ fontSize: 20, fontWeight: 900 }}>{tx("Configure ta boutique", "إعداد متجرك")}</h1>
                    <small style={{ fontSize: 12.5, color: "var(--gc-text-muted)" }}>
                      {tx("Modifiable à tout moment dans l'admin", "يمكنك تعديلها لاحقاً في أي وقت")}
                    </small>
                  </div>
                </div>

                <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
                  {tx("Nom de la boutique", "اسم المتجر")}
                  <input
                    className="gc-input"
                    value={storeName}
                    onChange={e => {
                      const val = e.target.value;
                      setStoreName(val);
                      if (!subdomain || subdomain === slugifyStore(storeName)) {
                        setSubdomain(slugifyStore(val));
                      }
                    }}
                    placeholder={tx("Ex: Atelier Couture DZ", "مثال: متجر الأناقة")}
                    required
                  />
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
                  {tx("Lien / Identifiant boutique", "رابط المتجر")}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }} dir="ltr">
                    <input
                      className="gc-input"
                      value={subdomain}
                      onChange={e => setSubdomain(slugifyStore(e.target.value))}
                      placeholder="atelier-couture"
                      required
                    />
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--gc-text-muted)", whiteSpace: "nowrap" }}>
                      .gcome.dz
                    </span>
                  </div>
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
                    {tx("Wilaya", "الولاية")}
                    <select className="gc-input" value={wilaya} onChange={e => setWilaya(e.target.value)}>
                      {wilayas.map(w => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
                    {tx("Commandes / mois", "الطلبات شهرياً")}
                    <select className="gc-input" value={monthlyVolume} onChange={e => setMonthlyVolume(e.target.value)}>
                      <option value="0-100">0 – 100</option>
                      <option value="100-500">100 – 500</option>
                      <option value="500-2000">500 – 2 000</option>
                      <option value="2000+">2 000+</option>
                    </select>
                  </label>
                </div>

                {errorMsg && <p style={{ color: "#EF4444", fontSize: 12.5, fontWeight: 700 }}>{errorMsg}</p>}

                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10 }}>
                  <button type="button" onClick={() => setStep(1)} className="gc-btn-hero-secondary">
                    <ArrowLeft size={17} />
                  </button>
                  <button type="submit" className="gc-btn-hero-primary">
                    <span>{tx("Choisir mon offre", "اختيار الباقة")}</span>
                    <ArrowRight size={17} />
                  </button>
                </div>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleFinish} style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 13, background: "var(--gc-surface-muted)", display: "grid", placeItems: "center", color: "var(--gc-primary)" }}>
                    <Sparkles size={20} />
                  </span>
                  <div>
                    <h1 style={{ fontSize: 20, fontWeight: 900 }}>{tx("Choisis ton offre", "اختر باقتك")}</h1>
                    <small style={{ fontSize: 12.5, color: "var(--gc-text-muted)" }}>
                      {tx("Remise -20 % appliquée automatiquement en annuel", "خصم 20% تلقائي عند الدفع السنوي")}
                    </small>
                  </div>
                </div>

                <div className="gc-segmented" style={{ width: "fit-content" }}>
                  <button type="button" onClick={() => setCycle("monthly")} className={`gc-segmented-btn${cycle === "monthly" ? " is-active" : ""}`}>
                    {tx("Mensuel", "شهري")}
                  </button>
                  <button type="button" onClick={() => setCycle("yearly")} className={`gc-segmented-btn${cycle === "yearly" ? " is-active" : ""}`}>
                    {tx("Annuel -20%", "سنوي -20%")}
                  </button>
                </div>

                <div style={{ display: "grid", gap: 9 }}>
                  {GCOME_PLANS.map(p => {
                    const price = computeBillingPrice(p.id, cycle);
                    const active = p.id === planId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlanId(p.id)}
                        className="gc-card"
                        style={{
                          padding: 13,
                          textAlign: "start",
                          cursor: "pointer",
                          borderWidth: active ? 2 : 1,
                          borderColor: active ? "#7C3AED" : undefined,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: 15, fontWeight: 900 }}>{tx(p.nameFr, p.nameAr)}</strong>
                          <small style={{ display: "block", fontSize: 12, color: "var(--gc-text-muted)" }}>
                            {p.trialDays > 0 ? tx(`${p.trialDays}j d'essai gratuit`, `${p.trialDays} يوم تجربة مجانية`) : tx("Démo & accompagnement", "عرض ومرافقة")}
                          </small>
                        </div>
                        <div style={{ textAlign: "end" }}>
                          <strong style={{ fontSize: 16, fontWeight: 900, color: "var(--gc-primary)" }}>
                            {formatDzdLocale(price.monthlyEquivalentDzd, lang)}
                          </strong>
                          <small style={{ display: "block", fontSize: 11, color: "var(--gc-text-muted)" }}>
                            {tx("/ mois", "/ شهر")}
                          </small>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ padding: 12, borderRadius: 14, background: "var(--gc-surface-muted)", fontSize: 12.5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800 }}>
                    <CheckCircle2 size={15} color="#10B981" />
                    <span>
                      {storeName} ({subdomain}.gcome.dz) · {tx(selectedPlan.nameFr, selectedPlan.nameAr)}
                    </span>
                  </div>
                  <small style={{ display: "block", marginTop: 4, color: "var(--gc-text-muted)" }}>
                    {tx(
                      `Montant de référence : ${formatDzdLocale(pricing.totalChargedDzd, lang)} (${cycle === "yearly" ? "annuel" : "mensuel"})`,
                      `القيمة : ${formatDzdLocale(pricing.totalChargedDzd, lang)} (${cycle === "yearly" ? "سنوي" : "شهري"})`
                    )}
                  </small>
                </div>

                {errorMsg && <p style={{ color: "#EF4444", fontSize: 12.5, fontWeight: 700 }}>{errorMsg}</p>}

                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10 }}>
                  <button type="button" onClick={() => setStep(2)} className="gc-btn-hero-secondary">
                    <ArrowLeft size={17} />
                  </button>
                  <button type="submit" className="gc-btn-hero-primary" disabled={signupMutation.isPending}>
                    <Rocket size={17} />
                    <span>
                      {signupMutation.isPending
                        ? tx("Création en cours…", "جاري الحفظ…")
                        : tx("Finaliser & choisir le paiement", "إتمام التسجيل واختيار الدفع")}
                    </span>
                  </button>
                </div>
              </form>
            )}

            <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--gc-border)", textAlign: "center", fontSize: 12.5, color: "var(--gc-text-muted)" }}>
              {tx("Déjà inscrit sur GCOME ? ", "لديك حساب GCOME بالفعل؟ ")}
              <Link href={gcomeHref("/connexion")} style={{ color: "var(--gc-primary)", fontWeight: 800, textDecoration: "none" }}>
                {tx("Se connecter →", "تسجيل الدخول ←")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </GcomeShell>
  );
}

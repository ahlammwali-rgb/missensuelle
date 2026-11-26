import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  Lock,
  ReceiptText,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { GcomeShell } from "@/components/gcome/GcomeShell";
import { formatDzdLocale, useGcomeLang } from "@/lib/gcome-i18n";
import { gcomeHref } from "@/lib/gcome-routing";
import { trpc } from "@/lib/trpc";
import {
  computeBillingPrice,
  GCOME_PLANS,
  type GcomeBillingCycle,
  type GcomePaidPlanId,
  type GcomePaymentMethod,
} from "@shared/billing";

export default function GcomePayment() {
  const { lang, tx } = useGcomeLang();
  const [, navigate] = useLocation();
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;

  const initPlan = params?.get("plan");
  const initCycle = params?.get("cycle");

  const [planId, setPlanId] = useState<GcomePaidPlanId>(
    initPlan === "starter" || initPlan === "business" ? initPlan : "pro"
  );
  const [cycle, setCycle] = useState<GcomeBillingCycle>(
    initCycle === "yearly" ? "yearly" : "monthly"
  );
  const [paymentMethod, setPaymentMethod] = useState<GcomePaymentMethod>("chargily");
  const [customerName, setCustomerName] = useState(params?.get("name") || "");
  const [storeName, setStoreName] = useState(params?.get("store") || "");
  const [phone, setPhone] = useState(params?.get("phone") || "");
  const [ccpReference, setCcpReference] = useState("");
  const [ccpReceiptNote, setCcpReceiptNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const checkoutMutation = trpc.billing.createCheckoutSession.useMutation();
  const plan = GCOME_PLANS.find(p => p.id === planId) ?? GCOME_PLANS[1];
  const price = computeBillingPrice(planId, cycle);

  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (paymentMethod === "ccp" && !ccpReference.trim()) {
      setErrorMsg(
        tx(
          "Indique le numéro d'opération / reçu BaridiMob ou CCP.",
          "أدخل رقم العملية أو الوصل البريدي CCP / بريدي موب."
        )
      );
      return;
    }
    try {
      const res = await checkoutMutation.mutateAsync({
        planId,
        cycle,
        paymentMethod,
        customerName: customerName.trim() || undefined,
        storeName: storeName.trim() || undefined,
        phone: phone.trim() || undefined,
        ccpReference: ccpReference.trim() || undefined,
        ccpReceiptNote: ccpReceiptNote.trim() || undefined,
        signupId: params?.get("signupId") || undefined,
      });
      navigate(`${gcomeHref("/paiement/succes")}?invoice=${encodeURIComponent(res.invoice.id)}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : tx("Erreur de paiement", "تعذر إتمام العملية"));
    }
  };

  return (
    <GcomeShell
      activeTab="pricing"
      titleFr="Paiement Abonnement GCOME · CIB / Edahabia / CCP"
      titleAr="دفع اشتراك GCOME · الذهبية، CIB أو CCP"
      descriptionFr="Finalise ton abonnement GCOME via Chargily Pay (CIB, Edahabia, BaridiMob) ou virement CCP."
      descriptionAr="أكمل اشتراكك في GCOME عبر الذهبية، CIB، بريدي موب أو تحويل CCP."
    >
      <section className="gc-section" style={{ paddingTop: 26 }}>
        <div className="gcome-container" style={{ maxWidth: 920 }}>
          <div style={{ marginBottom: 16 }}>
            <span className="gc-eyebrow">
              <Sparkles size={14} /> {tx("Mode Préparation SaaS · Passerelle prête", "وضع التجهيز للربط المباشر")}
            </span>
            <h1 className="gc-hero-title" style={{ marginTop: 10 }}>
              {tx("Active ton abonnement ", "فعّل اشتراكك في ")}
              <span className="is-accent">GCOME.</span>
            </h1>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
              gap: 18,
              alignItems: "start",
            }}
          >
            {/* Left: Payment Methods Form */}
            <form onSubmit={handleCheckout} className="gc-card" style={{ display: "grid", gap: 14 }}>
              <strong style={{ fontSize: 16, fontWeight: 900 }}>
                {tx("1. Choisis ton moyen de paiement", "1. اختر وسيلة الدفع")}
              </strong>

              <div style={{ display: "grid", gap: 10 }}>
                {[
                  {
                    id: "chargily" as const,
                    icon: CreditCard,
                    title: tx("CIB / Edahabia / BaridiMob (Chargily Pay)", "البطاقة الذهبية / CIB / بريدي موب"),
                    sub: tx("Validation instantanée dès branchement de ta clé Chargily", "تفعيل فوري فور ربط مفتاح Chargily Pay"),
                    badge: tx("Recommandé", "موصى به"),
                  },
                  {
                    id: "ccp" as const,
                    icon: Building2,
                    title: tx("Virement CCP / BaridiMob avec justificatif", "تحويل بريدي CCP / بريدي موب مع وصل"),
                    sub: tx("Renseigne la référence du virement pour validation sous 2h", "أدخل رقم التحويل للتأكيد خلال ساعتين"),
                  },
                  {
                    id: "card" as const,
                    icon: Lock,
                    title: tx("Carte Internationale (Visa / Mastercard)", "بطاقة بنكية دولية"),
                    sub: tx("Activation prévue dans la prochaine mise à jour", "متاحة قريباً للدفع الدولي"),
                  },
                ].map(m => {
                  const Icon = m.icon;
                  const active = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className="gc-card"
                      style={{
                        padding: 13,
                        textAlign: "start",
                        cursor: "pointer",
                        borderWidth: active ? 2 : 1,
                        borderColor: active ? "#7C3AED" : undefined,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <span style={{ width: 38, height: 38, borderRadius: 12, background: "var(--gc-surface-muted)", color: "var(--gc-primary)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <Icon size={18} />
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <strong style={{ fontSize: 13.5, fontWeight: 900 }}>{m.title}</strong>
                          {m.badge && (
                            <span style={{ fontSize: 10, fontWeight: 900, padding: "2px 8px", borderRadius: 999, background: "#F5B301", color: "#1E103B" }}>
                              {m.badge}
                            </span>
                          )}
                        </div>
                        <small style={{ display: "block", marginTop: 3, fontSize: 12, color: "var(--gc-text-muted)" }}>
                          {m.sub}
                        </small>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 5, fontSize: 12.5, fontWeight: 800 }}>
                  {tx("Nom complet", "الاسم الكامل")}
                  <input className="gc-input" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={tx("Ton nom", "اسمك")} />
                </label>
                <label style={{ display: "grid", gap: 5, fontSize: 12.5, fontWeight: 800 }}>
                  {tx("Téléphone", "الهاتف")}
                  <input className="gc-input" dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0550..." />
                </label>
              </div>

              <label style={{ display: "grid", gap: 5, fontSize: 12.5, fontWeight: 800 }}>
                {tx("Nom de boutique", "اسم المتجر")}
                <input className="gc-input" value={storeName} onChange={e => setStoreName(e.target.value)} placeholder={tx("Ex: Miss Sensuelle", "اسم متجرك")} />
              </label>

              {paymentMethod === "ccp" && (
                <div style={{ padding: 12, borderRadius: 14, background: "var(--gc-surface-muted)", display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800 }}>
                    {tx("Coordonnées CCP / BaridiMob GCOME (à renseigner avec ton RIP)", "بيانات التحويل البريدي")}
                  </div>
                  <input
                    className="gc-input"
                    value={ccpReference}
                    onChange={e => setCcpReference(e.target.value)}
                    placeholder={tx("Référence du reçu ou ID transaction BaridiMob", "رقم الوصل أو رقم العملية")}
                    required
                  />
                  <input
                    className="gc-input"
                    value={ccpReceiptNote}
                    onChange={e => setCcpReceiptNote(e.target.value)}
                    placeholder={tx("Note / lien capture du reçu (optionnel)", "ملاحظة أو رابط صورة الوصل (اختياري)")}
                  />
                </div>
              )}

              {errorMsg && <p style={{ color: "#EF4444", fontSize: 12.5, fontWeight: 700 }}>{errorMsg}</p>}

              <button type="submit" className="gc-btn-hero-primary" disabled={checkoutMutation.isPending}>
                <Smartphone size={18} />
                <span>
                  {checkoutMutation.isPending
                    ? tx("Traitement…", "جاري المعالجة…")
                    : paymentMethod === "chargily"
                      ? tx(`Simuler paiement Chargily (${formatDzdLocale(price.totalChargedDzd, lang)})`, `دفع تجريبي Chargily (${formatDzdLocale(price.totalChargedDzd, lang)})`)
                      : paymentMethod === "ccp"
                        ? tx("Envoyer mon justificatif CCP", "إرسال وصل التحويل")
                        : tx("Enregistrer ma demande", "تسجيل الطلب")}
                </span>
              </button>
            </form>

            {/* Right: Offer Summary */}
            <div className="gc-card" style={{ display: "grid", gap: 14 }}>
              <strong style={{ fontSize: 16, fontWeight: 900 }}>{tx("Récapitulatif de l'offre", "ملخص الاشتراك")}</strong>

              <div className="gc-segmented" style={{ width: "100%" }}>
                {GCOME_PLANS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanId(p.id)}
                    className={`gc-segmented-btn${planId === p.id ? " is-active" : ""}`}
                    style={{ flex: 1 }}
                  >
                    {tx(p.nameFr, p.nameAr)}
                  </button>
                ))}
              </div>

              <div className="gc-segmented" style={{ width: "fit-content" }}>
                <button type="button" onClick={() => setCycle("monthly")} className={`gc-segmented-btn${cycle === "monthly" ? " is-active" : ""}`}>
                  {tx("Mensuel", "شهري")}
                </button>
                <button type="button" onClick={() => setCycle("yearly")} className={`gc-segmented-btn${cycle === "yearly" ? " is-active" : ""}`}>
                  {tx("Annuel (-20 %)", "سنوي (-20%)")}
                </button>
              </div>

              <div style={{ padding: 14, borderRadius: 16, background: "var(--gc-surface-muted)", display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{tx("Offre sélectionnée", "الباقة")}</span>
                  <strong>{tx(plan.nameFr, plan.nameAr)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{tx("Cycle", "المدة")}</span>
                  <strong>{cycle === "yearly" ? tx("12 mois (-20 %)", "سنة (-20%)") : tx("Mensuel", "شهري")}</strong>
                </div>
                <div style={{ borderTop: "1px solid var(--gc-border)", paddingTop: 8, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <strong>{tx("Total", "الإجمالي")}</strong>
                  <strong style={{ fontSize: 22, fontWeight: 900, color: "var(--gc-primary)" }}>
                    {formatDzdLocale(price.totalChargedDzd, lang)}
                  </strong>
                </div>
              </div>

              <div style={{ fontSize: 12, color: "var(--gc-text-muted)", lineHeight: 1.55 }}>
                {tx(
                  "En validant, tu acceptes nos Conditions Générales d'Utilisation et notre politique de remboursement.",
                  "بالمتابعة فإنك توافق على شروط الاستخدام وسياسة الاسترجاع."
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </GcomeShell>
  );
}

export function GcomePaymentResult({ mode }: { mode: "success" | "failure" }) {
  const { lang, tx } = useGcomeLang();
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const invoiceId = params?.get("invoice") || "";

  const invoiceQuery = trpc.billing.getCheckoutStatus.useQuery(
    { invoiceId },
    { enabled: Boolean(invoiceId) && mode === "success", retry: false }
  );

  const inv = invoiceQuery.data?.invoice;

  return (
    <GcomeShell
      activeTab="pricing"
      titleFr={mode === "success" ? "Paiement GCOME enregistré" : "Échec de paiement GCOME"}
      titleAr={mode === "success" ? "تم تسجيل الدفع بنجاح" : "فشل عملية الدفع"}
      descriptionFr="Statut de votre abonnement GCOME."
      descriptionAr="حالة اشتراكك في GCOME."
    >
      <section className="gc-section">
        <div className="gcome-container" style={{ maxWidth: 560 }}>
          <div className="gc-card" style={{ textAlign: "center", display: "grid", gap: 14, padding: 28 }}>
            <div style={{ marginInline: "auto" }}>
              {mode === "success" ? (
                <CheckCircle2 size={54} color="#10B981" />
              ) : (
                <AlertTriangle size={54} color="#EF4444" />
              )}
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 900 }}>
              {mode === "success"
                ? tx("Demande enregistrée avec succès !", "تم تسجيل طلب الاشتراك بنجاح!")
                : tx("Le paiement n'a pas abouti", "لم تكتمل عملية الدفع")}
            </h1>

            <p style={{ fontSize: 14, color: "var(--gc-text-muted)", lineHeight: 1.6 }}>
              {mode === "success"
                ? tx(
                    "Ta facture a bien été générée et enregistrée dans ton espace Abonnement (mode préparation SaaS / vérification CCP).",
                    "تم إنشاء فاتورتك وتسجيلها في لوحة التحكم بنجاح."
                  )
                : tx(
                    "Aucun montant n'a été débité. Tu peux réessayer avec Chargily (CIB / Edahabia) ou un virement CCP.",
                    "لم يتم خصم أي مبلغ. يمكنك المحاولة مرة أخرى عبر الذهبية أو CCP."
                  )}
            </p>

            {inv && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  background: "var(--gc-surface-muted)",
                  textAlign: "start",
                  fontSize: 13,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 900 }}>
                  <ReceiptText size={16} color="#7C3AED" />
                  <span>{inv.id}</span>
                </div>
                <div>
                  {tx("Offre :", "الباقة:")} <strong>{inv.planId.toUpperCase()}</strong> ({inv.cycle})
                </div>
                <div>
                  {tx("Montant :", "المبلغ:")} <strong>{formatDzdLocale(inv.amountDzd, lang)}</strong>
                </div>
                <div>
                  {tx("Référence :", "المرجع:")} <code>{inv.reference || "—"}</code>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 6 }}>
              <Link href="/admin" className="gc-btn-hero-primary">
                {tx("Accéder au Tableau de bord", "الذهاب للوحة التحكم")}
              </Link>
              <Link href={gcomeHref("/paiement")} className="gc-btn-hero-secondary">
                {mode === "success" ? tx("Nouveau paiement", "فاتورة جديدة") : tx("Réessayer", "إعادة المحاولة")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </GcomeShell>
  );
}

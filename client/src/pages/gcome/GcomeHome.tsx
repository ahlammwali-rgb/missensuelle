import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Crown,
  Globe2,
  MapPin,
  Package,
  Rocket,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Truck,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { GcomeShell } from "@/components/gcome/GcomeShell";
import { HeroDashboard3D, RealPreviewsSection, ThreeInOnePinnedSection } from "@/components/gcome/GcomeShowcase3D";
import { GCOME_LOGO_CONCEPTS, GcomeLogo, type GcomeLogoConcept } from "@/components/GcomeLogo";
import { formatDzdLocale, useGcomeLang } from "@/lib/gcome-i18n";
import { gcomeHref } from "@/lib/gcome-routing";
import { computeBillingPrice, GCOME_PLANS, type GcomeBillingCycle, type GcomePaidPlanId } from "@shared/billing";

function AnimatedCounter({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const duration = 900;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target]);

  return (
    <span ref={ref}>
      {prefix}
      {val}
      {suffix}
    </span>
  );
}

export default function GcomeHome() {
  const { lang, tx } = useGcomeLang();
  const [cycle, setCycle] = useState<GcomeBillingCycle>("monthly");
  const [mobilePlanTab, setMobilePlanTab] = useState<GcomePaidPlanId>("pro");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [previewLogoConcept, setPreviewLogoConcept] = useState<GcomeLogoConcept>("trinity");

  const pipelineRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: pipeScroll } = useScroll({
    target: pipelineRef,
    offset: ["start 80%", "end 55%"],
  });
  const lineScaleX = useTransform(pipeScroll, [0, 1], [0.1, 1]);

  const partnerChips = [
    tx("EcoTrack / DHD Livraison", "شركة التوصيل DHD / EcoTrack"),
    tx("E-com Delivery 58 Wilayas", "توصيل 58 ولاية E-com"),
    tx("Meta Ads & CAPI Serveur", "إعلانات ميتا + حماية CAPI"),
    tx("TikTok Pixel & Events API", "تيك توك بيكسل وتتبع الشراء"),
    tx("Google Sheets Auto-Sync", "مزامنة Google Sheets التلقائية"),
    tx("Chargily Pay (CIB / Edahabia)", "الدفع عبر الذهبية و CIB"),
  ];

  const orderSteps = [
    { step: "1", title: tx("Pub TikTok / FB", "إعلان تيك توك أو ميتا"), sub: tx("Signal Pixel + CAPI capturé", "تتبع فوري بدون ضياع") },
    { step: "2", title: tx("Commande 12 sec", "طلب خلال 12 ثانية"), sub: tx("Formulaire COD ultra rapide", "استمارة شراء ذكية وسريعة") },
    { step: "3", title: tx("Confirmation équipe", "تأكيد الفريق"), sub: tx("Appel, NRP, WhatsApp en 1 tap", "اتصال أو واتساب بلمسة واحدة") },
    { step: "4", title: tx("Expédition 1-clic", "ترحيل بنقرة واحدة"), sub: tx("Envoi direct DHD ou E-com", "إرسال فوري إلى DHD أو E-com") },
    { step: "5", title: tx("Livraison suivie", "تتبع التوصيل"), sub: tx("Alertes client & retours auto", "إشعارات مباشرة وتنبيه المرتجعات") },
    { step: "6", title: tx("Bénéfice encaissé", "حساب صافي الربح"), sub: tx("Marge nette & ROAS calculés", "حساب تلقائي لصافي الفائدة") },
  ];

  const advantages = [
    { icon: Wallet, title: tx("COD Algérien Natif", "الدفع عند الاستلام 100%"), desc: tx("Sans panier compliqué : la cliente commande en 10 secondes nom + téléphone + wilaya.", "استمارة شراء مباشرة وسريعة تناسب المستهلك الجزائري.") },
    { icon: MapPin, title: tx("58 Wilayas & Stop Desk", "58 ولاية ومكاتب التوصيل"), desc: tx("Communes, tarifs domicile et bureaux Stop Desk synchronisés sans saisie manuelle.", "أسعار التوصيل والبلديات ومكاتب الاستلام محدثة تلقائياً.") },
    { icon: Globe2, title: tx("Bilingue Français & عربي", "واجهة فرنسية وعربية RTL"), desc: tx("Ton interface, tes pages de vente et ton onboarding basculent instantanément.", "حوّل المتجر ولوحة التحكم بين العربية والفرنسية بضغطة زر.") },
    { icon: ShieldCheck, title: tx("CAPI Anti-Perte iPhone", "حماية CAPI لمستخدمي آيفون"), desc: tx("Fini les commandes qui n'apparaissent pas dans Facebook Ads Manager grâce au CAPI serveur.", "إرسال 100% من المبيعات من السيرفر مباشرة نحو ميتا وتيك توك.") },
    { icon: Users, title: tx("Confirmateurs & Commissions", "المؤكّدات والعمولات"), desc: tx("Vois qui a confirmé ou livré chaque commande et calcule les salaires automatiquement.", "متابعة أداء كل عضو في الفريق وحساب الأجور والعمولات آلياً.") },
    { icon: Bell, title: tx("App PWA & Son Ca-Ching", "تطبيق هاتف وتنبيهات فورية"), desc: tx("Reçois chaque commande et chaque colis livré sur ton téléphone avec sonnerie dédiée.", "توصّل بإشعار وصوت عند كل طلب جديد أو تسليم ناجح.") },
  ];

  const testimonials = [
    {
      brand: "Miss Sensuelle DZ",
      role: tx("Boutique Mode & Beauté · Alger (Cas Réel)", "متجر موضة وتجميل · الجزائر (دراسة حالة حقيقية)"),
      quote: tx(
        "On gérait nos commandes entre Instagram, des fichiers Sheets et les portails transporteurs. Avec GCOME 3 en 1, l'équipe confirme 2× plus vite et nos pixels CAPI remontent enfin chaque achat.",
        "كنا نضيع وقتاً كبيراً بين إكسل وشركات التوصيل. مع GCOME تضاعفت سرعة التأكيد وأصبح التتبع الإعلاني دقيقاً."
      ),
      stat: tx("92 % de suivi fiable", "دقة تتبع +92%"),
    },
    {
      brand: "Atelier Oran Modest",
      role: tx("Prêt-à-porter Femme · Oran", "ألبسة نسائية · وهران"),
      quote: tx(
        "La vue mobile est incroyable : mes confirmatrices travaillent directement sur téléphone et je vois mon bénéfice net le soir dans Finance IA.",
        "الواجهة على الهاتف رائعة جداً، الفريق يؤكّد الطلبات من الهاتف وأنا أراقب صافي الربح كل مساء."
      ),
      stat: tx("+38 % commandes expédiées", "+38% طرود مشحونة"),
    },
    {
      brand: "Cosmétique Aurès",
      role: tx("Beauté & Soins · Sétif", "تجميل وعناية · سطيف"),
      quote: tx(
        "Le transfert groupé vers DHD en 1 clic sans erreur de commune m'a fait gagner 2 heures par jour.",
        "الترحيل الجماعي نحو DHD بنقرة واحدة مع ضبط البلديات وفر لنا ساعتين كل يوم."
      ),
      stat: tx("2h gagnées / jour", "ربح ساعتين يومياً"),
    },
  ];

  const faqs = [
    {
      q: tx("Puis-je tester GCOME gratuitement avant de payer ?", "هل يمكنني تجربة GCOME مجاناً قبل الدفع؟"),
      a: tx(
        "Oui ! Les offres Starter et Pro incluent 14 jours d'essai gratuit sans engagement, et l'équipe peut t'aider à connecter ton premier produit et ton transporteur en quelques minutes.",
        "نعم! باقتا Starter و Pro تتضمنان 14 يوماً تجربة مجانية كاملة بدون التزام."
      ),
    },
    {
      q: tx("Est-ce que ça fonctionne avec DHD / EcoTrack et E-com Delivery ?", "هل المنصة مربوطة مع DHD / EcoTrack و E-com؟"),
      a: tx(
        "Oui, les API officielles EcoTrack (DHD et partenaires) ainsi qu'E-com Delivery sont intégrées nativement : création des colis, validation Prêt à expédier, suivi temps réel et gestion des retours.",
        "نعم، الربط مدمج مع EcoTrack / DHD و E-com لإنشاء الطرود وتتبعها آلياً وتحديث المرتجعات."
      ),
    },
    {
      q: tx("Comment fonctionne le paiement d'abonnement en Algérie ?", "كيف يتم دفع الاشتراك في الجزائر؟"),
      a: tx(
        "Tu pourras régler par carte Edahabia / CIB / BaridiMob (Chargily Pay) ou par virement CCP avec validation rapide. Ton historique de factures reste disponible dans l'admin.",
        "يمكنك الدفع بالبطاقة الذهبية أو CIB عبر Chargily أو عبر تحويل بريدي CCP مع توثيق الفاتورة داخل حسابك."
      ),
    },
    {
      q: tx("Puis-je utiliser mon propre nom de domaine plus tard ?", "هل يمكنني ربط دومين خاص بمتجري؟"),
      a: tx(
        "Oui, chaque boutique démarre immédiatement avec son lien prêt à l'emploi, et l'offre Business permet de brancher un domaine personnalisé et jusqu'à 3 boutiques.",
        "نعم، تحصل على رابط جاهز فور التسجيل ويمكنك ربط نطاقك الخاص في باقة Business."
      ),
    },
    {
      q: tx("Le site fonctionne-t-il bien sur téléphone (mobile-first) ?", "هل المنصة سريعة وعملية على الهاتف؟"),
      a: tx(
        "GCOME est construit en Mobile-First style application mobile (PWA installable, barre de navigation basse, boutons tactiles rapides) pour travailler confortablement sur Android et iPhone.",
        "المنصة مبنية بأسلوب تطبيقات الهاتف (PWA، شريط تنقل سفلي، أزرار سهلة باليد الواحدة) على أندرويد وآيفون."
      ),
    },
  ];

  return (
    <GcomeShell
      activeTab="home"
      logoConcept={previewLogoConcept}
      titleFr="GCOME · Plateforme SaaS E-Commerce 3 en 1 — Algérie"
      titleAr="GCOME · منصة التجارة الإلكترونية 3 في 1 في الجزائر"
      descriptionFr="Vends, confirme et livre sur 58 wilayas dans un seul tableau de bord mobile-first : Boutique COD, Confirmation équipe, Transporteurs DHD/E-com & Finance IA."
      descriptionAr="بع وأكد وشغّل التوصيل لـ 58 ولاية من تطبيق واحد: متجر، فريق تأكيد، شركات التوصيل والمالية الذكية."
    >
      {/* 1 & 2. HERO SECTION (Mobile-First App Hero + Interactive 3D Dashboard) */}
      <section id="gc-hero" className="gc-hero">
        <div className="gc-hero-glow" aria-hidden="true" />
        <div className="gcome-container gc-hero-grid">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <span className="gc-eyebrow">
              <Crown size={14} color="#F5B301" />
              <span>{tx("SaaS E-Commerce Algérie · App 3 en 1", "منصة التجارة الإلكترونية الجزائرية · 3 في 1")}</span>
            </span>

            <h1 className="gc-hero-title">
              {tx("Vends, confirme, livre : ", "بع، أكّد طلباتك، وشغّل التوصيل: ")}
              <span className="is-accent">
                {tx("tout dans un seul tableau de bord.", "كل شيء في تطبيق واحد.")}
              </span>
            </h1>

            <p className="gc-hero-lead">
              {tx(
                "Une application mobile-first taillée pour le e-commerce algérien : pages produits haute conversion, équipe de confirmation, expédition 58 wilayas et Finance IA pour ton vrai bénéfice net.",
                "تطبيق مصمم أولاً للهاتف يجمع بين صفحات البيع عالية التحويل، فريق التأكيد، الشحن إلى 58 ولاية، وحساب صافي الربح بالذكاء الاصطناعي."
              )}
            </p>

            <div className="gc-hero-cta-row">
              <Link href={gcomeHref("/inscription")} className="gc-btn-hero-primary">
                <Rocket size={18} />
                <span>{tx("Essai gratuit 14 jours", "ابدأ تجربة مجانية 14 يوماً")}</span>
                <ArrowRight size={17} />
              </Link>
              <Link href={gcomeHref("/tarifs")} className="gc-btn-hero-secondary">
                <Sparkles size={17} color="#7C3AED" />
                <span>{tx("Voir les tarifs DZD", "عرض الأسعار بالدينار")}</span>
              </Link>
            </div>

            <div className="gc-hero-trust-strip">
              <span className="gc-hero-trust-item">
                <CheckCircle2 size={14} color="#10B981" /> {tx("Sans carte bancaire", "بدون بطاقة بنكية")}
              </span>
              <span className="gc-hero-trust-item">
                <CheckCircle2 size={14} color="#10B981" /> {tx("58 Wilayas & Stop Desk", "58 ولاية ومكاتب التوصيل")}
              </span>
              <span className="gc-hero-trust-item">
                <CheckCircle2 size={14} color="#10B981" /> {tx("Prêt en 5 minutes", "جاهز خلال 5 دقائق")}
              </span>
            </div>
          </motion.div>

          <HeroDashboard3D lang={lang} />
        </div>
      </section>

      {/* 3. BANDEAU LOGOS / INTEGRATIONS */}
      <div className="gc-marquee-wrap" aria-label={tx("Intégrations officielles", "التكاملات الرسمية")}>
        <div className="gc-marquee-track">
          {[...partnerChips, ...partnerChips].map((chip, idx) => (
            <span key={idx} className="gc-marquee-chip">
              <Zap size={13} color="#7C3AED" />
              <span>{chip}</span>
            </span>
          ))}
        </div>
      </div>

      {/* 4. LE 3 EN 1 (COEUR DE LA PAGE + SCROLL ASSEMBLY) */}
      <ThreeInOnePinnedSection lang={lang} />

      {/* 5. PARCOURS D'UNE COMMANDE (TIMELINE ANIMEE AU SCROLL) */}
      <section ref={pipelineRef} className="gc-section">
        <div className="gcome-container">
          <div className="gc-section-head">
            <span className="gc-eyebrow">
              <Truck size={14} /> {tx("Parcours Automatisé", "رحلة الطلب الآلية")}
            </span>
            <h2 className="gc-section-title">
              {tx("De la pub jusqu'au cash encaissé.", "من نقرة الإعلان إلى تحصيل أموالك.")}
            </h2>
          </div>

          <div
            style={{
              height: 4,
              borderRadius: 99,
              background: "var(--gc-surface-muted)",
              overflow: "hidden",
              marginBottom: 18,
            }}
          >
            <motion.div
              style={{
                height: "100%",
                transformOrigin: "left",
                scaleX: lineScaleX,
                background: "linear-gradient(90deg, #4C1D95, #7C3AED, #F5B301, #10B981)",
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            {orderSteps.map((st, idx) => (
              <motion.div
                key={st.step}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: idx * 0.05 }}
                className="gc-card"
                style={{ padding: 15 }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #6D28D9, #4C1D95)",
                    color: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: 900,
                    display: "inline-grid",
                    placeItems: "center",
                    marginBottom: 10,
                  }}
                >
                  {st.step}
                </span>
                <strong style={{ display: "block", fontSize: 14, fontWeight: 900 }}>{st.title}</strong>
                <small style={{ display: "block", marginTop: 4, fontSize: 12, color: "var(--gc-text-muted)" }}>
                  {st.sub}
                </small>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. APERCUS REELS (MOBILE APP & DASHBOARD) */}
      <RealPreviewsSection lang={lang} />

      {/* 7. CHIFFRES CLES ANIMES */}
      <section className="gc-section" style={{ paddingBlock: 32 }}>
        <div className="gcome-container">
          <div
            className="gc-card"
            style={{
              background: "linear-gradient(135deg, #1E103B 0%, #4C1D95 60%, #6D28D9 100%)",
              color: "#FFFFFF",
              border: 0,
              padding: "24px 18px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 18,
                textAlign: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "clamp(1.9rem, 5vw, 2.7rem)", fontWeight: 900, color: "#FDE047" }}>
                  <AnimatedCounter target={3} /> {tx("outils", "أدوات")}
                </div>
                <div style={{ fontSize: 12.5, color: "#DDD6FE", fontWeight: 700 }}>
                  {tx("Remplacés par 1 App", "مدمجة في تطبيق واحد")}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "clamp(1.9rem, 5vw, 2.7rem)", fontWeight: 900, color: "#6EE7B7" }}>
                  <AnimatedCounter target={70} prefix="-" suffix=" %" />
                </div>
                <div style={{ fontSize: 12.5, color: "#DDD6FE", fontWeight: 700 }}>
                  {tx("Temps de confirmation", "وقت تأكيد الطلبات")}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "clamp(1.9rem, 5vw, 2.7rem)", fontWeight: 900, color: "#FFFFFF" }}>
                  <AnimatedCounter target={58} /> {tx("Wilayas", "ولاية")}
                </div>
                <div style={{ fontSize: 12.5, color: "#DDD6FE", fontWeight: 700 }}>
                  {tx("Domicile & Stop Desk", "توصيل للمنزل وللمكتب")}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "clamp(1.9rem, 5vw, 2.7rem)", fontWeight: 900, color: "#FDE047" }}>
                  24/7
                </div>
                <div style={{ fontSize: 12.5, color: "#DDD6FE", fontWeight: 700 }}>
                  {tx("Synchro Colis & CAPI", "مزامنة الطرود والبيكسل")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. POURQUOI GCOME (6 AVANTAGES ALGERIE) */}
      <section className="gc-section">
        <div className="gcome-container">
          <div className="gc-section-head">
            <span className="gc-eyebrow">
              <BarChart3 size={14} /> {tx("Conçu pour le Marché Algérien", "مصمم للسوق الجزائري")}
            </span>
            <h2 className="gc-section-title">
              {tx("Tout ce qui bloquait tes ventes, enfin réglé.", "كل مشاكل التجارة الإلكترونية محلولة.")}
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 14,
            }}
          >
            {advantages.map((adv, idx) => {
              const Icon = adv.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ delay: idx * 0.04 }}
                  whileHover={{ y: -4 }}
                  className="gc-card"
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 13,
                      background: "var(--gc-surface-muted)",
                      color: "var(--gc-primary)",
                      display: "grid",
                      placeItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <Icon size={20} />
                  </span>
                  <h3 style={{ fontSize: 16, fontWeight: 900 }}>{adv.title}</h3>
                  <p style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.55, color: "var(--gc-text-muted)" }}>
                    {adv.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 9. APERCU TARIFS (MOBILE TABS + ANNUEL -20%) */}
      <section id="gc-pricing-preview" className="gc-section">
        <div className="gcome-container">
          <div className="gc-section-head">
            <span className="gc-eyebrow">
              <Crown size={14} color="#F5B301" /> {tx("Tarifs Simples en Dinars", "أسعار واضحة بالدينار الجزائري")}
            </span>
            <h2 className="gc-section-title">
              {tx("Démarre gratuitement, évolue selon ton volume.", "ابدأ مجاناً، وتوسع حسب حجم مبيعاتك.")}
            </h2>

            {/* Cycle Switcher */}
            <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
              <div className="gc-segmented">
                <button
                  type="button"
                  onClick={() => setCycle("monthly")}
                  className={`gc-segmented-btn${cycle === "monthly" ? " is-active" : ""}`}
                >
                  {tx("Mensuel", "شهري")}
                </button>
                <button
                  type="button"
                  onClick={() => setCycle("yearly")}
                  className={`gc-segmented-btn${cycle === "yearly" ? " is-active" : ""}`}
                >
                  {tx("Annuel (-20 %)", "سنوي (خصم 20%)")}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Plan Segmented Pills (<768px) */}
          <div className="md:hidden" style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div className="gc-segmented">
              {GCOME_PLANS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setMobilePlanTab(p.id)}
                  className={`gc-segmented-btn${mobilePlanTab === p.id ? " is-active" : ""}`}
                >
                  {tx(p.nameFr, p.nameAr)}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {GCOME_PLANS.map(plan => {
              const price = computeBillingPrice(plan.id, cycle);
              const hiddenOnMobile = mobilePlanTab !== plan.id;
              return (
                <div
                  key={plan.id}
                  className={`gc-card ${hiddenOnMobile ? "hidden md:flex" : "flex"}`}
                  style={{
                    flexDirection: "column",
                    justifyContent: "space-between",
                    borderColor: plan.recommended ? "#7C3AED" : undefined,
                    borderWidth: plan.recommended ? 2 : 1,
                    position: "relative",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontSize: 19, fontWeight: 900 }}>{tx(plan.nameFr, plan.nameAr)}</strong>
                      {plan.badgeFr && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 900,
                            padding: "4px 9px",
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
                      <span style={{ fontSize: 30, fontWeight: 900 }}>
                        {formatDzdLocale(price.monthlyEquivalentDzd, lang)}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--gc-text-muted)", fontWeight: 700 }}>
                        {tx("/ mois", "/ شهر")}
                      </span>
                    </div>
                    {cycle === "yearly" && (
                      <div style={{ fontSize: 11.5, color: "#10B981", fontWeight: 800, marginTop: 2 }}>
                        {tx(
                          `Soit ${formatDzdLocale(price.totalChargedDzd, lang)}/an · Économie ${formatDzdLocale(price.savingsPerYearDzd, lang)}`,
                          `المجموع ${formatDzdLocale(price.totalChargedDzd, lang)} سنوياً · توفير ${formatDzdLocale(price.savingsPerYearDzd, lang)}`
                        )}
                      </div>
                    )}

                    <ul style={{ marginTop: 16, padding: 0, listStyle: "none", display: "grid", gap: 9 }}>
                      {(lang === "ar" ? plan.featuresAr : plan.featuresFr).map((feat, fi) => (
                        <li key={fi} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
                          <Check size={16} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <Link
                      href={`${gcomeHref("/inscription")}?plan=${plan.id}&cycle=${cycle}`}
                      className={plan.recommended ? "gc-btn-hero-primary" : "gc-btn-hero-secondary"}
                      style={{ width: "100%" }}
                    >
                      <span>{tx(plan.ctaFr, plan.ctaAr)}</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ textAlign: "center", marginTop: 18 }}>
            <Link href={gcomeHref("/tarifs")} style={{ color: "var(--gc-primary)", fontWeight: 800, fontSize: 13.5, textDecoration: "none" }}>
              {tx("Voir le tableau comparatif complet des offres →", "مقارنة شاملة لجميع الباقات والمميزات ←")}
            </Link>
          </div>
        </div>
      </section>

      {/* 10. TEMOIGNAGES MARCHANDS */}
      <section className="gc-section">
        <div className="gcome-container">
          <div className="gc-section-head">
            <span className="gc-eyebrow">
              <Star size={14} color="#F5B301" /> {tx("Retours Terrain", "تجارب حقيقية")}
            </span>
            <h2 className="gc-section-title">
              {tx("Déjà adopté par des boutiques qui livrent tous les jours.", "تعتمد عليه متاجر تبيع وتشحن يومياً.")}
            </h2>
          </div>

          <div className="gsnap-rail">
            {testimonials.map((item, idx) => (
              <div key={idx} className="gc-card gsnap-item" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 2 }}>
                      {Array.from({ length: 5 }).map((_, si) => (
                        <Star key={si} size={14} fill="#F5B301" color="#F5B301" />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: "rgba(16,185,129,0.14)", color: "#10B981" }}>
                      {item.stat}
                    </span>
                  </div>
                  <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>« {item.quote} »</p>
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: 14, fontWeight: 900 }}>{item.brand}</strong>
                  <small style={{ fontSize: 12, color: "var(--gc-text-muted)" }}>{item.role}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 11. FAQ ACCORDÉON */}
      <section id="gc-faq" className="gc-section">
        <div className="gcome-container" style={{ maxWidth: 840 }}>
          <div className="gc-section-head">
            <span className="gc-eyebrow">{tx("Questions Fréquentes", "الأسئلة الشائعة")}</span>
            <h2 className="gc-section-title">{tx("Tout ce qu'il faut savoir", "كل ما تحتاج معرفته")}</h2>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="gc-card" style={{ padding: 0, overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    style={{
                      width: "100%",
                      padding: "16px 18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      textAlign: "start",
                      background: "transparent",
                      border: 0,
                      color: "var(--gc-text)",
                      fontWeight: 800,
                      fontSize: 14.5,
                      cursor: "pointer",
                    }}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      size={18}
                      style={{
                        flexShrink: 0,
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                      }}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{ padding: "0 18px 16px", fontSize: 13.5, lineHeight: 1.6, color: "var(--gc-text-muted)" }}>
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 12. LOGOS CONCEPTS SWITCHER + FINAL CTA */}
      <section className="gc-section">
        <div className="gcome-container" style={{ display: "grid", gap: 22 }}>
          {/* Interactive 3 Logo Concepts Comparator */}
          <div className="gc-card">
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div>
                <strong style={{ fontSize: 16, fontWeight: 900, display: "block" }}>
                  {tx("Identité Visuelle · Choisis ton Logo GCOME préféré", "الهوية البصرية · اختر تصميم شعار GCOME المفضل")}
                </strong>
                <small style={{ fontSize: 12.5, color: "var(--gc-text-muted)" }}>
                  {tx("Clique sur un concept pour le tester immédiatement dans toute la page :", "اضغط على أي تصميم لمعاينته فوراً في رأس الصفحة:")}
                </small>
              </div>
              <span className="gc-eyebrow">3 SVG Pro Concepts</span>
            </div>

            <div className="gsnap-rail">
              {GCOME_LOGO_CONCEPTS.map(c => {
                const selected = previewLogoConcept === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPreviewLogoConcept(c.id)}
                    className="gc-card gsnap-item"
                    style={{
                      textAlign: "start",
                      cursor: "pointer",
                      borderColor: selected ? "#7C3AED" : undefined,
                      borderWidth: selected ? 2 : 1,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <GcomeLogo concept={c.id} variant="full" lang={lang} />
                    <strong style={{ fontSize: 13.5, fontWeight: 900 }}>{tx(c.titleFr, c.titleAr)}</strong>
                    <small style={{ fontSize: 12, color: "var(--gc-text-muted)", lineHeight: 1.45 }}>
                      {tx(c.descFr, c.descAr)}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Final Big App CTA */}
          <div
            className="gc-card"
            style={{
              background: "linear-gradient(135deg, #2E1065 0%, #5B21B6 55%, #7C3AED 100%)",
              color: "#FFFFFF",
              border: 0,
              padding: "32px 20px",
              textAlign: "center",
            }}
          >
            <h2 style={{ fontSize: "clamp(1.6rem, 6vw, 2.5rem)", fontWeight: 900, lineHeight: 1.15 }}>
              {tx("Lance ta boutique en 5 minutes.", "أطلق متجرك المتكامل خلال 5 دقائق.")}
            </h2>
            <p style={{ marginTop: 10, fontSize: 14.5, color: "#EDE9FE", maxWidth: 520, marginInline: "auto" }}>
              {tx(
                "Essai gratuit 14 jours sans engagement. Connecte ton premier produit, tes pixels Meta/TikTok et DHD dès aujourd'hui.",
                "تجربة مجانية 14 يوماً بدون التزام. اربط منتجاتك، البيكسل وشركة التوصيل الآن."
              )}
            </p>
            <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
              <Link href={gcomeHref("/inscription")} className="gc-btn-hero-primary" style={{ background: "linear-gradient(135deg, #FDE047, #F5B301)", color: "#1E103B" }}>
                <Package size={18} />
                <span>{tx("Créer mon compte GCOME", "إنشاء حساب GCOME الآن")}</span>
              </Link>
              <Link href={gcomeHref("/connexion")} className="gc-btn-hero-secondary" style={{ background: "rgba(255,255,255,0.12)", color: "#FFFFFF", borderColor: "rgba(255,255,255,0.28)" }}>
                <span>{tx("Déjà client ? Connexion", "لديك حساب؟ تسجيل الدخول")}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </GcomeShell>
  );
}

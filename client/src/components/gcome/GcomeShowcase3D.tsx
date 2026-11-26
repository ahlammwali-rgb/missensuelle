import { useRef, useState, type MouseEvent } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import {
  BellRing,
  CheckCircle2,
  Layers3,
  PackageCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import type { GcomeLang } from "@/lib/gcome-i18n";

/* =========================================================
   1. Hero 3D Interactive Dashboard + Mobile App Card Stack
   ========================================================= */
export function HeroDashboard3D({ lang }: { lang: GcomeLang }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ["start 85%", "end 25%"],
  });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 130,
    damping: 22,
  });

  const scrollRotateX = useTransform(smoothProgress, [0, 1], [12, 0]);
  const scrollScale = useTransform(smoothProgress, [0, 1], [0.95, 1.01]);
  const floatBadgeY1 = useTransform(smoothProgress, [0, 1], [10, -14]);
  const floatBadgeY2 = useTransform(smoothProgress, [0, 1], [-6, 12]);

  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const tx = <T,>(fr: T, ar: T): T => (lang === "ar" ? ar : fr);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (window.innerWidth < 768) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Number((-py * 10).toFixed(2)),
      ry: Number((px * 12).toFixed(2)),
    });
  };

  return (
    <div
      ref={stageRef}
      className="g3d-stage"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
    >
      {/* Floating Top Pill */}
      <motion.div
        style={{ y: floatBadgeY1, top: 0, insetInlineEnd: 8 }}
        className="g3d-float-badge"
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#10B981",
            boxShadow: "0 0 0 4px rgba(16,185,129,0.22)",
          }}
        />
        <span>{tx("+12 commandes TikTok · CAPI OK", "+12 طلب تيك توك · CAPI مفعل")}</span>
      </motion.div>

      {/* Main 3D Perspective Dashboard + Mobile Frame */}
      <motion.div
        className="g3d-card-frame"
        style={{
          rotateX: scrollRotateX,
          scale: scrollScale,
          transform: `perspective(1200px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: "transform 0.18s ease-out",
        }}
      >
        {/* App Header Bar inside mockup */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 12,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                background: "linear-gradient(135deg, #7C3AED, #F5B301)",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                fontSize: 13,
              }}
            >
              G
            </span>
            <div>
              <strong style={{ fontSize: 12.5, display: "block" }}>
                {tx("Cockpit GCOME 3 en 1", "لوحة تحكم GCOME")}
              </strong>
              <small style={{ fontSize: 10.5, color: "#C4B5FD" }}>
                {tx("Live · 58 Wilayas", "مباشر · 58 ولاية")}
              </small>
            </div>
          </div>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              padding: "4px 9px",
              borderRadius: 999,
              background: "rgba(16,185,129,0.2)",
              color: "#6EE7B7",
              border: "1px solid rgba(52,211,153,0.35)",
            }}
          >
            {tx("Synchronisé", "متصل الآن")}
          </span>
        </div>

        {/* 3 KPI Strip (Boutique / Confirmation / Livraison) */}
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          <div
            style={{
              borderRadius: 14,
              padding: "10px 9px",
              background: "rgba(124,58,237,0.24)",
              border: "1px solid rgba(167,139,250,0.3)",
            }}
          >
            <small style={{ fontSize: 10, color: "#DDD6FE", display: "block" }}>
              {tx("Ventes jour", "مبيعات اليوم")}
            </small>
            <strong style={{ fontSize: 14.5, fontWeight: 900 }}>184 500 DA</strong>
          </div>
          <div
            style={{
              borderRadius: 14,
              padding: "10px 9px",
              background: "rgba(245,179,1,0.14)",
              border: "1px solid rgba(253,224,71,0.32)",
            }}
          >
            <small style={{ fontSize: 10, color: "#FDE047", display: "block" }}>
              {tx("Taux confirm.", "نسبة التأكيد")}
            </small>
            <strong style={{ fontSize: 14.5, fontWeight: 900 }}>81,4 %</strong>
          </div>
          <div
            style={{
              borderRadius: 14,
              padding: "10px 9px",
              background: "rgba(16,185,129,0.16)",
              border: "1px solid rgba(52,211,153,0.32)",
            }}
          >
            <small style={{ fontSize: 10, color: "#6EE7B7", display: "block" }}>
              {tx("ROAS net IA", "العائد ROAS")}
            </small>
            <strong style={{ fontSize: 14.5, fontWeight: 900 }}>4.8×</strong>
          </div>
        </div>

        {/* Animated Mini Chart + Orders Queue */}
        <div
          style={{
            marginTop: 12,
            borderRadius: 16,
            padding: 11,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#DDD6FE" }}>
              {tx("Flux Commandes & Expéditions", "تدفق الطلبات والشحن الفوري")}
            </span>
            <span style={{ fontSize: 10.5, color: "#FDE047", fontWeight: 800 }}>
              {tx("DHD + E-com", "DHD + إي-كوم")}
            </span>
          </div>

          <div style={{ display: "grid", gap: 7 }}>
            {[
              {
                name: tx("Amira B. · Alger", "أميرة ب. · الجزائر"),
                item: tx("Abaya Perle · 4 900 DA", "عباية لؤلؤ · 4,900 دج"),
                badge: tx("Livré ✅", "تم التوصيل ✅"),
                color: "#6EE7B7",
                bg: "rgba(16,185,129,0.18)",
              },
              {
                name: tx("Yasmine K. · Oran", "ياسمين ق. · وهران"),
                item: tx("Extensions Soie · 3 800 DA", "وصلات حرير · 3,800 دج"),
                badge: tx("En livraison 🚚", "قيد التوصيل 🚚"),
                color: "#C4B5FD",
                bg: "rgba(124,58,237,0.28)",
              },
              {
                name: tx("Rania M. · Sétif", "رانيا م. · سطيف"),
                item: tx("Pyjama Velours · 3 500 DA", "بيجاما قطيفة · 3,500 دج"),
                badge: tx("Confirmée 📞", "مؤكدة 📞"),
                color: "#FDE047",
                bg: "rgba(245,179,1,0.18)",
              },
            ].map((row, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "7px 9px",
                  borderRadius: 11,
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.name}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#A78BFA" }}>{row.item}</div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: row.bg,
                    color: row.color,
                    flexShrink: 0,
                  }}
                >
                  {row.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Floating Bottom Card */}
      <motion.div
        style={{ y: floatBadgeY2, bottom: -4, insetInlineStart: 8 }}
        className="g3d-float-badge"
      >
        <CheckCircle2 size={15} color="#10B981" />
        <span>{tx("Colis DHD encaissé · +4 900 DA", "تحصيل طرد DHD · +4,900 دج")}</span>
      </motion.div>
    </div>
  );
}

/* =========================================================
   2. Le 3 en 1 — Mobile App Cards + Desktop Scroll Assembly
   ========================================================= */
export function ThreeInOnePinnedSection({ lang }: { lang: GcomeLang }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeMod, setActiveMod] = useState<0 | 1 | 2>(0);
  const tx = <T,>(fr: T, ar: T): T => (lang === "ar" ? ar : fr);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 70%", "end 40%"],
  });
  const mergeProgress = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 2]);

  const modules = [
    {
      num: "01",
      icon: ShoppingBag,
      accent: "#7C3AED",
      title: tx("Boutique & Landings Haute Conversion", "متجر وصفحات هبوط عالية التحويل"),
      subtitle: tx("Encaisse dès le premier clic", "حوّل الزوار إلى طلبات من النقرة الأولى"),
      bullets: [
        tx("Templates pro prêts pour le COD algérien", "قوالب احترافية جاهزة للدفع عند الاستلام"),
        tx("Studio IA qui rédige et crée tes fiches produits", "استوديو ذكاء اصطناعي لإنشاء المنتجات"),
        tx("Multi-Pixels Facebook & TikTok + CAPI sans perte iPhone", "ربط فيسبوك وتيك توك مع CAPI السيرفر بدون ضياع"),
      ],
    },
    {
      num: "02",
      icon: Users,
      accent: "#F5B301",
      title: tx("Commandes & Équipe Confirmation", "الطلبات وفريق التأكيد"),
      subtitle: tx("Zéro appel perdu, zéro doublon", "لا ضياع لأي اتصال أو تكرار للطلبات"),
      bullets: [
        tx("Accès séparé pour chaque confirmateur + calcul de salaire", "حساب خاص لكل مؤكّدة طلبات مع حساب العمولات"),
        tx("Rappels intelligents Ne répond pas, Reporté & Paniers abandonnés", "تنبيهات تلقائية للطلبات المؤجلة والسلات المتروكة"),
        tx("Synchro instantanée Google Sheets & alertes sonores Ca-Ching", "مزامنة Google Sheets وإشعارات صوتية فورية"),
      ],
    },
    {
      num: "03",
      icon: Truck,
      accent: "#10B981",
      title: tx("Livraison 58 Wilayas & Finance IA", "التوصيل 58 ولاية والمالية الذكية"),
      subtitle: tx("Tu sais combien tu gagnes vraiment", "اعرف ربحك الصافي الحقيقي بالدينار لحظة بلحظة"),
      bullets: [
        tx("Expédition groupée EcoTrack / DHD & E-com Delivery en 1 clic", "ترحيل جماعي لشركات التوصيل بنقرة واحدة"),
        tx("Suivi temps réel, alertes retours, contrôle antérieur des colis", "تتبع مباشر لحالة الطرود وتنبيهات المرتجعات"),
        tx("Finance IA : coût marchandise FIFO, dépenses pub Meta/TikTok & bénéfice net", "المالية الذكية: تكلفة البضاعة، ميزانية الإعلانات وصافي الربح"),
      ],
    },
  ] as const;

  const activeData = modules[activeMod];

  return (
    <section id="gc-3in1" ref={sectionRef} className="gc-section">
      <div className="gcome-container">
        <div className="gc-section-head">
          <span className="gc-eyebrow">
            <Layers3 size={14} /> {tx("Architecture 3 en 1 Unifiée", "نظام متكامل 3 في 1")}
          </span>
          <h2 className="gc-section-title">
            {tx(
              "3 outils fusionnés dans une seule App.",
              "3 أدوات قوية مدمجة في تطبيق واحد."
            )}
          </h2>
          <p className="gc-section-sub">
            {tx(
              "Arrête de jongler entre ton site, Excel, WhatsApp et le portail transporteur. Balaye ou clique sur chaque module :",
              "توقف عن التنقل بين الموقع، إكسل، واتساب وبوابة شركة التوصيل. اسحب أو اختر كل وحدة:"
            )}
          </p>
        </div>

        {/* Interactive Assembly Pill Selector (Mobile App Style) */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <div className="gc-segmented" role="tablist">
            {modules.map((m, idx) => (
              <button
                key={m.num}
                type="button"
                role="tab"
                aria-selected={activeMod === idx}
                className={`gc-segmented-btn${activeMod === idx ? " is-active" : ""}`}
                onClick={() => setActiveMod(idx as 0 | 1 | 2)}
              >
                {m.num} · {idx === 0 ? tx("Boutique", "المتجر") : idx === 1 ? tx("Confirmation", "التأكيد") : tx("Livraison & IA", "التوصيل والمالية")}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Horizontal Swipeable Cards / Desktop 3-col Grid */}
        <div className="gsnap-rail">
          {modules.map((m, idx) => {
            const Icon = m.icon;
            const isSelected = activeMod === idx;
            return (
              <motion.article
                key={m.num}
                onClick={() => setActiveMod(idx as 0 | 1 | 2)}
                whileTap={{ scale: 0.985 }}
                className="gc-card gsnap-item"
                style={{
                  cursor: "pointer",
                  borderColor: isSelected ? m.accent : undefined,
                  boxShadow: isSelected
                    ? `0 20px 44px -18px ${m.accent}55`
                    : undefined,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      background: `${m.accent}20`,
                      color: m.accent,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Icon size={20} />
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: isSelected ? m.accent : "var(--gc-surface-muted)",
                      color: isSelected ? "#ffffff" : "var(--gc-text-muted)",
                    }}
                  >
                    {m.num}
                  </span>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.25 }}>
                  {m.title}
                </h3>
                <p style={{ fontSize: 13, color: "var(--gc-text-muted)", marginTop: 4 }}>
                  {m.subtitle}
                </p>
                <ul style={{ marginTop: 14, display: "grid", gap: 8, padding: 0, listStyle: "none" }}>
                  {m.bullets.map((b, bi) => (
                    <li
                      key={bi}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        fontSize: 12.8,
                        lineHeight: 1.4,
                      }}
                    >
                      <CheckCircle2 size={15} color={m.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </motion.article>
            );
          })}
        </div>

        {/* Scroll-linked Assembly Preview Strip */}
        <motion.div
          className="gc-card"
          style={{
            marginTop: 18,
            background: "linear-gradient(135deg, #1b0f3a 0%, #311268 100%)",
            color: "#ffffff",
            border: "1px solid rgba(196,181,253,0.3)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <motion.div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.12)",
                  display: "grid",
                  placeItems: "center",
                  rotate: useTransform(mergeProgress, [0, 2], [0, 8]),
                }}
              >
                <activeData.icon size={22} color="#FDE047" />
              </motion.div>
              <div>
                <small style={{ fontSize: 11, fontWeight: 800, color: "#FDE047", textTransform: "uppercase" }}>
                  {tx(`Module actif · ${activeData.num}/03`, `الوحدة النشطة · ${activeData.num}/03`)}
                </small>
                <div style={{ fontSize: 15, fontWeight: 900 }}>{activeData.title}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, color: "#DDD6FE" }}>
              <Sparkles size={15} color="#FDE047" />
              <span>
                {tx(
                  "Données partagées automatiquement entre Boutique, Équipe et Transporteur",
                  "البيانات تتدفق تلقائياً بين المتجر، الفريق وشركة التوصيل"
                )}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* =========================================================
   3. Real Interactive App + Dashboard Screen Previews
   ========================================================= */
export function RealPreviewsSection({ lang }: { lang: GcomeLang }) {
  const [activeScreen, setActiveScreen] = useState<"orders" | "shipping" | "finance" | "mobile">("orders");
  const tx = <T,>(fr: T, ar: T): T => (lang === "ar" ? ar : fr);

  const screens = [
    { id: "orders" as const, icon: ShoppingBag, label: tx("Commandes", "الطلبات") },
    { id: "shipping" as const, icon: PackageCheck, label: tx("Transférées", "الشحن") },
    { id: "finance" as const, icon: Wallet, label: tx("Finance IA", "المالية IA") },
    { id: "mobile" as const, icon: Smartphone, label: tx("App Mobile", "تطبيق الهاتف") },
  ];

  return (
    <section id="gc-previews" className="gc-section">
      <div className="gcome-container">
        <div className="gc-section-head">
          <span className="gc-eyebrow">
            <Smartphone size={14} /> {tx("Aperçus Réels GCOME", "معاينة الواجهات الحقيقية")}
          </span>
          <h2 className="gc-section-title">
            {tx("Pensé d'abord pour ton téléphone.", "مصمم أولاً للهاتف مثل التطبيق الأصلي.")}
          </h2>
          <p className="gc-section-sub">
            {tx(
              "Confirme, transfère et vérifie ta marge depuis n'importe où, en une main.",
              "أكّد، رحّل الطرود وراقب صافي ربحك بيد واحدة من هاتفك في أي مكان."
            )}
          </p>
        </div>

        {/* Segmented Tab Switcher */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div className="gc-segmented">
            {screens.map(s => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveScreen(s.id)}
                  className={`gc-segmented-btn${activeScreen === s.id ? " is-active" : ""}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Icon size={14} />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
            gap: 18,
            alignItems: "center",
          }}
        >
          {/* Left: Authentic Mobile Frame */}
          <div
            style={{
              maxWidth: 340,
              width: "100%",
              marginInline: "auto",
              borderRadius: 34,
              padding: 10,
              background: "linear-gradient(155deg, #271554, #090616)",
              border: "3px solid rgba(167,139,250,0.34)",
              boxShadow: "0 26px 60px -20px rgba(30,16,59,0.65)",
            }}
          >
            {/* Notch pill */}
            <div
              style={{
                width: 88,
                height: 6,
                borderRadius: 99,
                background: "rgba(255,255,255,0.22)",
                margin: "4px auto 12px",
              }}
            />
            <AnimatePresence mode="wait">
              <motion.div
                key={activeScreen}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                style={{
                  borderRadius: 24,
                  background: "#0f0a21",
                  color: "#ffffff",
                  padding: 14,
                  minHeight: 330,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                {activeScreen === "orders" && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 13.5 }}>{tx("Nouvelles commandes (14)", "طلبات جديدة (14)")}</strong>
                      <span style={{ fontSize: 10.5, color: "#6EE7B7", fontWeight: 800 }}>● Live</span>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {[
                        { img: "/images/petit-meche/01-petit-meche.jpg", name: "Meriem · 16 Alger", prod: "Frange Naturelle × 1", price: "2 900 DA" },
                        { img: "/images/pyjama/01-pyjama.jpg", name: "Imane · 31 Oran", prod: "Pyjama Satin × 2", price: "5 400 DA" },
                        { img: "/manus-storage/abaya-hero-main.jpg", name: "Lina · 25 Constantine", prod: "Abaya Luxe × 1", price: "6 200 DA" },
                      ].map((o, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: 9,
                            borderRadius: 14,
                            background: "rgba(255,255,255,0.06)",
                          }}
                        >
                          <img
                            src={o.img}
                            alt={o.prod}
                            style={{ width: 42, height: 42, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 800 }}>{o.name}</div>
                            <div style={{ fontSize: 10.5, color: "#C4B5FD", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {o.prod}
                            </div>
                          </div>
                          <strong style={{ fontSize: 11.5, color: "#FDE047" }}>{o.price}</strong>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{ padding: "8px", textAlign: "center", borderRadius: 12, background: "#10B981", fontSize: 11.5, fontWeight: 900 }}>
                        {tx("📞 Confirmer", "📞 تأكيد")}
                      </div>
                      <div style={{ padding: "8px", textAlign: "center", borderRadius: 12, background: "#7C3AED", fontSize: 11.5, fontWeight: 900 }}>
                        {tx("🚚 Transférer", "🚚 ترحيل")}
                      </div>
                    </div>
                  </>
                )}

                {activeScreen === "shipping" && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 13.5 }}>{tx("Suivi Colis DHD & E-com", "تتبع طرود DHD و E-com")}</strong>
                      <span style={{ fontSize: 10.5, color: "#FDE047", fontWeight: 800 }}>{tx("Tout sél. ✓", "تحديد الكل ✓")}</span>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {[
                        { code: "DHD-89412", wilaya: "Tizi Ouzou", st: tx("🟢 Livré au client", "🟢 تم التسليم للزبون"), c: "#6EE7B7" },
                        { code: "DHD-89419", wilaya: "Blida · StopDesk", st: tx("🚚 Sorti en livraison", "🚚 خرج للتوزيع"), c: "#C4B5FD" },
                        { code: "ECM-44201", wilaya: "Béjaïa", st: tx("📞 Ne répond pas · Relance", "📞 لا يرد · إعادة اتصال"), c: "#FDBA74" },
                      ].map((s, idx) => (
                        <div key={idx} style={{ padding: 10, borderRadius: 14, background: "rgba(255,255,255,0.06)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 800 }}>
                            <span>{s.code}</span>
                            <span style={{ color: "#94A3B8" }}>{s.wilaya}</span>
                          </div>
                          <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 800, color: s.c }}>{s.st}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: 10, borderRadius: 14, background: "rgba(124,58,237,0.22)", fontSize: 11, fontWeight: 700, textAlign: "center" }}>
                      {tx("Protection anti-429 & zéro faux statut Livré", "حماية ضد تكرار الطلبات والحالات الوهمية")}
                    </div>
                  </>
                )}

                {activeScreen === "finance" && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 13.5 }}>{tx("Finance IA & Bénéfice Net", "المالية الذكية والربح الصافي")}</strong>
                      <TrendingUp size={16} color="#10B981" />
                    </div>
                    <div style={{ padding: 12, borderRadius: 16, background: "linear-gradient(135deg, rgba(16,185,129,0.24), rgba(109,40,217,0.28))" }}>
                      <small style={{ fontSize: 10.5, color: "#A7F3D0" }}>{tx("BÉNÉFICE NET RÉEL (MOIS)", "صافي الربح الحقيقي (الشهر)")}</small>
                      <div style={{ fontSize: 24, fontWeight: 900, marginTop: 2 }}>412 800 DA</div>
                      <small style={{ fontSize: 10.5, color: "#FDE047" }}>{tx("Marge nette 31,4 % après pub & retours", "هامش ربح صافي 31.4% بعد الإعلانات والمرتجعات")}</small>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{ padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.06)" }}>
                        <small style={{ fontSize: 10, color: "#C4B5FD" }}>{tx("Budget FB/TikTok", "ميزانية الإعلانات")}</small>
                        <div style={{ fontSize: 13.5, fontWeight: 900 }}>165 000 DA</div>
                      </div>
                      <div style={{ padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.06)" }}>
                        <small style={{ fontSize: 10, color: "#FDE047" }}>{tx("Coût FIFO & Port", "التكلفة والشحن")}</small>
                        <div style={{ fontSize: 13.5, fontWeight: 900 }}>248 200 DA</div>
                      </div>
                    </div>
                  </>
                )}

                {activeScreen === "mobile" && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 13.5 }}>{tx("Notifications Push & Sonores", "تنبيهات فورية وأصوات البيع")}</strong>
                      <BellRing size={16} color="#FDE047" />
                    </div>
                    <div style={{ display: "grid", gap: 9 }}>
                      <div style={{ padding: 11, borderRadius: 14, background: "rgba(16,185,129,0.2)", border: "1px solid rgba(52,211,153,0.35)" }}>
                        <div style={{ fontSize: 11.5, fontWeight: 900, color: "#6EE7B7" }}>🎉 {tx("Nouvelle commande !", "طلبية جديدة!")}</div>
                        <div style={{ fontSize: 11, marginTop: 2 }}>{tx("Son Ca-Ching · 4 500 DA · Blida", "صوت كاشينغ · 4,500 دج · البليدة")}</div>
                      </div>
                      <div style={{ padding: 11, borderRadius: 14, background: "rgba(124,58,237,0.22)", border: "1px solid rgba(167,139,250,0.35)" }}>
                        <div style={{ fontSize: 11.5, fontWeight: 900, color: "#DDD6FE" }}>🚀 {tx("VICTOIRE : Colis livré", "تم التسليم بنجاح!")}</div>
                        <div style={{ fontSize: 11, marginTop: 2 }}>{tx("Confirmé par le transporteur · Caisse mise à jour", "تأكيد من شركة التوصيل وتحديث الرصيد")}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#C4B5FD", textAlign: "center", fontWeight: 700 }}>
                      {tx("Installable en 1 tap sur Android & iPhone (PWA)", "يُثبت كـ تطبيق على أندرويد وآيفون بنقرة واحدة")}
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: Explanations & Quick Action Summary */}
          <div className="gc-card" style={{ display: "grid", gap: 14 }}>
            <span className="gc-eyebrow" style={{ width: "fit-content" }}>
              {tx("Vitesse & Précision Terrain", "السرعة والدقة في الميدان")}
            </span>
            <h3 style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.2 }}>
              {activeScreen === "orders"
                ? tx("Gestion de commandes fluide, même avec 200 commandes/jour", "إدارة سلسة للطلبات حتى مع مئات الطلبات يومياً")
                : activeScreen === "shipping"
                  ? tx("Expédition groupée EcoTrack/DHD & E-com sans quitter l'écran", "شحن جماعي عبر DHD و E-com دون مغادرة اللوحة")
                  : activeScreen === "finance"
                    ? tx("Connais ta rentabilité nette par produit et par campagne pub", "اعرف صافي ربحك لكل منتج ولكل حملة إعلانية")
                    : tx("Alertes temps réel même écran verrouillé sur téléphone", "تنبيهات مباشرة على هاتفك حتى والشاشة مغلقة")}
            </h3>
            <p style={{ fontSize: 14, color: "var(--gc-text-muted)", lineHeight: 1.6 }}>
              {tx(
                "Chaque écran de GCOME a d'abord été pensé pour l'écran tactile du marchand et de ses confirmatrices : boutons dans la zone du pouce, recherche instantanée par téléphone, et aucun tableau illisible.",
                "كل شاشة في GCOME صُممت أولاً لهاتفك وهاتف فريق التأكيد: أزرار كبيرة في متناول الإبهام، بحث سريع برقم الهاتف، ووضوح تام بدون تعقيد."
              )}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                paddingTop: 4,
              }}
            >
              <div style={{ padding: 12, borderRadius: 14, background: "var(--gc-surface-muted)" }}>
                <strong style={{ fontSize: 18, fontWeight: 900, color: "var(--gc-primary)" }}>
                  &lt; 3 sec
                </strong>
                <div style={{ fontSize: 12, color: "var(--gc-text-muted)", fontWeight: 700 }}>
                  {tx("Pour appeler ou transférer", "للاتصال أو ترحيل الطرد")}
                </div>
              </div>
              <div style={{ padding: 12, borderRadius: 14, background: "var(--gc-surface-muted)" }}>
                <strong style={{ fontSize: 18, fontWeight: 900, color: "var(--gc-emerald)" }}>
                  100 %
                </strong>
                <div style={{ fontSize: 12, color: "var(--gc-text-muted)", fontWeight: 700 }}>
                  {tx("Adapté Mobile & PC", "متوافق هاتف وحاسوب")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

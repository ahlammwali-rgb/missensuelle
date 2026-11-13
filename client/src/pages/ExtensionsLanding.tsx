import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, ShieldCheck, Sparkles, Star, Truck } from "lucide-react";
import { type Order, type Product } from "@/lib/store-data";
import { abayaCommunesByWilaya, abayaWilayas } from "@/lib/abaya-communes";
import { trpc } from "@/lib/trpc";
import { shippingFeeFor } from "@shared/shipping";
import { useCheckoutDraft } from "@/components/useCheckoutDraft";
import { submitCheckoutOrder } from "@/lib/checkout-api";
import { trackPixelEvent } from "@/lib/tracking";
import "./extensions-template.css";

type OfferMode = "single" | "pack2";

type ExtensionShade = {
  id: string;
  name: string;
  subtitle: string;
  badge: string;
  swatch: string;
  image: string;
};

const SHADES: readonly ExtensionShade[] = [
  {
    id: "chatain-fonce",
    name: "شاتان فونس",
    subtitle: "بني شاتان طبيعي دافئ بتموجات لامعة يناسب أغلب ألوان الشعر",
    badge: "الأكثر طلباً 🔥",
    swatch: "#4b2818",
    image: "/manus-storage/ext-c1-chatain-fonce.jpg",
  },
  {
    id: "noir",
    name: "أسود",
    subtitle: "أسود ملكي جذاب بلمعة حريرية طبيعية وكثافة فائقة",
    badge: "كلاسيكي فخم ✨",
    swatch: "#151518",
    image: "/manus-storage/ext-c2-noir.jpg",
  },
  {
    id: "brun-fonce",
    name: "بني غامق",
    subtitle: "بني داكن شوكولا يمنحك إطلالة أنثوية ناعمة وطبيعية جداً",
    badge: "طبيعي 100% 🤎",
    swatch: "#361f14",
    image: "/manus-storage/ext-c3-brun-fonce.jpg",
  },
  {
    id: "chatain-roux",
    name: "شاتان روكس",
    subtitle: "عسلي نحاسي دافئ يضيء الملامح ويمنحك ستايل عصري ساحر",
    badge: "لون مميز 🌟",
    swatch: "#80411e",
    image: "/manus-storage/ext-c4-chatain-roux.jpg",
  },
  {
    id: "blond-clair",
    name: "أشقر فاتح",
    subtitle: "أشقر ذهبي فاتح لإطلالة مشرقة ومثالية للمناسبات والأعراس",
    badge: "إطلالة ملكية 👑",
    swatch: "#d8be96",
    image: "/manus-storage/ext-c5-blond-clair.jpg",
  },
  {
    id: "gris-balayage",
    name: "نور بالياح غري",
    subtitle: "بالياح رمادي عصري متدرج مع جذور داكنة لمظهر جريء وفخم",
    badge: "ترند الموسم 💎",
    swatch: "#76737d",
    image: "/manus-storage/ext-c6-gris-balayage.jpg",
  },
] as const;

const DETAIL_PHOTOS = [
  {
    title: "خصلات طويلة وكثافة فورية",
    desc: "طول مثالي يمنح شعرك حجماً مضاعفاً ومظهراً أنثوياً ساحراً من أول دقيقة.",
    image: "/manus-storage/ext-detail-strand.jpg",
    tag: "طول وكثافة XXL",
  },
  {
    title: "كلبسات مخفية وثابتة",
    desc: "مزودة بكلبسات مبطنة سهلة التركيب في دقيقتين، ثابتة طوال اليوم بدون شد أو ضرر.",
    image: "/manus-storage/ext-detail-clips.jpg",
    tag: "تركيب في دقيقتين",
  },
  {
    title: "شعر طبيعي 50% بملمس حريري",
    desc: "ألياف طبيعية فاخرة ناعمة الملمس تندمج كلياً مع شعرك وتتحمل التسريح والويفي.",
    image: "/manus-storage/ext-detail-waves.jpg",
    tag: "ملمس حريري ناعم",
  },
] as const;

const REVIEWS = [
  {
    name: "سارة ب. · وهران ✅",
    shade: "شاتان فونس",
    text: "وصلتني في يومين برك! الشعر ناعم بزاف واللون شاتان فونس خرج نفس شعري تماماً، تركبيها في دقيقتين وتبان طبيعية 100% يعطيكم الصحة ❤️",
  },
  {
    name: "إيمان م. · الجزائر العاصمة ✅",
    shade: "أسود",
    text: "كنت خايفة تبان اصطناعية بصح كي فتحت الكولي انبهرت بالجودة! الكلبسات تاوعها يحكمو مليح وما يوجعوش كامل في الراس، ديت عرض زوج قطع أنا وأختي.",
  },
  {
    name: "أمينة ك. · قسنطينة ✅",
    shade: "بني غامق",
    text: "بهاد السعر 2700 دج والله غير صفقة رابحة! كثافة وطول يهبلو، درت بيها الويفي في عرس خويا كلشي سقسيوني وين شريتها 😍",
  },
] as const;

const PACK_2_PRICE = 4800;

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function ExtensionsLanding({
  product,
  quantity,
}: {
  product: Product;
  quantity: number;
}) {
  const [activeSlideIdx, setActiveSlideIdx] = useState<number>(0);
  const [color, setColor] = useState<string>(SHADES[0].name);
  const [secondColor, setSecondColor] = useState<string>(SHADES[1].name);
  const [offerMode, setOfferMode] = useState<OfferMode>("single");
  const [selectedWilaya, setSelectedWilaya] = useState<string>("");
  const [selectedCommune, setSelectedCommune] = useState<string>("");
  const [remainingSeconds, setRemainingSeconds] = useState(14 * 3600 + 27 * 60 + 42);
  const [okMessage, setOkMessage] = useState<string>("");
  const [toastMsg, setToastMsg] = useState<string>("");
  const [toastShown, setToastShown] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderSubmitted, setOrderSubmitted] = useState<boolean>(false);

  const isSubmittingRef = useRef<boolean>(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const currentShade = SHADES[activeSlideIdx] ?? SHADES[0];

  const communes = selectedWilaya
    ? (abayaCommunesByWilaya[selectedWilaya] ?? [])
    : [];

  const ratesQuery = trpc.store.shippingRates.useQuery(undefined, {
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const shippingFee = selectedWilaya
    ? shippingFeeFor(ratesQuery.data?.rates, selectedWilaya, "home", [product.id])
    : 0;

  const singleUnitPrice = product.price || 2700;
  const goodsTotal =
    offerMode === "pack2"
      ? PACK_2_PRICE
      : singleUnitPrice * Math.max(1, quantity || 1);

  const showToast = (msg: string, duration = 2400) => {
    setToastMsg(msg);
    setToastShown(true);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastShown(false);
    }, duration);
  };

  useCheckoutDraft({
    formRef,
    source: "product",
    aliases: { customer: ["name"] },
    getItems: () => [
      {
        productId: product.id,
        quantity: offerMode === "pack2" ? 2 : Math.max(1, quantity || 1),
        color:
          offerMode === "pack2"
            ? `1: ${color} | 2: ${secondColor}`
            : color,
        size: "",
      },
    ],
    watchKey: `${color}|${secondColor}|${offerMode}|${selectedWilaya}|${selectedCommune}|${quantity}`,
  });

  useEffect(() => {
    trackPixelEvent("ViewContent", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: product.name,
      value: product.price,
      currency: "DZD",
    });
  }, [product.id, product.name, product.price]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Miss Sensuelle – إكستنشن الشعر الطبيعي الفاخر";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemainingSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const hours = pad2(Math.floor(remainingSeconds / 3600));
  const minutes = pad2(Math.floor((remainingSeconds % 3600) / 60));
  const seconds = pad2(remainingSeconds % 60);

  const selectShadeByIndex = (idx: number, announce = true) => {
    const safeIdx = (idx + SHADES.length) % SHADES.length;
    const chosen = SHADES[safeIdx];
    setActiveSlideIdx(safeIdx);
    setColor(chosen.name);
    if (announce) {
      showToast(`✅ اللون المختار: ${chosen.name}`, 2200);
    }
  };

  const selectShadeByName = (shadeName: string, announce = true) => {
    const foundIdx = SHADES.findIndex(s => s.name === shadeName);
    if (foundIdx >= 0) {
      selectShadeByIndex(foundIdx, announce);
    } else {
      setColor(shadeName);
    }
  };

  const scrollToOrderForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activatePack2Offer = () => {
    setOfferMode("pack2");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    showToast("🔥 تم تفعيل عرض قطعتين بـ 4,800 دج فقط !", 2600);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingRef.current || orderSubmitted) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const chosenColor = String(formData.get("color") || color || SHADES[0].name).trim();
    const customer = String(formData.get("name") || "زبونة Miss Sensuelle").trim();
    const rawPhone = String(formData.get("phone") || "").trim();
    const phone = rawPhone.replace(/[\s\-\.]/g, "");
    const wilaya = String(formData.get("wilaya") || selectedWilaya).trim();
    const commune = String(formData.get("commune") || selectedCommune || wilaya).trim();
    const extraNote = String(formData.get("note") || "").trim();

    const isPack = offerMode === "pack2";
    const billedQty = isPack ? 2 : Math.max(1, quantity || 1);
    const orderTotal =
      (isPack ? PACK_2_PRICE : singleUnitPrice * billedQty) + shippingFee;
    const summaryColor = isPack
      ? `1: ${chosenColor} | 2: ${secondColor}`
      : chosenColor;

    const offerNoteParts = [
      isPack
        ? `🔥 عرض خاص: 2 إكستنشن بـ 4,800 دج بدل 5,400 دج — [القطعة 1: ${chosenColor} | القطعة 2: ${secondColor}]`
        : "",
      extraNote,
    ].filter(Boolean);
    const offerNote = offerNoteParts.join(" · ");

    setOkMessage(
      isPack
        ? `✅ شكرًا لكِ ${customer}! تم تسجيل طلبك لعرض (2 إكستنشن بـ 4,800 دج 🔥)، سنتصل بك قريبًا لتأكيده.`
        : `✅ شكرًا لكِ ${customer}! تم تسجيل طلبك (اللون: ${chosenColor})، سنتصل بك قريبًا لتأكيده.`
    );

    let serverOrderNumber = `MS-${Math.floor(1000 + Math.random() * 8999)}`;

    try {
      const storedToken =
        window.sessionStorage.getItem("miss-sensuelle-checkout-token") ||
        window.localStorage.getItem("miss-sensuelle-checkout-token");
      const token =
        storedToken ??
        globalThis.crypto?.randomUUID?.() ??
        `00000000-0000-4000-8000-${String(Date.now()).padStart(12, "0").slice(-12)}`;

      const res = await submitCheckoutOrder(token, {
        source: "product",
        customer,
        phone,
        wilaya,
        commune,
        address: "",
        note: offerNote,
        delivery: "home",
        items: [
          {
            productId: product.id,
            quantity: billedQty,
            color: summaryColor,
            size: "",
          },
        ],
      });
      serverOrderNumber = res.orderNumber;
      try {
        window.sessionStorage.removeItem("miss-sensuelle-checkout-token");
        window.localStorage.removeItem("miss-sensuelle-checkout-token");
      } catch {}
    } catch {
      // Fallback local si hors-ligne
    }

    const order: Order = {
      id: serverOrderNumber,
      createdAt: new Date().toISOString(),
      customer,
      phone,
      product: isPack
        ? `${product.name} (عرض 2 إكستنشن بـ 4800 دج)`
        : `${product.name} · ${chosenColor}`,
      productId: product.id,
      color: summaryColor,
      size: "",
      delivery: "home",
      quantity: billedQty,
      total: orderTotal,
      wilaya,
      commune,
      address: "",
      note: offerNote,
      status: "nouvelle",
    };

    try {
      const existing = JSON.parse(
        localStorage.getItem("miss-sensuelle-orders") || "[]"
      ) as Order[];
      localStorage.setItem(
        "miss-sensuelle-orders",
        JSON.stringify([order, ...existing])
      );
    } catch {
      // Confirmation visuelle conservée
    }

    trackPixelEvent("Purchase", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: product.name,
      value: orderTotal,
      currency: "DZD",
      order_id: serverOrderNumber,
      phone,
      customer,
    });

    setOrderSubmitted(true);
    setIsSubmitting(false);
    isSubmittingRef.current = false;
  };

  return (
    <div className="extensions-template" dir="rtl" lang="ar">
      <div className="ext-page">
        {/* Top Announcement Promo Bar */}
        <div className="ext-promo-bar">
          ✨ عرض خاص لفترة محدودة : <strong>2,700 دج فقط</strong> بدل <del>3,500 دج</del> · الدفع عند الاستلام وتوصيل سريع لـ 58 ولاية 🚚
        </div>

        {/* Section 1: Hero Banner Image + Instant Conversion Card */}
        <section className="ext-hero-section">
          <div className="ext-hero-banner-wrap">
            <img
              className="ext-hero-img"
              src="/manus-storage/ext-hero-banner.jpg"
              alt="Miss Sensuelle – إكستنشن الشعر الطبيعي الفاخر"
            />
          </div>

          <div className="ext-hero-summary">
            <div className="ext-hero-summary-top">
              <div>
                <span className="ext-kicker">👑 MISS SENSUELLE · BEAUTÉ & CONFIANCE</span>
                <h1>إكستنشن الشعر الطبيعي 50% — طول أكبر وكثافة ساحرة</h1>
              </div>
              <div className="ext-price-tag">
                <strong>2,700 دج</strong>
                <del>3,500 دج</del>
                <span>خصم 23%-</span>
              </div>
            </div>

            <div className="ext-urgency-box">
              <div className="ext-urgency-labels">
                <span>🔥 سارعي ! الكمية محدودة جداً بهذا السعر</span>
                <span>👁️ تشاهده 34 زبونة الآن</span>
              </div>
              <div className="ext-urgency-bar">
                <i />
              </div>
            </div>

            <button
              type="button"
              className="ext-hero-cta-btn"
              onClick={scrollToOrderForm}
            >
              👇 اضغطي هنا لطلب لونك المفضل الآن (الدفع عند الاستلام)
            </button>
          </div>
        </section>

        {/* Section 2: 4 Luxury Guarantee Badges */}
        <section className="ext-guarantees-grid">
          <div className="ext-guarantee-item">
            <span className="ext-g-icon">💎</span>
            <b>شعر طبيعي 50%</b>
            <small>ملمس حريري ناعم</small>
          </div>
          <div className="ext-guarantee-item">
            <span className="ext-g-icon">⚡</span>
            <b>سهل التركيب</b>
            <small>في دقيقتين فقط</small>
          </div>
          <div className="ext-guarantee-item">
            <span className="ext-g-icon">🚚</span>
            <b>توصيل سريع</b>
            <small>لكل 58 ولاية</small>
          </div>
          <div className="ext-guarantee-item">
            <span className="ext-g-icon">🛡️</span>
            <b>الدفع عند الاستلام</b>
            <small>افحصي قبل الدفع</small>
          </div>
        </section>

        {/* Section 3: BIG Interactive Color Slider + 3x2 Large Color Cards */}
        <section className="ext-slider-section">
          <div className="ext-section-head">
            <span className="ext-badge-gold">🎨 متوفر بـ 6 ألوان ساحرة</span>
            <h2>شوفي الألوان بحجم كبير واختاري اللون اللي يخرج عليك</h2>
            <p>مرّري السلايدر أو اضغطي على أي لون بالأسفل لتكبيره واعتماده في طلبك</p>
          </div>

          {/* BIG Main Showcase Slider */}
          <div className="ext-big-slider">
            <button
              type="button"
              className="ext-slider-nav ext-slider-prev"
              aria-label="اللون السابق"
              onClick={() => selectShadeByIndex(activeSlideIdx - 1)}
            >
              <ChevronRight size={26} />
            </button>

            <div className="ext-big-slide-card">
              <div className="ext-big-slide-img-wrap">
                <img
                  key={currentShade.id}
                  src={currentShade.image}
                  alt={currentShade.name}
                  className="ext-big-slide-img"
                />
                <span className="ext-slide-floating-badge">{currentShade.badge}</span>
                <span className="ext-slide-counter">
                  {activeSlideIdx + 1} / {SHADES.length}
                </span>
              </div>

              <div className="ext-big-slide-info">
                <div className="ext-big-slide-title-row">
                  <div className="ext-shade-Identity">
                    <span
                      className="ext-shade-dot-lg"
                      style={{ background: currentShade.swatch }}
                    />
                    <div>
                      <h3>اللون : {currentShade.name}</h3>
                      <p>{currentShade.subtitle}</p>
                    </div>
                  </div>
                  <div className="ext-slide-selected-pill">
                    ✓ اللون المختار حالياً
                  </div>
                </div>

                <button
                  type="button"
                  className="ext-slide-order-btn"
                  onClick={scrollToOrderForm}
                >
                  اطلبي اللون « {currentShade.name} » الآن بـ 2,700 دج 🛒
                </button>
              </div>
            </div>

            <button
              type="button"
              className="ext-slider-nav ext-slider-next"
              aria-label="اللون التالي"
              onClick={() => selectShadeByIndex(activeSlideIdx + 1)}
            >
              <ChevronLeft size={26} />
            </button>
          </div>

          {/* Slider Dots */}
          <div className="ext-slider-dots">
            {SHADES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                aria-label={s.name}
                className={idx === activeSlideIdx ? "active" : ""}
                onClick={() => selectShadeByIndex(idx)}
              >
                <span style={{ background: s.swatch }} />
                <b>{s.name}</b>
              </button>
            ))}
          </div>

          {/* LARGE 3x2 Color Cards Grid (2x larger & clearer than old poster) */}
          <div className="ext-colors-grid-large">
            {SHADES.map((shade, idx) => {
              const isSelected = color === shade.name;
              return (
                <button
                  key={shade.id}
                  type="button"
                  className={`ext-color-card-lg${isSelected ? " selected" : ""}`}
                  onClick={() => selectShadeByIndex(idx)}
                >
                  <div className="ext-color-card-img-box">
                    <img src={shade.image} alt={shade.name} loading="lazy" />
                    {isSelected && (
                      <span className="ext-color-check">✓ تم الاختيار</span>
                    )}
                  </div>
                  <div className="ext-color-card-footer">
                    <i style={{ background: shade.swatch }} />
                    <strong>{shade.name}</strong>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 4: Detailed Close-Up Photos of the Hair Extension */}
        <section className="ext-details-section">
          <div className="ext-section-head">
            <span className="ext-badge-gold">🔍 صور تفصيلية عن قرب</span>
            <h2>لماذا تعشق زبوناتنا إكستنشن Miss Sensuelle ؟</h2>
            <p>تفاصيل الجودة، الكلبسات المخفية والملمس الطبيعي عن قرب</p>
          </div>

          <div className="ext-details-grid">
            {DETAIL_PHOTOS.map(detail => (
              <article key={detail.title} className="ext-detail-card">
                <div className="ext-detail-img-wrap">
                  <img src={detail.image} alt={detail.title} loading="lazy" />
                  <span className="ext-detail-tag">{detail.tag}</span>
                </div>
                <div className="ext-detail-copy">
                  <h3>{detail.title}</h3>
                  <p>{detail.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Section 5: Harmonious Warm-Gold & Espresso High-Converting Order Form */}
        <form className="ext-fm" id="f" ref={formRef} onSubmit={handleSubmit}>
          <div className="ext-fh">
            <div>
              <span className="ext-form-kicker">⚡ استمارة الطلب السريع · الدفع عند الاستلام</span>
              <h2>🔥 اطلبي الآن قبل نفاذ الكمية !</h2>
            </div>
            <div className="ext-tm">
              الوقت المتبقي للعرض
              <div>
                <b id="h">{hours}</b>
                <span>:</span>
                <b id="m">{minutes}</b>
                <span>:</span>
                <b id="s">{seconds}</b>
              </div>
            </div>
          </div>

          {/* Visual Color Selector right inside the form */}
          <div className="ext-form-color-picker">
            <div className="ext-form-color-head">
              <span>🎨 1. اختاري لون الإكستنشن :</span>
              <strong>اللون المختار : {color}</strong>
            </div>
            <div className="ext-form-color-strip">
              {SHADES.map((s, idx) => {
                const active = color === s.name;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`ext-form-color-pill${active ? " active" : ""}`}
                    onClick={() => selectShadeByIndex(idx, false)}
                  >
                    <img src={s.image} alt={s.name} />
                    <span>{s.name}</span>
                    {active && <i>✓</i>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input Fields Grid matching the luxury aesthetic */}
          <div className="ext-g">
            <label className="ext-f">
              <i>📞</i>
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                required
                pattern="0[5-7][0-9]{8}"
                placeholder="رقم الهاتف (07/05/06...)"
                onFocus={() =>
                  trackPixelEvent("InitiateCheckout", {
                    content_type: "product",
                    content_id: product.id,
                    content_ids: [product.id],
                    content_name: product.name,
                    value: product.price,
                    currency: "DZD",
                  })
                }
              />
            </label>

            <label className="ext-f">
              <i>👤</i>
              <input name="name" required placeholder="الاسم الكامل" />
            </label>

            <label className="ext-f">
              <i>🎨</i>
              <select
                name="color"
                required
                value={color}
                onChange={e => selectShadeByName(e.target.value, false)}
              >
                {SHADES.map(c => (
                  <option key={c.id} value={c.name}>
                    اللون: {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="ext-f">
              <i>📍</i>
              <select
                name="wilaya"
                required
                value={selectedWilaya}
                onChange={e => {
                  setSelectedWilaya(e.target.value);
                  setSelectedCommune("");
                }}
              >
                <option value="">اختاري الولاية (58 ولاية)</option>
                {abayaWilayas.map(w => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>

            <label className="ext-f">
              <i>🏘️</i>
              <select
                name="commune"
                required
                disabled={!selectedWilaya}
                value={selectedCommune}
                onChange={e => setSelectedCommune(e.target.value)}
              >
                <option value="">
                  {selectedWilaya ? "اختاري البلدية" : "اختاري الولاية أولاً"}
                </option>
                {communes.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="ext-f">
              <i>📝</i>
              <input name="note" placeholder="ملاحظة للتوصيل (اختياري)" />
            </label>
          </div>

          {/* Offer Choices: Single vs Pack Duo */}
          <div className="ext-offer-choices">
            <button
              type="button"
              className={`ext-offer-option${offerMode === "single" ? " active" : ""}`}
              onClick={() => setOfferMode("single")}
            >
              <div className="ext-offer-main">
                <span className="ext-offer-radio" />
                <div className="ext-offer-text">
                  <strong>قطعة واحدة (1 إكستنشن شعر)</strong>
                  <small>العرض العادي · كثافة وطول طبيعي</small>
                </div>
              </div>
              <div className="ext-offer-price">
                <b>2,700 دج</b>
                <del>3,500 دج</del>
              </div>
            </button>

            <button
              type="button"
              className={`ext-offer-option${offerMode === "pack2" ? " active" : ""}`}
              onClick={() => setOfferMode("pack2")}
            >
              <div className="ext-offer-main">
                <span className="ext-offer-radio" />
                <div className="ext-offer-text">
                  <strong>🔥 عرض خاص : اشتري 2 إكستنشن بتخفيض رائع !</strong>
                  <small>2 قطع بـ 4,800 دج فقط (وفّري 600 دج لكثافة مضاعفة)</small>
                </div>
              </div>
              <div className="ext-offer-price">
                <b>4,800 دج</b>
                <del>5,400 دج</del>
              </div>
            </button>

            {offerMode === "pack2" && (
              <div className="ext-offer-subform">
                <div className="ext-offer-subform-title">
                  ✨ اختاري لون القطعة الثانية من الإكستنشن 💇‍♀️
                </div>
                <div className="ext-form-color-strip">
                  {SHADES.map(s => {
                    const active2 = secondColor === s.name;
                    return (
                      <button
                        key={`second-${s.id}`}
                        type="button"
                        className={`ext-form-color-pill${active2 ? " active" : ""}`}
                        onClick={() => setSecondColor(s.name)}
                      >
                        <img src={s.image} alt={s.name} />
                        <span>{s.name}</span>
                        {active2 && <i>✓</i>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Order Summary & Shipping Box */}
          <div className="ext-summary-box">
            <div className="ext-summary-row">
              <span>🎨 اللون المختار :</span>
              <strong>
                {offerMode === "pack2"
                  ? `1: ${color} + 2: ${secondColor}`
                  : color}
              </strong>
            </div>
            <div className="ext-summary-row">
              <span>🛍️ سعر الطلبية :</span>
              <strong>{goodsTotal.toLocaleString("en-US")} دج</strong>
            </div>
            <div className="ext-summary-row">
              <span>🚚 سعر التوصيل {selectedWilaya ? `إلى ${selectedWilaya}` : ""} :</span>
              <strong>
                {selectedWilaya
                  ? `${shippingFee.toLocaleString("en-US")} دج`
                  : "يُحدد فور اختيار الولاية"}
              </strong>
            </div>
            <div className="ext-summary-total">
              <span>💰 المبلغ الإجمالي عند الاستلام :</span>
              <strong>
                {(goodsTotal + shippingFee).toLocaleString("en-US")} دج
              </strong>
            </div>
          </div>

          {/* Submit CTA Button with Curved Arrow */}
          <div className="ext-bt">
            <svg viewBox="0 0 60 50">
              <path
                d="M5 4C8 30 25 42 48 40"
                fill="none"
                stroke="#f5c04a"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M40 28L54 40 38 49"
                fill="none"
                stroke="#f5c04a"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <button
              className="ext-go"
              type="submit"
              disabled={isSubmitting || orderSubmitted}
            >
              {isSubmitting
                ? "جاري تأكيد طلبك... ⏳"
                : orderSubmitted
                  ? "تم استلام طلبك بنجاح ✅"
                  : offerMode === "pack2"
                    ? "أؤكد طلبي للعرض (2 بـ 4,800 دج) 🛒"
                    : "أؤكد طلبي الآن (2,700 دج) 🛒"}
            </button>
          </div>

          <p id="ok" style={{ display: okMessage ? "block" : "none" }}>
            {okMessage}
          </p>
        </form>

        {/* Section 6: Under-Form Pack 2 Promo Banner */}
        <div
          className="ext-under-form-offer"
          onClick={activatePack2Offer}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") activatePack2Offer();
          }}
        >
          <span className="ext-under-badge">🔥 عرض التوفير الأكثر طلباً 🔥</span>
          <h3>
            اشتري 2 إكستنشن شعر بـ <span>4,800 دج فقط !</span>
          </h3>
          <p>
            احصلي على قطعتين من إكستنشن الشعر الفاخر (يمكنك اختيار لونين مختلفين أو نفس اللون لكثافة مضاعفة) بسعر <b>4,800 دج</b> بدلاً من <del>5,400 دج</del> !
          </p>
          <span className="ext-under-cta">
            {offerMode === "pack2"
              ? "✅ تم تفعيل عرض 2 إكستنشن بـ 4,800 دج في الاستمارة أعلاه"
              : "👈 اضغطي هنا لتفعيل عرض قطعتين بـ 4,800 دج"}
          </span>
        </div>

        {/* Section 7: Customer Reviews Section */}
        <section className="ext-reviews-section">
          <div className="ext-reviews-header">
            <div>
              <strong>💬 آراء زبوناتنا بعد التجربة</strong>
              <small>أكثر من 3,200 زبونة راضية في جميع ولايات الجزائر</small>
            </div>
            <div className="ext-rating-pill">⭐ 4.9 / 5</div>
          </div>

          <div className="ext-reviews-list">
            {REVIEWS.map(rev => (
              <div key={rev.name} className="ext-review-box">
                <div className="ext-review-top">
                  <div>
                    <b>{rev.name}</b>
                    <span className="ext-review-shade">اللون : {rev.shade}</span>
                  </div>
                  <em className="ext-review-stars">★★★★★</em>
                </div>
                <p>« {rev.text} »</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="ext-footer">
          <div className="ext-footer-brand">
            <span>👑</span>
            <strong>Miss Sensuelle</strong>
            <small>Beauté & Confiance · الجزائر</small>
          </div>
          <div className="ext-footer-trust">
            <span>📦 توصيل سريع 58 ولاية</span>
            <span>🛡️ دفع آمن 100% عند الاستلام</span>
            <span>❤️ رضاكم يهمنا</span>
          </div>
        </footer>
      </div>

      <div id="t" className={`ext-toast${toastShown ? " s" : ""}`}>
        {toastMsg}
      </div>
    </div>
  );
}

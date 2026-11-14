import { FormEvent, TouchEvent, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  swatch: string;
  backCardImage: string;
  frontModelImage: string;
};

const SHADES: readonly ExtensionShade[] = [
  {
    id: "noir-naturel",
    name: "أسود طبيعي",
    subtitle: "أسود طبيعي جذاب بلمعة حريرية وكثافة فورية",
    swatch: "#161518",
    backCardImage: "/manus-storage/ext-pink-v1.jpg",
    frontModelImage: "/manus-storage/ext-c2-noir.jpg",
  },
  {
    id: "brun-fonce",
    name: "بني غامق",
    subtitle: "بني غامق شوكولا يمنحك إطلالة أنثوية طبيعية جداً",
    swatch: "#3a2014",
    backCardImage: "/manus-storage/ext-pink-v2.jpg",
    frontModelImage: "/manus-storage/ext-c3-brun-fonce.jpg",
  },
  {
    id: "brun-miel",
    name: "بني عسلي",
    subtitle: "بني عسلي دافئ بتموجات لامعة يناسب أغلب ألوان الشعر",
    swatch: "#6b381b",
    backCardImage: "/manus-storage/ext-pink-v3.jpg",
    frontModelImage: "/manus-storage/ext-c1-chatain-fonce.jpg",
  },
  {
    id: "chatain-roux",
    name: "شاتين روكس",
    subtitle: "شاتين روكس نحاسي يضيء الملامح ويمنحك ستايل ساحر",
    swatch: "#89451f",
    backCardImage: "/manus-storage/ext-pink-v4.jpg",
    frontModelImage: "/manus-storage/ext-c4-chatain-roux.jpg",
  },
  {
    id: "blond-clair",
    name: "أشقر فاتح",
    subtitle: "أشقر فاتح ذهبي لإطلالة مشرقة ومثالية للمناسبات",
    swatch: "#d9be94",
    backCardImage: "/manus-storage/ext-pink-v5.jpg",
    frontModelImage: "/manus-storage/ext-c5-blond-clair.jpg",
  },
  {
    id: "noir-balayage-gris",
    name: "نور بليلي غري",
    subtitle: "رمادي مائل متدرج مع جذور داكنة لمظهر عصري فخم",
    swatch: "#7b7782",
    backCardImage: "/manus-storage/ext-pink-v6.jpg",
    frontModelImage: "/manus-storage/ext-c6-gris-balayage.jpg",
  },
] as const;

const PACK_2_PRICE = 4500;

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
  const [okMessage, setOkMessage] = useState<string>("");
  const [toastMsg, setToastMsg] = useState<string>("");
  const [toastShown, setToastShown] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderSubmitted, setOrderSubmitted] = useState<boolean>(false);

  const isSubmittingRef = useRef<boolean>(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);

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

  const showToast = (msg: string, duration = 2200) => {
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
    document.title = "إكستنشن الشعر — طول أكبر وكثافة أكثر";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  const selectShadeByIndex = (idx: number, announce = true) => {
    const safeIdx = (idx + SHADES.length) % SHADES.length;
    const chosen = SHADES[safeIdx];
    setActiveSlideIdx(safeIdx);
    setColor(chosen.name);

    if (stripRef.current) {
      const thumbEl = stripRef.current.children[safeIdx] as HTMLElement | undefined;
      thumbEl?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }

    if (announce) {
      showToast(`✅ اللون المختار: ${chosen.name}`);
    }
  };

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const diffX = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(diffX) > 36) {
      if (diffX > 0) {
        selectShadeByIndex(activeSlideIdx + 1);
      } else {
        selectShadeByIndex(activeSlideIdx - 1);
      }
    }
  };

  const scrollToOrderForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activatePack2Offer = () => {
    setOfferMode("pack2");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("🎁 تم تفعيل عرض: اشتري واحدة والثانية مجاناً بـ 4500 DA !", 2600);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingRef.current || orderSubmitted) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const chosenColor = String(color || SHADES[0].name).trim();
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
        ? `🎁 عرض: اشتري واحدة والثانية مجاناً بـ 4500 دج — [القطعة 1: ${chosenColor} | القطعة 2: ${secondColor}]`
        : "",
      extraNote,
    ].filter(Boolean);
    const offerNote = offerNoteParts.join(" · ");

    setOkMessage(
      isPack
        ? `✅ تم استلام طلبك بنجاح (${customer} — قطعتين بـ 4500 دج)، سنتصل بك قريباً!`
        : `✅ تم استلام طلبك بنجاح (${customer} — اللون: ${chosenColor})، سنتصل بك قريباً!`
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
        address: commune || wilaya || "Algérie",
        delivery: "home",
        note: offerNote,
        items: [
          {
            productId: product.id,
            quantity: billedQty,
            color: summaryColor,
            size: "",
          },
        ],
      });
      if (res?.orderNumber) {
        serverOrderNumber = res.orderNumber;
      }
      window.sessionStorage.removeItem("miss-sensuelle-checkout-token");
      window.localStorage.removeItem("miss-sensuelle-checkout-token");
    } catch (err) {
      console.error("[extensions-checkout] submit failed:", err);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      showToast("⚠️ يرجى التحقق من رقم الهاتف والمحاولة مرة أخرى", 3200);
      return;
    }

    try {
      const rawOrders = window.localStorage.getItem("miss-sensuelle-orders-v2");
      const parsed: Order[] = rawOrders ? JSON.parse(rawOrders) : [];
      const newOrder: Order = {
        id: serverOrderNumber,
        createdAt: new Date().toLocaleDateString("fr-FR"),
        customer,
        phone,
        product: `${product.name} × ${billedQty}`,
        quantity: billedQty,
        total: orderTotal,
        color: summaryColor,
        size: "",
        delivery: "home",
        wilaya,
        commune,
        address: commune || wilaya,
        note: offerNote,
        status: "nouvelle",
      };
      window.localStorage.setItem(
        "miss-sensuelle-orders-v2",
        JSON.stringify([newOrder, ...parsed])
      );
    } catch {
      // ignore storage errors
    }

    trackPixelEvent("Purchase", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: product.name,
      value: orderTotal,
      currency: "DZD",
      num_items: billedQty,
      order_id: serverOrderNumber,
    });

    setOrderSubmitted(true);
    setIsSubmitting(false);
    showToast("🎉 تم تسجيل طلبك بنجاح! سنتصل بك قريباً", 3500);
  };

  return (
    <div className="ext-pink-root" dir="rtl" lang="ar">
      <div className={`ext-pink-toast ${toastShown ? "is-visible" : ""}`}>
        {toastMsg}
      </div>

      <div className="ext-pink-w">
        {/* 1. Top Hero Slice from exex.html */}
        <img
          className="ext-pink-slice"
          src="/manus-storage/ext-pink-1.jpg"
          alt="إكستنشن الشعر الطبيعي - طول أكبر وكثافة أكثر"
        />

        {/* 2. INTERACTIVE VARIANT SLIDER (varient slyde) */}
        <section className="ext-vslide-section" aria-label="سلايدر ألوان الإكستنشن">
          <div className="ext-vslide-header">
            <span className="ext-vslide-title-pill">
              ✨ الألوان المتوفرة • اسحبي للاختيار
            </span>
            <span className="ext-vslide-counter">
              {activeSlideIdx + 1} / {SHADES.length}
            </span>
          </div>

          <div
            className="ext-vslide-stage"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <button
              type="button"
              className="ext-vslide-arrow ext-vslide-arrow-prev"
              onClick={() => selectShadeByIndex(activeSlideIdx - 1)}
              aria-label="اللون السابق"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <button
              type="button"
              className="ext-vslide-arrow ext-vslide-arrow-next"
              onClick={() => selectShadeByIndex(activeSlideIdx + 1)}
              aria-label="اللون التالي"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="ext-vslide-dual">
              <div className="ext-vslide-photo-card">
                <img
                  src={currentShade.backCardImage}
                  alt={currentShade.name}
                />
                <span className="ext-vslide-photo-tag">من الخلف ✨</span>
              </div>

              <div className="ext-vslide-photo-card">
                <img
                  src={currentShade.frontModelImage}
                  alt={`${currentShade.name} - إطلالة كاملة`}
                />
                <span className="ext-vslide-photo-tag">النتيجة النهائية 💖</span>
              </div>
            </div>

            <div className="ext-vslide-caption">
              <div className="ext-vslide-caption-right">
                <span
                  className="ext-vslide-swatch-dot"
                  style={{ backgroundColor: currentShade.swatch }}
                />
                <div>
                  <div className="ext-vslide-shade-name">{currentShade.name}</div>
                  <div className="ext-vslide-shade-sub">{currentShade.subtitle}</div>
                </div>
              </div>

              <button
                type="button"
                className="ext-vslide-pick-btn"
                onClick={() => {
                  selectShadeByIndex(activeSlideIdx, true);
                  scrollToOrderForm();
                }}
              >
                اطلبي هذا اللون 🛒
              </button>
            </div>
          </div>

          <div className="ext-vslide-strip-title">
            <span>👇 اضغطي على اللون أو اسحبي يميناً ويساراً:</span>
            <span>مختار: {color}</span>
          </div>

          {/* Horizontal swipeable carousel of the 6 variant cards from ext-pink-2 */}
          <div className="ext-vslide-strip" ref={stripRef}>
            {SHADES.map((shade, idx) => {
              const isSelected = idx === activeSlideIdx;
              return (
                <button
                  key={shade.id}
                  type="button"
                  className={`ext-vslide-thumb ${isSelected ? "is-active" : ""}`}
                  onClick={() => selectShadeByIndex(idx)}
                >
                  <img src={shade.backCardImage} alt={shade.name} />
                  {isSelected && <span className="ext-vslide-thumb-check">✓</span>}
                </button>
              );
            })}
          </div>

          <div className="ext-vslide-dots">
            {SHADES.map((shade, idx) => (
              <button
                key={shade.id}
                type="button"
                className={`ext-vslide-dot ${idx === activeSlideIdx ? "is-active" : ""}`}
                onClick={() => selectShadeByIndex(idx)}
                aria-label={shade.name}
              />
            ))}
          </div>
        </section>

        {/* 3. How to wash, style & wear in seconds */}
        <img
          className="ext-pink-slice"
          src="/manus-storage/ext-pink-3.jpg"
          alt="تلبس في ثواني وتغسل وتصفف بسهولة"
        />

        {/* 4. Details & closeups */}
        <img
          className="ext-pink-slice"
          src="/manus-storage/ext-pink-4.jpg"
          alt="شعر ناعم وحريري ومشابك قوية لا تنزلق"
        />

        {/* 5. Special Offer Banner: 4500 DA Buy 1 Get 2nd Free */}
        <img
          className="ext-pink-slice ext-pink-slice-clickable"
          src="/manus-storage/ext-pink-5.jpg"
          alt="4500 DA اشتري واحدة والثانية مجاناً"
          onClick={activatePack2Offer}
          title="اضغطي لتفعيل عرض قطعتين بـ 4500 دج"
        />

        {/* 6. Quality Badges & Shades Preview */}
        <img
          className="ext-pink-slice"
          src="/manus-storage/ext-pink-6.jpg"
          alt="جودة عالية وخفيفة الوزن ومناسبة لجميع أنواع الشعر"
        />

        {/* 7. HOMOGENEOUS ORDER FORM (#f) */}
        <form
          id="f"
          ref={formRef}
          className="ext-pink-form-wrap"
          onSubmit={handleSubmit}
        >
          <div className="ext-pink-form-card">
            <div className="ext-pink-form-ribbon">
              <h3>اطلبي الآن • الدفع عند الاستلام</h3>
              <p>توصيل سريع لـ 58 ولاية لباب المنزل 🚚</p>
            </div>

            {/* Offer Choice (1 piece vs 2 pieces 4500 DA matching ext-pink-5.jpg) */}
            <div className="ext-pink-field-label">
              <span>1. اختاري العرض المناسب لكِ:</span>
              <span>🔥 عرض محدود</span>
            </div>

            <div className="ext-pink-offers">
              <button
                type="button"
                className={`ext-pink-offer-btn ${offerMode === "single" ? "is-active" : ""}`}
                onClick={() => setOfferMode("single")}
              >
                <div className="ext-pink-offer-title">قطعة واحدة</div>
                <div className="ext-pink-offer-sub">إكستنشن شعر طبيعي</div>
                <span className="ext-pink-offer-price">
                  {singleUnitPrice.toLocaleString("fr-FR")} DA
                </span>
              </button>

              <button
                type="button"
                className={`ext-pink-offer-btn ${offerMode === "pack2" ? "is-active" : ""}`}
                onClick={() => setOfferMode("pack2")}
              >
                <span className="ext-pink-offer-badge">🎁 الثانية مجاناً</span>
                <div className="ext-pink-offer-title">واحدة + الثانية مجاناً</div>
                <div className="ext-pink-offer-sub">قطعتين (اختاري لونين)</div>
                <span className="ext-pink-offer-price">
                  {PACK_2_PRICE.toLocaleString("fr-FR")} DA
                </span>
              </button>
            </div>

            {/* Primary Color Selector synced with Variant Slider */}
            <div className="ext-pink-field-label">
              <span>
                {offerMode === "pack2"
                  ? "2. اختاري لون القطعة الأولى:"
                  : "2. اختاري اللون المطلوب:"}
              </span>
              <span>اللون: {color}</span>
            </div>

            <div className="ext-pink-color-grid">
              {SHADES.map((shade, idx) => {
                const isSelected = color === shade.name;
                return (
                  <button
                    key={shade.id}
                    type="button"
                    className={`ext-pink-color-chip ${isSelected ? "is-active" : ""}`}
                    onClick={() => selectShadeByIndex(idx, false)}
                  >
                    <img
                      src={shade.backCardImage}
                      alt={shade.name}
                      className="ext-pink-color-chip-thumb"
                    />
                    <span className="ext-pink-color-chip-name">{shade.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Second Color Selector when Pack 2 is active */}
            {offerMode === "pack2" && (
              <>
                <div className="ext-pink-field-label">
                  <span>🎁 اختاري لون القطعة الثانية (المجانية):</span>
                  <span>اللون: {secondColor}</span>
                </div>
                <div className="ext-pink-color-grid">
                  {SHADES.map(shade => {
                    const isSelected = secondColor === shade.name;
                    return (
                      <button
                        key={`second-${shade.id}`}
                        type="button"
                        className={`ext-pink-color-chip ${isSelected ? "is-active" : ""}`}
                        onClick={() => setSecondColor(shade.name)}
                      >
                        <img
                          src={shade.backCardImage}
                          alt={shade.name}
                          className="ext-pink-color-chip-thumb"
                        />
                        <span className="ext-pink-color-chip-name">
                          {shade.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <input type="hidden" name="color" value={color} />

            {/* Customer Info Inputs matching exex.html */}
            <div className="ext-pink-field-label">
              <span>3. معلومات التوصيل:</span>
              <span>الدفع عند الاستلام 🤝</span>
            </div>

            <div className="ext-pink-input-group">
              <input
                className="ext-pink-input"
                name="name"
                placeholder="الاسم الكامل"
                required
              />
            </div>

            <div className="ext-pink-input-group">
              <input
                className="ext-pink-input"
                type="tel"
                inputMode="tel"
                name="phone"
                placeholder="رقم الهاتف (مثال: 0550123456)"
                pattern="0[5-7][0-9]{8}"
                required
                onFocus={() => {
                  trackPixelEvent("InitiateCheckout", {
                    content_type: "product",
                    content_id: product.id,
                    content_ids: [product.id],
                    content_name: product.name,
                    value: goodsTotal,
                    currency: "DZD",
                  });
                }}
              />
            </div>

            <div className="ext-pink-input-row">
              <select
                className="ext-pink-select"
                name="wilaya"
                value={selectedWilaya}
                onChange={e => {
                  const nextWilaya = e.target.value;
                  setSelectedWilaya(nextWilaya);
                  const firstCommune =
                    (abayaCommunesByWilaya[nextWilaya] ?? [])[0] ?? "";
                  setSelectedCommune(firstCommune);
                }}
                required
              >
                <option value="">الولاية</option>
                {abayaWilayas.map(w => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>

              <select
                className="ext-pink-select"
                name="commune"
                value={selectedCommune}
                onChange={e => setSelectedCommune(e.target.value)}
                disabled={!selectedWilaya}
                required
              >
                <option value="">
                  {selectedWilaya ? "البلدية" : "اختر الولاية أولاً"}
                </option>
                {communes.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="ext-pink-input-group">
              <input
                className="ext-pink-input"
                name="note"
                placeholder="اللون المطلوب / ملاحظة (اختياري)"
              />
            </div>

            {/* Order Summary */}
            <div className="ext-pink-summary">
              <div className="ext-pink-summary-row">
                <span>
                  {offerMode === "pack2"
                    ? `عرض قطعتين (${color} + ${secondColor})`
                    : `قطعة واحدة (${color})`}
                </span>
                <span>{goodsTotal.toLocaleString("fr-FR")} دج</span>
              </div>
              <div className="ext-pink-summary-row">
                <span>سعر التوصيل للمنزل</span>
                <span>
                  {selectedWilaya
                    ? shippingFee === 0
                      ? "مجاني 🎉"
                      : `${shippingFee.toLocaleString("fr-FR")} دج`
                    : "يحدد حسب الولاية"}
                </span>
              </div>
              <div className="ext-pink-summary-total">
                <span>المجموع الكلي:</span>
                <span>
                  {(goodsTotal + shippingFee).toLocaleString("fr-FR")} دج
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="ext-pink-submit-btn"
              disabled={isSubmitting || orderSubmitted}
            >
              {isSubmitting
                ? "⏳ جاري تأكيد الطلب..."
                : orderSubmitted
                  ? "✅ تم تسجيل طلبك بنجاح"
                  : "🛒 تأكيد الطلب"}
            </button>

            {okMessage && <div className="ext-pink-ok-box">{okMessage}</div>}
          </div>
        </form>

        {/* 8. Sticky Bottom CTA Bar from exex.html */}
        <a
          className="ext-pink-bar"
          href="#f"
          onClick={e => {
            e.preventDefault();
            scrollToOrderForm();
          }}
        >
          <img src="/manus-storage/ext-pink-bar.jpg" alt="الطلب الآن" />
        </a>
      </div>
    </div>
  );
}

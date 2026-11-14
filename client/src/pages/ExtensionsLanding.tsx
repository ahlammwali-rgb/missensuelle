import { FormEvent, useEffect, useRef, useState } from "react";
import { type Order, type Product } from "@/lib/store-data";
import { abayaCommunesByWilaya, abayaWilayas } from "@/lib/abaya-communes";
import { trpc } from "@/lib/trpc";
import { shippingFeeFor } from "@shared/shipping";
import { useCheckoutDraft } from "@/components/useCheckoutDraft";
import { submitCheckoutOrder } from "@/lib/checkout-api";
import { initializePixels, trackPixelEvent } from "@/lib/tracking";
import "./extensions-template.css";

type OfferMode = "pack2" | "single";

const VARIANT_CARDS = [
  { id: "v1", name: "أسود طبيعي", image: "/manus-storage/ext-pink-v1.jpg" },
  { id: "v2", name: "بني غامق", image: "/manus-storage/ext-pink-v2.jpg" },
  { id: "v3", name: "بني عسلي", image: "/manus-storage/ext-pink-v3.jpg" },
  { id: "v4", name: "شاتين روكس", image: "/manus-storage/ext-pink-v4.jpg" },
  { id: "v5", name: "أشقر فاتح", image: "/manus-storage/ext-pink-v5.jpg" },
  { id: "v6", name: "نور بليلي غري", image: "/manus-storage/ext-pink-v6.jpg" },
] as const;

const PACK_2_PRICE = 4500;

export default function ExtensionsLanding({
  product,
  quantity,
}: {
  product: Product;
  quantity: number;
}) {
  const [offerMode, setOfferMode] = useState<OfferMode>("pack2");
  const [color1, setColor1] = useState<string>(VARIANT_CARDS[0].name);
  const [color2, setColor2] = useState<string>(VARIANT_CARDS[1].name);
  const [nextSlotToFill, setNextSlotToFill] = useState<1 | 2>(1);
  const [selectedWilaya, setSelectedWilaya] = useState<string>("");
  const [selectedCommune, setSelectedCommune] = useState<string>("");
  const [noteInput, setNoteInput] = useState<string>("");
  const [orderSubmitted, setOrderSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isSubmittingRef = useRef<boolean>(false);
  const checkoutInitiatedRef = useRef<boolean>(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

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
  const isPack2 = offerMode === "pack2";
  const billedQty = isPack2 ? 2 : Math.max(1, quantity || 1);
  const goodsTotal = isPack2 ? PACK_2_PRICE : singleUnitPrice * billedQty;
  const combinedColorLabel = isPack2
    ? `1: ${color1} | 2: ${color2}`
    : color1;

  useCheckoutDraft({
    formRef,
    source: "product",
    aliases: { customer: ["name"] },
    getItems: () => [
      {
        productId: product.id,
        quantity: billedQty,
        color: combinedColorLabel,
        size: "",
      },
    ],
    watchKey: `${offerMode}|${color1}|${color2}|${selectedWilaya}|${selectedCommune}|${noteInput}|${quantity}`,
  });

  useEffect(() => {
    initializePixels();
    trackPixelEvent("ViewContent", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: product.name,
      value: PACK_2_PRICE,
      currency: "DZD",
    });
  }, [product.id, product.name]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "إكستنشن الشعر";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  const handleSelectTopVariant = (shadeName: string) => {
    if (!isPack2) {
      setColor1(shadeName);
    } else if (nextSlotToFill === 1) {
      setColor1(shadeName);
      setNextSlotToFill(2);
    } else {
      setColor2(shadeName);
      setNextSlotToFill(1);
    }

    trackPixelEvent("AddToCart", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: `${product.name} - ${shadeName}`,
      value: goodsTotal,
      currency: "DZD",
    });
  };

  const scrollVariants = (dir: "left" | "right") => {
    if (!trackRef.current) return;
    const step = 170;
    trackRef.current.scrollBy({
      left: dir === "left" ? -step : step,
      behavior: "smooth",
    });
  };

  const handleFormFocus = () => {
    if (checkoutInitiatedRef.current) return;
    checkoutInitiatedRef.current = true;
    trackPixelEvent("InitiateCheckout", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: product.name,
      value: goodsTotal,
      currency: "DZD",
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingRef.current || orderSubmitted) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const customer = String(formData.get("name") || "زبونة Miss Sensuelle").trim();
    const rawPhone = String(formData.get("phone") || "").trim();
    const phone = rawPhone.replace(/[\s\-\.]/g, "");
    const wilaya = String(formData.get("wilaya") || selectedWilaya).trim();
    const commune = String(formData.get("commune") || selectedCommune || wilaya).trim();
    const extraNote = String(formData.get("note") || noteInput).trim();

    const orderTotal = goodsTotal + shippingFee;
    const offerNote = [
      isPack2
        ? `🎁 عرض 1 + 1 مجاناً (4500 دج) — [القطعة 1: ${color1} | القطعة 2: ${color2}]`
        : `قطعة واحدة — [اللون: ${color1}]`,
      extraNote,
    ]
      .filter(Boolean)
      .join(" · ");

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
            color: combinedColorLabel,
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
        color: combinedColorLabel,
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
      // ignore localStorage errors
    }

    trackPixelEvent("Purchase", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: product.name,
      value: orderTotal,
      quantity: billedQty,
      num_items: billedQty,
      currency: "DZD",
      order_id: serverOrderNumber,
      phone,
      customer,
    });

    setOrderSubmitted(true);
    setIsSubmitting(false);
  };

  return (
    <div className="ext-pink-root" dir="rtl" lang="ar">
      <div className="ext-pink-w">
        <img src="/manus-storage/ext-pink-1.jpg" alt="" />

        {/* Variant images slightly larger in a horizontal slide */}
        <div className="ext-variants-slider-wrap">
          <button
            type="button"
            className="ext-variant-nav ext-variant-nav-left"
            onClick={() => scrollVariants("left")}
            aria-label="السابق"
          >
            ‹
          </button>

          <div className="ext-variants-track" ref={trackRef}>
            {VARIANT_CARDS.map(card => {
              const isC1 = color1 === card.name;
              const isC2 = isPack2 && color2 === card.name;
              const isSelected = isC1 || isC2;
              return (
                <button
                  key={card.id}
                  type="button"
                  className={`ext-variant-card ${isSelected ? "is-selected" : ""}`}
                  onClick={() => handleSelectTopVariant(card.name)}
                >
                  <img src={card.image} alt={card.name} />
                  {isC1 && isC2 ? (
                    <span className="ext-variant-badge">1️⃣ + 2️⃣</span>
                  ) : isC1 ? (
                    <span className="ext-variant-badge">1️⃣</span>
                  ) : isC2 ? (
                    <span className="ext-variant-badge">2️⃣ 🎁</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="ext-variant-nav ext-variant-nav-right"
            onClick={() => scrollVariants("right")}
            aria-label="التالي"
          >
            ›
          </button>
        </div>

        <img src="/manus-storage/ext-pink-3.jpg" alt="" />
        <img src="/manus-storage/ext-pink-4.jpg" alt="" />
        <img src="/manus-storage/ext-pink-5.jpg" alt="" />
        <img src="/manus-storage/ext-pink-6.jpg" alt="" />

        {/* Beautiful Order Form at the bottom with 2-Variant Selection */}
        <form
          id="f"
          ref={formRef}
          className="ext-pink-form"
          onFocus={handleFormFocus}
          onSubmit={handleSubmit}
        >
          <div className="ext-pink-form-inner">
            <div className="ext-form-header">
              <span className="ext-form-promo-pill">
                🎁 عرض خاص : اشتري واحدة والثانية مجاناً
              </span>
              <h3>اطلبي الآن • الدفع عند الاستلام</h3>
              <p>اختاري لونين من اختياركِ واستفيدي من العرض 🚚</p>
            </div>

            {/* Offer Mode Choice (Default: 1+1 = 4500 DA) */}
            <div className="ext-offer-toggle">
              <button
                type="button"
                className={`ext-offer-card ${offerMode === "pack2" ? "is-active" : ""}`}
                onClick={() => setOfferMode("pack2")}
              >
                <span className="ext-offer-tag">🎁 1 + 1 مجاناً (الأكثر طلباً)</span>
                <div className="ext-offer-name">قطعتين (1 + 1 مجاناً)</div>
                <div className="ext-offer-desc">اختاري لونين من اختيارك</div>
                <span className="ext-offer-price-pill">4 500 DA</span>
              </button>

              <button
                type="button"
                className={`ext-offer-card ${offerMode === "single" ? "is-active" : ""}`}
                onClick={() => setOfferMode("single")}
              >
                <div className="ext-offer-name">قطعة واحدة</div>
                <div className="ext-offer-desc">لون واحد من اختيارك</div>
                <span className="ext-offer-price-pill">
                  {singleUnitPrice.toLocaleString("fr-FR")} DA
                </span>
              </button>
            </div>

            {/* Variant 1 Selector */}
            <div className="ext-variant-picker-box">
              <div className="ext-variant-picker-head">
                <span>1️⃣ اختر لون القطعة الأولى :</span>
                <span className="ext-variant-selected-pill">{color1}</span>
              </div>
              <div className="ext-variant-mini-grid">
                {VARIANT_CARDS.map(card => (
                  <button
                    key={`c1-${card.id}`}
                    type="button"
                    className={`ext-variant-mini-item ${color1 === card.name ? "is-active" : ""}`}
                    onClick={() => setColor1(card.name)}
                  >
                    <img src={card.image} alt={card.name} />
                    <span>{card.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Variant 2 Selector (1 Achetée + 1 Offerte) */}
            {isPack2 && (
              <div className="ext-variant-picker-box is-second">
                <div className="ext-variant-picker-head">
                  <span>2️⃣ اختر لون القطعة الثانية (المجانية 🎁) :</span>
                  <span className="ext-variant-selected-pill">{color2}</span>
                </div>
                <div className="ext-variant-mini-grid">
                  {VARIANT_CARDS.map(card => (
                    <button
                      key={`c2-${card.id}`}
                      type="button"
                      className={`ext-variant-mini-item ${color2 === card.name ? "is-active" : ""}`}
                      onClick={() => setColor2(card.name)}
                    >
                      <img src={card.image} alt={card.name} />
                      <span>{card.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Details */}
            <div className="ext-field-group">
              <input
                name="name"
                placeholder="👤 الاسم الكامل"
                required
              />
            </div>

            <div className="ext-field-group">
              <input
                type="tel"
                inputMode="tel"
                name="phone"
                placeholder="📞 رقم الهاتف (05 / 06 / 07)"
                pattern="0[5-7][0-9]{8}"
                required
              />
            </div>

            <div className="ext-field-row">
              <select
                id="w"
                name="wilaya"
                value={selectedWilaya}
                onChange={e => {
                  const nextW = e.target.value;
                  setSelectedWilaya(nextW);
                  const firstC = (abayaCommunesByWilaya[nextW] ?? [])[0] ?? "";
                  setSelectedCommune(firstC);
                }}
                required
              >
                <option value="">📍 الولاية</option>
                {abayaWilayas.map(wName => (
                  <option key={wName} value={wName}>
                    {wName}
                  </option>
                ))}
              </select>

              <select
                name="commune"
                value={selectedCommune}
                onChange={e => setSelectedCommune(e.target.value)}
                disabled={!selectedWilaya}
                required
              >
                <option value="">
                  {selectedWilaya ? "🏘️ البلدية" : "اختر الولاية أولاً"}
                </option>
                {communes.map(cName => (
                  <option key={cName} value={cName}>
                    {cName}
                  </option>
                ))}
              </select>
            </div>

            <div className="ext-field-group">
              <input
                name="note"
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                placeholder="📝 ملاحظة إضافية للتوصيل (اختياري)"
              />
            </div>

            {/* Order Recap */}
            <div className="ext-order-recap">
              <div className="ext-order-recap-line">
                <span>
                  {isPack2
                    ? `🎁 عرض قطعتين (${color1} + ${color2})`
                    : `✨ قطعة واحدة (${color1})`}
                </span>
                <span>{goodsTotal.toLocaleString("fr-FR")} DA</span>
              </div>
              <div className="ext-order-recap-line">
                <span>🚚 التوصيل للمنزل</span>
                <span>
                  {selectedWilaya
                    ? shippingFee === 0
                      ? "مجاني 🎉"
                      : `${shippingFee.toLocaleString("fr-FR")} DA`
                    : "حسب الولاية"}
                </span>
              </div>
              <div className="ext-order-recap-total">
                <span>المجموع الكلي :</span>
                <span>{(goodsTotal + shippingFee).toLocaleString("fr-FR")} DA</span>
              </div>
            </div>

            <button
              type="submit"
              className="ext-submit-btn"
              disabled={isSubmitting || orderSubmitted}
            >
              {isSubmitting
                ? "⏳ جاري تأكيد الطلب..."
                : orderSubmitted
                  ? "✅ تم تسجيل طلبك بنجاح"
                  : "🛒 تأكيد الطلب الآن"}
            </button>

            {orderSubmitted && (
              <div className="ext-pink-ok" id="ok">
                ✅ تم استلام طلبك بنجاح، سنتصل بك قريباً لتأكيد الإرسال!
              </div>
            )}
          </div>
        </form>

        <a
          className="ext-pink-bar"
          href="#f"
          onClick={e => {
            e.preventDefault();
            formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          <img src="/manus-storage/ext-pink-bar.jpg" alt="الطلب الآن" />
        </a>
      </div>
    </div>
  );
}

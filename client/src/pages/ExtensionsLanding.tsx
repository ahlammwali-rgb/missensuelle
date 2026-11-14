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

const DEFAULT_VARIANT_CARDS = [
  { id: "v1", name: "أسود طبيعي", image: "/manus-storage/ext-m2-v1.jpg" },
  { id: "v2", name: "بني غامق", image: "/manus-storage/ext-m2-v2.jpg" },
  { id: "v3", name: "بني عسلي", image: "/manus-storage/ext-m2-v3.jpg" },
  { id: "v4", name: "شاتين روكس", image: "/manus-storage/ext-m2-v4.jpg" },
  { id: "v5", name: "أشقر فاتح", image: "/manus-storage/ext-m2-v5.jpg" },
  { id: "v6", name: "نور بليلج غري", image: "/manus-storage/ext-m2-v6.jpg" },
] as const;

const HERO_FEATURES = [
  { top: "39.66%", text: "شعر طبيعي 60%" },
  { top: "46.67%", text: "يتليس ويتبوكل" },
  { top: "53.68%", text: "سهل التركيب" },
  { top: "60.68%", text: "مريح وخفيف" },
  { top: "67.69%", text: "يدوم لفترة طويلة" },
  { top: "74.70%", text: "مظهر طبيعي ولامع" },
] as const;

const DEFAULT_PACK_2_PRICE = 4500;

export default function ExtensionsLanding({
  product,
  quantity,
}: {
  product: Product;
  quantity: number;
}) {
  const isBuiltIn =
    product.id === "p-005" ||
    product.slug === "extensions-silk-wave" ||
    product.slug === "extensions-cheveux";

  const hasCustomVariants =
    Array.isArray(product.variantImages) &&
    product.variantImages.some(v => v && (v.image || v.name));

  const VARIANT_CARDS = hasCustomVariants
    ? product.variantImages!.map((v, idx) => ({
        id: `v${idx + 1}`,
        name: v.name || product.colors?.[idx] || `اللون ${idx + 1}`,
        image:
          v.image ||
          product.gallery?.[idx] ||
          product.image ||
          DEFAULT_VARIANT_CARDS[idx % DEFAULT_VARIANT_CARDS.length].image,
      }))
    : !isBuiltIn && product.colors && product.colors.length > 0
      ? product.colors.map((c, idx) => ({
          id: `v${idx + 1}`,
          name: c,
          image: product.gallery?.[idx] || product.image,
        }))
      : !isBuiltIn && product.gallery && product.gallery.length > 0
        ? product.gallery.map((img, idx) => ({
            id: `v${idx + 1}`,
            name: product.colors?.[idx] || `الموديل ${idx + 1}`,
            image: img,
          }))
        : DEFAULT_VARIANT_CARDS;

  const isCustomHeroImage =
    Boolean(product.image) &&
    product.image !== "/manus-storage/ext-pink-1.jpg" &&
    product.image !== "/manus-storage/ext-m2-hero.jpg";

  const heroImageSrc = isCustomHeroImage
    ? product.image
    : isBuiltIn
      ? "/manus-storage/ext-m2-hero.jpg"
      : product.image ||
        product.gallery?.[0] ||
        VARIANT_CARDS[0]?.image ||
        "/manus-storage/ext-m2-hero.jpg";

  const legacyDefaultGallery = new Set([
    "/manus-storage/extensions-poster.jpg",
    "/manus-storage/async-images/uM7lQJWYdXHIVBYkKtIu8c/image-3.webp",
    "/manus-storage/async-images/vHn8VKRbVex1NUkhameC59/image-3.webp",
    "/manus-storage/async-images/vHn8VKRbVex1NUkhameC59/image-2.webp",
    "/manus-storage/async-images/vHn8VKRbVex1NUkhameC59/image-1.webp",
    "/manus-storage/async-images/CiRxshIVQV0OT7GfuQSZCa/image-5.webp",
  ]);
  const effectiveGallery = (product.gallery ?? []).filter(
    img => Boolean(img) && !(isBuiltIn && legacyDefaultGallery.has(img))
  );

  const PACK_2_PRICE =
    product.packPrice ||
    (isBuiltIn ? DEFAULT_PACK_2_PRICE : Math.round((product.price || 2700) * 1.65));

  const [offerMode, setOfferMode] = useState<OfferMode>("pack2");
  const [color1, setColor1] = useState<string>(VARIANT_CARDS[0]?.name ?? "أسود طبيعي");
  const [color2, setColor2] = useState<string>(
    (VARIANT_CARDS[1] ?? VARIANT_CARDS[0])?.name ?? "بني غامق"
  );
  const [nextSlotToFill, setNextSlotToFill] = useState<1 | 2>(1);
  const [selectedWilaya, setSelectedWilaya] = useState<string>("");
  const [selectedCommune, setSelectedCommune] = useState<string>("");
  const [formError, setFormError] = useState<string>("");
  const [orderSubmitted, setOrderSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isSubmittingRef = useRef<boolean>(false);
  const checkoutInitiatedRef = useRef<boolean>(false);
  const formRef = useRef<HTMLFormElement | null>(null);

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
  const combinedColorLabel = isPack2 ? `1: ${color1} | 2: ${color2}` : color1;

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
    watchKey: `${offerMode}|${color1}|${color2}|${selectedWilaya}|${selectedCommune}|${quantity}`,
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
  }, [product.id, product.name, PACK_2_PRICE]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "إكستنشن الشعر";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  const handlePickFromSlider = (shadeName: string) => {
    if (!isPack2) {
      setColor1(shadeName);
    } else if (nextSlotToFill === 1) {
      setColor1(shadeName);
      setNextSlotToFill(2);
    } else {
      setColor2(shadeName);
      setNextSlotToFill(1);
    }

    setFormError("");
    trackPixelEvent("AddToCart", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: `${product.name} - ${shadeName}`,
      value: goodsTotal,
      currency: "DZD",
    });

    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

    if (!color1 || (isPack2 && !color2)) {
      setFormError("اختاري اللونين من فضلك");
      return;
    }

    setFormError("");
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const customer = String(formData.get("name") || "زبونة Miss Sensuelle").trim();
    const rawPhone = String(formData.get("phone") || "").trim();
    const phone = rawPhone.replace(/[\s\-\.]/g, "");
    const wilaya = String(formData.get("wilaya") || selectedWilaya).trim();
    const commune = String(
      formData.get("commune") || selectedCommune || wilaya
    ).trim();

    const orderTotal = goodsTotal + shippingFee;
    const offerNote = isPack2
      ? `🎁 عرض 1 + 1 مجاناً (${PACK_2_PRICE} دج) — [القطعة 1: ${color1} | القطعة 2: ${color2}]`
      : `قطعة واحدة — [اللون: ${color1}]`;

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
    <div className="ext-m2-root" dir="rtl" lang="ar">
      <div className="w">
        {/* 1. BIGGER HERO WITH 6 FEATURE ROWS + SMOOTH BOTTOM GRADIENT */}
        <div className="hero">
          <img
            src={heroImageSrc}
            alt={product.arName || product.name}
          />
          {isBuiltIn && !isCustomHeroImage &&
            HERO_FEATURES.map((feat, idx) => (
              <div key={idx} className="rw" style={{ top: feat.top }}>
                <span>{feat.text}</span>
                <i>✔</i>
              </div>
            ))}
        </div>

        {/* 2. VARIANT CARDS SLIDER */}
        <div className="ext-m2-slider-sec">
          <span className="pill">متوفر بجميع الألوان</span>
          <div className="sl" id="sl">
            {VARIANT_CARDS.map(card => {
              const isC1 = color1 === card.name;
              const isC2 = isPack2 && color2 === card.name;
              const isPicked = isC1 || isC2;
              return (
                <div
                  key={card.id}
                  className={`cd ${isPicked ? "is-picked" : ""}`}
                >
                  {isC1 && isC2 ? (
                    <span className="ext-m2-cd-badge">① + ② 🎁</span>
                  ) : isC1 ? (
                    <span className="ext-m2-cd-badge">① المختار</span>
                  ) : isC2 ? (
                    <span className="ext-m2-cd-badge">② مجانية 🎁</span>
                  ) : null}
                  <img src={card.image} alt={card.name} />
                  <button
                    type="button"
                    onClick={() => handlePickFromSlider(card.name)}
                  >
                    اختاري هذا اللون
                  </button>
                </div>
              );
            })}
          </div>
          <div className="hint">‹ اسحبي لرؤية كل الألوان ›</div>
        </div>

        {/* 3. STACKED PROMO SECTIONS + CTA IMAGE */}
        <div className="ext-m2-banners">
          {effectiveGallery.length > 0 ? (
            effectiveGallery.map((sliceUrl, idx) => (
              <img key={`${sliceUrl}-${idx}`} src={sliceUrl} alt="" />
            ))
          ) : isBuiltIn ? (
            <>
              <img src="/manus-storage/ext-m2-s1.jpg" alt="" />
              <img src="/manus-storage/ext-m2-s2.jpg" alt="" />
            </>
          ) : null}

          <a
            href="#f"
            className="ext-m2-cta-link"
            onClick={e => {
              e.preventDefault();
              formRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          >
            <img src="/manus-storage/ext-m2-cta.jpg" alt="أطلبي الآن" />
          </a>
        </div>

        {/* 4. LUXURY DARK ESPRESSO & CHAMPAGNE GOLD FORM (LESS PINK) */}
        <div className="fm">
          <form
            id="f"
            ref={formRef}
            className="fb"
            onFocus={handleFormFocus}
            onSubmit={handleSubmit}
          >
            <span className="ft">اطلبي الآن</span>

            <div className="of">
              <span className="ext-m2-of-badge">
                {isPack2
                  ? "اشتري واحدة والثانية مجاناً 🎁"
                  : "عرض قطعة واحدة ✨"}
              </span>
              <b>{goodsTotal.toLocaleString("fr-FR")} DA</b>
              <span className="ext-m2-of-sub">
                الدفع عند الاستلام • توصيل سريع لباب المنزل
              </span>
            </div>

            {/* Option to pick 1+1 Free (4500 DA) or 1 piece (2700 DA) */}
            <div className="ext-m2-mode-switch">
              <button
                type="button"
                className={`ext-m2-mode-btn ${isPack2 ? "is-active" : ""}`}
                onClick={() => setOfferMode("pack2")}
              >
                <strong>🎁 قطعتين (1 + 1 مجاناً)</strong>
                <small>{PACK_2_PRICE.toLocaleString("fr-FR")} DA</small>
              </button>
              <button
                type="button"
                className={`ext-m2-mode-btn ${!isPack2 ? "is-active" : ""}`}
                onClick={() => setOfferMode("single")}
              >
                <strong>قطعة واحدة</strong>
                <small>{singleUnitPrice.toLocaleString("fr-FR")} DA</small>
              </button>
            </div>

            <input
              name="name"
              placeholder="الاسم الكامل"
              required
            />

            <input
              type="tel"
              inputMode="tel"
              name="phone"
              placeholder="رقم الهاتف (05 / 06 / 07)"
              pattern="0[5-7][0-9]{8}"
              required
            />

            <div className="ext-m2-row-2">
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
                <option value="">الولاية</option>
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
                  {selectedWilaya ? "البلدية" : "اختر الولاية أولاً"}
                </option>
                {communes.map(cName => (
                  <option key={cName} value={cName}>
                    {cName}
                  </option>
                ))}
              </select>
            </div>

            {/* ① First Shade Picker */}
            <label>
              <span>① اللون الأول (المشتراة)</span>
              <span className="ext-m2-picked-pill">{color1}</span>
            </label>
            <div className="ch" id="g0">
              {VARIANT_CARDS.map(card => {
                const active = color1 === card.name;
                return (
                  <div
                    key={`g0-${card.id}`}
                    className={active ? "on" : ""}
                    onClick={() => {
                      setColor1(card.name);
                      setFormError("");
                    }}
                  >
                    {active && <span className="ext-m2-ch-check">✔</span>}
                    <img src={card.image} alt={card.name} />
                    {card.name}
                  </div>
                );
              })}
            </div>

            {/* ② Second Shade Picker (Free Gift) */}
            {isPack2 && (
              <>
                <label className="gf">
                  <span>② اللون الثاني (🎁 مجانية)</span>
                  <span className="ext-m2-picked-pill">{color2}</span>
                </label>
                <div className="ch" id="g1">
                  {VARIANT_CARDS.map(card => {
                    const active = color2 === card.name;
                    return (
                      <div
                        key={`g1-${card.id}`}
                        className={active ? "on" : ""}
                        onClick={() => {
                          setColor2(card.name);
                          setFormError("");
                        }}
                      >
                        {active && <span className="ext-m2-ch-check">✔</span>}
                        <img src={card.image} alt={card.name} />
                        {card.name}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Order Recap */}
            <div className="ext-m2-recap">
              <div className="ext-m2-recap-line">
                <span>
                  {isPack2
                    ? `🎁 عرض 1+1 (${color1} + ${color2})`
                    : `✨ قطعة واحدة (${color1})`}
                </span>
                <span>{goodsTotal.toLocaleString("fr-FR")} DA</span>
              </div>
              <div className="ext-m2-recap-line">
                <span>🚚 التوصيل</span>
                <span>
                  {selectedWilaya
                    ? shippingFee === 0
                      ? "مجاني 🎉"
                      : `${shippingFee.toLocaleString("fr-FR")} DA`
                    : "حسب الولاية"}
                </span>
              </div>
              <div className="ext-m2-recap-total">
                <span>المجموع الكلي :</span>
                <span>
                  {(goodsTotal + shippingFee).toLocaleString("fr-FR")} DA
                </span>
              </div>
            </div>

            {formError && (
              <div className="er" id="er">
                {formError}
              </div>
            )}

            <button
              className="go"
              type="submit"
              disabled={isSubmitting || orderSubmitted}
            >
              {isSubmitting
                ? "⏳ جاري تأكيد الطلب..."
                : orderSubmitted
                  ? "✅ تم تسجيل طلبك بنجاح"
                  : "🛒 تأكيد الطلب"}
            </button>

            {orderSubmitted && (
              <div className="ok" id="ok">
                ✅ تم استلام طلبك بنجاح
                <br />
                {isPack2 ? `${color1} + ${color2} 🎁` : color1}
                <br />
                سنتصل بك قريباً لتأكيد الإرسال
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

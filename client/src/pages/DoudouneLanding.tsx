import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { type Order, type Product } from "@/lib/store-data";
import { abayaCommunesByWilaya, abayaWilayas } from "@/lib/abaya-communes";
import { trpc } from "@/lib/trpc";
import { shippingFeeFor } from "@shared/shipping";
import { useCheckoutDraft } from "@/components/useCheckoutDraft";
import { submitCheckoutOrder } from "@/lib/checkout-api";
import { trackPixelEvent } from "@/lib/tracking";
import "./doudoune-template.css";

type ColorKey = "white" | "blue" | "black";
type OfferMode = "single" | "pack2";

const PH: Record<ColorKey, string> = {
  white: "/manus-storage/doudoune-white.jpg",
  blue: "/manus-storage/doudoune-blue.jpg",
  black: "/manus-storage/doudoune-black.jpg",
};

const AR: Record<ColorKey, string> = {
  white: "أبيض",
  blue: "أزرق سماوي",
  black: "أسود",
};

const SIZES = ["S", "M", "L", "XL", "XXL"];
const DEFAULT_PACK_2_PRICE = 12900;

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function DoudouneLanding({
  product,
  quantity,
}: {
  product: Product;
  quantity: number;
}) {
  const cfg = product.landingConfig;
  const isBuiltIn =
    !cfg &&
    (product.id === "p-008" || product.slug === "doudoune-hiver-luxe") &&
    (!product.image || product.image === "/manus-storage/doudoune-bg.jpg");
  const customVariants =
    !isBuiltIn && cfg?.colorSwatches && cfg.colorSwatches.length > 0
      ? cfg.colorSwatches.map((sw, idx) => ({
          name: sw.name,
          image: product.variantImages?.[idx]?.image || product.gallery?.[idx] || product.image,
        }))
      : product.variantImages && product.variantImages.length > 0
        ? product.variantImages
        : product.colors && product.colors.length > 0
          ? product.colors.map((c, idx) => ({
              name: c,
              image: product.gallery?.[idx] || product.image,
            }))
          : (product.gallery ?? []).map((img, idx) => ({
              name: `اللون ${idx + 1}`,
              image: img,
            }));
  const dynamicSizes = isBuiltIn
    ? SIZES
    : cfg?.sizes !== undefined
      ? cfg.sizes.map(s => s.label)
      : SIZES;
  const hasPackOffer = isBuiltIn || (typeof product.packPrice === "number" && product.packPrice > 0);
  const defaultDoudouneGallery = new Set([
    "/manus-storage/doudoune-bg.jpg",
    "/manus-storage/doudoune-white.jpg",
    "/manus-storage/doudoune-blue.jpg",
    "/manus-storage/doudoune-black.jpg",
  ]);
  const extraGalleryPhotos = (product.gallery ?? []).filter(
    img => Boolean(img) && !(isBuiltIn && defaultDoudouneGallery.has(img))
  );
  const PACK_2_PRICE = product.packPrice || (isBuiltIn ? DEFAULT_PACK_2_PRICE : Math.round((product.price || 7600) * 1.7));

  const [color, setColor] = useState<string>(isBuiltIn ? "blue" : (customVariants[0]?.name ?? "اللون 1"));
  const [isThumbSelected, setIsThumbSelected] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedWilaya, setSelectedWilaya] = useState<string>("");
  const [selectedCommune, setSelectedCommune] = useState<string>("");
  const [delivery, setDelivery] = useState<"home" | "office">("home");
  const [offerMode, setOfferMode] = useState<OfferMode>("single");
  const [secondColor, setSecondColor] = useState<string>(isBuiltIn ? "black" : ((customVariants[1] ?? customVariants[0])?.name ?? "اللون 2"));
  const [secondSize, setSecondSize] = useState<string>(dynamicSizes.includes("L") ? "L" : (dynamicSizes[0] ?? ""));
  const [remainingSeconds, setRemainingSeconds] = useState(18 * 3600 + 32 * 60);
  const [okMessage, setOkMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderSubmitted, setOrderSubmitted] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const communes = selectedWilaya
    ? (abayaCommunesByWilaya[selectedWilaya] ?? [])
    : [];
  const ratesQuery = trpc.store.shippingRates.useQuery(undefined, { retry: false, staleTime: 10 * 60 * 1000, refetchOnWindowFocus: false });
  const homeShippingFee = selectedWilaya
    ? shippingFeeFor(ratesQuery.data?.rates, selectedWilaya, "home", [product.id])
    : 0;
  const officeShippingFee = selectedWilaya
    ? shippingFeeFor(ratesQuery.data?.rates, selectedWilaya, "office", [product.id])
    : 0;
  const shippingFee = delivery === "office" ? officeShippingFee : homeShippingFee;
  const goodsTotal = offerMode === "pack2" ? PACK_2_PRICE : product.price * Math.max(1, quantity || 1);

  const getColorLabel = (c: string) => isBuiltIn ? (AR[c as ColorKey] || c) : c;

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
            ? `1: ${getColorLabel(color)} | 2: ${getColorLabel(secondColor)}`
            : getColorLabel(color),
        size:
          dynamicSizes.length === 0
            ? ""
            : offerMode === "pack2"
              ? `1: ${selectedSize} | 2: ${secondSize}`
              : selectedSize,
      },
    ],
    watchKey: `${color}|${selectedSize}|${selectedWilaya}|${selectedCommune}|${delivery}|${offerMode}|${secondColor}|${secondSize}|${quantity}`,
  });

  useLayoutEffect(() => {
    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {}
    const raf = window.requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [product.id]);

  useEffect(() => {
    trackPixelEvent("ViewContent", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: product.name,
      value: product.price,
      currency: "DZD",
    });
  }, [product.id]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = isBuiltIn
      ? "Miss Sensuelle – دواقون شتوية فاخرة"
      : `Miss Sensuelle – ${product.arName || product.name}`;
    return () => {
      document.title = prevTitle;
    };
  }, [isBuiltIn, product.arName, product.name]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemainingSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const setC = (c: string, thumb: boolean) => {
    setColor(c);
    setIsThumbSelected(thumb);
  };

  const hours = pad2(Math.floor(remainingSeconds / 3600));
  const minutes = pad2(Math.floor((remainingSeconds % 3600) / 60));
  const seconds = pad2(remainingSeconds % 60);

  const showOverlay = !(color === "blue" && !isThumbSelected);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingRef.current || orderSubmitted) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const chosenColor = String(formData.get("color") || color);
    const size = String(formData.get("size") || "");
    const phone = String(formData.get("phone") || "");
    const name = String(formData.get("name") || "");
    const wilaya = String(formData.get("wilaya") || selectedWilaya);
    const commune = String(formData.get("commune") || selectedCommune || wilaya);
    const colorLabel = getColorLabel(chosenColor);
    const secondColorLabel = getColorLabel(secondColor);

    const isPack = offerMode === "pack2";
    const billedQty = isPack ? 2 : Math.max(1, quantity || 1);
    const orderTotal = (isPack ? PACK_2_PRICE : product.price * billedQty) + shippingFee;
    const summaryColor = isPack
      ? `1: ${colorLabel} | 2: ${secondColorLabel}`
      : colorLabel;
    const sizeSuffix = size ? ` (${size})` : "";
    const secondSizeSuffix = secondSize ? ` (${secondSize})` : "";
    const summarySize = dynamicSizes.length === 0 ? "" : isPack ? `1: ${size} | 2: ${secondSize}` : size;
    const offerNote = isPack
      ? `🔥 عرض خاص: 2 قطع بـ ${PACK_2_PRICE.toLocaleString("en-US")} دج — [القطعة 1: ${colorLabel}${sizeSuffix} | القطعة 2: ${secondColorLabel}${secondSizeSuffix}]`
      : "";

    setOkMessage(
      isPack
        ? `✅ شكرًا! تم استلام طلبك للعرض (2 × بـ ${PACK_2_PRICE.toLocaleString("en-US")} دج 🔥)، سنتصل بك قريبًا لتأكيده.`
        : `✅ شكرًا! تم استلام طلبك (${colorLabel}${size ? ` - ${size}` : ""})، سنتصل بك قريبًا لتأكيده.`,
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
        customer: name,
        phone,
        wilaya,
        commune,
        address: "",
        note: offerNote,
        delivery,
        items: [
          {
            productId: product.id,
            quantity: billedQty,
            color: summaryColor,
            size: summarySize,
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
      customer: name,
      phone,
      product: isPack
        ? `${product.name} (عرض 2 دواقون بـ 12900 دج)`
        : `${product.name} · ${colorLabel} · ${size}`,
      productId: product.id,
      color: summaryColor,
      size: summarySize,
      delivery,
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
        localStorage.getItem("miss-sensuelle-orders") || "[]",
      ) as Order[];
      localStorage.setItem(
        "miss-sensuelle-orders",
        JSON.stringify([order, ...existing]),
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
      event_id: `purchase_${serverOrderNumber}`,
      phone,
      customer: name,
    });

    setOrderSubmitted(true);
    setIsSubmitting(false);
    isSubmittingRef.current = false;
  };

  const activatePack2Offer = () => {
    setOfferMode("pack2");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const activeCustomImage = customVariants.find(v => v.name === color)?.image || product.image;

  return (
    <div className="doudoune-template" dir="rtl" lang="ar">
      <div className="page">
        {isBuiltIn ? (
          <div className="top">
            <img
              className="b"
              src="/manus-storage/doudoune-bg.jpg"
              alt="Miss Sensuelle"
            />
            <img
              id="ov"
              src={PH[color as ColorKey] ?? PH.blue}
              alt=""
              style={{ opacity: showOverlay ? 1 : 0 }}
            />
            <button
              type="button"
              className={`hs th${color === "white" ? " on" : ""}`}
              data-c="white"
              style={{
                left: "2.338%",
                top: "64.835%",
                width: "23.804%",
                height: "21.350%",
              }}
              aria-label="أبيض"
              onClick={() => setC("white", true)}
            />
            <button
              type="button"
              className={`hs th${color === "blue" ? " on" : ""}`}
              data-c="blue"
              style={{
                left: "27.630%",
                top: "64.835%",
                width: "22.104%",
                height: "21.350%",
              }}
              aria-label="أزرق"
              onClick={() => setC("blue", true)}
            />
            <button
              type="button"
              className={`hs th${color === "black" ? " on" : ""}`}
              data-c="black"
              style={{
                left: "51.222%",
                top: "64.835%",
                width: "22.317%",
                height: "21.350%",
              }}
              aria-label="أسود"
              onClick={() => setC("black", true)}
            />
            <button
              type="button"
              className={`hs dt${color === "white" ? " on" : ""}`}
              data-c="white"
              style={{
                left: "77.152%",
                top: "77.551%",
                width: "6.376%",
                height: "4.710%",
              }}
              aria-label="أبيض"
              onClick={() => setC("white", false)}
            />
            <button
              type="button"
              className={`hs dt${color === "blue" ? " on" : ""}`}
              data-c="blue"
              style={{
                left: "83.528%",
                top: "77.316%",
                width: "6.376%",
                height: "4.710%",
              }}
              aria-label="أزرق"
              onClick={() => setC("blue", false)}
            />
            <button
              type="button"
              className={`hs dt${color === "black" ? " on" : ""}`}
              data-c="black"
              style={{
                left: "90.329%",
                top: "76.923%",
                width: "6.376%",
                height: "4.710%",
              }}
              aria-label="أسود"
              onClick={() => setC("black", false)}
            />
          </div>
        ) : (
          <div className="top" style={{ background: "#fff", paddingBottom: 14 }}>
            <img
              className="b"
              src={activeCustomImage}
              alt={product.arName || product.name}
            />
            <div style={{ padding: "14px 16px 8px", textAlign: "center" }}>
              {cfg?.promoBannerAr || cfg?.heroBadgeAr || product.badge ? (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: "inline-block", background: "#e0112b", color: "#fff", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>
                    {cfg?.heroBadgeAr || cfg?.promoBannerAr || product.badge}
                  </span>
                </div>
              ) : null}
              <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#17307e" }}>
                {cfg?.heroHeadlineAr || product.arName || product.name}
              </h1>
              <p style={{ margin: "0 0 10px", fontSize: 14, color: "#475569", fontWeight: 600 }}>
                {cfg?.heroSubheadlineAr || product.arDescription || product.description}
              </p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 16px", borderRadius: 999, background: "#fef2f2", border: "1.5px solid #fecaca" }}>
                <strong style={{ fontSize: 22, fontWeight: 900, color: "#e0112b" }}>{product.price.toLocaleString("en-US")} دج</strong>
                {product.oldPrice ? <del style={{ fontSize: 14, color: "#94a3b8" }}>{product.oldPrice.toLocaleString("en-US")} دج</del> : null}
              </div>
              {product.details && product.details.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 10 }}>
                  {product.details.map(d => (
                    <span key={d} style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: "#1e293b" }}>
                      ✅ {d}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            {customVariants.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(4, Math.max(2, customVariants.length))}, 1fr)`, gap: 10, padding: "12px 14px 4px" }}>
                {customVariants.map(v => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => setC(v.name, true)}
                    style={{
                      border: color === v.name ? "3px solid #e0112b" : "2px solid #e2e8f0",
                      borderRadius: 14,
                      padding: 4,
                      background: "#fff",
                      cursor: "pointer",
                      overflow: "hidden",
                      boxShadow: color === v.name ? "0 6px 16px rgba(224,17,43,0.22)" : "none",
                    }}
                  >
                    <img src={v.image || product.image} alt={v.name} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 10, display: "block" }} />
                    <span style={{ display: "block", marginTop: 4, fontSize: 12, fontWeight: 800, color: "#1e293b" }}>{v.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {extraGalleryPhotos.length > 0 && (
          <div style={{ display: "grid", gap: 0, lineHeight: 0, background: "#fff" }}>
            {extraGalleryPhotos.map((imgUrl, idx) => (
              <img
                key={`${imgUrl}-${idx}`}
                src={imgUrl}
                alt={`${product.arName || product.name} - ${idx + 1}`}
                style={{ width: "100%", height: "auto", display: "block" }}
                loading="lazy"
              />
            ))}
          </div>
        )}

        <form className="fm" id="f" ref={formRef} onSubmit={handleSubmit}>
          <div className="fh">
            <h2>🔥 اطلبي الآن قبل نفاذ الكمية !</h2>
            <div className="tm">
              الوقت المتبقي للعرض
              <div>
                <b id="h">{hours}</b>
                <b>:</b>
                <b id="m">{minutes}</b>
                <b>:</b>
                <b id="s">{seconds}</b>
              </div>
            </div>
          </div>

          <div className="g">
            <label className="f">
              <i>📞</i>
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                required
                pattern="0[5-7][0-9]{8}"
                placeholder="رقم الهاتف (07...)"
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
            <label className="f">
              <i>👤</i>
              <input name="name" required placeholder="الاسم الكامل" />
            </label>
            <label className="f">
              <i>🎨</i>
              <select
                name="color"
                id="cs"
                required
                value={color}
                onChange={e => setC(e.target.value, false)}
              >
                {isBuiltIn ? (
                  <>
                    <option value="white">اللون: أبيض</option>
                    <option value="blue">اللون: أزرق سماوي</option>
                    <option value="black">اللون: أسود</option>
                  </>
                ) : (
                  (customVariants.length ? customVariants : [{ name: "الافتراضي", image: "" }]).map(v => (
                    <option key={v.name} value={v.name}>
                      اللون: {v.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            {dynamicSizes.length > 0 ? (
              <label className="f">
                <i>📏</i>
                <select
                  name="size"
                  required
                  value={selectedSize}
                  onChange={e => setSelectedSize(e.target.value)}
                >
                  <option value="">المقاس</option>
                  {dynamicSizes.map(sz => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="f">
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
                <option value="">الولاية</option>
                {abayaWilayas.map(w => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            <label className="f">
              <i>🏘️</i>
              <select
                name="commune"
                required
                disabled={!selectedWilaya}
                value={selectedCommune}
                onChange={e => setSelectedCommune(e.target.value)}
              >
                <option value="">
                  {selectedWilaya ? "البلدية" : "اختاري الولاية أولاً"}
                </option>
                {communes.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <input type="hidden" name="delivery" value={delivery} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "10px 0 4px" }}>
            <button
              type="button"
              onClick={() => setDelivery("home")}
              style={{
                padding: "10px 8px",
                borderRadius: 12,
                border: delivery === "home" ? "2px solid #e0112b" : "1.5px solid #cbd5e1",
                background: delivery === "home" ? "rgba(224,17,43,0.08)" : "#fff",
                color: "#1e293b",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <div>🏠 التوصيل للمنزل</div>
              <small style={{ color: "#e0112b", fontWeight: 900 }}>
                {selectedWilaya ? (homeShippingFee > 0 ? `${homeShippingFee.toLocaleString("en-US")} دج` : "مجاناً") : "حسب الولاية"}
              </small>
            </button>
            <button
              type="button"
              onClick={() => setDelivery("office")}
              style={{
                padding: "10px 8px",
                borderRadius: 12,
                border: delivery === "office" ? "2px solid #e0112b" : "1.5px solid #cbd5e1",
                background: delivery === "office" ? "rgba(224,17,43,0.08)" : "#fff",
                color: "#1e293b",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <div>🏢 المكتب (Stop Desk)</div>
              <small style={{ color: "#e0112b", fontWeight: 900 }}>
                {selectedWilaya ? (officeShippingFee > 0 ? `${officeShippingFee.toLocaleString("en-US")} دج` : "مجاناً") : "حسب الولاية"}
              </small>
            </button>
          </div>

          <div className="offer-choices">
            <button
              type="button"
              className={`offer-option${offerMode === "single" ? " active" : ""}`}
              onClick={() => setOfferMode("single")}
            >
              <div className="offer-option-main">
                <span className="offer-radio" />
                <div className="offer-text">
                  <strong>{isBuiltIn ? "قطعة واحدة (1 دواقون)" : (cfg?.offer1LabelAr || `قطعة واحدة (${product.arName || product.name})`)}</strong>
                  <small>العرض العادي</small>
                </div>
              </div>
              <div className="offer-price">
                <b>{product.price.toLocaleString("en-US")} دج</b>
                {product.oldPrice && <del>{product.oldPrice.toLocaleString("en-US")} دج</del>}
              </div>
            </button>

            {hasPackOffer ? (
              <button
                type="button"
                className={`offer-option${offerMode === "pack2" ? " active" : ""}`}
                onClick={() => setOfferMode("pack2")}
              >
                <div className="offer-option-main">
                  <span className="offer-radio" />
                  <div className="offer-text">
                    <strong>{isBuiltIn ? "🔥 عرض خاص : اشتري 2 دواقون بتخفيض رائع !" : `🔥 ${cfg?.offer2LabelAr || "عرض خاص : اشتري قطعتين (2) بتخفيض رائع !"}`}</strong>
                    <small>2 قطع بـ {PACK_2_PRICE.toLocaleString("en-US")} دج فقط (وفّري {Math.max(0, product.price * 2 - PACK_2_PRICE).toLocaleString("en-US")} دج)</small>
                  </div>
                </div>
                <div className="offer-price">
                  <b>{PACK_2_PRICE.toLocaleString("en-US")} دج</b>
                  <del>{(product.price * 2).toLocaleString("en-US")} دج</del>
                </div>
              </button>
            ) : null}

            {hasPackOffer && offerMode === "pack2" && (
              <div className="offer-subform">
                <div className="offer-subform-title">
                  {isBuiltIn ? "✨ اختاري لون ومقاس الدواقون الثانية 🧥" : "✨ اختاري تفاصيل القطعة الثانية 🎁"}
                </div>
                <div className="offer-subform-row">
                  <label className="f">
                    <i>🎨</i>
                    <select
                      value={secondColor}
                      onChange={e => setSecondColor(e.target.value)}
                    >
                      {isBuiltIn ? (
                        <>
                          <option value="white">القطعة 2: أبيض</option>
                          <option value="blue">القطعة 2: أزرق سماوي</option>
                          <option value="black">القطعة 2: أسود</option>
                        </>
                      ) : (
                        (customVariants.length ? customVariants : [{ name: "الافتراضي", image: "" }]).map(v => (
                          <option key={v.name} value={v.name}>
                            القطعة 2: {v.name}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  {dynamicSizes.length > 0 ? (
                    <label className="f">
                      <i>📏</i>
                      <select
                        value={secondSize}
                        onChange={e => setSecondSize(e.target.value)}
                      >
                        {dynamicSizes.map(sz => (
                          <option key={sz} value={sz}>
                            مقاس 2: {sz}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {selectedWilaya && shippingFee > 0 && (
            <div className="shipping-fee-box" style={{ margin: "10px 0", padding: "10px 14px", borderRadius: 12, background: "rgba(212,175,55,.12)", border: "1px dashed #d4af37", fontWeight: 700, lineHeight: 1.9 }}>
              <div>🚚 سعر التوصيل إلى {selectedWilaya} : <span style={{ color: "#e0112b" }}>{shippingFee.toLocaleString("en-US")} دج</span></div>
              <div>💰 المبلغ الإجمالي عند الاستلام : <span style={{ color: "#e0112b" }}>{(goodsTotal + shippingFee).toLocaleString("en-US")} دج</span></div>
            </div>
          )}

          <div className="bt">
            <svg viewBox="0 0 60 50">
              <path
                d="M5 4C8 30 25 42 48 40"
                fill="none"
                stroke="#e0112b"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M40 28L54 40 38 49"
                fill="none"
                stroke="#e0112b"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <button className="go" type="submit" disabled={isSubmitting || orderSubmitted}>
              {isSubmitting
                ? "جاري تأكيد طلبك... ⏳"
                : orderSubmitted
                ? "تم استلام طلبك بنجاح ✅"
                : offerMode === "pack2"
                ? `أؤكد طلبي للعرض (2 بـ ${PACK_2_PRICE.toLocaleString("en-US")} دج) 🛒`
                : isBuiltIn
                ? "أؤكد طلبي الآن 🛒"
                : `${cfg?.ctaLabelAr || "أؤكد طلبي الآن"} 🛒`}
            </button>
          </div>

          <p id="ok" style={{ display: okMessage ? "block" : "none" }}>
            {okMessage}
          </p>
        </form>

        {!isBuiltIn && cfg?.reviews && cfg.reviews.length > 0 ? (
          <div style={{ margin: "14px auto 0", display: "grid", gap: 8 }}>
            {cfg.reviews.slice(0, 3).map((rev, idx) => (
              <div
                key={`${rev.author}-${idx}`}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, marginBottom: 4 }}>
                  <span>{rev.author}{rev.city ? ` · ${rev.city}` : ""}</span>
                  <span style={{ color: "#d4af37" }}>{"★".repeat(Math.min(5, Math.max(1, rev.rating || 5)))}</span>
                </div>
                <p style={{ margin: 0, color: "#334155" }}>« {rev.text} »</p>
              </div>
            ))}
          </div>
        ) : null}

        {hasPackOffer ? (
          <div
            className="under-form-offer"
            onClick={activatePack2Offer}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") activatePack2Offer();
            }}
          >
            <span className="under-form-badge">🔥 تخفيض استثنائي لفترة محدودة 🔥</span>
            <h3>
              {isBuiltIn
                ? <>اشتري 2 دواقون بـ <span>12,900 دج فقط !</span></>
                : <>اشتري قطعتين من {product.arName || product.name} بـ <span>{PACK_2_PRICE.toLocaleString("en-US")} دج فقط !</span></>}
            </h3>
            <p>
              {isBuiltIn ? (
                <>احصلي على قطعتين من الدواقون الشتوية الفاخرة (من اختيارك في الألوان والمقاسات) بسعر مخفض <b>12,900 دج</b> بدلاً من <del>15,200 دج</del> !</>
              ) : (
                <>احصلي على قطعتين بسعر مخفض <b>{PACK_2_PRICE.toLocaleString("en-US")} دج</b> بدلاً من <del>{(product.price * 2).toLocaleString("en-US")} دج</del> !</>
              )}
            </p>
            <span className="under-form-cta">
              {offerMode === "pack2"
                ? `✅ تم تفعيل عرض القطعتين بـ ${PACK_2_PRICE.toLocaleString("en-US")} دج في الاستمارة أعلاه`
                : `👈 اضغطي هنا للاستفادة من عرض القطعتين بـ ${PACK_2_PRICE.toLocaleString("en-US")} دج`}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

import { FormEvent, useEffect, useRef, useState } from "react";
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
const PACK_2_PRICE = 12900;

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function DoudouneLanding({
  product,
  quantity,
}: {
  product: Product;
  quantity: number;
}) {
  const [color, setColor] = useState<ColorKey>("blue");
  const [isThumbSelected, setIsThumbSelected] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedWilaya, setSelectedWilaya] = useState<string>("");
  const [selectedCommune, setSelectedCommune] = useState<string>("");
  const [offerMode, setOfferMode] = useState<OfferMode>("single");
  const [secondColor, setSecondColor] = useState<ColorKey>("black");
  const [secondSize, setSecondSize] = useState<string>("L");
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
  const shippingFee = selectedWilaya
    ? shippingFeeFor(ratesQuery.data?.rates, selectedWilaya, "home", [product.id])
    : 0;
  const goodsTotal = offerMode === "pack2" ? PACK_2_PRICE : product.price * Math.max(1, quantity || 1);

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
            ? `1: ${AR[color]} | 2: ${AR[secondColor]}`
            : AR[color],
        size:
          offerMode === "pack2"
            ? `1: ${selectedSize} | 2: ${secondSize}`
            : selectedSize,
      },
    ],
    watchKey: `${color}|${selectedSize}|${selectedWilaya}|${selectedCommune}|${offerMode}|${secondColor}|${secondSize}|${quantity}`,
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
  }, [product.id]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Miss Sensuelle – دواقون شتوية فاخرة";
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

  const setC = (c: ColorKey, thumb: boolean) => {
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
    const chosenColor = ((formData.get("color") as ColorKey) || color) as ColorKey;
    const size = String(formData.get("size") || "");
    const phone = String(formData.get("phone") || "");
    const name = String(formData.get("name") || "");
    const wilaya = String(formData.get("wilaya") || selectedWilaya);
    const commune = String(formData.get("commune") || selectedCommune || wilaya);
    const colorLabel = AR[chosenColor] || chosenColor;

    const isPack = offerMode === "pack2";
    const billedQty = isPack ? 2 : Math.max(1, quantity || 1);
    const orderTotal = (isPack ? PACK_2_PRICE : product.price * billedQty) + shippingFee;
    const summaryColor = isPack
      ? `1: ${colorLabel} | 2: ${AR[secondColor]}`
      : colorLabel;
    const summarySize = isPack ? `1: ${size} | 2: ${secondSize}` : size;
    const offerNote = isPack
      ? `🔥 عرض خاص: 2 دواقون بـ 12,900 دج بدل 15,200 دج — [القطعة 1: ${colorLabel} (${size}) | القطعة 2: ${AR[secondColor]} (${secondSize})]`
      : "";

    setOkMessage(
      isPack
        ? `✅ شكرًا! تم استلام طلبك لعرض (2 دواقون بـ 12,900 دج فقط 🔥)، سنتصل بك قريبًا لتأكيده.`
        : `✅ شكرًا! تم استلام طلبك (${colorLabel} - ${size})، سنتصل بك قريبًا لتأكيده.`,
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
        delivery: "home",
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

  return (
    <div className="doudoune-template" dir="rtl" lang="ar">
      <div className="page">
        <div className="top">
          <img
            className="b"
            src="/manus-storage/doudoune-bg.jpg"
            alt="Miss Sensuelle"
          />
          <img
            id="ov"
            src={PH[color]}
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
                onChange={e => setC(e.target.value as ColorKey, false)}
              >
                <option value="white">اللون: أبيض</option>
                <option value="blue">اللون: أزرق سماوي</option>
                <option value="black">اللون: أسود</option>
              </select>
            </label>
            <label className="f">
              <i>📏</i>
              <select
                name="size"
                required
                value={selectedSize}
                onChange={e => setSelectedSize(e.target.value)}
              >
                <option value="">المقاس</option>
                {SIZES.map(sz => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </select>
            </label>
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

          <div className="offer-choices">
            <button
              type="button"
              className={`offer-option${offerMode === "single" ? " active" : ""}`}
              onClick={() => setOfferMode("single")}
            >
              <div className="offer-option-main">
                <span className="offer-radio" />
                <div className="offer-text">
                  <strong>قطعة واحدة (1 دواقون)</strong>
                  <small>العرض العادي</small>
                </div>
              </div>
              <div className="offer-price">
                <b>7,600 دج</b>
                <del>9,000 دج</del>
              </div>
            </button>

            <button
              type="button"
              className={`offer-option${offerMode === "pack2" ? " active" : ""}`}
              onClick={() => setOfferMode("pack2")}
            >
              <div className="offer-option-main">
                <span className="offer-radio" />
                <div className="offer-text">
                  <strong>🔥 عرض خاص : اشتري 2 دواقون بتخفيض رائع !</strong>
                  <small>2 قطع بـ 12,900 دج فقط (وفّري 2,300 دج)</small>
                </div>
              </div>
              <div className="offer-price">
                <b>12,900 دج</b>
                <del>15,200 دج</del>
              </div>
            </button>

            {offerMode === "pack2" && (
              <div className="offer-subform">
                <div className="offer-subform-title">
                  ✨ اختاري لون ومقاس الدواقون الثانية 🧥
                </div>
                <div className="offer-subform-row">
                  <label className="f">
                    <i>🎨</i>
                    <select
                      value={secondColor}
                      onChange={e => setSecondColor(e.target.value as ColorKey)}
                    >
                      <option value="white">القطعة 2: أبيض</option>
                      <option value="blue">القطعة 2: أزرق سماوي</option>
                      <option value="black">القطعة 2: أسود</option>
                    </select>
                  </label>
                  <label className="f">
                    <i>📏</i>
                    <select
                      value={secondSize}
                      onChange={e => setSecondSize(e.target.value)}
                    >
                      {SIZES.map(sz => (
                        <option key={sz} value={sz}>
                          مقاس 2: {sz}
                        </option>
                      ))}
                    </select>
                  </label>
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
                ? "أؤكد طلبي للعرض (2 بـ 12,900 دج) 🛒"
                : "أؤكد طلبي الآن 🛒"}
            </button>
          </div>

          <p id="ok" style={{ display: okMessage ? "block" : "none" }}>
            {okMessage}
          </p>
        </form>

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
            اشتري 2 دواقون بـ <span>12,900 دج فقط !</span>
          </h3>
          <p>
            احصلي على قطعتين من الدواقون الشتوية الفاخرة (من اختيارك في الألوان
            والمقاسات) بسعر مخفض <b>12,900 دج</b> بدلاً من <del>15,200 دج</del> !
          </p>
          <span className="under-form-cta">
            {offerMode === "pack2"
              ? "✅ تم تفعيل عرض 2 دواقون بـ 12,900 دج في الاستمارة أعلاه"
              : "👈 اضغطي هنا للاستفادة من عرض 2 دواقون بـ 12,900 دج"}
          </span>
        </div>
      </div>
    </div>
  );
}

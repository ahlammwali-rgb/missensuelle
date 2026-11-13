import { FormEvent, useEffect, useRef, useState } from "react";
import { type Order, type Product } from "@/lib/store-data";
import { abayaCommunesByWilaya, abayaWilayas } from "@/lib/abaya-communes";
import { trpc } from "@/lib/trpc";
import { shippingFeeFor } from "@shared/shipping";
import { useCheckoutDraft } from "@/components/useCheckoutDraft";
import { submitCheckoutOrder } from "@/lib/checkout-api";
import { trackPixelEvent } from "@/lib/tracking";
import "./extensions-template.css";

type OfferMode = "single" | "pack2";

const COLOR_CARDS = [
  {
    name: "شاتان فونس",
    swatch: "#3b2219",
    style: { left: "0.977%", top: "61.939%", width: "16.211%", height: "24.058%" },
  },
  {
    name: "أسود",
    swatch: "#141416",
    style: { left: "18.359%", top: "61.939%", width: "16.016%", height: "24.058%" },
  },
  {
    name: "بني غامق",
    swatch: "#4a2c1d",
    style: { left: "35.352%", top: "61.939%", width: "14.941%", height: "24.058%" },
  },
  {
    name: "شاتان روكس",
    swatch: "#7b3f20",
    style: { left: "51.465%", top: "61.939%", width: "15.137%", height: "24.058%" },
  },
  {
    name: "أشقر فاتح",
    swatch: "#d8be98",
    style: { left: "67.773%", top: "61.939%", width: "15.039%", height: "24.058%" },
  },
  {
    name: "نور بالياح غري",
    swatch: "#706e78",
    style: { left: "83.984%", top: "61.939%", width: "14.941%", height: "24.058%" },
  },
] as const;

const PACK_2_PRICE = 4800;

const REVIEWS: ReadonlyArray<readonly [string, string]> = [
  ["منتج رائع، شعر طبيعي وخفيف وسهل التركيب، أنصح به بشدة ❤️", "سارة · وهران"],
  ["الجودة ممتازة واللون طابق الصورة تمامًا، والتوصيل كان سريعًا.", "إيمان · الجزائر العاصمة"],
  ["سهلة التركيب وتعطي كثافة وطول رهيب، شكرًا Miss Sensuelle.", "أمينة · قسنطينة"],
];

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function ExtensionsLanding({
  product,
  quantity,
}: {
  product: Product;
  quantity: number;
}) {
  const [color, setColor] = useState<string>(COLOR_CARDS[0].name);
  const [secondColor, setSecondColor] = useState<string>(COLOR_CARDS[1].name);
  const [offerMode, setOfferMode] = useState<OfferMode>("single");
  const [selectedWilaya, setSelectedWilaya] = useState<string>("");
  const [selectedCommune, setSelectedCommune] = useState<string>("");
  const [remainingSeconds, setRemainingSeconds] = useState(18 * 3600 + 32 * 60);
  const [reviewIdx, setReviewIdx] = useState<number>(0);
  const [okMessage, setOkMessage] = useState<string>("");
  const [toastMsg, setToastMsg] = useState<string>("");
  const [toastShown, setToastShown] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderSubmitted, setOrderSubmitted] = useState<boolean>(false);

  const isSubmittingRef = useRef<boolean>(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

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
    document.title = "Miss Sensuelle – إكستنشن الشعر الفاخر";
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

  useEffect(() => {
    const interval = window.setInterval(() => {
      setReviewIdx(prev => (prev + 1) % REVIEWS.length);
    }, 4500);
    return () => window.clearInterval(interval);
  }, []);

  const hours = pad2(Math.floor(remainingSeconds / 3600));
  const minutes = pad2(Math.floor((remainingSeconds % 3600) / 60));
  const seconds = pad2(remainingSeconds % 60);

  const handleSelectColor = (selectedColor: string) => {
    setColor(selectedColor);
    showToast(`✅ اللون المختار: ${selectedColor}`, 2200);
  };

  const activatePack2Offer = () => {
    setOfferMode("pack2");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingRef.current || orderSubmitted) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const chosenColor = String(formData.get("color") || color || COLOR_CARDS[0].name).trim();
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
        ? `✅ شكرًا! تم استلام طلبك لعرض (2 إكستنشن بـ 4,800 دج فقط 🔥)، سنتصل بك قريبًا لتأكيده.`
        : `✅ شكرًا! تم استلام طلبك (${chosenColor})، سنتصل بك قريبًا لتأكيده.`
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
      <div className="page">
        {/* Top Hero + 6 Interactive Color Cards + 4 Gold Guarantees */}
        <div className="top">
          <img
            className="b"
            src="/manus-storage/extensions-poster.jpg"
            alt="Miss Sensuelle – إكستنشن الشعر"
          />

          {COLOR_CARDS.map(card => (
            <button
              key={card.name}
              type="button"
              className={`cd${color === card.name ? " on" : ""}`}
              data-n={card.name}
              aria-label={card.name}
              style={card.style}
              onClick={() => handleSelectColor(card.name)}
            />
          ))}
        </div>

        {/* Social Proof & Customer Reviews Strip (like Doudoune) */}
        <div className="ext-proof-row">
          <div className="ext-review-card">
            <div className="ext-stars">★★★★★</div>
            <p>« {REVIEWS[reviewIdx]?.[0]} »</p>
            <div className="ext-review-meta">
              <small>— {REVIEWS[reviewIdx]?.[1]}</small>
              <div className="ext-dots">
                {REVIEWS.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Avis ${idx + 1}`}
                    className={idx === reviewIdx ? "on" : ""}
                    onClick={() => setReviewIdx(idx)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="ext-stat-card">
            <span className="ext-crown">👑</span>
            <small>أكثر من</small>
            <strong>3200</strong>
            <span>زبونة راضية</span>
          </div>
        </div>

        {/* Full-Width Order Form Inspired by Doudoune Page */}
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
                required
                value={color}
                onChange={e => handleSelectColor(e.target.value)}
              >
                {COLOR_CARDS.map(c => (
                  <option key={c.name} value={c.name}>
                    اللون: {c.name}
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

            <label className="f">
              <i>📝</i>
              <input name="note" placeholder="ملاحظة (اختياري)" />
            </label>
          </div>

          {/* Offer Choices: 1 Piece vs Pack 2 Pieces (like Doudoune) */}
          <div className="offer-choices">
            <button
              type="button"
              className={`offer-option${offerMode === "single" ? " active" : ""}`}
              onClick={() => setOfferMode("single")}
            >
              <div className="offer-option-main">
                <span className="offer-radio" />
                <div className="offer-text">
                  <strong>قطعة واحدة (1 إكستنشن شعر)</strong>
                  <small>العرض العادي · كثافة وطول رائع</small>
                </div>
              </div>
              <div className="offer-price">
                <b>2,700 دج</b>
                <del>3,500 دج</del>
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
                  <strong>🔥 عرض خاص : اشتري 2 إكستنشن بتخفيض رائع !</strong>
                  <small>2 قطع بـ 4,800 دج فقط (وفّري 600 دج)</small>
                </div>
              </div>
              <div className="offer-price">
                <b>4,800 دج</b>
                <del>5,400 دج</del>
              </div>
            </button>

            {offerMode === "pack2" && (
              <div className="offer-subform">
                <div className="offer-subform-title">
                  ✨ اختاري لون الإكستنشن الثانية 💇‍♀️
                </div>
                <div className="offer-subform-row">
                  <label className="f">
                    <i>🎨</i>
                    <select
                      value={secondColor}
                      onChange={e => setSecondColor(e.target.value)}
                    >
                      {COLOR_CARDS.map(c => (
                        <option key={c.name} value={c.name}>
                          القطعة 2: {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}
          </div>

          {selectedWilaya && shippingFee > 0 && (
            <div
              className="shipping-fee-box"
              style={{
                margin: "10px 0",
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(212,175,55,.15)",
                border: "1px dashed #ffd54a",
                fontWeight: 700,
                lineHeight: 1.9,
              }}
            >
              <div>
                🚚 سعر التوصيل إلى {selectedWilaya} :{" "}
                <span style={{ color: "#ffd54a" }}>
                  {shippingFee.toLocaleString("en-US")} دج
                </span>
              </div>
              <div>
                💰 المبلغ الإجمالي عند الاستلام :{" "}
                <span style={{ color: "#ffd54a" }}>
                  {(goodsTotal + shippingFee).toLocaleString("en-US")} دج
                </span>
              </div>
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
            <button
              className="go"
              type="submit"
              disabled={isSubmitting || orderSubmitted}
            >
              {isSubmitting
                ? "جاري تأكيد طلبك... ⏳"
                : orderSubmitted
                  ? "تم استلام طلبك بنجاح ✅"
                  : offerMode === "pack2"
                    ? "أؤكد طلبي للعرض (2 بـ 4,800 دج) 🛒"
                    : "أؤكد طلبي الآن 🛒"}
            </button>
          </div>

          <p id="ok" style={{ display: okMessage ? "block" : "none" }}>
            {okMessage}
          </p>
        </form>

        {/* Under-Form Promotional Banner (like Doudoune) */}
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
            اشتري 2 إكستنشن شعر بـ <span>4,800 دج فقط !</span>
          </h3>
          <p>
            احصلي على قطعتين من إكستنشن الشعر الفاخر (من اختيارك في الألوان)
            بسعر مخفض <b>4,800 دج</b> بدلاً من <del>5,400 دج</del> لكثافة مضاعفة أو لتقاسمها مع أختك أو صديقتك !
          </p>
          <span className="under-form-cta">
            {offerMode === "pack2"
              ? "✅ تم تفعيل عرض 2 إكستنشن بـ 4,800 دج في الاستمارة أعلاه"
              : "👈 اضغطي هنا للاستفادة من عرض 2 إكستنشن بـ 4,800 دج"}
          </span>
        </div>
      </div>

      <div id="t" className={`ext-toast${toastShown ? " s" : ""}`}>
        {toastMsg}
      </div>
    </div>
  );
}

import { FormEvent, useEffect, useState } from "react";
import { type Order, type Product } from "@/lib/store-data";
import { submitCheckoutOrder } from "@/lib/checkout-api";
import { trackPixelEvent } from "@/lib/tracking";
import "./doudoune-template.css";

type ColorKey = "white" | "blue" | "black";

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

const DOUDOUNE_WILAYAS = [
  "أدرار",
  "الشلف",
  "الأغواط",
  "أم البواقي",
  "باتنة",
  "بجاية",
  "بسكرة",
  "بشار",
  "البليدة",
  "البويرة",
  "تمنراست",
  "تبسة",
  "تلمسان",
  "تيارت",
  "تيزي وزو",
  "الجزائر",
  "الجلفة",
  "جيجل",
  "سطيف",
  "سعيدة",
  "سكيكدة",
  "سيدي بلعباس",
  "عنابة",
  "قالمة",
  "قسنطينة",
  "المدية",
  "مستغانم",
  "المسيلة",
  "معسكر",
  "ورقلة",
  "وهران",
  "البيض",
  "إليزي",
  "برج بوعريريج",
  "بومرداس",
  "الطارف",
  "تندوف",
  "تيسمسيلت",
  "الوادي",
  "خنشلة",
  "سوق أهراس",
  "تيبازة",
  "ميلة",
  "عين الدفلى",
  "النعامة",
  "عين تموشنت",
  "غرداية",
  "غليزان",
];

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
  const [remainingSeconds, setRemainingSeconds] = useState(18 * 3600 + 32 * 60);
  const [okMessage, setOkMessage] = useState<string>("");

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
    const formData = new FormData(e.currentTarget);
    const chosenColor = ((formData.get("color") as ColorKey) || color) as ColorKey;
    const size = String(formData.get("size") || "");
    const phone = String(formData.get("phone") || "");
    const name = String(formData.get("name") || "");
    const wilaya = String(formData.get("wilaya") || "");
    const note = String(formData.get("note") || "");
    const colorLabel = AR[chosenColor] || chosenColor;

    setOkMessage(
      `✅ شكرًا! تم استلام طلبك (${colorLabel} - ${size})، سنتصل بك قريبًا لتأكيده.`,
    );

    const qty = Math.max(1, quantity || 1);
    let serverOrderNumber = `MS-${Math.floor(1000 + Math.random() * 8999)}`;

    try {
      const token =
        globalThis.crypto?.randomUUID?.() ??
        `00000000-0000-4000-8000-${String(Date.now()).padStart(12, "0").slice(-12)}`;
      const res = await submitCheckoutOrder(token, {
        source: "product",
        customer: name,
        phone,
        wilaya,
        commune: wilaya || "المركز",
        address: "",
        note,
        delivery: "home",
        items: [
          {
            productId: product.id,
            quantity: qty,
            color: colorLabel,
            size,
          },
        ],
      });
      serverOrderNumber = res.orderNumber;
    } catch {
      // Fallback local si hors-ligne
    }

    const order: Order = {
      id: serverOrderNumber,
      createdAt: new Date().toISOString(),
      customer: name,
      phone,
      product: `${product.name} · ${colorLabel} · ${size}`,
      productId: product.id,
      color: colorLabel,
      size,
      delivery: "home",
      quantity: qty,
      total: product.price * qty,
      wilaya,
      commune: wilaya || "المركز",
      address: "",
      note,
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
      content_ids: [product.id],
      content_name: product.name,
      value: product.price * qty,
      currency: "DZD",
      order_id: serverOrderNumber,
    });
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

        <form className="fm" id="f" onSubmit={handleSubmit}>
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
                    content_ids: [product.id],
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
              <select name="size" required defaultValue="">
                <option value="">المقاس</option>
                <option>S</option>
                <option>M</option>
                <option>L</option>
                <option>XL</option>
                <option>XXL</option>
              </select>
            </label>
            <label className="f">
              <i>📍</i>
              <select name="wilaya" required defaultValue="">
                <option value="">الولاية</option>
                {DOUDOUNE_WILAYAS.map(w => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </label>
            <label className="f">
              <i>💬</i>
              <input name="note" placeholder="الملحة (اختياري)" />
            </label>
          </div>

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
            <button className="go" type="submit">
              أؤكد طلبي الآن 🛒
            </button>
          </div>

          <p id="ok" style={{ display: okMessage ? "block" : "none" }}>
            {okMessage}
          </p>
        </form>
      </div>
    </div>
  );
}

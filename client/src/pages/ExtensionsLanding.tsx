import { FormEvent, useEffect, useRef, useState } from "react";
import { type Order, type Product } from "@/lib/store-data";
import { abayaWilayas } from "@/lib/abaya-communes";
import { trpc } from "@/lib/trpc";
import { shippingFeeFor } from "@shared/shipping";
import { useCheckoutDraft } from "@/components/useCheckoutDraft";
import { submitCheckoutOrder } from "@/lib/checkout-api";
import { trackPixelEvent } from "@/lib/tracking";
import "./extensions-template.css";

const COLOR_CARDS = [
  {
    name: "شاتان فونس",
    style: { left: "0.977%", top: "44.922%", width: "16.211%", height: "17.448%" },
  },
  {
    name: "أسود",
    style: { left: "18.359%", top: "44.922%", width: "16.016%", height: "17.448%" },
  },
  {
    name: "بني غامق",
    style: { left: "35.352%", top: "44.922%", width: "14.941%", height: "17.448%" },
  },
  {
    name: "شاتان روكس",
    style: { left: "51.465%", top: "44.922%", width: "15.137%", height: "17.448%" },
  },
  {
    name: "أشقر فاتح",
    style: { left: "67.773%", top: "44.922%", width: "15.039%", height: "17.448%" },
  },
  {
    name: "نور بالياح غري",
    style: { left: "83.984%", top: "44.922%", width: "14.941%", height: "17.448%" },
  },
] as const;

const REVIEWS: ReadonlyArray<readonly [string, string]> = [
  ["منتج رائع، شعر طبيعي وخفيف وسهل التركيب، أنصح به بشدة..", "سارة · وهران"],
  ["الجودة ممتازة واللون طابق الصورة تمامًا، والتوصيل كان سريعًا.", "زبونة · الجزائر العاصمة"],
  ["سهلة التركيب وتعطي كثافة جميلة، شكرًا Miss Sensuelle.", "زبونة · قسنطينة"],
];

const WILAYAS_AR = [
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
  "تيميمون",
  "برج باجي مختار",
  "أولاد جلال",
  "بني عباس",
  "عين صالح",
  "عين قزام",
  "تقرت",
  "جانت",
  "المغير",
  "المنيعة",
];

export default function ExtensionsLanding({
  product,
  quantity,
}: {
  product: Product;
  quantity: number;
}) {
  const [color, setColor] = useState<string>("");
  const [nameVal, setNameVal] = useState<string>("");
  const [phoneVal, setPhoneVal] = useState<string>("");
  const [wilayaVal, setWilayaVal] = useState<string>("");
  const [noteVal, setNoteVal] = useState<string>("");
  const [reviewIdx, setReviewIdx] = useState<number>(0);
  const [reviewVisible, setReviewVisible] = useState<boolean>(true);
  const [toastMsg, setToastMsg] = useState<string>("");
  const [toastShown, setToastShown] = useState<boolean>(false);
  const [orderSubmitted, setOrderSubmitted] = useState<boolean>(false);

  const isSubmittingRef = useRef<boolean>(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const firstColorRef = useRef<HTMLButtonElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const ratesQuery = trpc.store.shippingRates.useQuery(undefined, {
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const shippingFee = wilayaVal
    ? shippingFeeFor(ratesQuery.data?.rates, wilayaVal, "home", [product.id])
    : 0;

  const showToast = (msg: string, duration = 2600) => {
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
    aliases: { customer: ["name"], commune: ["wilaya"] },
    getItems: () => [
      {
        productId: product.id,
        quantity: Math.max(1, quantity || 1),
        color: color || COLOR_CARDS[0].name,
        size: "",
      },
    ],
    watchKey: `${color}|${nameVal}|${phoneVal}|${wilayaVal}|${noteVal}|${quantity}`,
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
    document.title = "Miss Sensuelle – إكستنشن الشعر";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setReviewVisible(false);
      window.setTimeout(() => {
        setReviewIdx(prev => (prev + 1) % REVIEWS.length);
        setReviewVisible(true);
      }, 250);
    }, 4500);
    return () => window.clearInterval(interval);
  }, []);

  const handleSelectReview = (index: number) => {
    setReviewVisible(false);
    window.setTimeout(() => {
      setReviewIdx(index);
      setReviewVisible(true);
    }, 200);
  };

  const handleSelectColor = (selectedColor: string) => {
    setColor(selectedColor);
    showToast(`✅ اللون المختار: ${selectedColor}`, 2200);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!color) {
      showToast("اختاري اللون أولًا 🎨", 2500);
      firstColorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (isSubmittingRef.current || orderSubmitted) return;
    isSubmittingRef.current = true;

    const formData = new FormData(e.currentTarget);
    const customer = String(formData.get("name") || nameVal || "زبونة Miss Sensuelle").trim();
    const rawPhone = String(formData.get("phone") || phoneVal || "").trim();
    const phone = rawPhone.replace(/[\s\-\.]/g, "");
    const wilaya = String(formData.get("wilaya") || wilayaVal || "").trim();
    const note = String(formData.get("note") || noteVal || "").trim();
    const commune = wilaya;

    const billedQty = Math.max(1, quantity || 1);
    const orderTotal = product.price * billedQty + shippingFee;

    showToast(`✅ شكرًا! تم استلام طلبك (${color})، سنتصل بك قريبًا لتأكيده.`, 4500);

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
        note,
        delivery: "home",
        items: [
          {
            productId: product.id,
            quantity: billedQty,
            color,
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
      product: `${product.name} · ${color}`,
      productId: product.id,
      color,
      size: "",
      delivery: "home",
      quantity: billedQty,
      total: orderTotal,
      wilaya,
      commune,
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
    isSubmittingRef.current = false;
  };

  return (
    <div className="extensions-template" dir="rtl" lang="ar">
      <form className="p" id="f" ref={formRef} onSubmit={handleSubmit}>
        <img
          src="/manus-storage/extensions-poster.jpg"
          alt="Miss Sensuelle – إكستنشن الشعر"
        />

        {COLOR_CARDS.map((card, index) => (
          <button
            key={card.name}
            ref={index === 0 ? firstColorRef : undefined}
            type="button"
            className={`cd${color === card.name ? " on" : ""}`}
            data-n={card.name}
            aria-label={card.name}
            style={card.style}
            onClick={() => handleSelectColor(card.name)}
          />
        ))}

        <div
          className="tt"
          id="ti"
          style={{
            left: "58.594%",
            top: "73.828%",
            width: "26.562%",
            height: "2.344%",
          }}
        >
          اطلبي الآن قبل نفاذ الكمية !
        </div>

        <input
          name="name"
          required
          value={nameVal}
          onChange={e => setNameVal(e.target.value)}
          className={nameVal ? "v" : ""}
          placeholder="name"
          aria-label="الاسم الكامل"
          style={{
            left: "46.875%",
            top: "77.344%",
            width: "17.578%",
            height: "2.409%",
          }}
        />

        <input
          name="phone"
          type="tel"
          inputMode="numeric"
          required
          pattern="0[5-7][0-9]{8}"
          value={phoneVal}
          onChange={e => setPhoneVal(e.target.value)}
          className={phoneVal ? "v" : ""}
          placeholder="phone"
          aria-label="رقم الهاتف"
          style={{
            left: "71.582%",
            top: "77.344%",
            width: "19.238%",
            height: "2.409%",
          }}
        />

        <select
          name="wilaya"
          required
          value={wilayaVal}
          onChange={e => setWilayaVal(e.target.value)}
          className={wilayaVal ? "v" : ""}
          aria-label="الولاية"
          style={{
            left: "46.875%",
            top: "80.469%",
            width: "17.578%",
            height: "2.474%",
          }}
        >
          <option value="" />
          {abayaWilayas.map(w => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>

        <input
          name="note"
          value={noteVal}
          onChange={e => setNoteVal(e.target.value)}
          className={noteVal ? "v" : ""}
          placeholder="note"
          aria-label="الملحة"
          style={{
            left: "71.582%",
            top: "80.469%",
            width: "19.238%",
            height: "2.474%",
          }}
        />

        <button
          className="go"
          type="submit"
          aria-label="أؤكد طلبي الآن"
          style={{
            left: "53.809%",
            top: "84.180%",
            width: "34.570%",
            height: "4.557%",
          }}
        />

        <div
          className="rv"
          id="rv"
          style={{
            left: "5.078%",
            top: "79.036%",
            width: "26.172%",
            height: "5.339%",
            opacity: reviewVisible ? 1 : 0,
          }}
        >
          <span className="st">★★★★★</span>
          <q id="rq">{REVIEWS[reviewIdx]?.[0]}</q>
          <small id="rn">{REVIEWS[reviewIdx]?.[1]}</small>
        </div>

        <div
          className="dts"
          id="dt"
          style={{
            left: "5.078%",
            top: "84.505%",
            width: "26.172%",
            height: "1.562%",
          }}
        >
          {REVIEWS.map((_, idx) => (
            <i
              key={idx}
              className={idx === reviewIdx ? "on" : ""}
              onClick={() => handleSelectReview(idx)}
            />
          ))}
        </div>
      </form>

      <div id="t" className={`ext-toast${toastShown ? " s" : ""}`}>
        {toastMsg}
      </div>
    </div>
  );
}

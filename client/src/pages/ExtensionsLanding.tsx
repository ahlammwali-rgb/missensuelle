import { FormEvent, useEffect, useRef, useState } from "react";
import { type Order, type Product } from "@/lib/store-data";
import { abayaWilayas } from "@/lib/abaya-communes";
import { trpc } from "@/lib/trpc";
import { shippingFeeFor } from "@shared/shipping";
import { useCheckoutDraft } from "@/components/useCheckoutDraft";
import { submitCheckoutOrder } from "@/lib/checkout-api";
import { initializePixels, trackPixelEvent } from "@/lib/tracking";
import "./extensions-template.css";

const VARIANT_CARDS = [
  { id: "v1", name: "أسود طبيعي", image: "/manus-storage/ext-pink-v1.jpg" },
  { id: "v2", name: "بني غامق", image: "/manus-storage/ext-pink-v2.jpg" },
  { id: "v3", name: "بني عسلي", image: "/manus-storage/ext-pink-v3.jpg" },
  { id: "v4", name: "شاتين روكس", image: "/manus-storage/ext-pink-v4.jpg" },
  { id: "v5", name: "أشقر فاتح", image: "/manus-storage/ext-pink-v5.jpg" },
  { id: "v6", name: "نور بليلي غري", image: "/manus-storage/ext-pink-v6.jpg" },
] as const;

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
] as const;

export default function ExtensionsLanding({
  product,
  quantity,
}: {
  product: Product;
  quantity: number;
}) {
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [noteInput, setNoteInput] = useState<string>("");
  const [selectedWilayaIdx, setSelectedWilayaIdx] = useState<string>("");
  const [orderSubmitted, setOrderSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isSubmittingRef = useRef<boolean>(false);
  const checkoutInitiatedRef = useRef<boolean>(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const canonicalWilaya =
    selectedWilayaIdx !== ""
      ? (abayaWilayas[Number(selectedWilayaIdx)] ?? "")
      : "";

  const ratesQuery = trpc.store.shippingRates.useQuery(undefined, {
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const shippingFee = canonicalWilaya
    ? shippingFeeFor(ratesQuery.data?.rates, canonicalWilaya, "home", [product.id])
    : 0;

  useCheckoutDraft({
    formRef,
    source: "product",
    aliases: { customer: ["name"], commune: ["wilaya"] },
    getItems: () => [
      {
        productId: product.id,
        quantity: Math.max(1, quantity || 1),
        color: selectedColor || noteInput || VARIANT_CARDS[0].name,
        size: "",
      },
    ],
    watchKey: `${selectedColor}|${noteInput}|${selectedWilayaIdx}|${quantity}`,
  });

  useEffect(() => {
    initializePixels();
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
    document.title = "إكستنشن الشعر";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  const handleSelectVariant = (shadeName: string) => {
    setSelectedColor(shadeName);
    setNoteInput(shadeName);
    trackPixelEvent("AddToCart", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: `${product.name} - ${shadeName}`,
      value: product.price,
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
      value: product.price,
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
    const wilaya = canonicalWilaya || String(formData.get("wilaya") || "").trim();
    const noteOrColor = String(formData.get("note") || noteInput || selectedColor || "").trim();
    const finalColor = selectedColor || noteOrColor || VARIANT_CARDS[0].name;

    const billedQty = Math.max(1, quantity || 1);
    const unitPrice = product.price || 2700;
    const orderTotal = unitPrice * billedQty + shippingFee;

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
        commune: wilaya,
        address: wilaya || "Algérie",
        delivery: "home",
        note: noteOrColor,
        items: [
          {
            productId: product.id,
            quantity: billedQty,
            color: finalColor,
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
        color: finalColor,
        size: "",
        delivery: "home",
        wilaya,
        commune: wilaya,
        address: wilaya,
        note: noteOrColor,
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
            {VARIANT_CARDS.map(card => (
              <button
                key={card.id}
                type="button"
                className={`ext-variant-card ${selectedColor === card.name ? "is-selected" : ""}`}
                onClick={() => handleSelectVariant(card.name)}
              >
                <img src={card.image} alt={card.name} />
              </button>
            ))}
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

        <form
          id="f"
          ref={formRef}
          className="ext-pink-form"
          onFocus={handleFormFocus}
          onSubmit={handleSubmit}
        >
          <div className="ext-pink-form-inner">
            <h3>اطلبي الآن • الدفع عند الاستلام</h3>

            <input
              name="name"
              placeholder="الاسم الكامل"
              required
            />

            <input
              type="tel"
              inputMode="tel"
              name="phone"
              placeholder="رقم الهاتف"
              pattern="0[5-7][0-9]{8}"
              required
            />

            <select
              id="w"
              name="wilaya"
              value={selectedWilayaIdx}
              onChange={e => setSelectedWilayaIdx(e.target.value)}
              required
            >
              <option value="">الولاية</option>
              {WILAYAS_AR.map((wName, idx) => (
                <option key={wName} value={String(idx)}>
                  {idx + 1} - {wName}
                </option>
              ))}
            </select>

            <input
              name="note"
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              placeholder="اللون المطلوب / ملاحظة (اختياري)"
            />

            <button type="submit" disabled={isSubmitting || orderSubmitted}>
              🛒 تأكيد الطلب
            </button>

            {orderSubmitted && (
              <div className="ext-pink-ok" id="ok">
                ✅ تم استلام طلبك، سنتصل بك قريباً
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

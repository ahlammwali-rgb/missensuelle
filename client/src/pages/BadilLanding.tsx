import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { abayaCommunesByWilaya } from "@/lib/abaya-communes";
import { useCheckoutDraft } from "@/components/useCheckoutDraft";
import { getCatalogProducts, type Product } from "@/lib/store-data";
import { identifyTikTokUser, initializePixels, trackPixelEvent } from "@/lib/tracking";
import { trpc } from "@/lib/trpc";
import { shippingFeeFor } from "@shared/shipping";
import "./badil-template.css";

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

type OfferId = "offer1" | "offer2";

type OfferOption = {
  id: OfferId;
  value: string;
  title: string;
  price: number;
  quantity: number;
  color: string;
  size: string;
};

function normalizeDzPhone(raw: string): string {
  const cleaned = raw.replace(/[\s().-]/g, "");
  if (/^[5-7]\d{8}$/.test(cleaned)) return `0${cleaned}`;
  return cleaned;
}

function isValidDzPhone(raw: string): boolean {
  const cleaned = raw.replace(/[\s().-]/g, "");
  return /^(0|\+?213)?[5-7][0-9]{8}$/.test(cleaned);
}

function formatPrice(amount: number): string {
  return `${new Intl.NumberFormat("fr-DZ").format(amount)} DA`;
}

export default function BadilLanding({ product }: { product?: Product }) {
  const activeProduct = product;
  const cfg = activeProduct?.landingConfig;
  const productId = activeProduct?.id || "p-010";
  const isBuiltIn =
    !cfg &&
    productId === "p-010" &&
    (!activeProduct?.image || activeProduct.image === "/images/badil/01-badil.jpg");
  const productTitle = isBuiltIn
    ? activeProduct?.name || "Badil Microblading"
    : activeProduct?.arName || activeProduct?.name || "Sensuelle";

  const singlePrice = activeProduct?.price && activeProduct.price > 0 ? activeProduct.price : 1800;
  const hasPackOffer = isBuiltIn || (typeof activeProduct?.packPrice === "number" && activeProduct.packPrice > 0);
  const packPrice =
    activeProduct?.packPrice && activeProduct.packPrice > 0
      ? activeProduct.packPrice
      : isBuiltIn
        ? 3000
        : singlePrice * 2;

  const colorOptions = useMemo(() => {
    if (isBuiltIn) return [];
    if (cfg?.colorSwatches && cfg.colorSwatches.length > 0) {
      return cfg.colorSwatches.map(c => ({ value: c.name, hex: c.hex || "#e0145f" }));
    }
    if (activeProduct?.colors && activeProduct.colors.length > 0) {
      return activeProduct.colors.map(c => ({ value: c, hex: "#e0145f" }));
    }
    return [];
  }, [isBuiltIn, cfg?.colorSwatches, activeProduct?.colors]);

  const sizeOptions = useMemo(() => {
    if (isBuiltIn || !cfg?.sizes) return [];
    return cfg.sizes.map(s => ({ value: s.label, note: s.hint || "" }));
  }, [isBuiltIn, cfg?.sizes]);

  const offers: OfferOption[] = useMemo(() => {
    const base: OfferOption[] = [
      {
        id: "offer1",
        value: `1 - ${singlePrice} DA`,
        title: isBuiltIn ? "لوحة واحدة" : cfg?.offer1LabelAr || "قطعة واحدة",
        price: singlePrice,
        quantity: 1,
        color: isBuiltIn ? "لوحة واحدة" : cfg?.offer1LabelAr || "قطعة واحدة",
        size: isBuiltIn ? "قطعة واحدة" : "1",
      },
    ];
    if (hasPackOffer) {
      base.push({
        id: "offer2",
        value: `2 - ${packPrice} DA`,
        title: isBuiltIn ? "لوحتان + الثالثة مجانا" : cfg?.offer2LabelAr || "قطعتان بسعر مميز",
        price: packPrice,
        quantity: 2,
        color: isBuiltIn ? "لوحتان + الثالثة مجانا" : cfg?.offer2LabelAr || "عرض ثنائي",
        size: isBuiltIn ? "3 قطع (2+1 مجانا)" : "2",
      });
    }
    return base;
  }, [singlePrice, packPrice, hasPackOffer, isBuiltIn, cfg?.offer1LabelAr, cfg?.offer2LabelAr]);

  const [selectedOfferId, setSelectedOfferId] = useState<OfferId>(hasPackOffer ? "offer2" : "offer1");
  useEffect(() => {
    setSelectedOfferId(hasPackOffer ? "offer2" : "offer1");
  }, [hasPackOffer, productId]);
  const selectedOffer = offers.find(o => o.id === selectedOfferId) ?? offers[0];

  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [wilaya, setWilaya] = useState("");
  const [communeChoice, setCommuneChoice] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [hideSticky, setHideSticky] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<{
    orderNumber: string;
    total: number;
    offerValue: string;
  } | null>(null);

  const formRef = useRef<HTMLFormElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const submitBtnRef = useRef<HTMLButtonElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const initiatedCheckoutRef = useRef(false);

  const communes = useMemo(() => {
    if (!wilaya) return [];
    const lookupKey = wilaya === "تقرت" ? "توقرت" : wilaya;
    const list = abayaCommunesByWilaya[lookupKey];
    return list && list.length > 0 ? list : [wilaya];
  }, [wilaya]);

  const resolvedAddress = isBuiltIn
    ? address.trim()
    : communeChoice === "__o"
      ? address.trim()
      : communeChoice.trim() || address.trim();

  const hasUserInput = Boolean(customer.trim() || phone.trim() || wilaya || resolvedAddress);

  const ratesQuery = trpc.store.shippingRates.useQuery(undefined, {
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const shippingFee = useMemo(() => {
    if (!wilaya) return 0;
    return shippingFeeFor(ratesQuery.data?.rates, wilaya, "home", [productId]);
  }, [ratesQuery.data?.rates, wilaya, productId]);

  const grandTotal = selectedOffer.price + shippingFee;

  const checkout = useCheckoutDraft({
    formRef,
    source: "product",
    getItems: () => [
      {
        productId,
        quantity: selectedOffer.quantity,
        color: hasUserInput ? selectedColor || selectedOffer.color : "",
        size: hasUserInput ? selectedSize || selectedOffer.size : "",
      },
    ],
    watchKey: `${selectedOffer.id}|${selectedColor}|${selectedSize}|${customer}|${phone}|${wilaya}|${resolvedAddress}`,
  });

  // Always start cleanly at the top and isolate page styling
  useLayoutEffect(() => {
    document.body.classList.add("badil-experience");
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {
      // Ignore scroll restoration error
    }
    return () => {
      document.body.classList.remove("badil-experience");
    };
  }, [productId]);

  // Initialize Meta + TikTok Pixels and emit ViewContent on mount
  useEffect(() => {
    const prevTitle = document.title;
    document.title = productTitle;
    initializePixels();
    try {
      const win = window as Window & { ttq?: { page?: () => void } };
      win.ttq?.page?.();
    } catch {
      // Ignore
    }
    trackPixelEvent("ViewContent", {
      content_name: productTitle,
      content_ids: [productId],
      content_id: productId,
      content_type: "product",
      value: selectedOffer.price,
      currency: "DZD",
    });
    return () => {
      document.title = prevTitle;
    };
  }, [productId, productTitle]);

  // Hide sticky bottom button when main submit CTA is visible or after completion
  useEffect(() => {
    const btn = submitBtnRef.current;
    if (!btn || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]) {
        setHideSticky(entries[0].isIntersecting);
      }
    });
    observer.observe(btn);
    return () => observer.disconnect();
  }, [submittedOrder]);

  const triggerInitiateCheckoutOnce = () => {
    if (initiatedCheckoutRef.current) return;
    initiatedCheckoutRef.current = true;
    trackPixelEvent("InitiateCheckout", {
      content_name: `${productTitle} - ${selectedOffer.value}`,
      content_ids: [productId],
      content_id: productId,
      content_type: "product",
      quantity: selectedOffer.quantity,
      num_items: selectedOffer.quantity,
      value: grandTotal,
      currency: "DZD",
    });
  };

  const handleOfferSelect = (offer: OfferOption) => {
    setSelectedOfferId(offer.id);
    trackPixelEvent("AddToCart", {
      content_name: `${productTitle} - ${offer.value}`,
      content_ids: [productId],
      content_id: productId,
      content_type: "product",
      quantity: offer.quantity,
      value: offer.price,
      currency: "DZD",
    });
  };

  const handleStickyClick = () => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    triggerInitiateCheckoutOnce();
  };

  const handlePhoneBlur = () => {
    const normalized = normalizeDzPhone(phone);
    if (normalized !== phone) {
      setPhone(normalized);
      if (phoneInputRef.current) {
        phoneInputRef.current.value = normalized;
      }
    }
    if (isValidDzPhone(normalized)) {
      identifyTikTokUser(normalized, customer.trim());
    }
  };

  const handleSubmit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (checkout.pending || submittedOrder) return;

    if (colorOptions.length > 0 && !selectedColor) {
      setError("المرجو اختيار اللون");
      return;
    }
    if (sizeOptions.length > 0 && !selectedSize) {
      setError("المرجو اختيار المقاس");
      return;
    }

    const trimmedName = customer.trim();
    const trimmedAddress = resolvedAddress;
    if (!trimmedName || !wilaya || !trimmedAddress) {
      setError("المرجو ملء جميع الخانات");
      return;
    }
    if (!isValidDzPhone(phone)) {
      setError("رقم الهاتف غير صحيح");
      return;
    }

    const normalizedPhone = normalizeDzPhone(phone);
    if (normalizedPhone !== phone) {
      setPhone(normalizedPhone);
    }
    if (phoneInputRef.current) {
      phoneInputRef.current.value = normalizedPhone;
    }

    setError("");
    triggerInitiateCheckoutOnce();
    identifyTikTokUser(normalizedPhone, trimmedName);

    const result = await checkout.submitOrder();
    if (!result) {
      setError(checkout.draftError || "حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى.");
      return;
    }

    const finalTotal = result.total || grandTotal;

    // Keep local browser mirror synchronized
    try {
      const catalog = getCatalogProducts();
      const prod = catalog.find(p => p.id === productId);
      const raw = localStorage.getItem("miss-sensuelle-orders");
      const existing = raw ? JSON.parse(raw) : [];
      if (Array.isArray(existing)) {
        const localOrder = {
          id: result.orderNumber,
          createdAt: new Date().toISOString(),
          customer: trimmedName,
          phone: normalizedPhone,
          productId,
          product: `${prod?.name || productTitle} × ${selectedOffer.quantity}`,
          quantity: selectedOffer.quantity,
          total: finalTotal,
          color: selectedColor || selectedOffer.color,
          size: selectedSize || selectedOffer.size,
          delivery: "home" as const,
          wilaya,
          commune: trimmedAddress || wilaya,
          address: trimmedAddress,
          note: `العرض: ${selectedOffer.value}`,
          status: "nouvelle" as const,
        };
        localStorage.setItem("miss-sensuelle-orders", JSON.stringify([localOrder, ...existing]));
      }
    } catch {
      // Ignore storage error
    }

    // Fire Meta & TikTok Purchase conversion events (including TikTok CompletePayment, PlaceAnOrder, SubmitForm)
    trackPixelEvent("Purchase", {
      content_name: `${productTitle} (${selectedOffer.value})`,
      content_ids: [productId],
      content_id: productId,
      content_type: "product",
      quantity: selectedOffer.quantity,
      num_items: selectedOffer.quantity,
      value: finalTotal,
      currency: "DZD",
      order_id: result.orderNumber,
      phone: normalizedPhone,
      customer: trimmedName,
    });

    setSubmittedOrder({
      orderNumber: result.orderNumber,
      total: finalTotal,
      offerValue: selectedOffer.value,
    });
  };

  const heroImages = isBuiltIn
    ? [
        { src: activeProduct?.gallery?.[0] || "/images/badil/01-badil.jpg", alt: "Badil Microblading", lazy: false },
        { src: activeProduct?.gallery?.[1] || "/images/badil/02-badil.jpg", alt: "قبل وبعد", lazy: true },
        { src: activeProduct?.gallery?.[2] || "/images/badil/03-badil.jpg", alt: "طريقة الاستخدام", lazy: true },
        { src: activeProduct?.gallery?.[3] || "/images/badil/04-badil.jpg", alt: "العروض", lazy: true },
      ]
    : [];

  const customImages = useMemo(
    () =>
      isBuiltIn
        ? []
        : (Array.from(
            new Set([activeProduct?.image, ...(activeProduct?.gallery ?? [])].filter(Boolean)),
          ) as string[]),
    [isBuiltIn, activeProduct?.image, activeProduct?.gallery],
  );
  const ctaText = isBuiltIn ? "اطلبي الآن" : cfg?.ctaLabelAr || "اطلبي الآن";
  const displayHeadline = cfg?.heroHeadlineAr || productTitle;
  const displaySubheadline =
    cfg?.heroSubheadlineAr || activeProduct?.arDescription || activeProduct?.description || "";
  const hasOldPrice = Boolean(activeProduct?.oldPrice && activeProduct.oldPrice > singlePrice);

  return (
    <div className="badil-page" dir="rtl" lang="ar">
      <div className="badil-wrap">
        {isBuiltIn ? (
          heroImages.map(img => (
            <img
              key={img.src}
              src={img.src}
              alt={img.alt}
              loading={img.lazy ? "lazy" : undefined}
            />
          ))
        ) : (
          <>
            {cfg?.promoBannerAr ? (
              <div
                style={{
                  background: "linear-gradient(90deg, #ff2d78, #d4a73c)",
                  color: "#fff",
                  textAlign: "center",
                  padding: "9px 12px",
                  fontSize: "13px",
                  fontWeight: 800,
                }}
              >
                {cfg.promoBannerAr}
              </div>
            ) : null}

            {customImages[0] ? (
              <img
                src={customImages[0]}
                alt={displayHeadline}
                style={{ width: "100%", maxHeight: 540, objectFit: "cover" }}
              />
            ) : null}

            <div
              style={{
                background: "linear-gradient(165deg, #fff5f8 0%, #ffdbe7 100%)",
                padding: "16px 15px 18px",
                borderBottom: "3px solid #d4a73c",
              }}
            >
              {cfg?.heroBadgeAr || activeProduct?.badge ? (
                <span
                  style={{
                    display: "inline-block",
                    background: "#ff2d78",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 800,
                    padding: "4px 12px",
                    borderRadius: "999px",
                    marginBottom: "8px",
                  }}
                >
                  {cfg?.heroBadgeAr || activeProduct?.badge}
                </span>
              ) : null}

              <h1 style={{ margin: "0 0 6px", fontSize: "23px", fontWeight: 900, lineHeight: 1.35, color: "#14100c" }}>
                {displayHeadline}
              </h1>

              {displaySubheadline ? (
                <p style={{ margin: "0 0 12px", fontSize: "14px", lineHeight: 1.65, color: "#432833", fontWeight: 600 }}>
                  {displaySubheadline}
                </p>
              ) : null}

              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: activeProduct?.details?.length ? "12px" : 0 }}>
                <span
                  dir="ltr"
                  style={{
                    fontSize: "22px",
                    fontWeight: 900,
                    color: "#ff2d78",
                    background: "#fff",
                    border: "2px solid #ff2d78",
                    borderRadius: "10px",
                    padding: "4px 12px",
                  }}
                >
                  {singlePrice} DA
                </span>
                {hasOldPrice ? (
                  <del dir="ltr" style={{ fontSize: "15px", color: "#8b6b77", fontWeight: 700 }}>
                    {activeProduct?.oldPrice} DA
                  </del>
                ) : null}
              </div>

              {activeProduct?.details && activeProduct.details.length > 0 ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "6px" }}>
                  {activeProduct.details.map(detail => (
                    <li
                      key={detail}
                      style={{
                        background: "#ffffffe0",
                        border: "1px solid #f7b8cc",
                        borderRadius: "10px",
                        padding: "7px 10px",
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#221018",
                      }}
                    >
                      ✨ {detail}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {customImages.slice(1, 3).map((src, idx) => (
              <img
                key={src + idx}
                src={src}
                alt={`${displayHeadline} ${idx + 2}`}
                loading="lazy"
                style={{ width: "100%", maxHeight: 520, objectFit: "cover" }}
              />
            ))}
          </>
        )}

        <section id="badil-form" ref={sectionRef}>
          {isBuiltIn ? (
            <img
              className="badil-tt"
              src={activeProduct?.gallery?.[4] || "/images/badil/05-badil.jpg"}
              alt="إستمارة الطلب"
            />
          ) : (
            <div
              style={{
                textAlign: "center",
                background: "linear-gradient(90deg, #14100c, #3b1726)",
                color: "#fff",
                borderRadius: "12px",
                padding: "10px 14px",
                marginBottom: "14px",
                border: "2px solid #d4a73c",
                fontWeight: 900,
                fontSize: "17px",
              }}
            >
              ✨ استمارة الطلب السريع — الدفع عند الاستلام ✨
            </div>
          )}

          {submittedOrder ? (
            <div className="badil-ok" role="status">
              ✅ شكرا لك! تم استلام طلبك
              <br />
              سنتصل بك قريبا لتأكيد الطلب.
              <div>
                <span className="badil-ok-meta">
                  {submittedOrder.orderNumber} · {formatPrice(submittedOrder.total)}
                </span>
              </div>
            </div>
          ) : (
            <form id="f" ref={formRef} onSubmit={handleSubmit} noValidate>
              <input type="hidden" name="delivery" value="home" />
              <input type="hidden" name="commune" value={resolvedAddress || wilaya} />
              <input type="hidden" name="address" value={resolvedAddress} />
              <input
                type="hidden"
                name="note"
                value={
                  hasUserInput
                    ? [`العرض: ${selectedOffer.value}`, selectedColor ? `اللون: ${selectedColor}` : "", selectedSize ? `المقاس: ${selectedSize}` : ""]
                        .filter(Boolean)
                        .join(" | ")
                    : ""
                }
              />

              <div
                className="badil-offers"
                style={offers.length === 1 ? { gridTemplateColumns: "1fr" } : undefined}
              >
                {offers.map(offer => (
                  <label className="badil-offer-label" key={offer.id}>
                    <input
                      type="radio"
                      name="o"
                      value={offer.value}
                      checked={selectedOfferId === offer.id}
                      onChange={() => handleOfferSelect(offer)}
                    />
                    <span className="badil-offer-box">
                      {offer.title}
                      <b>{offer.price} DA</b>
                    </span>
                  </label>
                ))}
              </div>

              {colorOptions.length > 0 ? (
                <div style={{ marginTop: "12px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "6px", color: "#3b1726" }}>
                    اختاري اللون / الخيار
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {colorOptions.map(c => {
                      const active = selectedColor === c.value;
                      return (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => {
                            setSelectedColor(c.value);
                            if (error) setError("");
                            triggerInitiateCheckoutOnce();
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "7px 12px",
                            borderRadius: "999px",
                            border: active ? "2px solid #ff2d78" : "1.5px solid #e7b5c8",
                            background: active ? "#fff0f6" : "#fff",
                            fontWeight: 800,
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ width: 12, height: 12, borderRadius: "50%", background: c.hex, border: "1px solid #0002" }} />
                          {c.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {sizeOptions.length > 0 ? (
                <div style={{ marginTop: "12px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "6px", color: "#3b1726" }}>
                    اختاري المقاس
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {sizeOptions.map(s => {
                      const active = selectedSize === s.value;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => {
                            setSelectedSize(s.value);
                            if (error) setError("");
                            triggerInitiateCheckoutOnce();
                          }}
                          style={{
                            padding: "7px 14px",
                            borderRadius: "10px",
                            border: active ? "2px solid #ff2d78" : "1.5px solid #e7b5c8",
                            background: active ? "#fff0f6" : "#fff",
                            fontWeight: 800,
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                        >
                          {s.value} {s.note ? `(${s.note})` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="badil-fl">
                <input
                  id="n"
                  name="customer"
                  autoComplete="name"
                  placeholder="الاسم و اللقب"
                  value={customer}
                  onFocus={triggerInitiateCheckoutOnce}
                  onChange={e => {
                    setCustomer(e.target.value);
                    if (error) setError("");
                  }}
                />
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="7" r="5" />
                  <path d="M2 22c0-6 4-9 10-9s10 3 10 9z" />
                </svg>
              </div>

              <div className="badil-fl">
                <input
                  id="p"
                  ref={phoneInputRef}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="رقم الهاتف"
                  value={phone}
                  onFocus={triggerInitiateCheckoutOnce}
                  onChange={e => {
                    setPhone(e.target.value);
                    if (error) setError("");
                  }}
                  onBlur={handlePhoneBlur}
                />
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1.02z" />
                </svg>
              </div>

              <div className="badil-fl">
                <select
                  id="w"
                  name="wilaya"
                  value={wilaya}
                  onFocus={triggerInitiateCheckoutOnce}
                  onChange={e => {
                    setWilaya(e.target.value);
                    setCommuneChoice("");
                    if (!isBuiltIn) setAddress("");
                    if (error) setError("");
                  }}
                >
                  <option value="">الولاية</option>
                  {WILAYAS_AR.map((wName, index) => (
                    <option key={wName} value={wName}>
                      {index + 1} - {wName}
                    </option>
                  ))}
                </select>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 1C7.6 1 4 4.4 4 8.7 4 14.5 12 23 12 23s8-8.5 8-14.3C20 4.4 16.4 1 12 1zm0 11a3 3 0 110-6 3 3 0 010 6z" />
                </svg>
              </div>

              {isBuiltIn ? (
                <div className="badil-fl">
                  <input
                    id="a"
                    name="address"
                    autoComplete="street-address"
                    placeholder="عنوان التوصيل"
                    value={address}
                    onFocus={triggerInitiateCheckoutOnce}
                    onChange={e => {
                      setAddress(e.target.value);
                      if (error) setError("");
                    }}
                  />
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3z" />
                  </svg>
                </div>
              ) : (
                <>
                  <div className="badil-fl">
                    <select
                      id="a"
                      name="communeSelect"
                      value={communeChoice}
                      onFocus={triggerInitiateCheckoutOnce}
                      onChange={e => {
                        setCommuneChoice(e.target.value);
                        if (e.target.value !== "__o") setAddress("");
                        if (error) setError("");
                      }}
                    >
                      <option value="">البلدية</option>
                      {communes.map(cName => (
                        <option key={cName} value={cName}>
                          {cName}
                        </option>
                      ))}
                      {wilaya ? <option value="__o">بلدية أخرى</option> : null}
                    </select>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3z" />
                    </svg>
                  </div>
                  {communeChoice === "__o" ? (
                    <div className="badil-fl">
                      <input
                        placeholder="اكتبي اسم البلدية"
                        value={address}
                        onChange={e => {
                          setAddress(e.target.value);
                          if (error) setError("");
                        }}
                      />
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3z" />
                      </svg>
                    </div>
                  ) : null}
                </>
              )}

              {isBuiltIn ? (
                <div className="badil-row">
                  <img
                    className="badil-b"
                    src={activeProduct?.gallery?.[5] || "/images/badil/06-badil.jpg"}
                    alt="نتيجة طبيعية ومذهلة"
                    loading="lazy"
                  />
                  <img
                    className="badil-e"
                    src={activeProduct?.gallery?.[6] || "/images/badil/07-badil.jpg"}
                    alt="تفاصيل الحاجب"
                    loading="lazy"
                  />
                </div>
              ) : null}

              <div className="badil-summary" aria-live="polite">
                <span>
                  {wilaya && shippingFee > 0
                    ? `التوصيل (${wilaya}): ${formatPrice(shippingFee)}`
                    : "الدفع عند الاستلام"}
                </span>
                <strong>المجموع: {formatPrice(grandTotal)}</strong>
              </div>

              {(error || checkout.draftError) && (
                <div className="badil-err" role="alert">
                  {error || checkout.draftError}
                </div>
              )}

              <button
                ref={submitBtnRef}
                className="badil-btn"
                type="submit"
                disabled={checkout.pending}
              >
                <span>🛒</span> {checkout.pending ? "جارٍ تأكيد الطلب..." : ctaText} <span>👆</span>
              </button>
            </form>
          )}
        </section>

        {isBuiltIn ? (
          <img
            src={activeProduct?.gallery?.[7] || "/images/badil/08-badil.jpg"}
            alt="مميزات Badil Microblading"
            loading="lazy"
          />
        ) : (
          <div style={{ padding: "14px 12px 10px", display: "grid", gap: "10px" }}>
            {cfg?.reviews && cfg.reviews.length > 0 ? (
              <div style={{ display: "grid", gap: "8px" }}>
                <div style={{ fontWeight: 900, fontSize: "15px", color: "#3b1726", textAlign: "center" }}>
                  ⭐ آراء زبوناتنا حول {displayHeadline}
                </div>
                {cfg.reviews.slice(0, 3).map((rev, idx) => (
                  <div
                    key={`${rev.author}-${idx}`}
                    style={{
                      background: "#fff",
                      border: "1px solid #f5bfd2",
                      borderRadius: "12px",
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 800, marginBottom: "4px" }}>
                      <span>{rev.author}{rev.city ? ` · ${rev.city}` : ""}</span>
                      <span style={{ color: "#d4a73c" }}>{"★".repeat(Math.min(5, Math.max(1, rev.rating || 5)))}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.55, color: "#3b232c" }}>
                      “{rev.text}”
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", textAlign: "center" }}>
              {(cfg?.trustItems && cfg.trustItems.length > 0
                ? cfg.trustItems.slice(0, 3)
                : [
                    { icon: "🚚", label: "التوصيل لكل الولايات" },
                    { icon: "💵", label: "الدفع عند الاستلام" },
                    { icon: "✅", label: "ضمان الجودة الأصلي" },
                  ]
              ).map((item, idx) => (
                <div
                  key={`${item.label}-${idx}`}
                  style={{
                    background: "#fff",
                    border: "1px solid #f5bfd2",
                    borderRadius: "12px",
                    padding: "10px 6px",
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#221018",
                  }}
                >
                  <div style={{ fontSize: "18px", marginBottom: "3px" }}>{item.icon || ["🚚", "💵", "✅"][idx % 3]}</div>
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!submittedOrder && (
        <div className={`badil-sticky${hideSticky ? " is-hidden" : ""}`}>
          <button className="badil-btn" type="button" onClick={handleStickyClick}>
            <span>🛒</span> {ctaText} <span>👆</span>
          </button>
        </div>
      )}
    </div>
  );
}

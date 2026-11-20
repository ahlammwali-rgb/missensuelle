import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { abayaCommunesByWilaya } from "@/lib/abaya-communes";
import { loadRealOrders, saveRealOrders } from "@/lib/admin-orders";
import { getProduct, type Product } from "@/lib/store-data";
import { identifyTikTokUser, initializePixels, trackPixelEvent } from "@/lib/tracking";
import { trpc } from "@/lib/trpc";
import { useCheckoutDraft } from "@/components/useCheckoutDraft";
import { shippingFeeFor } from "@shared/shipping";
import "./pyjama-template.css";

type PyjamaOfferId = "single" | "pack";

interface PyjamaOffer {
  id: PyjamaOfferId;
  value: string;
  label: string;
  quantity: number;
  price: number;
}

const PYJAMA_COLORS = [
  { value: "أبيض", hex: "#fff" },
  { value: "أصفر", hex: "#ffd21f" },
  { value: "وردي", hex: "#ff6fae" },
  { value: "موف", hex: "#9b7ff0" },
  { value: "خوخي", hex: "#ff9a85" },
] as const;

const PYJAMA_SIZES = [
  { value: "S", weight: "45-55 Kg" },
  { value: "M", weight: "55-65 Kg" },
  { value: "L", weight: "65-75 Kg" },
  { value: "XL", weight: "75-85 Kg" },
] as const;

const PYJAMA_WILAYAS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "أدرار", label: "1 - أدرار" },
  { value: "الشلف", label: "2 - الشلف" },
  { value: "الأغواط", label: "3 - الأغواط" },
  { value: "أم البواقي", label: "4 - أم البواقي" },
  { value: "باتنة", label: "5 - باتنة" },
  { value: "بجاية", label: "6 - بجاية" },
  { value: "بسكرة", label: "7 - بسكرة" },
  { value: "بشار", label: "8 - بشار" },
  { value: "البليدة", label: "9 - البليدة" },
  { value: "البويرة", label: "10 - البويرة" },
  { value: "تمنراست", label: "11 - تمنراست" },
  { value: "تبسة", label: "12 - تبسة" },
  { value: "تلمسان", label: "13 - تلمسان" },
  { value: "تيارت", label: "14 - تيارت" },
  { value: "تيزي وزو", label: "15 - تيزي وزو" },
  { value: "الجزائر", label: "16 - الجزائر" },
  { value: "الجلفة", label: "17 - الجلفة" },
  { value: "جيجل", label: "18 - جيجل" },
  { value: "سطيف", label: "19 - سطيف" },
  { value: "سعيدة", label: "20 - سعيدة" },
  { value: "سكيكدة", label: "21 - سكيكدة" },
  { value: "سيدي بلعباس", label: "22 - سيدي بلعباس" },
  { value: "عنابة", label: "23 - عنابة" },
  { value: "قالمة", label: "24 - قالمة" },
  { value: "قسنطينة", label: "25 - قسنطينة" },
  { value: "المدية", label: "26 - المدية" },
  { value: "مستغانم", label: "27 - مستغانم" },
  { value: "المسيلة", label: "28 - المسيلة" },
  { value: "معسكر", label: "29 - معسكر" },
  { value: "ورقلة", label: "30 - ورقلة" },
  { value: "وهران", label: "31 - وهران" },
  { value: "البيض", label: "32 - البيض" },
  { value: "إليزي", label: "33 - إليزي" },
  { value: "برج بوعريريج", label: "34 - برج بوعريريج" },
  { value: "بومرداس", label: "35 - بومرداس" },
  { value: "الطارف", label: "36 - الطارف" },
  { value: "تندوف", label: "37 - تندوف" },
  { value: "تيسمسيلت", label: "38 - تيسمسيلت" },
  { value: "الوادي", label: "39 - الوادي" },
  { value: "خنشلة", label: "40 - خنشلة" },
  { value: "سوق أهراس", label: "41 - سوق أهراس" },
  { value: "تيبازة", label: "42 - تيبازة" },
  { value: "ميلة", label: "43 - ميلة" },
  { value: "عين الدفلى", label: "44 - عين الدفلى" },
  { value: "النعامة", label: "45 - النعامة" },
  { value: "عين تموشنت", label: "46 - عين تموشنت" },
  { value: "غرداية", label: "47 - غرداية" },
  { value: "غليزان", label: "48 - غليزان" },
  { value: "تيميمون", label: "49 - تيميمون" },
  { value: "برج باجي مختار", label: "50 - برج باجي مختار" },
  { value: "أولاد جلال", label: "51 - أولاد جلال" },
  { value: "بني عباس", label: "52 - بني عباس" },
  { value: "عين صالح", label: "53 - عين صالح" },
  { value: "عين قزام", label: "54 - عين قزام" },
  { value: "تقرت", label: "55 - تقرت" },
  { value: "جانت", label: "56 - جانت" },
  { value: "المغير", label: "57 - المغير" },
  { value: "المنيعة", label: "58 - المنيعة" },
];

const WILAYA_COMMUNE_KEY_ALIASES: Record<string, string> = {
  تقرت: "توقرت",
};

function getCommunesForWilaya(wilaya: string): string[] {
  if (!wilaya) return [];
  const lookupKey = WILAYA_COMMUNE_KEY_ALIASES[wilaya] ?? wilaya;
  const official = abayaCommunesByWilaya[lookupKey];
  if (official && official.length > 0) return official;
  return [wilaya];
}

function normalizeDzPhone(raw: string): string {
  const cleaned = raw.replace(/[\s.-]+/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+213")) return `0${cleaned.slice(4)}`;
  if (cleaned.startsWith("00213")) return `0${cleaned.slice(5)}`;
  if (cleaned.startsWith("213") && cleaned.length === 12) return `0${cleaned.slice(3)}`;
  if (/^[5-7]\d{8}$/.test(cleaned)) return `0${cleaned}`;
  return cleaned;
}

function isValidDzPhone(raw: string): boolean {
  return /^0[5-7]\d{8}$/.test(normalizeDzPhone(raw));
}

export default function PyjamaLanding({ product }: { product?: Product }) {
  const activeProduct = product ?? getProduct("pyjama-ete");
  const cfg = activeProduct?.landingConfig;
  const productId = activeProduct?.id || "p-011";
  const isBuiltIn =
    !cfg &&
    (productId === "p-011" || activeProduct?.slug === "pyjama-ete") &&
    (!activeProduct?.image || activeProduct.image === "/images/pyjama/01-pyjama.jpg");
  const unitPrice = activeProduct?.price || 1800;
  const hasPackOffer = isBuiltIn || (typeof activeProduct?.packPrice === "number" && activeProduct.packPrice > 0);
  const packPrice = activeProduct?.packPrice || (isBuiltIn ? 3000 : unitPrice * 2);

  const colorOptions = useMemo(() => {
    if (isBuiltIn) return PYJAMA_COLORS.map(c => ({ value: c.value as string, hex: c.hex as string }));
    if (cfg?.colorSwatches && cfg.colorSwatches.length > 0) {
      return cfg.colorSwatches.map(c => ({ value: c.name, hex: c.hex || "#e0145f" }));
    }
    if (activeProduct?.colors && activeProduct.colors.length > 0) {
      const palette = ["#e0145f", "#d4a73c", "#14100c", "#9b7ff0", "#ffd21f", "#ff9a85"];
      return activeProduct.colors.map((c, idx) => ({ value: c, hex: palette[idx % palette.length] }));
    }
    return [];
  }, [isBuiltIn, cfg?.colorSwatches, activeProduct?.colors]);

  const sizeOptions = useMemo(() => {
    if (isBuiltIn) return PYJAMA_SIZES.map(s => ({ value: s.value as string, weight: s.weight as string }));
    if (cfg?.sizes !== undefined) {
      return cfg.sizes.map(s => ({ value: s.label, weight: s.hint || "" }));
    }
    return [];
  }, [isBuiltIn, cfg?.sizes]);

  const offers: PyjamaOffer[] = useMemo(() => {
    const base: PyjamaOffer[] = [
      {
        id: "single",
        value: `1 قطعة - ${unitPrice} DA`,
        label: isBuiltIn ? "قطعة واحدة" : cfg?.offer1LabelAr || "قطعة واحدة",
        quantity: 1,
        price: unitPrice,
      },
    ];
    if (hasPackOffer) {
      base.push({
        id: "pack",
        value: `2 قطع - ${packPrice} DA`,
        label: isBuiltIn ? "قطعتان + الثالثة مجانا" : cfg?.offer2LabelAr || "قطعتان بسعر خاص",
        quantity: 2,
        price: packPrice,
      });
    }
    return base;
  }, [unitPrice, packPrice, hasPackOffer, isBuiltIn, cfg?.offer1LabelAr, cfg?.offer2LabelAr]);

  const [selectedOfferId, setSelectedOfferId] = useState<PyjamaOfferId>(hasPackOffer ? "pack" : "single");
  useEffect(() => {
    setSelectedOfferId(hasPackOffer ? "pack" : "single");
  }, [hasPackOffer, productId]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [wilaya, setWilaya] = useState("");
  const [communeChoice, setCommuneChoice] = useState("");
  const [customCommune, setCustomCommune] = useState("");
  const [validationError, setValidationError] = useState("");
  const [submittedOrder, setSubmittedOrder] = useState<{
    orderNumber: string;
    total: number;
    offerLabel: string;
    colors: string;
    size: string;
    wilaya: string;
    commune: string;
  } | null>(null);
  const [hideSticky, setHideSticky] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const checkoutStartedRef = useRef(false);

  const selectedOffer = offers.find(o => o.id === selectedOfferId) ?? offers[0];
  const communes = useMemo(() => getCommunesForWilaya(wilaya), [wilaya]);
  const resolvedCommune = communeChoice === "__o" ? customCommune.trim() : communeChoice.trim();
  const colorsJoined = selectedColors.join(" + ");
  const sizeForOrder = selectedSize ? `${selectedSize} · ${selectedOffer.label}` : selectedOffer.label;
  const computedNote = [
    `العرض: ${selectedOffer.value}`,
    colorsJoined ? `الألوان: ${colorsJoined}` : "",
    selectedSize ? `المقاس: ${selectedSize}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const ratesQuery = trpc.store.shippingRates.useQuery(undefined, {
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const shippingFee = useMemo(() => {
    if (!wilaya) return 0;
    return shippingFeeFor(ratesQuery.data?.rates, wilaya, "home", [productId]);
  }, [ratesQuery.data?.rates, wilaya, productId]);

  const estimatedTotal = selectedOffer.price + shippingFee;

  const checkout = useCheckoutDraft({
    formRef,
    source: "product",
    getItems: () => [
      {
        productId,
        quantity: selectedOffer.quantity,
        color: colorsJoined || selectedOffer.label,
        size: sizeForOrder,
      },
    ],
    watchKey: `${selectedOfferId}|${colorsJoined}|${selectedSize}|${customer}|${phone}|${wilaya}|${resolvedCommune}`,
  });

  useEffect(() => {
    const prevTitle = document.title;
    document.title = activeProduct?.arName
      ? `Sensuelle - ${activeProduct.arName}`
      : "Sensuelle - بيجامة صيفية";
    document.body.classList.add("pyjama-experience");

    initializePixels();
    (window as Window & { ttq?: { page?: () => void } }).ttq?.page?.();
    trackPixelEvent("ViewContent", {
      content_type: "product",
      content_id: productId,
      content_ids: [productId],
      content_name: activeProduct?.name || "Pyjama Été Sensuelle",
      value: unitPrice,
      currency: "DZD",
      source_page: "pyjama-landing",
    });

    return () => {
      document.title = prevTitle;
      document.body.classList.remove("pyjama-experience");
    };
  }, [activeProduct?.arName, activeProduct?.name, productId, unitPrice]);

  useEffect(() => {
    if (submittedOrder) {
      setHideSticky(true);
      return;
    }
    const target = formRef.current?.querySelector(".pyjama-submit-btn");
    if (!target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      entries => {
        setHideSticky(entries.some(entry => entry.isIntersecting));
      },
      { threshold: 0.15 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [submittedOrder]);

  function ensureInitiateCheckout() {
    if (checkoutStartedRef.current) return;
    checkoutStartedRef.current = true;
    trackPixelEvent("InitiateCheckout", {
      content_type: "product",
      content_id: productId,
      content_ids: [productId],
      content_name: activeProduct?.name || "Pyjama Été Sensuelle",
      value: estimatedTotal,
      currency: "DZD",
      num_items: selectedOffer.quantity,
      source_page: "pyjama-landing",
    });
  }

  function fireAddToCart(
    nextOffer: PyjamaOffer,
    nextColors: string[],
    nextSize: string,
  ) {
    trackPixelEvent("AddToCart", {
      content_type: "product",
      content_id: productId,
      content_ids: [productId],
      content_name: activeProduct?.name || "Pyjama Été Sensuelle",
      value: nextOffer.price,
      currency: "DZD",
      quantity: nextOffer.quantity,
      offer: nextOffer.label,
      color: nextColors.join(" + ") || undefined,
      size: nextSize || undefined,
      source_page: "pyjama-landing",
    });
  }

  function handleOfferChange(nextId: PyjamaOfferId) {
    setSelectedOfferId(nextId);
    setValidationError("");
    ensureInitiateCheckout();
    const nextOffer = offers.find(o => o.id === nextId) ?? offers[0];
    fireAddToCart(nextOffer, selectedColors, selectedSize);
  }

  function handleColorToggle(colorValue: string) {
    ensureInitiateCheckout();
    setValidationError("");
    const exists = selectedColors.includes(colorValue);
    const nextColors = exists
      ? selectedColors.filter(c => c !== colorValue)
      : [...selectedColors, colorValue];
    setSelectedColors(nextColors);
    if (!exists) {
      fireAddToCart(selectedOffer, nextColors, selectedSize);
    }
  }

  function handleSizeChange(sizeValue: string) {
    ensureInitiateCheckout();
    setValidationError("");
    setSelectedSize(sizeValue);
    fireAddToCart(selectedOffer, selectedColors, sizeValue);
  }

  function handleWilayaChange(nextWilaya: string) {
    ensureInitiateCheckout();
    setValidationError("");
    setWilaya(nextWilaya);
    setCommuneChoice("");
    setCustomCommune("");
  }

  function handleStickyClick() {
    ensureInitiateCheckout();
    sectionRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (colorOptions.length > 0 && selectedColors.length === 0) {
      setValidationError("المرجو اختيار اللون");
      return;
    }
    if (sizeOptions.length > 0 && !selectedSize) {
      setValidationError("المرجو اختيار المقاس");
      return;
    }

    const trimmedName = customer.trim();
    if (!trimmedName || !wilaya || !resolvedCommune) {
      setValidationError("المرجو ملء جميع الخانات");
      return;
    }

    const normalizedPhone = normalizeDzPhone(phone);
    if (!isValidDzPhone(normalizedPhone)) {
      setValidationError("رقم الهاتف غير صحيح");
      return;
    }

    setValidationError("");

    // Synchronize the normalized phone onto the DOM input so FormData(form) in submitOrder() sees the canonical 05/06/07 format.
    if (normalizedPhone !== phone) {
      setPhone(normalizedPhone);
      if (phoneInputRef.current) phoneInputRef.current.value = normalizedPhone;
    }

    identifyTikTokUser(normalizedPhone, trimmedName);

    const result = await checkout.submitOrder();
    if (!result) return;

    try {
      const existing = loadRealOrders();
      saveRealOrders([
        {
          id: result.orderNumber,
          createdAt: new Date().toISOString(),
          customer: trimmedName,
          phone: normalizedPhone,
          productId,
          product: `${activeProduct?.name || "Pyjama Été Sensuelle"} × ${selectedOffer.quantity}`,
          quantity: selectedOffer.quantity,
          total: result.total,
          color: colorsJoined,
          size: sizeForOrder,
          delivery: "home",
          wilaya,
          commune: resolvedCommune,
          address: resolvedCommune,
          note: computedNote,
          status: "nouvelle",
        },
        ...existing.filter(o => o.id !== result.orderNumber),
      ]);
    } catch {
      // Le stockage local est optionnel ; la commande est déjà enregistrée côté serveur.
    }

    trackPixelEvent("Purchase", {
      content_type: "product",
      content_id: productId,
      content_ids: [productId],
      content_name: activeProduct?.name || "Pyjama Été Sensuelle",
      value: result.total,
      currency: "DZD",
      order_id: result.orderNumber,
      num_items: selectedOffer.quantity,
      phone: normalizedPhone,
      customer: trimmedName,
      offer: selectedOffer.label,
      color: colorsJoined,
      size: selectedSize,
      wilaya,
      commune: resolvedCommune,
      source_page: "pyjama-landing",
    });

    setSubmittedOrder({
      orderNumber: result.orderNumber,
      total: result.total,
      offerLabel: selectedOffer.label,
      colors: colorsJoined,
      size: selectedSize,
      wilaya,
      commune: resolvedCommune,
    });
  }

  const promoImages = isBuiltIn
    ? [
        { src: activeProduct?.gallery?.[0] || "/images/pyjama/01-pyjama.jpg", alt: "Sensuelle بيجامة صيفية", lazy: false },
        { src: activeProduct?.gallery?.[1] || "/images/pyjama/02-pyjama.jpg", alt: "الألوان المتوفرة", lazy: true },
        { src: activeProduct?.gallery?.[2] || "/images/pyjama/03-pyjama.jpg", alt: "المقاسات والعروض", lazy: true },
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
  const displayHeadline = cfg?.heroHeadlineAr || activeProduct?.arName || activeProduct?.name || "";
  const displaySubheadline =
    cfg?.heroSubheadlineAr || activeProduct?.arDescription || activeProduct?.description || "";
  const hasOldPrice = Boolean(activeProduct?.oldPrice && activeProduct.oldPrice > unitPrice);

  return (
    <div className="pyjama-page" dir="rtl" lang="ar">
      <div className="pyjama-wrap">
        {isBuiltIn ? (
          promoImages.map((img, idx) => (
            <img
              key={img.src + idx}
              src={img.src}
              alt={img.alt}
              loading={img.lazy ? "lazy" : undefined}
              decoding={idx === 0 ? "sync" : "async"}
              fetchPriority={idx === 0 ? "high" : "low"}
            />
          ))
        ) : (
          <>
            {cfg?.promoBannerAr ? (
              <div
                style={{
                  background: "linear-gradient(90deg, #e0145f, #d4a73c)",
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
                decoding="sync"
                fetchPriority="high"
                style={{ width: "100%", maxHeight: 540, objectFit: "cover" }}
              />
            ) : null}

            <div
              style={{
                background: "linear-gradient(165deg, #fff5f8 0%, #ffe0ea 100%)",
                padding: "16px 15px 18px",
                borderBottom: "3px solid #d4a73c",
              }}
            >
              {cfg?.heroBadgeAr || activeProduct?.badge ? (
                <span
                  style={{
                    display: "inline-block",
                    background: "#e0145f",
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

              <h1
                style={{
                  margin: "0 0 6px",
                  fontSize: "23px",
                  fontWeight: 900,
                  lineHeight: 1.35,
                  color: "#14100c",
                }}
              >
                {displayHeadline}
              </h1>

              {displaySubheadline ? (
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: "14px",
                    lineHeight: 1.65,
                    color: "#432833",
                    fontWeight: 600,
                  }}
                >
                  {displaySubheadline}
                </p>
              ) : null}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                  marginBottom: activeProduct?.details?.length ? "12px" : 0,
                }}
              >
                <span
                  dir="ltr"
                  style={{
                    fontSize: "22px",
                    fontWeight: 900,
                    color: "#e0145f",
                    background: "#fff",
                    border: "2px solid #e0145f",
                    borderRadius: "10px",
                    padding: "4px 12px",
                  }}
                >
                  {unitPrice} DA
                </span>
                {hasOldPrice ? (
                  <del dir="ltr" style={{ fontSize: "15px", color: "#8b6b77", fontWeight: 700 }}>
                    {activeProduct?.oldPrice} DA
                  </del>
                ) : null}
              </div>

              {activeProduct?.details && activeProduct.details.length > 0 ? (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "grid",
                    gap: "6px",
                  }}
                >
                  {activeProduct.details.map(detail => (
                    <li
                      key={detail}
                      style={{
                        background: "#ffffffd9",
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

        <section id="pyjama-form" ref={sectionRef}>
          {isBuiltIn ? (
            <img
              className="pyjama-tt"
              src={activeProduct?.gallery?.[3] || "/images/pyjama/04-pyjama.jpg"}
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
            <div className="pyjama-ok" role="status">
              ✅ شكرا لك! تم استلام طلبك
              <br />
              سنتصل بك قريبا لتأكيد الطلب.
              <span className="pyjama-ok-meta">
                رقم الطلب: <b dir="ltr">{submittedOrder.orderNumber}</b>
                <br />
                {submittedOrder.offerLabel}
                {submittedOrder.size ? ` · المقاس ${submittedOrder.size}` : ""}
                {submittedOrder.colors ? ` · الألوان: ${submittedOrder.colors}` : ""}
                <br />
                {submittedOrder.wilaya} - {submittedOrder.commune}
                <br />
                المبلغ الإجمالي:{" "}
                <b dir="ltr">{new Intl.NumberFormat("fr-DZ").format(submittedOrder.total)} DA</b>
              </span>
            </div>
          ) : (
            <form
              ref={formRef}
              noValidate
              onSubmit={handleSubmit}
              onFocusCapture={ensureInitiateCheckout}
            >
              <input type="hidden" name="commune" value={resolvedCommune} />
              <input type="hidden" name="address" value={resolvedCommune} />
              <input type="hidden" name="color" value={colorsJoined || selectedOffer.label} />
              <input type="hidden" name="size" value={sizeForOrder} />
              <input type="hidden" name="note" value={computedNote} />
              <input type="hidden" name="delivery" value="home" />

              <div
                className="pyjama-offers"
                style={offers.length === 1 ? { gridTemplateColumns: "1fr" } : undefined}
              >
                {offers.map(offer => (
                  <label className="pyjama-offer-label" key={offer.id}>
                    <input
                      type="radio"
                      name="offer"
                      value={offer.value}
                      checked={selectedOfferId === offer.id}
                      onChange={() => handleOfferChange(offer.id)}
                    />
                    <span className="pyjama-offer-box">
                      {offer.label}
                      <b>{offer.price} DA</b>
                    </span>
                  </label>
                ))}
              </div>

              {colorOptions.length > 0 ? (
                <>
                  <div className="pyjama-lab">اختاري اللون (يمكنك اختيار أكثر من لون)</div>
                  <div className="pyjama-chips">
                    {colorOptions.map(colorItem => (
                      <label key={colorItem.value}>
                        <input
                          type="checkbox"
                          name="colorChoice"
                          value={colorItem.value}
                          checked={selectedColors.includes(colorItem.value)}
                          onChange={() => handleColorToggle(colorItem.value)}
                        />
                        <span>
                          <i style={{ background: colorItem.hex }} />
                          {colorItem.value}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}

              {sizeOptions.length > 0 ? (
                <>
                  <div className="pyjama-lab">اختاري المقاس</div>
                  <div className="pyjama-chips pyjama-sz">
                    {sizeOptions.map(sizeItem => (
                      <label key={sizeItem.value}>
                        <input
                          type="radio"
                          name="sizeChoice"
                          value={sizeItem.value}
                          checked={selectedSize === sizeItem.value}
                          onChange={() => handleSizeChange(sizeItem.value)}
                        />
                        <span>
                          {sizeItem.value}
                          {sizeItem.weight ? <small>{sizeItem.weight}</small> : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}

              <div className="pyjama-fl">
                <input
                  id="n"
                  name="customer"
                  autoComplete="name"
                  placeholder="الاسم و اللقب"
                  value={customer}
                  onChange={e => {
                    setCustomer(e.target.value);
                    if (validationError) setValidationError("");
                  }}
                />
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="7" r="5" />
                  <path d="M2 22c0-6 4-9 10-9s10 3 10 9z" />
                </svg>
              </div>

              <div className="pyjama-fl">
                <input
                  id="p"
                  ref={phoneInputRef}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="رقم الهاتف"
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value);
                    if (validationError) setValidationError("");
                  }}
                  onBlur={() => {
                    if (isValidDzPhone(phone)) {
                      identifyTikTokUser(normalizeDzPhone(phone), customer.trim());
                    }
                  }}
                />
                <svg viewBox="0 0 24 24">
                  <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1.02z" />
                </svg>
              </div>

              <div className="pyjama-fl">
                <select
                  id="w"
                  name="wilaya"
                  value={wilaya}
                  onChange={e => handleWilayaChange(e.target.value)}
                >
                  <option value="">الولاية</option>
                  {PYJAMA_WILAYAS.map(w => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
                <svg viewBox="0 0 24 24">
                  <path d="M12 1C7.6 1 4 4.4 4 8.7 4 14.5 12 23 12 23s8-8.5 8-14.3C20 4.4 16.4 1 12 1zm0 11a3 3 0 110-6 3 3 0 010 6z" />
                </svg>
              </div>

              <div className="pyjama-fl">
                <select
                  id="a"
                  name="communeSelect"
                  value={communeChoice}
                  onChange={e => {
                    setCommuneChoice(e.target.value);
                    if (e.target.value !== "__o") setCustomCommune("");
                    if (validationError) setValidationError("");
                  }}
                >
                  <option value="">البلدية</option>
                  {communes.map(communeName => (
                    <option key={communeName} value={communeName}>
                      {communeName}
                    </option>
                  ))}
                  {wilaya ? <option value="__o">بلدية أخرى</option> : null}
                </select>
                <svg viewBox="0 0 24 24">
                  <path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3z" />
                </svg>
              </div>

              {communeChoice === "__o" ? (
                <div className="pyjama-fl" id="ob">
                  <input
                    id="ao"
                    name="customCommune"
                    placeholder="اكتبي اسم البلدية"
                    value={customCommune}
                    onChange={e => {
                      setCustomCommune(e.target.value);
                      if (validationError) setValidationError("");
                    }}
                  />
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3z" />
                  </svg>
                </div>
              ) : null}

              {isBuiltIn ? (
                <div className="pyjama-row2">
                  <img
                    src={activeProduct?.gallery?.[4] || "/images/pyjama/05-pyjama.jpg"}
                    alt="تفاصيل البيجامة"
                    loading="lazy"
                  />
                  <img
                    src={activeProduct?.gallery?.[5] || "/images/pyjama/06-pyjama.jpg"}
                    alt="ألوان البيجامة الصيفية"
                    loading="lazy"
                  />
                </div>
              ) : customImages.length >= 5 ? (
                <div className="pyjama-row2">
                  <img src={customImages[3]} alt={displayHeadline} loading="lazy" />
                  <img src={customImages[4]} alt={displayHeadline} loading="lazy" />
                </div>
              ) : null}

              <div className="pyjama-summary" aria-live="polite">
                <div className="pyjama-summary-line">
                  <span>{selectedOffer.label}</span>
                  <span dir="ltr">{selectedOffer.price} DA</span>
                </div>
                <div className="pyjama-summary-line">
                  <span>{wilaya ? `التوصيل (${wilaya})` : "التوصيل"}</span>
                  <span dir="ltr">
                    {!wilaya ? "اختر الولاية" : shippingFee > 0 ? `${shippingFee} DA` : "حسب الولاية"}
                  </span>
                </div>
                <div className="pyjama-summary-line pyjama-summary-total">
                  <span>المجموع الإجمالي</span>
                  <span dir="ltr">{estimatedTotal} DA</span>
                </div>
              </div>

              {validationError || checkout.draftError ? (
                <div className="pyjama-err" role="alert">
                  {validationError || checkout.draftError}
                </div>
              ) : null}

              <button
                className="pyjama-btn pyjama-submit-btn"
                type="submit"
                disabled={checkout.pending}
              >
                {checkout.pending ? (
                  "⏳ جاري تسجيل الطلب..."
                ) : (
                  <>
                    <span>🛒</span> {ctaText} <span>👆</span>
                  </>
                )}
              </button>
            </form>
          )}
        </section>

        {!isBuiltIn && cfg?.reviews && cfg.reviews.length > 0 ? (
          <div style={{ padding: "14px 12px 4px", display: "grid", gap: "8px" }}>
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
                  boxShadow: "0 2px 8px #0001",
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

        <div className="pyjama-trust">
          {!isBuiltIn && cfg?.trustItems && cfg.trustItems.length > 0 ? (
            cfg.trustItems.slice(0, 3).map((item, idx) => (
              <div key={`${item.label}-${idx}`}>
                <b>{item.icon || ["🚚", "💵", "✅"][idx % 3]}</b>
                {item.label}
              </div>
            ))
          ) : (
            <>
              <div>
                <b>🚚</b>التوصيل لكل الولايات
              </div>
              <div>
                <b>💵</b>الدفع عند الاستلام
              </div>
              <div>
                <b>✅</b>جودة عالية
              </div>
            </>
          )}
        </div>
      </div>

      <div className={`pyjama-sticky${hideSticky ? " is-hidden" : ""}`}>
        <button className="pyjama-btn" type="button" onClick={handleStickyClick}>
          <span>🛒</span> {ctaText} <span>👆</span>
        </button>
      </div>
    </div>
  );
}

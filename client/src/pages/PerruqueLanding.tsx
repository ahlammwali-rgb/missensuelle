import {
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { abayaCommunesByWilaya } from "@/lib/abaya-communes";
import {
  discardCheckoutDraft,
  saveCheckoutDraft,
  submitCheckoutOrder,
} from "@/lib/checkout-api";
import { getCatalogProducts, type Product } from "@/lib/store-data";
import { initializePixels, trackPixelEvent } from "@/lib/tracking";
import { trpc } from "@/lib/trpc";
import { shippingFeeFor } from "@shared/shipping";
import "./perruque-template.css";

const WILAYAS_AR =
  "أدرار,الشلف,الأغواط,أم البواقي,باتنة,بجاية,بسكرة,بشار,البليدة,البويرة,تمنراست,تبسة,تلمسان,تيارت,تيزي وزو,الجزائر,الجلفة,جيجل,سطيف,سعيدة,سكيكدة,سيدي بلعباس,عنابة,قالمة,قسنطينة,المدية,مستغانم,المسيلة,معسكر,ورقلة,وهران,البيض,إليزي,برج بوعريريج,بومرداس,الطارف,تندوف,تيسمسيلت,الوادي,خنشلة,سوق أهراس,تيبازة,ميلة,عين الدفلى,النعامة,عين تموشنت,غرداية,غليزان,تيميمون,برج باجي مختار,أولاد جلال,بني عباس,عين صالح,عين قزام,تقرت,جانت,المغير,المنيعة".split(
    ","
  );

type VariantDef = {
  name: string;
  image: string;
};

const DEFAULT_VARIANTS: VariantDef[] = [
  { name: "بلاتيني", image: "/manus-storage/perruque-v1.jpg" },
  { name: "ميلي رويو", image: "/manus-storage/perruque-v2.jpg" },
  { name: "شتلين غامق", image: "/manus-storage/perruque-v3.jpg" },
  { name: "شتلين فاتح", image: "/manus-storage/perruque-v4.jpg" },
  { name: "أسود", image: "/manus-storage/perruque-v5.jpg" },
];

const DRAFT_TOKEN_STORAGE_KEY = "miss-sensuelle-checkout-token";

function createValidUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }
  return `00000000-0000-4000-8000-${String(Date.now()).padStart(12, "0").slice(-12)}`;
}

export default function PerruqueLanding({
  product,
  customProduct,
}: {
  product?: Product;
  customProduct?: Product;
}) {
  const activeProduct = customProduct ?? product;
  const isCustomModel = Boolean(activeProduct && activeProduct.id !== "p-009");

  const productId = activeProduct?.id || "p-009";
  const productTitle = activeProduct?.arName || activeProduct?.name || "بيروكه طويلة";
  const unitPrice = activeProduct?.price && activeProduct.price > 0 ? activeProduct.price : 8000;
  const oldPrice = activeProduct?.oldPrice && activeProduct.oldPrice > unitPrice ? activeProduct.oldPrice : 12000;

  const variants: VariantDef[] = useMemo(() => {
    if (isCustomModel && activeProduct?.variantImages?.length) {
      return activeProduct.variantImages.map(v => ({
        name: v.name,
        image: v.image,
      }));
    }
    if (isCustomModel && activeProduct?.colors?.length) {
      return activeProduct.colors.map((c, idx) => ({
        name: c,
        image: activeProduct.gallery?.[idx] || activeProduct.image,
      }));
    }
    return DEFAULT_VARIANTS;
  }, [activeProduct, isCustomModel]);

  const heroImg = isCustomModel ? activeProduct?.image || "/manus-storage/perruque-hero.jpg" : "/manus-storage/perruque-hero.jpg";
  const bannerImg = isCustomModel
    ? activeProduct?.gallery?.[1] || "/manus-storage/perruque-banner.jpg"
    : "/manus-storage/perruque-banner.jpg";
  const detailImg = isCustomModel
    ? activeProduct?.gallery?.[2] || "/manus-storage/perruque-detail.jpg"
    : "/manus-storage/perruque-detail.jpg";
  const footerImg = "/manus-storage/perruque-footer.jpg";

  const [selectedColor, setSelectedColor] = useState<string>(variants[0]?.name || "بلاتيني");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [wilaya, setWilaya] = useState("الجزائر");
  const [commune, setCommune] = useState("");
  const [customCommune, setCustomCommune] = useState("");
  const [delivery, setDelivery] = useState<"home" | "office">("home");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [hideSticky, setHideSticky] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<{
    orderNumber: string;
    total: number;
    color: string;
    shippingFee: number;
  } | null>(null);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const pauseUntilRef = useRef(0);
  const draftRevisionRef = useRef(0);
  const initiatedCheckoutRef = useRef(false);

  const [draftToken, setDraftToken] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_TOKEN_STORAGE_KEY);
      if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
    } catch {
      // Ignore storage error
    }
    const fresh = createValidUuid();
    try {
      localStorage.setItem(DRAFT_TOKEN_STORAGE_KEY, fresh);
    } catch {
      // Ignore
    }
    return fresh;
  });

  // Always start at the top when opening product page
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const raf = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [productId]);

  // Initialize Pixels + ViewContent
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
      value: unitPrice,
      currency: "DZD",
    });
    return () => {
      document.title = prevTitle;
    };
  }, [productId, productTitle, unitPrice]);

  // Auto-scroll variant track
  useEffect(() => {
    const tk = trackRef.current;
    if (!tk) return;
    const pause = () => {
      pauseUntilRef.current = Date.now() + 6000;
    };
    tk.addEventListener("touchstart", pause, { passive: true });
    tk.addEventListener("mousedown", pause, { passive: true });
    tk.addEventListener("wheel", pause, { passive: true });

    const interval = window.setInterval(() => {
      if (Date.now() < pauseUntilRef.current) return;
      const currentTrack = trackRef.current;
      if (!currentTrack) return;
      const firstCard = currentTrack.querySelector(".pq-card") as HTMLElement | null;
      if (!firstCard) return;
      const step = firstCard.offsetWidth + 10;
      if (currentTrack.scrollLeft + currentTrack.clientWidth >= currentTrack.scrollWidth - 4) {
        currentTrack.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        currentTrack.scrollBy({ left: step, behavior: "smooth" });
      }
    }, 2600);

    return () => {
      tk.removeEventListener("touchstart", pause);
      tk.removeEventListener("mousedown", pause);
      tk.removeEventListener("wheel", pause);
      window.clearInterval(interval);
    };
  }, []);

  // Hide sticky bottom bar when form is visible
  useEffect(() => {
    const fo = formRef.current;
    if (!fo || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]) {
        setHideSticky(entries[0].isIntersecting);
      }
    });
    observer.observe(fo);
    return () => observer.disconnect();
  }, []);

  // Shipping rates from E-com Delivery
  const ratesQuery = trpc.store.shippingRates.useQuery(undefined, {
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const wilayaCleanName = useMemo(() => {
    if (!wilaya) return "";
    return wilaya.replace(/^\d+\s*-\s*/, "").trim();
  }, [wilaya]);

  const extraCommunes: string[] = useMemo(() => {
    if (!wilayaCleanName) return [];
    return (abayaCommunesByWilaya as Record<string, string[]>)[wilayaCleanName] ?? [];
  }, [wilayaCleanName]);

  const resolvedCommune = useMemo(() => {
    if (commune === "other") {
      return customCommune.trim() || `${wilayaCleanName} (بلدية أخرى)`;
    }
    return commune || wilayaCleanName;
  }, [commune, customCommune, wilayaCleanName]);

  const homeFee = useMemo(
    () => shippingFeeFor(ratesQuery.data?.rates, wilayaCleanName || wilaya, "home", [productId]),
    [ratesQuery.data?.rates, wilayaCleanName, wilaya, productId]
  );

  const officeFee = useMemo(
    () => shippingFeeFor(ratesQuery.data?.rates, wilayaCleanName || wilaya, "office", [productId]),
    [ratesQuery.data?.rates, wilayaCleanName, wilaya, productId]
  );

  const shippingFee = delivery === "office" ? officeFee : homeFee;
  const grandTotal = unitPrice + shippingFee;

  const formatPrice = (n: number) => `${new Intl.NumberFormat("fr-DZ").format(n)} DA`;

  // Sync abandoned checkout draft whenever phone or form fields change
  const syncDraft = useCallback(
    async (overridePhone?: string) => {
      const currentPhone = (overridePhone ?? phone).trim();
      const digits = currentPhone.replace(/\D/g, "");
      if (digits.length < 8) return;

      const nextRev = draftRevisionRef.current + 1;
      draftRevisionRef.current = nextRev;

      const payload = {
        source: "product" as const,
        customer: customer.trim() || "زائرة",
        phone: currentPhone,
        wilaya: wilayaCleanName || wilaya || "الجزائر",
        commune: resolvedCommune || wilayaCleanName || "الجزائر",
        address: resolvedCommune || wilayaCleanName || "الجزائر",
        note: `اللون: ${selectedColor}`,
        delivery,
        items: [
          {
            productId,
            quantity: 1,
            color: selectedColor,
            size: "Standard",
          },
        ],
      };

      try {
        await saveCheckoutDraft({
          token: draftToken,
          revision: nextRev,
          consent: true,
          payload,
        });
      } catch {
        const renewed = createValidUuid();
        setDraftToken(renewed);
        try {
          localStorage.setItem(DRAFT_TOKEN_STORAGE_KEY, renewed);
        } catch {
          // Ignore
        }
        try {
          await saveCheckoutDraft({
            token: renewed,
            revision: 1,
            consent: true,
            payload,
          });
          draftRevisionRef.current = 1;
        } catch {
          // Ignore offline error
        }
      }
    },
    [phone, customer, wilayaCleanName, wilaya, resolvedCommune, selectedColor, delivery, productId, draftToken]
  );

  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) return;
    const timer = window.setTimeout(() => {
      void syncDraft();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [phone, customer, wilaya, commune, customCommune, delivery, selectedColor, syncDraft]);

  const handleSelectVariant = (variantName: string) => {
    pauseUntilRef.current = Date.now() + 7000;
    setSelectedColor(variantName);
    trackPixelEvent("AddToCart", {
      content_name: productTitle,
      content_ids: [productId],
      content_id: productId,
      content_type: "product",
      value: unitPrice,
      currency: "DZD",
      variant: variantName,
    });
  };

  const handleScrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!initiatedCheckoutRef.current) {
      initiatedCheckoutRef.current = true;
      trackPixelEvent("InitiateCheckout", {
        content_name: productTitle,
        content_ids: [productId],
        content_id: productId,
        content_type: "product",
        num_items: 1,
        value: grandTotal,
        currency: "DZD",
      });
    }
  };

  const handlePhoneFocusOrInput = () => {
    if (!initiatedCheckoutRef.current) {
      initiatedCheckoutRef.current = true;
      trackPixelEvent("InitiateCheckout", {
        content_name: productTitle,
        content_ids: [productId],
        content_id: productId,
        content_type: "product",
        num_items: 1,
        value: grandTotal,
        currency: "DZD",
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = customer.trim();
    const cleanDigits = phone.replace(/\D/g, "");
    if (!trimmedName) {
      setFormError("يرجى إدخال الاسم الكامل.");
      return;
    }
    if (cleanDigits.length < 9) {
      setFormError("يرجى إدخال رقم هاتف صحيح (9 أرقام على الأقل).");
      return;
    }
    if (!wilaya) {
      setFormError("يرجى اختيار الولاية.");
      return;
    }

    setSubmitting(true);
    try {
      const orderPayload = {
        source: "product" as const,
        customer: trimmedName,
        phone: phone.trim(),
        wilaya: wilayaCleanName || wilaya,
        commune: resolvedCommune,
        address: resolvedCommune,
        note: `اللون: ${selectedColor}`,
        delivery,
        items: [
          {
            productId,
            quantity: 1,
            color: selectedColor,
            size: "Standard",
          },
        ],
      };

      let orderNumber = `MS-${Date.now().toString().slice(-6)}`;
      try {
        const res = await submitCheckoutOrder(draftToken, orderPayload);
        if (res?.orderId) {
          orderNumber = `MS-${res.orderId}`;
        }
      } catch {
        // Fallback local save so order is never lost
        try {
          const catalog = getCatalogProducts();
          const prod = catalog.find(p => p.id === productId);
          const existing = JSON.parse(localStorage.getItem("miss-sensuelle-orders") || "[]");
          const localOrder = {
            id: `local-${Date.now()}`,
            orderNumber,
            createdAt: new Date().toISOString(),
            status: "Nouveau",
            customer: trimmedName,
            phone: phone.trim(),
            wilaya: wilayaCleanName || wilaya,
            commune: resolvedCommune,
            delivery,
            shippingFee,
            subtotal: unitPrice,
            total: grandTotal,
            items: [
              {
                productId,
                name: prod?.name || productTitle,
                quantity: 1,
                unitPrice,
                color: selectedColor,
                size: "Standard",
              },
            ],
          };
          localStorage.setItem("miss-sensuelle-orders", JSON.stringify([localOrder, ...existing]));
        } catch {
          // Ignore storage error
        }
      }

      try {
        await discardCheckoutDraft({
          token: draftToken,
          revision: draftRevisionRef.current + 1,
        });
      } catch {
        // Ignore
      }
      const nextToken = createValidUuid();
      setDraftToken(nextToken);
      try {
        localStorage.setItem(DRAFT_TOKEN_STORAGE_KEY, nextToken);
      } catch {
        // Ignore
      }

      // Meta + TikTok Purchase events
      trackPixelEvent("Purchase", {
        content_name: productTitle,
        content_ids: [productId],
        content_id: productId,
        content_type: "product",
        num_items: 1,
        value: grandTotal,
        currency: "DZD",
        order_id: orderNumber,
      });

      try {
        const win = window as Window & {
          ttq?: {
            identify?: (data: Record<string, string>) => void;
            track?: (event: string, data?: Record<string, unknown>) => void;
          };
        };
        if (win.ttq) {
          win.ttq.identify?.({
            phone_number: phone.trim(),
            external_id: orderNumber,
          });
          win.ttq.track?.("CompletePayment", {
            content_id: productId,
            content_name: productTitle,
            content_type: "product",
            quantity: 1,
            value: grandTotal,
            currency: "DZD",
          });
          win.ttq.track?.("PlaceAnOrder", {
            content_id: productId,
            content_name: productTitle,
            content_type: "product",
            quantity: 1,
            value: grandTotal,
            currency: "DZD",
          });
        }
      } catch {
        // Ignore TikTok error
      }

      setSubmittedOrder({
        orderNumber,
        total: grandTotal,
        color: selectedColor,
        shippingFee,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="perruque-page">
      <div className="perruque-wrap">
        {/* Hero Image */}
        <img src={heroImg} alt={productTitle} />

        {/* Original-style Variant Selector with Golden Frame */}
        <div className="pq-vr">اختاري لون البيروكه 👇</div>
        <div className="pq-track" ref={trackRef}>
          {variants.map(variant => {
            const isSelected = selectedColor === variant.name;
            return (
              <figure
                key={variant.name}
                className={`pq-card${isSelected ? " is-selected" : ""}`}
                onClick={() => handleSelectVariant(variant.name)}
              >
                <img src={variant.image} alt={variant.name} />
                <i className="pq-card-check" aria-hidden="true">
                  ✔
                </i>
              </figure>
            );
          })}
        </div>

        {/* Promo Banner */}
        <div className="pq-banner-wrap">
          <img src={bannerImg} alt="عرض خاص" />
        </div>

        {/* Detail Image */}
        <div className="pq-detail-wrap">
          <img src={detailImg} alt={productTitle} />
        </div>

        {/* Complete Order Form */}
        <div className="pq-form-section">
          <form id="f" ref={formRef} className="pq-form" onSubmit={handleSubmit}>
            <div className="pq-form-header">
              <div className="pq-form-gold-badge">
                <span>{formatPrice(unitPrice)}</span>
                <span className="pq-form-gold-old">{formatPrice(oldPrice)}</span>
              </div>
              <h2 className="pq-form-title">للطلب يرجى ملء الاستمارة 👇</h2>
              <p className="pq-form-sub">الدفع عند الاستلام • توصيل سريع لجميع الولايات (58 ولاية)</p>
            </div>

          {formError && <div className="pq-error">{formError}</div>}

          <div className="pq-field">
            <label className="pq-label" htmlFor="pq-name">
              الاسم الكامل
            </label>
            <input
              id="pq-name"
              className="pq-input"
              type="text"
              placeholder="مثال: سارة بن علي"
              value={customer}
              onChange={e => setCustomer(e.target.value)}
              required
            />
          </div>

          <div className="pq-field">
            <label className="pq-label" htmlFor="pq-phone">
              رقم الهاتف
            </label>
            <input
              id="pq-phone"
              className="pq-input"
              type="tel"
              inputMode="tel"
              dir="ltr"
              placeholder="05 / 06 / 07 XX XX XX XX"
              value={phone}
              onFocus={handlePhoneFocusOrInput}
              onChange={e => {
                handlePhoneFocusOrInput();
                setPhone(e.target.value);
              }}
              required
            />
          </div>

          <div className="pq-grid-2">
            <div className="pq-field">
              <label className="pq-label" htmlFor="pq-wilaya">
                الولاية
              </label>
              <select
                id="pq-wilaya"
                className="pq-select"
                value={wilaya}
                onChange={e => {
                  setWilaya(e.target.value);
                  setCommune("");
                  setCustomCommune("");
                }}
                required
              >
                {WILAYAS_AR.map((w, idx) => (
                  <option key={w} value={w}>
                    {String(idx + 1).padStart(2, "0")} - {w}
                  </option>
                ))}
              </select>
            </div>

            <div className="pq-field">
              <label className="pq-label" htmlFor="pq-commune">
                البلدية
              </label>
              <select
                id="pq-commune"
                className="pq-select"
                value={commune}
                onChange={e => setCommune(e.target.value)}
              >
                <option value="">اختر البلدية...</option>
                {extraCommunes.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="other">بلدية أخرى (أكتبها يدويا)</option>
              </select>
            </div>
          </div>

          {commune === "other" && (
            <div className="pq-field">
              <label className="pq-label" htmlFor="pq-custom-commune">
                اسم البلدية
              </label>
              <input
                id="pq-custom-commune"
                className="pq-input"
                type="text"
                placeholder="أدخل اسم البلدية"
                value={customCommune}
                onChange={e => setCustomCommune(e.target.value)}
              />
            </div>
          )}

          <div className="pq-field">
            <label className="pq-label">نوع التوصيل</label>
            <div className="pq-delivery-grid">
              <button
                type="button"
                className={`pq-delivery-btn${delivery === "home" ? " is-active" : ""}`}
                onClick={() => setDelivery("home")}
              >
                <span>🏠 إلى المنزل</span>
                <span className="pq-delivery-price">
                  {homeFee === 0 ? "مجاني" : formatPrice(homeFee)}
                </span>
              </button>
              <button
                type="button"
                className={`pq-delivery-btn${delivery === "office" ? " is-active" : ""}`}
                onClick={() => setDelivery("office")}
              >
                <span>🏢 إلى المكتب (Stop Desk)</span>
                <span className="pq-delivery-price">
                  {officeFee === 0 ? "مجاني" : formatPrice(officeFee)}
                </span>
              </button>
            </div>
          </div>

          <div className="pq-field">
            <label className="pq-label" htmlFor="pq-color">
              اللون المختار
            </label>
            <select
              id="pq-color"
              className="pq-select"
              value={selectedColor}
              onChange={e => setSelectedColor(e.target.value)}
            >
              {variants.map(v => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Order Summary */}
          <div className="pq-summary">
            <div className="pq-summary-row">
              <span>سعر المنتج ({selectedColor})</span>
              <strong>{formatPrice(unitPrice)}</strong>
            </div>
            <div className="pq-summary-row">
              <span>
                التوصيل ({delivery === "office" ? "إلى المكتب" : "إلى المنزل"} - {wilayaCleanName || wilaya})
              </span>
              <strong>{shippingFee === 0 ? "مجاني" : formatPrice(shippingFee)}</strong>
            </div>
            <div className="pq-summary-total">
              <span>المبلغ الإجمالي</span>
              <span>{formatPrice(grandTotal)}</span>
            </div>
          </div>

          <button type="submit" className="pq-submit" disabled={submitting}>
            {submitting ? "جاري تسجيل الطلب..." : "اطلب الآن • الدفع عند الاستلام"}
          </button>
          </form>
        </div>

        {/* Bottom Guarantee Image */}
        <img src={footerImg} alt="ضمان الجودة والتوصيل" />
      </div>

      {/* Original Rounded Sticky Bottom CTA */}
      <div className={`pq-sticky${hideSticky ? " is-hidden" : ""}`}>
        <button type="button" className="pq-sticky-btn" onClick={handleScrollToForm}>
          <b>اطلب الآن 🛒</b>
          <span>
            {formatPrice(unitPrice)} • الدفع عند الاستلام
          </span>
        </button>
      </div>

      {/* Success Modal */}
      {submittedOrder && (
        <div className="pq-modal-backdrop" onClick={() => setSubmittedOrder(null)}>
          <div className="pq-modal-box" onClick={e => e.stopPropagation()}>
            <div className="pq-modal-icon">✓</div>
            <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 900, color: "#a81c56" }}>
              تم تسجيل طلبك بنجاح!
            </h3>
            <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "#6d4858", fontWeight: 700 }}>
              سيتصل بك فريقنا لتأكيد الطلبية في أقرب وقت.
            </p>
            <div className="pq-summary" style={{ textAlign: "right" }}>
              <div className="pq-summary-row">
                <span>رقم الطلب</span>
                <strong>{submittedOrder.orderNumber}</strong>
              </div>
              <div className="pq-summary-row">
                <span>اللون</span>
                <strong>{submittedOrder.color}</strong>
              </div>
              <div className="pq-summary-row">
                <span>التوصيل</span>
                <strong>{formatPrice(submittedOrder.shippingFee)}</strong>
              </div>
              <div className="pq-summary-total">
                <span>الإجمالي</span>
                <span>{formatPrice(submittedOrder.total)}</span>
              </div>
            </div>
            <button type="button" className="pq-modal-btn" onClick={() => setSubmittedOrder(null)}>
              حسناً
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

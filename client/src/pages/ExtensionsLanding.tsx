import {
  FormEvent,
  MouseEvent,
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
import { getCatalogProducts, normalizeExtensionShadeName, type Product } from "@/lib/store-data";
import { initializePixels, trackPixelEvent } from "@/lib/tracking";
import { trpc } from "@/lib/trpc";
import { shippingFeeFor } from "@shared/shipping";
import "./extensions-template.css";

const WILAYAS_AR =
  "أدرار,الشلف,الأغواط,أم البواقي,باتنة,بجاية,بسكرة,بشار,البليدة,البويرة,تمنراست,تبسة,تلمسان,تيارت,تيزي وزو,الجزائر,الجلفة,جيجل,سطيف,سعيدة,سكيكدة,سيدي بلعباس,عنابة,قالمة,قسنطينة,المدية,مستغانم,المسيلة,معسكر,ورقلة,وهران,البيض,إليزي,برج بوعريريج,بومرداس,الطارف,تندوف,تيسمسيلت,الوادي,خنشلة,سوق أهراس,تيبازة,ميلة,عين الدفلى,النعامة,عين تموشنت,غرداية,غليزان,تيميمون,برج باجي مختار,أولاد جلال,بني عباس,عين صالح,عين قزام,تقرت,جانت,المغير,المنيعة".split(
    ","
  );

type VariantDef = {
  name: string;
  slideImg: string;
  swatchImg: string;
  hex?: string;
};

const DEFAULT_VARIANTS: VariantDef[] = [
  {
    name: "أسود طبيعي",
    slideImg: "/manus-storage/ext-vrait-2.jpg",
    swatchImg: "/manus-storage/ext-vrait-15.jpg",
  },
  {
    name: "بني غامق",
    slideImg: "/manus-storage/ext-vrait-3.jpg",
    swatchImg: "/manus-storage/ext-vrait-16.jpg",
  },
  {
    name: "شاتان فاتح",
    slideImg: "/manus-storage/ext-vrait-4.jpg",
    swatchImg: "/manus-storage/ext-vrait-17.jpg",
  },
  {
    name: "شاتين روكس",
    slideImg: "/manus-storage/ext-vrait-5.jpg",
    swatchImg: "/manus-storage/ext-vrait-18.jpg",
  },
  {
    name: "أشقر فاتح",
    slideImg: "/manus-storage/ext-vrait-6.jpg",
    swatchImg: "/manus-storage/ext-vrait-19.jpg",
  },
  {
    name: "أسود بالياج رمادي",
    slideImg: "/manus-storage/ext-vrait-7.jpg",
    swatchImg: "/manus-storage/ext-vrait-20.jpg",
  },
];

const FEATURE_ICONS = [
  "/manus-storage/ext-vrait-8.jpg",
  "/manus-storage/ext-vrait-9.jpg",
  "/manus-storage/ext-vrait-10.jpg",
  "/manus-storage/ext-vrait-11.jpg",
];

const PACK_PRICE = 4700;
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

export default function ExtensionsLanding({
  product,
  customProduct,
}: {
  product?: Product;
  customProduct?: Product;
  quantity?: number;
}) {
  const passedProduct = customProduct || product;
  const activeProduct = useMemo(() => {
    if (passedProduct) return passedProduct;
    return getCatalogProducts().find(p => p.id === "p-005");
  }, [passedProduct]);

  const cfg = activeProduct?.landingConfig;
  const productId = activeProduct?.id || "p-005";
  const isCustomModel = Boolean(passedProduct && (passedProduct.id !== "p-005" || cfg));
  const productTitle = isCustomModel
    ? (activeProduct?.arName || activeProduct?.name || "Miss Sensuelle")
    : (activeProduct?.name || "Extensions Cheveux Naturel");
  const hasPackOffer = !isCustomModel || Boolean(activeProduct?.packPrice && activeProduct.packPrice > 0);
  const billedQty = hasPackOffer ? 2 : 1;
  const packPrice = hasPackOffer
    ? (activeProduct?.packPrice || activeProduct?.price || PACK_PRICE)
    : (activeProduct?.price || PACK_PRICE);

  const variants: VariantDef[] = useMemo(() => {
    if (isCustomModel) {
      if (passedProduct?.variantImages && passedProduct.variantImages.length > 0) {
        return passedProduct.variantImages.map((v, idx) => ({
          name: normalizeExtensionShadeName(v.name),
          slideImg: v.image || passedProduct?.image || "",
          swatchImg: v.image || passedProduct?.image || "",
          hex: cfg?.colorSwatches?.[idx]?.hex,
        }));
      }
      if (cfg?.colorSwatches && cfg.colorSwatches.length > 0) {
        return cfg.colorSwatches.map((sw, idx) => {
          const img = passedProduct?.gallery?.[idx] || passedProduct?.image || "";
          return {
            name: normalizeExtensionShadeName(sw.name),
            slideImg: img,
            swatchImg: img,
            hex: sw.hex,
          };
        });
      }
      if (passedProduct?.colors && passedProduct.colors.length > 0) {
        return passedProduct.colors.map((c, idx) => {
          const img = passedProduct?.gallery?.[idx] || passedProduct?.image || "";
          return { name: normalizeExtensionShadeName(c), slideImg: img, swatchImg: img };
        });
      }
      return [];
    }
    return DEFAULT_VARIANTS;
  }, [isCustomModel, passedProduct, cfg?.colorSwatches]);

  const dynamicSizes = isCustomModel && cfg?.sizes ? cfg.sizes.map(s => s.label) : [];
  const [selectedSize, setSelectedSize] = useState(dynamicSizes[0] ?? "");
  useEffect(() => {
    setSelectedSize(dynamicSizes[0] ?? "");
  }, [productId]);

  const heroImage = (isCustomModel && passedProduct?.image) || "/manus-storage/ext-vrait-1.jpg";
  const beforeAfterImage =
    isCustomModel ? (passedProduct?.gallery?.[0] || "") : "/manus-storage/ext-vrait-12.jpg";
  const detailImage =
    isCustomModel ? (passedProduct?.gallery?.[1] || "") : "/manus-storage/ext-vrait-13.jpg";
  const ctaImage = isCustomModel ? "" : "/manus-storage/ext-vrait-14.jpg";

  const [c1, setC1] = useState<string | null>(null);
  const [c2, setC2] = useState<string | null>(null);
  const nextSlotRef = useRef<1 | 2>(1);

  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [wilaya, setWilaya] = useState("");
  const [commune, setCommune] = useState("");
  const [delivery, setDelivery] = useState<"home" | "office">("home");

  const [colorError, setColorError] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [hideSticky, setHideSticky] = useState(false);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const pauseUntilRef = useRef<number>(0);
  const formRef = useRef<HTMLFormElement | null>(null);
  const checkoutTrackedRef = useRef(false);

  // Live E-com Delivery shipping rates by Wilaya (Domicile vs Stop Desk)
  const ratesQuery = trpc.store.shippingRates.useQuery(undefined, {
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const homeShippingFee = useMemo(() => {
    if (!wilaya) return 0;
    return shippingFeeFor(ratesQuery.data?.rates, wilaya, "home", [productId]);
  }, [ratesQuery.data?.rates, wilaya, productId]);

  const officeShippingFee = useMemo(() => {
    if (!wilaya) return 0;
    return shippingFeeFor(ratesQuery.data?.rates, wilaya, "office", [productId]);
  }, [ratesQuery.data?.rates, wilaya, productId]);

  const shippingFee = delivery === "office" ? officeShippingFee : homeShippingFee;
  const grandTotal = packPrice + shippingFee;

  // Always open at the very top of the page (never at the bottom form)
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
  }, [productId]);

  // Initialize Meta & TikTok Pixels + fire ViewContent on mount
  useEffect(() => {
    const prevTitle = document.title;
    document.title = isCustomModel ? (activeProduct?.arName || activeProduct?.name || "Miss Sensuelle") : "إكستنشن الشعر";
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
      value: packPrice,
      currency: "DZD",
    });
    return () => {
      document.title = prevTitle;
    };
  }, [productId, productTitle, packPrice]);

  // Auto-scroll slider every 2300ms (pauses 6000ms on touch/mouse/wheel)
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
      const firstFig = currentTrack.querySelector("figure") as HTMLElement | null;
      if (!firstFig) return;
      const step = firstFig.offsetWidth + 8;
      if (currentTrack.scrollLeft + currentTrack.clientWidth >= currentTrack.scrollWidth - 4) {
        currentTrack.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        currentTrack.scrollBy({ left: step, behavior: "smooth" });
      }
    }, 2300);

    return () => {
      tk.removeEventListener("touchstart", pause);
      tk.removeEventListener("mousedown", pause);
      tk.removeEventListener("wheel", pause);
      window.clearInterval(interval);
    };
  }, []);

  // Hide sticky bottom bar when form #f is visible on screen
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

  const wilayaCleanName = useMemo(() => {
    if (!wilaya) return "";
    return wilaya.replace(/^\d+\s*-\s*/, "").trim();
  }, [wilaya]);

  const extraCommunes: string[] = useMemo(() => {
    if (!wilayaCleanName) return [];
    const communesMap = abayaCommunesByWilaya as Record<string, string[]>;
    return (
      communesMap[wilayaCleanName] ??
      (wilayaCleanName === "تقرت" ? communesMap["توقرت"] : undefined) ??
      []
    );
  }, [wilayaCleanName]);

  const resolvedCommune = useMemo(() => {
    return commune || wilayaCleanName;
  }, [commune, wilayaCleanName]);

  const chosenSummary = useMemo(() => {
    if (variants.length === 0) return cfg?.offer1LabelAr || productTitle;
    const first = c1 || variants[0]?.name || "";
    if (!hasPackOffer) return first;
    const second = c2 || first;
    return `1: ${first} + 2: ${second}`;
  }, [c1, c2, variants, hasPackOffer, cfg?.offer1LabelAr, productTitle]);

  // Persistent session token & revision counter for Abandoned Checkouts
  const tokenRef = useRef<string>("");
  const revisionRef = useRef<number>(0);

  const ensureToken = useCallback((): string => {
    if (tokenRef.current) return tokenRef.current;
    try {
      const stored =
        window.sessionStorage.getItem(DRAFT_TOKEN_STORAGE_KEY) ||
        window.localStorage.getItem(DRAFT_TOKEN_STORAGE_KEY);
      if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)) {
        tokenRef.current = stored;
        return stored;
      }
    } catch {}
    const created = createValidUuid();
    tokenRef.current = created;
    try {
      window.sessionStorage.setItem(DRAFT_TOKEN_STORAGE_KEY, created);
      window.localStorage.setItem(DRAFT_TOKEN_STORAGE_KEY, created);
    } catch {}
    return created;
  }, []);

  const latestDraftPayloadRef = useRef({
    customer,
    phone,
    wilaya,
    resolvedCommune,
    delivery,
    chosenSummary,
    productId,
    orderNumber,
    billedQty,
    selectedSize,
    hasPackOffer,
  });
  latestDraftPayloadRef.current = {
    customer,
    phone,
    wilaya,
    resolvedCommune,
    delivery,
    chosenSummary,
    productId,
    orderNumber,
    billedQty,
    selectedSize,
    hasPackOffer,
  };

  const nextRevision = useCallback(() => {
    // Toujours croissant, même après un rechargement de page (sinon le serveur refuse le brouillon)
    const timeBased = Math.floor((Date.now() - 1_700_000_000_000) / 100);
    revisionRef.current = Math.max(revisionRef.current + 1, timeBased);
    return revisionRef.current;
  }, []);

  const resetToken = useCallback(() => {
    tokenRef.current = "";
    try {
      window.sessionStorage.removeItem(DRAFT_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(DRAFT_TOKEN_STORAGE_KEY);
    } catch {}
  }, []);

  const persistDraftNow = useCallback(
    (keepalive = false, retried = false) => {
      const cur = latestDraftPayloadRef.current;
      if (cur.orderNumber) return;
      if (!cur.customer.trim() && !cur.phone.trim() && !cur.wilaya) return;
      const token = ensureToken();
      const revision = nextRevision();
      void saveCheckoutDraft(
        {
          token,
          revision,
          consent: true,
          payload: {
            source: "product",
            customer: cur.customer.trim() || "Cliente",
            phone: cur.phone.trim(),
            wilaya: cur.wilaya,
            commune: cur.resolvedCommune,
            address: cur.resolvedCommune || cur.wilaya,
            delivery: cur.delivery,
            note: `${cur.hasPackOffer ? "عرض ثنائي" : "طلب"} (${cur.chosenSummary}) — ${
              cur.delivery === "office" ? "المكتب Stop Desk" : "توصيل للمنزل"
            }`,
            items: [
              {
                productId: cur.productId,
                quantity: cur.billedQty,
                color: cur.chosenSummary,
                size: cur.selectedSize || "Standard",
              },
            ],
          },
        },
        keepalive
      )
        .then(result => {
          // Jeton déjà utilisé par une commande validée/annulée → nouveau jeton et nouvel essai
          if (result && !result.accepted && !retried && !keepalive) {
            resetToken();
            persistDraftNow(false, true);
          }
        })
        .catch(() => {});
    },
    [ensureToken, nextRevision, resetToken]
  );

  // Debounced draft save on every form change
  useEffect(() => {
    if (orderNumber) return;
    if (!customer.trim() && !phone.trim() && !wilaya) return;
    const timer = window.setTimeout(() => {
      persistDraftNow(false);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    customer,
    phone,
    wilaya,
    resolvedCommune,
    delivery,
    chosenSummary,
    orderNumber,
    persistDraftNow,
  ]);

  // Flush abandoned checkout draft with keepalive=true if the user closes tab or switches app
  useEffect(() => {
    const onPageHide = () => persistDraftNow(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistDraftNow(true);
      }
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [persistDraftNow]);

  const triggerInitiateCheckoutOnce = () => {
    if (checkoutTrackedRef.current) return;
    checkoutTrackedRef.current = true;
    trackPixelEvent("InitiateCheckout", {
      content_name: productTitle,
      content_ids: [productId],
      content_id: productId,
      content_type: "product",
      value: grandTotal,
      num_items: 2,
      currency: "DZD",
    });
  };

  const scrollToForm = (e?: MouseEvent<HTMLAnchorElement>) => {
    e?.preventDefault();
    triggerInitiateCheckoutOnce();
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleTrackFigureClick = (shadeName: string) => {
    const slot: 1 | 2 = !c1 ? 1 : !c2 ? 2 : nextSlotRef.current;
    if (slot === 1) {
      setC1(shadeName);
      nextSlotRef.current = 2;
    } else {
      setC2(shadeName);
      nextSlotRef.current = 1;
    }
    setColorError(false);
    trackPixelEvent("AddToCart", {
      content_name: `${productTitle} - ${shadeName}`,
      content_ids: [productId],
      content_id: productId,
      content_type: "product",
      value: packPrice,
      currency: "DZD",
    });
  };

  const handleSelectColor1 = (shadeName: string) => {
    setC1(shadeName);
    setColorError(false);
    trackPixelEvent("AddToCart", {
      content_name: `${productTitle} (1) - ${shadeName}`,
      content_ids: [productId],
      content_id: productId,
      content_type: "product",
      value: packPrice,
      currency: "DZD",
    });
  };

  const handleSelectColor2 = (shadeName: string) => {
    setC2(shadeName);
    setColorError(false);
    trackPixelEvent("AddToCart", {
      content_name: `${productTitle} (2 مجاناً) - ${shadeName}`,
      content_ids: [productId],
      content_id: productId,
      content_type: "product",
      value: packPrice,
      currency: "DZD",
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");

    if (variants.length > 0 && ((hasPackOffer && (!c1 || !c2)) || (!hasPackOffer && !c1))) {
      setColorError(true);
      document.getElementById("c1")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (dynamicSizes.length > 0 && !selectedSize) {
      setSubmitError("يرجى اختيار المقاس.");
      return;
    }

    const cleanPhone = phone.replace(/[\s\-.()]/g, "");
    if (!customer.trim()) {
      setSubmitError("يرجى إدخال الاسم الكامل.");
      return;
    }
    if (!/^(?:\+?213|0)[567]\d{8}$/.test(cleanPhone)) {
      setSubmitError("يرجى إدخال رقم هاتف جزائري صحيح (مثال: 0550123456).");
      return;
    }
    if (!wilaya) {
      setSubmitError("يرجى اختيار الولاية.");
      return;
    }
    if (!commune) {
      setSubmitError("يرجى اختيار البلدية.");
      return;
    }

    setSubmitting(true);
    triggerInitiateCheckoutOnce();

    try {
      const finalColor =
        variants.length > 0
          ? hasPackOffer
            ? `${c1} + ${c2}`
            : c1 || variants[0]?.name || productTitle
          : cfg?.offer1LabelAr || productTitle;
      const finalSize = selectedSize || "Standard";
      const finalNote = isCustomModel
        ? `${hasPackOffer ? (cfg?.offer2LabelAr || "عرض قطعتين") : (cfg?.offer1LabelAr || "قطعة واحدة")}${finalColor ? ` · ${finalColor}` : ""}${selectedSize ? ` · ${selectedSize}` : ""}`
        : `1 achetée + 2ème gratuite`;
      const finalCommune = resolvedCommune;
      const token = ensureToken();

      const result = await submitCheckoutOrder(token, {
        source: "product",
        customer: customer.trim(),
        phone: cleanPhone,
        wilaya,
        commune: finalCommune,
        address: finalCommune,
        delivery,
        note: finalNote,
        items: [
          {
            productId,
            quantity: billedQty,
            color: finalColor,
            size: finalSize,
          },
        ],
      });

      const finalTotal = result.total || grandTotal;

      const createdOrder = {
        id: result.orderNumber,
        createdAt: new Date().toISOString(),
        customer: customer.trim(),
        phone: cleanPhone,
        productId,
        product: `${productTitle} × ${billedQty} (${finalColor})`,
        quantity: billedQty,
        total: finalTotal,
        color: finalColor,
        size: finalSize,
        delivery,
        wilaya,
        commune: finalCommune,
        address: finalCommune,
        note: finalNote,
        status: "nouvelle" as const,
      };

      try {
        const raw = localStorage.getItem("miss-sensuelle-orders");
        const existing = raw ? JSON.parse(raw) : [];
        if (Array.isArray(existing)) {
          localStorage.setItem(
            "miss-sensuelle-orders",
            JSON.stringify([createdOrder, ...existing])
          );
        }
        window.sessionStorage.removeItem(DRAFT_TOKEN_STORAGE_KEY);
        window.localStorage.removeItem(DRAFT_TOKEN_STORAGE_KEY);
        tokenRef.current = "";
      } catch {
        // Ignore storage error
      }

      // Fire Purchase + CompletePayment + PlaceAnOrder + SubmitForm on TikTok & Meta Pixels
      trackPixelEvent("Purchase", {
        content_name: `${productTitle} (${finalColor})`,
        content_ids: [productId],
        content_id: productId,
        content_type: "product",
        value: finalTotal,
        quantity: billedQty,
        num_items: billedQty,
        currency: "DZD",
        order_id: result.orderNumber,
        event_id: `purchase_${result.orderNumber}`,
        phone: cleanPhone,
        customer: customer.trim(),
      });

      setOrderNumber(result.orderNumber);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ext-vrait-root" dir="rtl" lang="ar">
      <div className="w">
        <div className="hero2 fd4">
          <img src={heroImage} alt={productTitle} />
          {!isCustomModel ? (
            <div className="pl">
              <b>شعر طبيعي 60%</b>
              <span>يتلیس ويتبوكل</span>
            </div>
          ) : (
            <div style={{ padding: "14px 16px 12px", background: "#fff", textAlign: "center" }}>
              {cfg?.heroBadgeAr || activeProduct?.badge ? (
                <span style={{ display: "inline-block", background: "#e0145f", color: "#fff", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                  {cfg?.heroBadgeAr || activeProduct?.badge}
                </span>
              ) : null}
              <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: "#14100c" }}>
                {cfg?.heroHeadlineAr || productTitle}
              </h1>
              {cfg?.heroSubheadlineAr || activeProduct?.arDescription || activeProduct?.description ? (
                <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "#475569", lineHeight: 1.6 }}>
                  {cfg?.heroSubheadlineAr || activeProduct?.arDescription || activeProduct?.description}
                </p>
              ) : null}
              {activeProduct?.details && activeProduct.details.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
                  {activeProduct.details.map(d => (
                    <span key={d} style={{ background: "#fdf2f8", border: "1px solid #f5bfd2", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: "#831843" }}>
                      ✨ {d}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {variants.length > 0 ? (
          <div className="sl">
            <span className="tg">متوفر بجميع الألوان</span>
            <div className="track" dir="ltr" ref={trackRef}>
              {variants.map(v => {
                const isS1 = c1 === v.name;
                const isS2 = hasPackOffer && c2 === v.name;
                let badge = "";
                if (isS1) badge += "1";
                if (isS2) badge += (badge ? "+" : "") + "🎁";
                const figClass = [isS1 ? "s1" : "", isS2 && !isS1 ? "s2" : ""]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <figure
                    key={v.name}
                    data-n={v.name}
                    data-b={badge}
                    className={figClass || undefined}
                    onClick={() => handleTrackFigureClick(v.name)}
                  >
                    {v.slideImg ? <img src={v.slideImg} alt={v.name} /> : <div style={{ aspectRatio: "3/4", background: v.hex || "#f3e8ee" }} />}
                    <figcaption>{v.name}</figcaption>
                  </figure>
                );
              })}
            </div>
            <div className="sel" id="sel">
              {c1 || (hasPackOffer && c2) ? (
                <>
                  1️⃣ {c1 || "—"}{hasPackOffer ? ` • 🎁 ${c2 || "—"}` : ""} —{" "}
                  <a href="#f" onClick={scrollToForm}>
                    أكملي الطلب ↓
                  </a>
                </>
              ) : (
                "اضغطي على لون لاختياره"
              )}
            </div>
          </div>
        ) : null}

        {!isCustomModel ? (
          <div className="ft fd">
            <div className="ic">
              {FEATURE_ICONS.map((src, i) => (
                <img key={i} src={src} alt="" loading="lazy" />
              ))}
            </div>
            <img className="ba" src={beforeAfterImage} alt="" loading="lazy" />
          </div>
        ) : beforeAfterImage ? (
          <div className="ft fd">
            <img className="ba" src={beforeAfterImage} alt={productTitle} loading="lazy" />
          </div>
        ) : null}

        {detailImage ? <img className="fd" src={detailImage} alt={productTitle} loading="lazy" /> : null}

        {!isCustomModel && ctaImage ? (
          <a href="#f" className="fd3" onClick={scrollToForm}>
            <img src={ctaImage} alt="أطلبي الآن" loading="lazy" />
          </a>
        ) : null}

        <form id="f" className="fm" ref={formRef} onSubmit={handleSubmit}>
          <div className="fh">
            🛒 {isCustomModel && cfg?.ctaLabelAr ? cfg.ctaLabelAr : "اطلبي الآن"}
            <small>الدفع عند الاستلام • توصيل لكل الولايات</small>
          </div>

          <div className="of">
            <span>{isCustomModel ? (hasPackOffer ? (cfg?.offer2LabelAr || "عرض قطعتين") : (cfg?.offer1LabelAr || "سعر المنتج")) : "اشتري واحدة"}</span>
            <b>{packPrice} DA</b>
            <span>{hasPackOffer && !isCustomModel ? "والثانية مجاناً 🎁" : (hasPackOffer ? "عرض التوفير 🎁" : "الدفع عند الاستلام ✨")}</span>
          </div>

          <input
            placeholder="الاسم الكامل"
            value={customer}
            onFocus={triggerInitiateCheckoutOnce}
            onChange={e => setCustomer(e.target.value)}
            onBlur={() => persistDraftNow(false)}
            required
          />

          <input
            type="tel"
            inputMode="tel"
            placeholder="رقم الهاتف"
            pattern="0[5-7][0-9]{8}"
            value={phone}
            onFocus={triggerInitiateCheckoutOnce}
            onChange={e => setPhone(e.target.value)}
            onBlur={() => persistDraftNow(false)}
            required
          />

          <select
            id="w"
            value={wilaya}
            onChange={e => {
              const nextWilaya = e.target.value;
              setWilaya(nextWilaya);
              setCommune("");
            }}
            required
          >
            <option value="">الولاية</option>
            {WILAYAS_AR.map((wName, idx) => {
              const label = `${idx + 1} - ${wName}`;
              return (
                <option key={label} value={label}>
                  {label}
                </option>
              );
            })}
          </select>

          <select
            id="cm"
            value={commune}
            disabled={!wilaya}
            onChange={e => setCommune(e.target.value)}
            required
          >
            <option value="">
              {wilaya ? "اختاري البلدية" : "البلدية (اختاري الولاية أولاً)"}
            </option>
            {wilayaCleanName &&
              (extraCommunes.length > 0 ? (
                extraCommunes.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              ) : (
                <option value={wilayaCleanName}>{wilayaCleanName}</option>
              ))}
          </select>

          <div className="vt">
            <em>🚚</em> اختاري طريقة التوصيل
          </div>
          <div className="dlv">
            <button
              type="button"
              className={`dlv-b${delivery === "home" ? " on" : ""}`}
              onClick={() => setDelivery("home")}
            >
              <b>🏠 التوصيل للمنزل</b>
              <span>
                {wilaya
                  ? homeShippingFee > 0
                    ? `${homeShippingFee} DA`
                    : "مجاناً"
                  : "حسب الولاية"}
              </span>
            </button>
            <button
              type="button"
              className={`dlv-b${delivery === "office" ? " on" : ""}`}
              onClick={() => setDelivery("office")}
            >
              <b>🏢 المكتب (Stop Desk)</b>
              <span>
                {wilaya
                  ? officeShippingFee > 0
                    ? `${officeShippingFee} DA`
                    : "مجاناً"
                  : "حسب الولاية"}
              </span>
            </button>
          </div>

          {variants.length > 0 ? (
            <>
              <div className="vt">
                <em>1</em> {isCustomModel ? "اختاري اللون الأول" : "اختاري لون الإكستنشن الأولى"}
              </div>
              <div className="ch" id="c1">
                {variants.map(v => (
                  <button
                    key={v.name}
                    type="button"
                    className={`c${c1 === v.name ? " on" : ""}`}
                    data-n={v.name}
                    onClick={() => handleSelectColor1(v.name)}
                  >
                    <i style={{ background: v.hex ? v.hex : `url(${v.swatchImg}) center/cover` }} />
                    {v.name}
                  </button>
                ))}
              </div>

              {hasPackOffer ? (
                <>
                  <div className="vt">
                    <em>🎁</em> {isCustomModel ? "اختاري لون القطعة الثانية" : "اختاري لون الثانية"}
                  </div>
                  <div className="ch g" id="c2">
                    {variants.map(v => (
                      <button
                        key={v.name}
                        type="button"
                        className={`c${c2 === v.name ? " on" : ""}`}
                        data-n={v.name}
                        onClick={() => handleSelectColor2(v.name)}
                      >
                        <i style={{ background: v.hex ? v.hex : `url(${v.swatchImg}) center/cover` }} />
                        {v.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {dynamicSizes.length > 0 ? (
            <>
              <div className="vt"><em>📏</em> اختاري المقاس</div>
              <div className="ch" style={{ marginBottom: 10 }}>
                {dynamicSizes.map(sz => (
                  <button
                    key={sz}
                    type="button"
                    className={`c${selectedSize === sz ? " on" : ""}`}
                    onClick={() => setSelectedSize(sz)}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <div className="rcp">
            <div className="rcp-h">
              <span>📋 ملخص الطلب</span>
              <span>الدفع عند الاستلام</span>
            </div>
            <div className="rcp-r">
              <span>{hasPackOffer ? (isCustomModel ? (cfg?.offer2LabelAr || "عرض قطعتين") : "العرض (قطعة + الثانية مجاناً 🎁)") : (cfg?.offer1LabelAr || productTitle)}</span>
              <b>{packPrice} DA</b>
            </div>
            {variants.length > 0 ? (
              <div className="rcp-r">
                <span>{hasPackOffer ? "اللون 1 • اللون 2" : "اللون"}</span>
                <b>
                  {hasPackOffer ? `${c1 || "—"} • ${c2 || "—"}` : (c1 || "—")}
                </b>
              </div>
            ) : null}
            {dynamicSizes.length > 0 ? (
              <div className="rcp-r">
                <span>المقاس</span>
                <b>{selectedSize || "—"}</b>
              </div>
            ) : null}
            <div className="rcp-r">
              <span>
                سعر التوصيل ({delivery === "office" ? "المكتب Stop Desk" : "للمنزل"}
                {wilayaCleanName ? ` - ${wilayaCleanName}` : ""})
              </span>
              <b>{wilaya ? `${shippingFee} DA` : "اختاري الولاية"}</b>
            </div>
            <div className="rcp-t">
              <span>المجموع الكلي</span>
              <strong>{grandTotal} DA</strong>
            </div>
          </div>

          {colorError && (
            <div className="er" id="er" style={{ display: "block" }}>
              {hasPackOffer ? "من فضلك اختاري لون القطعتين" : "من فضلك اختاري اللون"}
            </div>
          )}

          {submitError && (
            <div className="er" style={{ display: "block" }}>
              ⚠️ {submitError}
            </div>
          )}

          <button className="go2" type="submit" disabled={submitting}>
            {submitting ? "جاري إرسال طلبك..." : `✅ ${isCustomModel && cfg?.ctaLabelAr ? cfg.ctaLabelAr : "تأكيد الطلب"} — ${grandTotal} DA`}
          </button>

          {orderNumber && (
            <div className="ok" id="ok" style={{ display: "block" }}>
              ✅ تم استلام طلبك، سنتصل بك قريباً
              <div style={{ fontSize: "12px", opacity: 0.9, marginTop: "3px" }}>
                رقم الطلب: <span dir="ltr">{orderNumber}</span>
              </div>
            </div>
          )}
        </form>

        {isCustomModel && cfg?.reviews && cfg.reviews.length > 0 ? (
          <div style={{ display: "grid", gap: 8, margin: "14px 12px" }}>
            {cfg.reviews.slice(0, 3).map((rev, idx) => (
              <div key={`${rev.author}-${idx}`} style={{ background: "#fff", border: "1px solid #f5bfd2", borderRadius: 12, padding: "10px 12px", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, marginBottom: 4 }}>
                  <span>{rev.author}{rev.city ? ` · ${rev.city}` : ""}</span>
                  <span style={{ color: "#d4af37" }}>{"★".repeat(Math.min(5, Math.max(1, rev.rating || 5)))}</span>
                </div>
                <p style={{ margin: 0, color: "#3b232c" }}>« {rev.text} »</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`st${hideSticky ? " hide" : ""}`} id="st">
        <a href="#f" onClick={scrollToForm}>
          <b>{isCustomModel && cfg?.ctaLabelAr ? `${cfg.ctaLabelAr} 🛒` : "اطلبي الآن 🛒"}</b>
          <span>{packPrice} DA • {hasPackOffer && !isCustomModel ? "الثانية مجاناً 🎁" : "الدفع عند الاستلام ✨"}</span>
        </a>
      </div>
    </div>
  );
}

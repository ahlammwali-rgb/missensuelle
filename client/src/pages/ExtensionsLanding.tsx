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
import { getCatalogProducts, type Product } from "@/lib/store-data";
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
    name: "بني عسلي",
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
    name: "نور بليلح غري",
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

const PACK_PRICE = 4500;
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

  const productId = activeProduct?.id || "p-005";
  const productTitle = activeProduct?.name || "Extensions Cheveux Naturel";
  const packPrice = activeProduct?.packPrice || activeProduct?.price || PACK_PRICE;

  const isCustomModel = Boolean(passedProduct && passedProduct.id !== "p-005");

  const variants: VariantDef[] = useMemo(() => {
    if (isCustomModel && passedProduct?.variantImages && passedProduct.variantImages.length > 0) {
      return passedProduct.variantImages.map(v => ({
        name: v.name,
        slideImg: v.image,
        swatchImg: v.image,
      }));
    }
    return DEFAULT_VARIANTS;
  }, [isCustomModel, passedProduct]);

  const heroImage = (isCustomModel && passedProduct?.image) || "/manus-storage/ext-vrait-1.jpg";
  const beforeAfterImage =
    (isCustomModel && passedProduct?.gallery?.[0]) || "/manus-storage/ext-vrait-12.jpg";
  const detailImage =
    (isCustomModel && passedProduct?.gallery?.[1]) || "/manus-storage/ext-vrait-13.jpg";
  const ctaImage = "/manus-storage/ext-vrait-14.jpg";

  const [c1, setC1] = useState<string | null>(null);
  const [c2, setC2] = useState<string | null>(null);
  const nextSlotRef = useRef<1 | 2>(1);

  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [wilaya, setWilaya] = useState("");
  const [commune, setCommune] = useState("");
  const [customCommune, setCustomCommune] = useState("");
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
    return (abayaCommunesByWilaya as Record<string, string[]>)[wilayaCleanName] ?? [];
  }, [wilayaCleanName]);

  const resolvedCommune = useMemo(() => {
    if (commune === "other") {
      return customCommune.trim() || `${wilayaCleanName} (بلدية أخرى)`;
    }
    return commune || wilayaCleanName;
  }, [commune, customCommune, wilayaCleanName]);

  const chosenSummary = useMemo(() => {
    const first = c1 || variants[0]?.name || "أسود طبيعي";
    const second = c2 || first;
    return `1: ${first} + 2 (مجاناً): ${second}`;
  }, [c1, c2, variants]);

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
            customer: cur.customer.trim() || "Cliente Extensions",
            phone: cur.phone.trim(),
            wilaya: cur.wilaya,
            commune: cur.resolvedCommune,
            address: cur.resolvedCommune || cur.wilaya,
            delivery: cur.delivery,
            note: `عرض قطعتين (${cur.chosenSummary}) — ${
              cur.delivery === "office" ? "المكتب Stop Desk" : "توصيل للمنزل"
            }`,
            items: [
              {
                productId: cur.productId,
                quantity: 2,
                color: cur.chosenSummary,
                size: "Standard",
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

    if (!c1 || !c2) {
      setColorError(true);
      document.getElementById("c1")?.scrollIntoView({ behavior: "smooth", block: "center" });
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
    if (!commune || (commune === "other" && !customCommune.trim())) {
      setSubmitError("يرجى اختيار أو كتابة اسم البلدية.");
      return;
    }

    setSubmitting(true);
    triggerInitiateCheckoutOnce();

    try {
      const finalColor = `1: ${c1} + 2 (مجاناً): ${c2}`;
      const finalNote = `عرض قطعتين (${finalColor}) — ${
        delivery === "office" ? "المكتب Stop Desk" : "توصيل للمنزل"
      } — الإجمالي: ${grandTotal} دج`;
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
            quantity: 2,
            color: finalColor,
            size: "Standard",
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
        product: `${productTitle} × 2 (${finalColor})`,
        quantity: 2,
        total: finalTotal,
        color: finalColor,
        size: "Standard",
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
        quantity: 2,
        num_items: 2,
        currency: "DZD",
        order_id: result.orderNumber,
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
          <img src={heroImage} alt="إكستنشن الشعر" />
          <div className="pl">
            <b>شعر طبيعي 60%</b>
            <span>يتلیس ويتبوكل</span>
          </div>
        </div>

        <div className="sl">
          <span className="tg">متوفر بجميع الألوان</span>
          <div className="track" dir="ltr" ref={trackRef}>
            {variants.map(v => {
              const isS1 = c1 === v.name;
              const isS2 = c2 === v.name;
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
                  <img src={v.slideImg} alt={v.name} />
                  <figcaption>{v.name}</figcaption>
                </figure>
              );
            })}
          </div>
          <div className="sel" id="sel">
            {c1 || c2 ? (
              <>
                1️⃣ {c1 || "—"} • 🎁 {c2 || "—"} —{" "}
                <a href="#f" onClick={scrollToForm}>
                  أكملي الطلب ↓
                </a>
              </>
            ) : (
              "اضغطي على لون لاختياره"
            )}
          </div>
        </div>

        <div className="ft fd">
          <div className="ic">
            {FEATURE_ICONS.map((src, i) => (
              <img key={i} src={src} alt="" loading="lazy" />
            ))}
          </div>
          <img className="ba" src={beforeAfterImage} alt="" loading="lazy" />
        </div>

        <img className="fd" src={detailImage} alt="" loading="lazy" />

        <a href="#f" className="fd3" onClick={scrollToForm}>
          <img src={ctaImage} alt="أطلبي الآن" loading="lazy" />
        </a>

        <form id="f" className="fm" ref={formRef} onSubmit={handleSubmit}>
          <div className="fh">
            🛒 اطلبي الآن
            <small>الدفع عند الاستلام • توصيل لكل الولايات</small>
          </div>

          <div className="of">
            <span>اشتري واحدة</span>
            <b>{packPrice} DA</b>
            <span>والثانية مجاناً 🎁</span>
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
              const nextClean = nextWilaya.replace(/^\d+\s*-\s*/, "").trim();
              setWilaya(nextWilaya);
              setCommune(nextClean || "");
              setCustomCommune("");
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
            onChange={e => {
              setCommune(e.target.value);
              if (e.target.value !== "other") {
                setCustomCommune("");
              }
            }}
            required
          >
            <option value="">البلدية</option>
            {wilayaCleanName && (
              <>
                <option value={wilayaCleanName}>{wilayaCleanName} (مركز الولاية)</option>
                <option value="other">بلدية أخرى</option>
                {extraCommunes
                  .filter(c => c !== wilayaCleanName)
                  .map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </>
            )}
          </select>

          {commune === "other" && (
            <input
              id="cx"
              placeholder="اكتبي اسم البلدية"
              value={customCommune}
              onChange={e => setCustomCommune(e.target.value)}
              required
            />
          )}

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

          <div className="vt">
            <em>1</em> اختاري لون الإكستنشن الأولى
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
                <i style={{ background: `url(${v.swatchImg}) center/cover` }} />
                {v.name}
              </button>
            ))}
          </div>

          <div className="vt">
            <em>🎁 مجاناً</em> اختاري لون الثانية
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
                <i style={{ background: `url(${v.swatchImg}) center/cover` }} />
                {v.name}
              </button>
            ))}
          </div>

          <div className="rcp">
            <div className="rcp-h">
              <span>📋 ملخص الطلب</span>
              <span>الدفع عند الاستلام</span>
            </div>
            <div className="rcp-r">
              <span>العرض (قطعة + الثانية مجاناً 🎁)</span>
              <b>{packPrice} DA</b>
            </div>
            <div className="rcp-r">
              <span>اللون 1 • اللون 2</span>
              <b>
                {c1 || "—"} • {c2 || "—"}
              </b>
            </div>
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
              من فضلك اختاري لون القطعتين
            </div>
          )}

          {submitError && (
            <div className="er" style={{ display: "block" }}>
              ⚠️ {submitError}
            </div>
          )}

          <button className="go2" type="submit" disabled={submitting}>
            {submitting ? "جاري إرسال طلبك..." : `✅ تأكيد الطلب — ${grandTotal} DA`}
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
      </div>

      <div className={`st${hideSticky ? " hide" : ""}`} id="st">
        <a href="#f" onClick={scrollToForm}>
          <b>اطلبي الآن 🛒</b>
          <span>{packPrice} DA • الثانية مجاناً 🎁</span>
        </a>
      </div>
    </div>
  );
}

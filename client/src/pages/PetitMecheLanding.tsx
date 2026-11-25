import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { abayaCommunesByWilaya } from "@/lib/abaya-communes";
import { loadRealOrders, saveRealOrders } from "@/lib/admin-orders";
import { getProduct, type Product } from "@/lib/store-data";
import { identifyTikTokUser, initializePixels, trackPixelEvent } from "@/lib/tracking";
import { trpc } from "@/lib/trpc";
import { useCheckoutDraft } from "@/components/useCheckoutDraft";
import { shippingFeeFor } from "@shared/shipping";
import "./petit-meche-template.css";

const PETIT_MECHE_VARIANTS: ReadonlyArray<{ value: string; hex: string; image: string }> = [
  { value: "أسود", hex: "#171516", image: "/images/petit-meche/variants/noir.jpg" },
  { value: "شاتين كلير", hex: "#945b35", image: "/images/petit-meche/variants/chatain-clair.jpg" },
  { value: "بلوند ذهبي طبيعي", hex: "#d6a256", image: "/images/petit-meche/variants/blond-dore.jpg" },
  { value: "شاتين فونسي", hex: "#4a281a", image: "/images/petit-meche/variants/chatain-fonce.jpg" },
  { value: "بلوند بلاتين", hex: "#ebd7b5", image: "/images/petit-meche/variants/blond-platine.jpg" },
];

const PETIT_MECHE_WILAYAS: ReadonlyArray<{ value: string; label: string }> = [
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

function formatPrice(value: number): string {
  return `${Math.max(0, Math.round(value))} DA`;
}

export default function PetitMecheLanding({ product }: { product?: Product }) {
  const activeProduct = product ?? getProduct("petit-meche");
  const cfg = activeProduct?.landingConfig;
  const productId = activeProduct?.id || "p-012";
  const isBuiltIn =
    (productId === "p-012" || activeProduct?.slug === "petit-meche") &&
    (!activeProduct?.image || activeProduct.image === "/images/petit-meche/01-petit-meche.jpg");

  const unitPrice = Number(activeProduct?.price) || 2500;
  const oldPrice = Number(activeProduct?.oldPrice) || 3500;
  const productTitle = activeProduct?.name || "Petit Mèche";

  const colorOptions = useMemo(() => {
    if (isBuiltIn) {
      return PETIT_MECHE_VARIANTS.map(c => ({ value: c.value, hex: c.hex, image: c.image }));
    }
    const hexMap = new Map(PETIT_MECHE_VARIANTS.map(c => [c.value, c.hex]));
    const imgMap = new Map(PETIT_MECHE_VARIANTS.map(c => [c.value, c.image]));
    if (activeProduct?.variantImages && activeProduct.variantImages.length > 0) {
      return activeProduct.variantImages.map(v => ({
        value: v.name,
        hex: hexMap.get(v.name) ?? "#7d0c2a",
        image: v.image || imgMap.get(v.name) || "",
      }));
    }
    if (cfg?.colorSwatches && cfg.colorSwatches.length > 0) {
      return cfg.colorSwatches.map(c => ({
        value: c.name,
        hex: c.hex || "#7d0c2a",
        image: imgMap.get(c.name) || "",
      }));
    }
    if (activeProduct?.colors && activeProduct.colors.length > 0) {
      return activeProduct.colors.map(name => ({
        value: name,
        hex: hexMap.get(name) ?? "#7d0c2a",
        image: imgMap.get(name) || "",
      }));
    }
    return PETIT_MECHE_VARIANTS.map(c => ({ value: c.value, hex: c.hex, image: c.image }));
  }, [isBuiltIn, cfg?.colorSwatches, activeProduct?.colors, activeProduct?.variantImages]);

  const gallery = useMemo(() => {
    if (isBuiltIn) {
      const g = activeProduct?.gallery;
      const pick = (idx: number, fallback: string) => {
        const src = g?.[idx];
        return src && src !== "/images/petit-meche/02-petit-meche.jpg" ? src : fallback;
      };
      return [
        { src: pick(0, "/images/petit-meche/01-petit-meche.jpg"), alt: productTitle, lazy: false },
        { src: pick(2, "/images/petit-meche/03-petit-meche.jpg"), alt: `${productTitle} - مميزات المنتج`, lazy: true },
        { src: pick(3, "/images/petit-meche/04-petit-meche.jpg"), alt: "طريقة التركيب", lazy: true },
        { src: pick(4, "/images/petit-meche/05-petit-meche.jpg"), alt: "آراء زبائننا", lazy: true },
        { src: pick(5, "/images/petit-meche/06-petit-meche.jpg"), alt: "جودة عالية", lazy: true },
      ];
    }
    const imgs = activeProduct?.gallery?.length
      ? activeProduct.gallery
      : activeProduct?.image
        ? [activeProduct.image]
        : ["/images/petit-meche/01-petit-meche.jpg"];
    return imgs.map((src, idx) => ({
      src,
      alt: `${productTitle} ${idx + 1}`,
      lazy: idx > 0,
    }));
  }, [isBuiltIn, activeProduct?.gallery, activeProduct?.image, productTitle]);

  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [wilaya, setWilaya] = useState("");
  const [communeChoice, setCommuneChoice] = useState("");
  const [customCommune, setCustomCommune] = useState("");
  const [error, setError] = useState("");
  const [hideSticky, setHideSticky] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<{
    orderNumber: string;
    total: number;
    colors: string;
    wilaya: string;
    commune: string;
  } | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const checkoutStartedRef = useRef(false);

  const communes = useMemo(() => getCommunesForWilaya(wilaya), [wilaya]);
  const resolvedCommune = communeChoice === "__o" ? customCommune.trim() : communeChoice.trim();
  const colorsJoined = selectedColors.join(" + ");

  const ratesQuery = trpc.store.shippingRates.useQuery(undefined, {
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const shippingFee = useMemo(() => {
    if (!wilaya) return 0;
    return shippingFeeFor(ratesQuery.data?.rates, wilaya, "home", [productId]);
  }, [ratesQuery.data?.rates, wilaya, productId]);

  const estimatedTotal = unitPrice + shippingFee;

  const checkout = useCheckoutDraft({
    formRef,
    source: "product",
    getItems: () => [
      {
        productId,
        quantity: 1,
        color: colorsJoined || colorOptions[0]?.value || "Standard",
        size: "Standard",
      },
    ],
    watchKey: `${colorsJoined}|${customer}|${phone}|${wilaya}|${resolvedCommune}`,
  });

  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${productTitle} - Miss Sensuelle`;
    document.body.classList.add("pm-experience");

    initializePixels();
    try {
      (window as Window & { ttq?: { page?: () => void } }).ttq?.page?.();
    } catch {
      // Ignore TikTok page hook failure
    }
    trackPixelEvent("ViewContent", {
      content_type: "product",
      content_id: productId,
      content_ids: [productId],
      content_name: productTitle,
      value: unitPrice,
      currency: "DZD",
      source_page: "petit-meche-landing",
    });

    return () => {
      document.title = prevTitle;
      document.body.classList.remove("pm-experience");
    };
  }, [productId, productTitle, unitPrice]);

  useEffect(() => {
    if (submittedOrder) {
      setHideSticky(true);
      return;
    }
    const target = formRef.current?.querySelector(".pm-submit-btn");
    if (!target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      entries => {
        setHideSticky(entries.some(entry => entry.isIntersecting));
      },
      { threshold: 0.08 }
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
      content_name: productTitle,
      value: estimatedTotal,
      currency: "DZD",
      num_items: 1,
      source_page: "petit-meche-landing",
    });
  }

  function handleColorToggle(colorValue: string) {
    ensureInitiateCheckout();
    if (error) setError("");
    const exists = selectedColors.includes(colorValue);
    const nextColors = exists
      ? selectedColors.filter(c => c !== colorValue)
      : [...selectedColors, colorValue];
    setSelectedColors(nextColors);
    if (!exists) {
      trackPixelEvent("AddToCart", {
        content_type: "product",
        content_id: productId,
        content_ids: [productId],
        content_name: `${productTitle} - ${colorValue}`,
        value: unitPrice,
        currency: "DZD",
        num_items: 1,
        color: colorValue,
        source_page: "petit-meche-landing",
      });
    }
  }

  function handleWilayaChange(nextWilaya: string) {
    ensureInitiateCheckout();
    if (error) setError("");
    setWilaya(nextWilaya);
    setCommuneChoice("");
    setCustomCommune("");
  }

  function handleStickyClick() {
    ensureInitiateCheckout();
    sectionRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handlePhoneBlur() {
    const normalized = normalizeDzPhone(phone);
    if (normalized && normalized !== phone) {
      setPhone(normalized);
      if (phoneInputRef.current) phoneInputRef.current.value = normalized;
    }
    if (isValidDzPhone(normalized)) {
      identifyTikTokUser(normalized, customer.trim());
    }
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (checkout.pending || submittedOrder) return;

    if (colorOptions.length > 0 && selectedColors.length === 0) {
      setError("المرجو اختيار اللون");
      return;
    }

    const trimmedName = customer.trim();
    if (!trimmedName || !wilaya || !resolvedCommune) {
      setError("المرجو ملء جميع الخانات");
      return;
    }

    const normalizedPhone = normalizeDzPhone(phone);
    if (!isValidDzPhone(normalizedPhone)) {
      setError("رقم الهاتف غير صحيح");
      return;
    }

    setError("");
    ensureInitiateCheckout();

    if (normalizedPhone !== phone) {
      setPhone(normalizedPhone);
      if (phoneInputRef.current) phoneInputRef.current.value = normalizedPhone;
    }

    identifyTikTokUser(normalizedPhone, trimmedName);

    const result = await checkout.submitOrder();
    if (!result) {
      setError(checkout.draftError || "حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى.");
      return;
    }

    const finalTotal = result.total || estimatedTotal;

    try {
      const existing = loadRealOrders();
      saveRealOrders([
        {
          id: result.orderNumber,
          createdAt: new Date().toISOString(),
          customer: trimmedName,
          phone: normalizedPhone,
          productId,
          product: `${productTitle} × 1`,
          quantity: 1,
          total: finalTotal,
          color: colorsJoined,
          size: "Standard",
          delivery: "home",
          wilaya,
          commune: resolvedCommune,
          address: resolvedCommune,
          note: colorsJoined ? `الألوان: ${colorsJoined}` : "",
          status: "nouvelle",
        },
        ...existing.filter(o => o.id !== result.orderNumber),
      ]);
    } catch {
      // Le stockage local est optionnel ; la commande est enregistrée côté serveur.
    }

    trackPixelEvent("Purchase", {
      content_type: "product",
      content_id: productId,
      content_ids: [productId],
      content_name: productTitle,
      value: finalTotal,
      currency: "DZD",
      order_id: result.orderNumber,
      num_items: 1,
      phone: normalizedPhone,
      customer: trimmedName,
      color: colorsJoined,
      wilaya,
      commune: resolvedCommune,
      source_page: "petit-meche-landing",
    });

    setSubmittedOrder({
      orderNumber: result.orderNumber,
      total: finalTotal,
      colors: colorsJoined,
      wilaya,
      commune: resolvedCommune,
    });
  }

  return (
    <div className="pm-page" dir="rtl" lang="ar">
      <div className="pm-w">
        {gallery[0] && (
          <img
            src={gallery[0].src}
            alt={gallery[0].alt}
          />
        )}

        {colorOptions.some(c => Boolean(c.image)) && (
          <section className="pm-showcase" aria-label="اختاري لونك المفضل">
            <div className="pm-showcase-head">
              <span>♡ الألوان المتوفرة ♡</span>
              <small>اضغطي على أي صورة لاختيار اللون</small>
            </div>
            <div className="pm-marquee-viewport" dir="ltr">
              <div className="pm-marquee-track">
                {[0, 1].map(copyIdx => (
                  <div
                    key={copyIdx}
                    className="pm-marquee-group"
                    aria-hidden={copyIdx === 1 || undefined}
                  >
                    {colorOptions
                      .filter(c => Boolean(c.image))
                      .map(c => {
                        const checked = selectedColors.includes(c.value);
                        return (
                          <button
                            key={`${copyIdx}-${c.value}`}
                            type="button"
                            tabIndex={copyIdx === 1 ? -1 : undefined}
                            aria-pressed={copyIdx === 0 ? checked : undefined}
                            className={`pm-showcase-slide${checked ? " is-selected" : ""}`}
                            onClick={() => handleColorToggle(c.value)}
                          >
                            {c.image && (
                              <img
                                src={c.image}
                                alt={copyIdx === 0 ? c.value : ""}
                                loading="eager"
                                decoding="async"
                              />
                            )}
                            <span className="pm-showcase-cap" dir="rtl">
                              <i style={{ background: c.hex }} />
                              <b>{c.value}</b>
                            </span>
                            {checked && (
                              <span className="pm-variant-check" aria-hidden="true">
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {gallery.slice(1).map((item, idx) => (
          <img
            key={`${item.src}-${idx + 1}`}
            src={item.src}
            alt={item.alt}
            loading={item.lazy ? "lazy" : undefined}
          />
        ))}

        <section id="pm-form" className="pm-form" ref={sectionRef}>
          <div className="pm-tt">
            <span>🛒</span> إستمارة الطلب
          </div>

          {submittedOrder ? (
            <div className="pm-ok" id="ok" role="status">
              ✅ شكرا لك! تم استلام طلبك
              <br />
              سنتصل بك قريبا لتأكيد الطلب.
              <span className="pm-ok-meta">
                رقم الطلب: {submittedOrder.orderNumber} · اللون: {submittedOrder.colors} · {submittedOrder.wilaya} -{" "}
                {submittedOrder.commune} · المجموع: {formatPrice(submittedOrder.total)}
              </span>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} noValidate>
              <div className="pm-pr">
                <span>عرض خاص</span>
                <b>{formatPrice(unitPrice)}</b>
                {oldPrice > unitPrice ? <s>{formatPrice(oldPrice)}</s> : null}
              </div>

              {colorOptions.length > 0 ? (
                <>
                  <div className="pm-lab">اختاري اللون ({selectedColors.length > 0 ? `تم اختيار ${selectedColors.length}` : "يمكنك اختيار لون أو أكثر"})</div>
                  <div className={colorOptions.some(c => Boolean(c.image)) ? "pm-variant-mini-list" : "pm-chips"}>
                    {colorOptions.map(c => {
                      const checked = selectedColors.includes(c.value);
                      if (c.image) {
                        return (
                          <label key={c.value} className={`pm-variant-mini${checked ? " is-selected" : ""}`}>
                            <input
                              type="checkbox"
                              name="c"
                              value={c.value}
                              checked={checked}
                              onChange={() => handleColorToggle(c.value)}
                            />
                            <span className="pm-variant-mini-thumb">
                              <img src={c.image} alt={c.value} loading="eager" decoding="async" />
                            </span>
                            <span className="pm-variant-mini-name">{c.value}</span>
                            {checked && (
                              <span className="pm-variant-mini-tick" aria-hidden="true">
                                ✓
                              </span>
                            )}
                          </label>
                        );
                      }
                      return (
                        <label key={c.value}>
                          <input
                            type="checkbox"
                            name="c"
                            value={c.value}
                            checked={checked}
                            onChange={() => handleColorToggle(c.value)}
                          />
                          <span>
                            <i style={{ background: c.hex }} />
                            {c.value}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              ) : null}

              <div className="pm-fl">
                <input
                  id="pm-customer"
                  name="customer"
                  autoComplete="name"
                  placeholder="الاسم و اللقب"
                  value={customer}
                  onFocus={ensureInitiateCheckout}
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

              <div className="pm-fl">
                <input
                  ref={phoneInputRef}
                  id="pm-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="رقم الهاتف"
                  value={phone}
                  onFocus={ensureInitiateCheckout}
                  onBlur={handlePhoneBlur}
                  onChange={e => {
                    setPhone(e.target.value);
                    if (error) setError("");
                  }}
                />
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1.02z" />
                </svg>
              </div>

              <div className="pm-fl">
                <select
                  id="pm-wilaya"
                  name="wilaya"
                  value={wilaya}
                  onFocus={ensureInitiateCheckout}
                  onChange={e => handleWilayaChange(e.target.value)}
                >
                  <option value="">الولاية</option>
                  {PETIT_MECHE_WILAYAS.map(w => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 1C7.6 1 4 4.4 4 8.7 4 14.5 12 23 12 23s8-8.5 8-14.3C20 4.4 16.4 1 12 1zm0 11a3 3 0 110-6 3 3 0 010 6z" />
                </svg>
              </div>

              <div className="pm-fl">
                <select
                  id="pm-commune"
                  name="commune"
                  value={communeChoice}
                  onFocus={ensureInitiateCheckout}
                  onChange={e => {
                    setCommuneChoice(e.target.value);
                    if (e.target.value !== "__o") setCustomCommune("");
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
                <div className="pm-fl" id="ob">
                  <input
                    id="ao"
                    name="address"
                    placeholder="اكتبي اسم البلدية"
                    value={customCommune}
                    onChange={e => {
                      setCustomCommune(e.target.value);
                      if (error) setError("");
                    }}
                  />
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3z" />
                  </svg>
                </div>
              ) : null}

              <div className="pm-summary" aria-live="polite">
                <span>
                  {wilaya && shippingFee > 0
                    ? `التوصيل (${wilaya}): ${formatPrice(shippingFee)}`
                    : "الدفع عند الاستلام"}
                </span>
                <strong>المجموع: {formatPrice(estimatedTotal)}</strong>
              </div>

              {(error || checkout.draftError) ? (
                <div className="pm-err" role="alert">
                  {error || checkout.draftError}
                </div>
              ) : null}

              <button className="pm-btn pm-submit-btn" type="submit" disabled={checkout.pending}>
                <span>🛒</span> {checkout.pending ? "جارٍ تأكيد الطلب..." : "اطلبي الآن"} <span>👆</span>
              </button>
            </form>
          )}
        </section>
      </div>

      {!submittedOrder ? (
        <div className={`pm-sticky${hideSticky ? " is-hidden" : ""}`}>
          <button className="pm-btn" type="button" onClick={handleStickyClick}>
            <span>🛒</span> اطلبي الآن <span>👆</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

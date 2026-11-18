import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  const productId = activeProduct?.id || "p-010";
  const productTitle = activeProduct?.name || "Badil Microblading";

  const singlePrice = activeProduct?.price && activeProduct.price > 0 ? activeProduct.price : 1800;
  const packPrice = activeProduct?.packPrice && activeProduct.packPrice > 0 ? activeProduct.packPrice : 3000;

  const offers: OfferOption[] = useMemo(
    () => [
      {
        id: "offer1",
        value: `1 لوحة - ${singlePrice} DA`,
        title: "لوحة واحدة",
        price: singlePrice,
        quantity: 1,
        color: "لوحة واحدة",
        size: "قطعة واحدة",
      },
      {
        id: "offer2",
        value: `2 لوحتين + 1 مجانا - ${packPrice} DA`,
        title: "لوحتان + الثالثة مجانا",
        price: packPrice,
        quantity: 2,
        color: "لوحتان + الثالثة مجانا",
        size: "3 قطع (2+1 مجانا)",
      },
    ],
    [singlePrice, packPrice]
  );

  const [selectedOfferId, setSelectedOfferId] = useState<OfferId>("offer2");
  const selectedOffer = offers.find(o => o.id === selectedOfferId) ?? offers[1];

  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [wilaya, setWilaya] = useState("");
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

  const hasUserInput = Boolean(customer.trim() || phone.trim() || wilaya || address.trim());

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
        color: hasUserInput ? selectedOffer.color : "",
        size: hasUserInput ? selectedOffer.size : "",
      },
    ],
    watchKey: `${selectedOffer.id}|${customer}|${phone}|${wilaya}|${address}`,
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

    const trimmedName = customer.trim();
    const trimmedAddress = address.trim();
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
          color: selectedOffer.color,
          size: selectedOffer.size,
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

  const heroImages = [
    { src: activeProduct?.gallery?.[0] || "/images/badil/01-badil.jpg", alt: "Badil Microblading", lazy: false },
    { src: activeProduct?.gallery?.[1] || "/images/badil/02-badil.jpg", alt: "قبل وبعد", lazy: true },
    { src: activeProduct?.gallery?.[2] || "/images/badil/03-badil.jpg", alt: "طريقة الاستخدام", lazy: true },
    { src: activeProduct?.gallery?.[3] || "/images/badil/04-badil.jpg", alt: "العروض", lazy: true },
  ];

  return (
    <div className="badil-page" dir="rtl" lang="ar">
      <div className="badil-wrap">
        {heroImages.map(img => (
          <img
            key={img.src}
            src={img.src}
            alt={img.alt}
            loading={img.lazy ? "lazy" : undefined}
          />
        ))}

        <section id="badil-form" ref={sectionRef}>
          <img
            className="badil-tt"
            src={activeProduct?.gallery?.[4] || "/images/badil/05-badil.jpg"}
            alt="إستمارة الطلب"
          />

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
              <input type="hidden" name="commune" value={address.trim() || wilaya} />
              <input
                type="hidden"
                name="note"
                value={hasUserInput ? `العرض: ${selectedOffer.value}` : ""}
              />

              <div className="badil-offers">
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
                <span>🛒</span> {checkout.pending ? "جارٍ تأكيد الطلب..." : "اطلبي الآن"} <span>👆</span>
              </button>
            </form>
          )}
        </section>

        <img
          src={activeProduct?.gallery?.[7] || "/images/badil/08-badil.jpg"}
          alt="مميزات Badil Microblading"
          loading="lazy"
        />
      </div>

      {!submittedOrder && (
        <div className={`badil-sticky${hideSticky ? " is-hidden" : ""}`}>
          <button className="badil-btn" type="button" onClick={handleStickyClick}>
            <span>🛒</span> اطلبي الآن <span>👆</span>
          </button>
        </div>
      )}
    </div>
  );
}

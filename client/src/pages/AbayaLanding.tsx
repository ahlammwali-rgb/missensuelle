import React, { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Search, ShoppingBag } from "lucide-react";
import { abayaCommunesByWilaya, abayaWilayas } from "@/lib/abaya-communes";
import { abayaImages } from "@/lib/abaya-images";
import { getProduct, type Product } from "@/lib/store-data";
import { trackPixelEvent } from "@/lib/tracking";
import { trpc } from "@/lib/trpc";
import { isFreeShippingProduct, shippingFeeFor } from "@shared/shipping";
import { CheckoutDraftNotice } from "@/components/CheckoutDraftNotice";
import { useCheckoutDraft } from "@/components/useCheckoutDraft";
import "./abaya-template.css";

type AbayaColor = "green" | "black";

const colorChoices = [
  {
    id: "green" as const,
    label: "أخضر ملكي",
    storeValue: "Emerald",
    hex: "#0d4b37",
    thumb: abayaImages.colorPreviews.green.thumb,
  },
  {
    id: "black" as const,
    label: "أسود فاخر",
    storeValue: "Noir",
    hex: "#111111",
    thumb: abayaImages.colorPreviews.black.thumb,
  },
];

const SIZES = ["S", "M", "L", "XL", "XXL"];

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function AbayaLanding({ product, quantity = 1 }: { product: Product; quantity?: number }) {
  const cfg = product.landingConfig;
  const isBuiltIn =
    !cfg &&
    (product.id === "p-007" || product.slug === "abaya-royal-emerald") &&
    (!product.image || product.image === "/manus-storage/v-hero_de8d807e.jpg");

  const dynamicColorChoices = !isBuiltIn && cfg?.colorSwatches && cfg.colorSwatches.length > 0
    ? cfg.colorSwatches.map((sw, idx) => ({
        id: `c-${idx}`,
        label: sw.name,
        storeValue: sw.name,
        hex: sw.hex || (idx % 2 === 0 ? "#0d4b37" : "#111111"),
        thumb: product.variantImages?.[idx]?.image || product.gallery?.[idx] || product.image,
      }))
    : product.variantImages && product.variantImages.length > 0 && !isBuiltIn
      ? product.variantImages.map((v, idx) => ({
          id: `c-${idx}`,
          label: v.name || `اللون ${idx + 1}`,
          storeValue: v.name || `اللون ${idx + 1}`,
          hex: idx % 2 === 0 ? "#0d4b37" : "#111111",
          thumb: v.image || product.gallery?.[idx] || product.image,
        }))
      : !isBuiltIn && product.colors && product.colors.length > 0
        ? product.colors.map((c, idx) => ({
            id: `c-${idx}`,
            label: c,
            storeValue: c,
            hex: idx % 2 === 0 ? "#0d4b37" : "#111111",
            thumb: product.gallery?.[idx] || product.image,
          }))
        : !isBuiltIn && product.gallery && product.gallery.length > 0
          ? product.gallery.map((img, idx) => ({
              id: `c-${idx}`,
              label: `الموديل ${idx + 1}`,
              storeValue: `الموديل ${idx + 1}`,
              hex: idx % 2 === 0 ? "#0d4b37" : "#111111",
              thumb: img,
            }))
          : colorChoices;

  const dynamicSizes = isBuiltIn
    ? SIZES
    : cfg?.sizes !== undefined
      ? cfg.sizes.map(s => s.label)
      : SIZES;

  const [color, setColor] = useState<string>(dynamicColorChoices[0]?.id ?? "green");
  const [wilaya, setWilaya] = useState("");
  const [commune, setCommune] = useState("");
  const [size, setSize] = useState(dynamicSizes.includes("L") ? "L" : (dynamicSizes[0] ?? ""));
  const [delivery, setDelivery] = useState<"home" | "office">("home");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [orderNumber, setOrderNumber] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(2 * 3600 + 43 * 60 + 50);
  const formRef = useRef<HTMLFormElement>(null);
  const checkoutStarted = useRef(false);

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
  }, [product.id]);

  useEffect(() => {
    const prevTitle = document.title;
    if (!isBuiltIn) {
      document.title = `Miss Sensuelle — ${product.arName || product.name}`;
    }
    trackPixelEvent("ViewContent", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: product.name,
      value: product.price || 7500,
      currency: "DZD",
    });
    return () => {
      if (!isBuiltIn) document.title = prevTitle;
    };
  }, [product.id, product.arName, product.name, product.price, isBuiltIn]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedColorChoice = dynamicColorChoices.find(c => c.id === color) ?? dynamicColorChoices[0];
  const current: AbayaColor = color === "black" ? "black" : "green";
  const activeColorPreview = isBuiltIn
    ? abayaImages.colorPreviews[current]
    : { thumb: selectedColorChoice.thumb, caption: selectedColorChoice.label };
  const doudoune = getProduct("doudoune-hiver-luxe");
  const ratesQuery = trpc.store.shippingRates.useQuery(undefined, {
    enabled: !isBuiltIn,
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const communes = abayaCommunesByWilaya[wilaya] ?? [];
  const unitPrice = isBuiltIn ? 7500 : (product.price || 7500);
  const oldPriceVal = isBuiltIn ? 14000 : (product.oldPrice || Math.round(unitPrice * 1.4));
  const total = unitPrice * quantity;
  const freeShipping = isBuiltIn || isFreeShippingProduct(product.id);
  const shippingFee = freeShipping
    ? 0
    : wilaya
      ? shippingFeeFor(ratesQuery.data?.rates, wilaya, delivery, [product.id])
      : 0;
  const grandTotal = total + shippingFee;

  const checkout = useCheckoutDraft({
    formRef,
    source: "abaya",
    getItems: () => [{ productId: product.id, quantity, color: selectedColorChoice.storeValue, size: dynamicSizes.length > 0 ? size : "" }],
    watchKey: `${color}|${wilaya}|${commune}|${size}|${delivery}|${quantity}`,
  });

  function startCheckout() {
    if (checkoutStarted.current) return;
    checkoutStarted.current = true;
    trackPixelEvent("InitiateCheckout", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: product.name,
      value: total,
      currency: "DZD",
    });
  }

  function scrollToOrderForm() {
    startCheckout();
    document.getElementById("order")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      const firstInput = document.getElementById("n") as HTMLInputElement | null;
      firstInput?.focus({ preventScroll: true });
    }, 450);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (orderNumber || checkout.pending) return;
    const form = new FormData(event.currentTarget);
    const customer = String(form.get("customer") ?? "").trim();
    const phone = String(form.get("phone") ?? "").replace(/[\s().-]/g, "");
    const nextErrors: Record<string, string> = {};
    if (customer.length < 2) nextErrors.customer = "أدخلي اسمك الكامل";
    if (!/^(?:0[567]\d{8}|\+213[567]\d{8})$/.test(phone)) nextErrors.phone = "رقم غير صحيح (مثال: 0555123456)";
    if (!wilaya) nextErrors.wilaya = "اختاري الولاية";
    if (!communes.includes(commune)) nextErrors.commune = "اختاري البلدية";
    if (dynamicSizes.length > 0 && !size) nextErrors.size = "اختاري المقاس";
    if (!color) nextErrors.color = "اختاري اللون";
    if (product.stock <= 0) nextErrors.form = "المنتج غير متوفر حالياً";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const result = await checkout.submitOrder();
    if (!result) return;
    setOrderNumber(result.orderNumber);
    trackPixelEvent("Purchase", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: product.name,
      value: result.total,
      currency: "DZD",
      order_id: result.orderNumber,
      phone,
      customer,
    });
  }

  const hrs = pad2(Math.floor(secondsLeft / 3600));
  const mins = pad2(Math.floor((secondsLeft % 3600) / 60));
  const secs = pad2(secondsLeft % 60);

  return (
    <div className="abaya-template" dir="rtl">
      <div className="w">
        <div className="top-promo-bar">
          {!isBuiltIn && cfg?.promoBannerAr ? (
            <span>{cfg.promoBannerAr}</span>
          ) : (
            <>🚚 <span>التوصيل {freeShipping ? "مجاني 100%" : "سريع لـ 58 ولاية"}</span> · الدفع عند الاستلام وفحص الطلبية قبل الدفع 🔥</>
          )}
        </div>

        <header className="hd">
          <Link href="/catalogue" className="hb" aria-label="القائمة"><i /><i /><i /></Link>
          <Link href="/" className="lg-link"><img className="lg" src={abayaImages.logo} alt="Miss Sensuelle" /></Link>
          <div className="ic">
            <Link href="/catalogue" aria-label="البحث"><Search size={27} /></Link>
            <a className="bag" href="#order" aria-label="اطلبي الآن" onClick={e => { e.preventDefault(); scrollToOrderForm(); }}>
              <ShoppingBag size={27} />
              <em>{quantity}</em>
            </a>
            <span className="flag" aria-label="الجزائر">☪</span>
          </div>
        </header>

        <section className="hx hx-poster" aria-label={product.arName || product.name}>
          <div className="hero-poster-wrap">
            <img
              id="hero"
              src={isBuiltIn ? abayaImages.mainHero : (selectedColorChoice.thumb || product.image || abayaImages.mainHero)}
              alt={product.arName || product.name}
              width="1024"
              height="840"
              fetchPriority="high"
            />
            <div className="hero-price-badge-7500">
              <strong>{unitPrice} دج</strong>
              <del>{oldPriceVal} دج</del>
              <span>{freeShipping ? "🚚 التوصيل مجاني" : `✨ ${cfg?.heroBadgeAr || product.badge || "حصري"}`}</span>
            </div>
          </div>

          <div className="hero-conversion-box">
            <div className="hero-conv-top">
              <div className="hero-conv-title">
                <h1>👑 {isBuiltIn ? "طقم عباية رويال + جمبسوت أسود" : (cfg?.heroHeadlineAr || product.arName || product.name)}</h1>
                <small>{isBuiltIn ? "✅ توصيل مجاني لباب المنزل (0 دج) · الدفع عند الاستلام" : (cfg?.heroSubheadlineAr || product.arDescription || product.description || "✅ الدفع عند الاستلام لجميع 58 ولاية")}</small>
              </div>
              <div className="hero-conv-price">
                <b>{unitPrice.toLocaleString("en-US")} دج</b>
                <del>{oldPriceVal.toLocaleString("en-US")} دج</del>
              </div>
            </div>

            <div className="stock-urgency">
              <div className="stock-urgency-row">
                <span>⚠️ سارعي ! بقي 6 قطع فقط بهذا السعر</span>
                <span>👁️ تشاهده 29 زبونة الآن</span>
              </div>
              <div className="stock-bar"><i /></div>
            </div>

            <button type="button" className="hero-fast-cta" onClick={scrollToOrderForm}>
              👇 {isBuiltIn ? "اضغطي هنا لحجز طلبيتك الآن (التوصيل مجاني 🚚)" : (cfg?.ctaLabelAr || "اضغطي هنا لطلب المنتج الآن 🛒")}
            </button>
          </div>

          <div className="vx-adv-bar">
            {!isBuiltIn && cfg?.trustItems && cfg.trustItems.length > 0 ? (
              cfg.trustItems.slice(0, 4).map((item, idx) => (
                <div key={`${item.label}-${idx}`}>
                  <i>{item.icon || ["🚚", "🛡️", "✅", "🔄"][idx % 4]}</i>
                  <b>{item.label}</b>
                </div>
              ))
            ) : (
              <>
                <div><i>🚚</i><b>{freeShipping ? "توصيل مجاني" : "توصيل سريع"}</b><small>لجميع 58 ولاية</small></div>
                <div><i>🛡️</i><b>دفع عند الاستلام</b><small>افحصي قبل الدفع</small></div>
                <div><i>✅</i><b>جودة ملكية</b><small>تفاصيل متقنة</small></div>
                <div><i>🔄</i><b>ضمان الجودة</b><small>خدمة زبائن 100%</small></div>
              </>
            )}
          </div>
        </section>

        <div className="g5">
          {(isBuiltIn ? abayaImages.thumbs : (product.gallery && product.gallery.length > 0 ? product.gallery : [product.image]).slice(0, 5).map((src, i) => ({ key: `g-${i}`, src, label: product.details?.[i] || `${product.arName || product.name} ${i + 1}` }))).map(item => (
            <div key={item.key}>
              <img src={item.src} alt={item.label} loading="lazy" />
              <p>{item.label}</p>
            </div>
          ))}
        </div>

        <div className="pair">
          <div className="card">
            <b>لماذا تعشقها زبوناتنا ؟</b><br />
            {isBuiltIn ? (
              <>عباية من القطيفة الملكية الفاخرة بتطريز راقٍ، مرفقة بجمبسوت أسود أنيق يبرز القوام، بسعر استثنائي <b>7,500 دج فقط + توصيل مجاني</b> !</>
            ) : (
              <>{product.arDescription || product.description} — بسعر استثنائي <b>{unitPrice.toLocaleString("en-US")} دج فقط</b> !</>
            )}
          </div>
          <div className="pk"><div><span>🎁</span><br />{freeShipping ? <>التوصيل مجاني<br />0 دج</> : <>الدفع عند<br />الاستلام</>}</div></div>
        </div>

        <section className="reviews-sec" aria-label="آراء الزبونات">
          <div className="reviews-head">
            <strong>💬 آراء زبوناتنا بعد الاستلام</strong>
            <span>⭐ 4.9 / 5 (+500 تقييم)</span>
          </div>
          <div className="reviews-list">
            {!isBuiltIn && cfg?.reviews && cfg.reviews.length > 0 ? (
              cfg.reviews.slice(0, 3).map((rev, idx) => (
                <div className="review-item" key={`${rev.author}-${idx}`}>
                  <div className="review-meta">
                    <b>{rev.author}{rev.city ? ` · ${rev.city}` : ""} ✅</b>
                    <em>{"★".repeat(Math.min(5, Math.max(1, rev.rating || 5)))}</em>
                  </div>
                  <p>« {rev.text} »</p>
                </div>
              ))
            ) : (
              <>
                <div className="review-item">
                  <div className="review-meta">
                    <b>سارة ب. · الجزائر العاصمة ✅</b>
                    <em>★★★★★</em>
                  </div>
                  <p>« وصلتني اليوم والتوصيل كان مجاني لباب الدار ! القماش قطيفة ثقيلة والتطريز فخم بزاف أحسن حتى من الصور، يعطيكم الصحة ❤️ »</p>
                </div>
                <div className="review-item">
                  <div className="review-meta">
                    <b>أمينة م. · وهران ✅</b>
                    <em>★★★★★</em>
                  </div>
                  <p>« عباية ملكية صح والجمبسوت تاعها مريح بزاف ومقاسو مضبوط. فتحت الكولي وتأكدت منها قبل ما نخلص، ثقة ومعاملة راقية ! »</p>
                </div>
                <div className="review-item">
                  <div className="review-meta">
                    <b>نسرين ك. · قسنطينة ✅</b>
                    <em>★★★★★</em>
                  </div>
                  <p>« بهذ السعر 7500 دج ومع التوصيل باطل والله غير صفقة رائعة، ديت الخضراء الملكية خرجت عليا تهبل ننصح بيها كل وحدة ! »</p>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="o" id="order">
          <div className="o-royal-ribbon">
            <div className="o-royal-ribbon-text">
              <strong>👑 {isBuiltIn ? "عرض خاص : عباية رويال + جمبسوت" : `عرض خاص : ${cfg?.heroHeadlineAr || product.arName || product.name}`}</strong>
              <span>{freeShipping ? "🚚 التوصيل مجاني 100% لجميع الولايات !" : "🚚 توصيل سريع لـ 58 ولاية مع الدفع عند الاستلام !"}</span>
            </div>
            <div className="o-royal-ribbon-price">
              <b>{total} دج</b>
              <del>{oldPriceVal} دج</del>
            </div>
          </div>

          <div className="form-countdown">
            <span>⏳ ينتهي التخفيض والتوصيل المجاني خلال :</span>
            <div className="form-countdown-digits">
              <b>{hrs}</b>:<b>{mins}</b>:<b>{secs}</b>
            </div>
          </div>

          <div className="zero-risk-banner">
            <strong>✅ لا تدفعي أي شيء الآن ! احجزي قطعتك مجاناً</strong>
            <p>أدخلي اسمك ورقم هاتفك أدناه وسنتصل بك هاتفياً لتأكيد المقاس والعنوان بكل أمان 📞</p>
          </div>

          {orderNumber ? (
            <div className="ok" role="status">
              <h2>✔ شكراً لك، تم تسجيل طلبك بنجاح !</h2>
              <p>رقم الطلب: <b dir="ltr">{orderNumber}</b></p>
              <p>الإجمالي: <b>{total} دج</b> شامل التوصيل المجاني 🎁</p>
              <p>سنتصل بك قريباً لتأكيد المقاس والتوصيل.</p>
            </div>
          ) : (
            <div className="cols">
              <form ref={formRef} id="f" noValidate onSubmit={submit} onFocusCapture={startCheckout}>
                <CheckoutDraftNotice checked={checkout.consent} onChange={checkout.setConsent} status={checkout.draftStatus} error={checkout.draftError} />
                <input type="hidden" name="color" value={selectedColorChoice.storeValue} />
                <input type="hidden" name="size" value={size} />
                <input type="hidden" name="delivery" value={delivery} />

                <label>1️⃣ سجّلي معلوماتك للاتصال بك وتأكيد الطلب :</label>
                <div className="fld"><i aria-hidden="true">👤</i><input id="n" name="customer" aria-label="الاسم الكامل" aria-invalid={Boolean(errors.customer)} placeholder="الاسم الكامل (مثال: سارة بن علي)" autoComplete="name" /></div>
                <div className="err" id="e_n" role={errors.customer ? "alert" : undefined}>{errors.customer}</div>

                <div className="fld"><i aria-hidden="true">📞</i><input id="ph" name="phone" aria-label="رقم الهاتف" aria-invalid={Boolean(errors.phone)} inputMode="tel" placeholder="رقم الهاتف (05 / 06 / 07...)" autoComplete="tel" /></div>
                <div className="err" id="e_ph" role={errors.phone ? "alert" : undefined}>{errors.phone}</div>

                <div className="fld">
                  <i aria-hidden="true">📍</i>
                  <select id="w" name="wilaya" aria-label="الولاية" value={wilaya} onChange={event => { setWilaya(event.target.value); setCommune(""); }}>
                    <option value="">اختاري الولاية (التوصيل مجاني 🚚)</option>
                    {abayaWilayas.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div className="err" id="e_w" role={errors.wilaya ? "alert" : undefined}>{errors.wilaya}</div>

                <div className="fld">
                  <i aria-hidden="true">🏘️</i>
                  <select id="cm" name="commune" aria-label="البلدية" disabled={!wilaya} value={commune} onChange={event => setCommune(event.target.value)}>
                    <option value="">{wilaya ? "اختاري البلدية" : "اختاري الولاية أولاً"}</option>
                    {communes.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div className="err" id="e_cm" role={errors.commune ? "alert" : undefined}>{errors.commune}</div>

                <label>2️⃣ {isBuiltIn ? "اختاري لون العباية (مع الجمبسوت الأسود) :" : "اختاري اللون المفضل لديك :"}</label>
                <div className="sw sw-thumbs" id="cb">
                  {dynamicColorChoices.map(item => (
                    <button
                      type="button"
                      key={item.id}
                      data-c={item.id}
                      aria-pressed={color === item.id}
                      onClick={() => setColor(item.id)}
                    >
                      <img src={item.thumb} alt={item.label} className="sw-thumb-img" />
                      <span className="sw-thumb-meta">
                        <span className="dot" style={{ background: item.hex }} />
                        <b>{item.label}</b>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="form-color-preview">
                  <img src={activeColorPreview.thumb} alt={activeColorPreview.caption} />
                  <div>
                    <small>اختيارك الحالي :</small>
                    <b>{activeColorPreview.caption}</b>
                    <span>{freeShipping ? "🚚 التوصيل مجاني (0 دج) · " : ""}{total} دج فقط</span>
                  </div>
                </div>
                <div className="err" id="e_c" role={errors.color ? "alert" : undefined}>{errors.color}</div>

                {dynamicSizes.length > 0 ? (
                  <>
                    <label>3️⃣ اختاري المقاس المناسب :</label>
                    <div className="size-pills" id="sz" role="group" aria-label="المقاس">
                      {dynamicSizes.map(item => (
                        <button
                          type="button"
                          key={item}
                          aria-pressed={size === item}
                          onClick={() => setSize(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    <div className="err" id="e_s" role={errors.size ? "alert" : undefined}>{errors.size}</div>
                  </>
                ) : null}

                <label>{dynamicSizes.length > 0 ? "4️⃣" : "3️⃣"} مكان الاستلام {freeShipping ? "(مجاني في الحالتين 🎁)" : ":"}</label>
                <div className="sw" id="dv">
                  <button type="button" data-d="home" aria-pressed={delivery === "home"} onClick={() => setDelivery("home")}>🏠 لباب المنزل {freeShipping ? "(مجاناً)" : ""}</button>
                  <button type="button" data-d="office" aria-pressed={delivery === "office"} onClick={() => setDelivery("office")}>🏢 مكتب التوصيل {freeShipping ? "(مجاناً)" : ""}</button>
                </div>

                <div className="fld fld-textarea">
                  <i aria-hidden="true">💬</i>
                  <textarea id="nt" name="note" aria-label="ملاحظة اختيارية" rows={2} maxLength={300} placeholder="ملاحظة إضافية (اختياري)" style={{ borderRadius: 20 }} />
                </div>

                <div className="sum" id="sum">
                  <div className="sum-row">
                    <span>{isBuiltIn ? "الطقم" : (product.arName || product.name)} ({selectedColorChoice.label}{dynamicSizes.length > 0 ? ` · مقاس ${size || "-"}` : ""})</span>
                    <b>{total} دج</b>
                  </div>
                  <div className="sum-row">
                    <span>سعر التوصيل ({wilaya || "كل الولايات"})</span>
                    <span className="sum-free">
                      {freeShipping
                        ? "مجاني 0 دج 🎁"
                        : !wilaya
                          ? "حددي الولاية"
                          : shippingFee > 0
                            ? `${shippingFee} دج`
                            : "حسب الولاية"}
                    </span>
                  </div>
                  <div className="sum-total">
                    <span>المبلغ الإجمالي عند الاستلام :</span>
                    <strong>{grandTotal} دج فقط</strong>
                  </div>
                </div>

                <div className="err" id="e_f" role={errors.form || checkout.draftError ? "alert" : undefined}>{errors.form || checkout.draftError}</div>
                <button className="btn" id="b" type="submit" disabled={product.stock <= 0 || checkout.pending}>
                  {checkout.pending
                    ? "جارٍ إرسال الطلب…"
                    : !isBuiltIn && cfg?.ctaLabelAr
                      ? `${cfg.ctaLabelAr} — ${grandTotal} دج 🛒`
                      : `أؤكد طلبي الآن — ${grandTotal} دج${freeShipping ? " + توصيل مجاني" : ""} 🛒`}
                </button>
                <div className="btn-subnote">
                  🔒 الدفع عند الاستلام بعد فحص الطلبية
                </div>
              </form>
              <div className="ft">
                <div><i>🎁</i>{freeShipping ? "توصيل مجاني 0 دج" : "توصيل سريع"}</div>
                <div><i>🔍</i>افحصي قبل الدفع</div>
                <div><i>⚡</i>توصيل سريع 58 ولاية</div>
              </div>
            </div>
          )}
        </section>

        {isBuiltIn ? (
          <Link className="oth" href={doudoune ? `/produit/${doudoune.slug}` : "/produit/doudoune-hiver-luxe"}>
            <img src="/manus-storage/doudoune-bg.jpg" alt="دواقون شتوية فاخرة" />
            <div><small>اكتشفي أيضاً عرض الشتاء 🔥</small><b>دواقون شتوية فاخرة — 7,600 دج</b></div>
          </Link>
        ) : null}

        <div className="fb">
          <div><span>🎁</span>{freeShipping ? "توصيل مجاني 58 ولاية" : "توصيل 58 ولاية"}</div>
          <div><span>🔍</span>افحصي طلبك قبل الدفع</div>
          <div><span>💛</span>الدفع عند الاستلام 100% أمان</div>
        </div>
        <div className="q">كوني دائماً مميزة ... اختاري ما يناسبك</div>

        <div className="abaya-sticky-bar">
          <div className="abaya-sticky-inner">
            <div className="abaya-sticky-price">
              <small>{freeShipping ? "🚚 التوصيل مجاني 0 دج" : "🚚 الدفع عند الاستلام"}</small>
              <strong>{grandTotal} دج</strong>
              <del>{oldPriceVal} دج</del>
            </div>
            <a
              href="#order"
              className="abaya-sticky-btn"
              onClick={e => {
                e.preventDefault();
                scrollToOrderForm();
              }}
            >
              🛒 {isBuiltIn ? "احجزي الآن — توصيل مجاني" : (cfg?.ctaLabelAr || "احجزي الآن")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

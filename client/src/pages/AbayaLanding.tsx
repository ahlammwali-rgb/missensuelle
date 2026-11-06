import React, { type FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Search, ShoppingBag } from "lucide-react";
import { abayaCommunesByWilaya, abayaWilayas } from "@/lib/abaya-communes";
import { abayaImages } from "@/lib/abaya-images";
import { getProduct, type Product } from "@/lib/store-data";
import { trackPixelEvent } from "@/lib/tracking";
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
  const [color, setColor] = useState<AbayaColor>("green");
  const [wilaya, setWilaya] = useState("");
  const [commune, setCommune] = useState("");
  const [size, setSize] = useState("L");
  const [delivery, setDelivery] = useState<"home" | "office">("home");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [orderNumber, setOrderNumber] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(2 * 3600 + 43 * 60 + 50);
  const formRef = useRef<HTMLFormElement>(null);
  const checkoutStarted = useRef(false);

  useEffect(() => {
    trackPixelEvent("ViewContent", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: product.name,
      value: 7500,
      currency: "DZD",
    });
  }, [product.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const current: AbayaColor = color === "black" ? "black" : "green";
  const activeColorPreview = abayaImages.colorPreviews[current];
  const doudoune = getProduct("doudoune-hiver-luxe");
  const communes = abayaCommunesByWilaya[wilaya] ?? [];
  const unitPrice = 7500;
  const total = unitPrice * quantity;
  const selectedColorChoice = colorChoices.find(c => c.id === color) ?? colorChoices[0];

  const checkout = useCheckoutDraft({
    formRef,
    source: "abaya",
    getItems: () => [{ productId: product.id, quantity, color: selectedColorChoice.storeValue, size }],
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
    if (!size) nextErrors.size = "اختاري المقاس";
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
          🚚 <span>التوصيل مجاني 100%</span> لجميع 58 ولاية · الدفع عند الاستلام وفحص الطلبية قبل الدفع 🔥
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

        <section className="hx hx-poster" aria-label="عباية رويال + Jump suit">
          <div className="hero-poster-wrap">
            <img
              id="hero"
              src={abayaImages.mainHero}
              alt="عباية رويال + Jump suit — عرض خاص 7500 دج + توصيل مجاني"
              width="1024"
              height="840"
              fetchPriority="high"
            />
            <div className="hero-price-badge-7500">
              <strong>7500 دج</strong>
              <del>14000 دج</del>
              <span>🚚 التوصيل مجاني</span>
            </div>
          </div>

          <div className="hero-conversion-box">
            <div className="hero-conv-top">
              <div className="hero-conv-title">
                <h1>👑 طقم عباية رويال + جمبسوت أسود</h1>
                <small>✅ توصيل مجاني لباب المنزل (0 دج) · الدفع عند الاستلام</small>
              </div>
              <div className="hero-conv-price">
                <b>7,500 دج</b>
                <del>14,000 دج</del>
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
              👇 اضغطي هنا لحجز طلبيتك الآن (التوصيل مجاني 🚚)
            </button>
          </div>

          <div className="vx-adv-bar">
            <div><i>🚚</i><b>توصيل مجاني</b><small>لجميع 58 ولاية</small></div>
            <div><i>🛡️</i><b>دفع عند الاستلام</b><small>افحصي قبل الدفع</small></div>
            <div><i>✅</i><b>قطيفة ملكية</b><small>تطريز حر متقن</small></div>
            <div><i>🔄</i><b>تبديل المقاس</b><small>مضمون 100%</small></div>
          </div>
        </section>

        <div className="g5">
          {abayaImages.thumbs.map(item => (
            <div key={item.key}>
              <img src={item.src} alt={item.label} loading="lazy" />
              <p>{item.label}</p>
            </div>
          ))}
        </div>

        <div className="pair">
          <div className="card">
            <b>لماذا تعشقها زبوناتنا ؟</b><br />
            عباية من القطيفة الملكية الفاخرة بتطريز راقٍ، مرفقة بجمبسوت أسود أنيق يبرز القوام، بسعر استثنائي <b>7,500 دج فقط + توصيل مجاني</b> !
          </div>
          <div className="pk"><div><span>🎁</span><br />التوصيل مجاني<br />0 دج</div></div>
        </div>

        <section className="reviews-sec" aria-label="آراء الزبونات">
          <div className="reviews-head">
            <strong>💬 آراء زبوناتنا بعد الاستلام</strong>
            <span>⭐ 4.9 / 5 (+500 تقييم)</span>
          </div>
          <div className="reviews-list">
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
          </div>
        </section>

        <section className="o" id="order">
          <div className="o-royal-ribbon">
            <div className="o-royal-ribbon-text">
              <strong>👑 عرض خاص : عباية رويال + جمبسوت</strong>
              <span>🚚 التوصيل مجاني 100% لجميع الولايات !</span>
            </div>
            <div className="o-royal-ribbon-price">
              <b>{total} دج</b>
              <del>14000 دج</del>
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

                <label>2️⃣ اختاري لون العباية (مع الجمبسوت الأسود) :</label>
                <div className="sw sw-thumbs" id="cb">
                  {colorChoices.map(item => (
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
                    <span>🚚 التوصيل مجاني (0 دج) · {total} دج فقط</span>
                  </div>
                </div>
                <div className="err" id="e_c" role={errors.color ? "alert" : undefined}>{errors.color}</div>

                <label>3️⃣ اختاري المقاس المناسب :</label>
                <div className="size-pills" id="sz" role="group" aria-label="المقاس">
                  {SIZES.map(item => (
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

                <label>4️⃣ مكان الاستلام (مجاني في الحالتين 🎁) :</label>
                <div className="sw" id="dv">
                  <button type="button" data-d="home" aria-pressed={delivery === "home"} onClick={() => setDelivery("home")}>🏠 لباب المنزل (مجاناً)</button>
                  <button type="button" data-d="office" aria-pressed={delivery === "office"} onClick={() => setDelivery("office")}>🏢 مكتب التوصيل (مجاناً)</button>
                </div>

                <div className="fld fld-textarea">
                  <i aria-hidden="true">💬</i>
                  <textarea id="nt" name="note" aria-label="ملاحظة اختيارية" rows={2} maxLength={300} placeholder="ملاحظة إضافية (اختياري)" style={{ borderRadius: 20 }} />
                </div>

                <div className="sum" id="sum">
                  <div className="sum-row">
                    <span>الطقم ({selectedColorChoice.label} · مقاس {size || "-"})</span>
                    <b>{total} دج</b>
                  </div>
                  <div className="sum-row">
                    <span>سعر التوصيل ({wilaya || "كل الولايات"})</span>
                    <span className="sum-free">مجاني 0 دج 🎁</span>
                  </div>
                  <div className="sum-total">
                    <span>المبلغ الإجمالي عند الاستلام :</span>
                    <strong>{total} دج فقط</strong>
                  </div>
                </div>

                <div className="err" id="e_f" role={errors.form || checkout.draftError ? "alert" : undefined}>{errors.form || checkout.draftError}</div>
                <button className="btn" id="b" type="submit" disabled={product.stock <= 0 || checkout.pending}>
                  {checkout.pending ? "جارٍ إرسال الطلب…" : `أؤكد طلبي الآن — ${total} دج + توصيل مجاني 🛒`}
                </button>
                <div className="btn-subnote">
                  🔒 الدفع عند الاستلام بعد فحص الطلبية · استبدال المقاس مضمون
                </div>
              </form>
              <div className="ft">
                <div><i>🎁</i>توصيل مجاني 0 دج</div>
                <div><i>🔍</i>افحصي قبل الدفع</div>
                <div><i>⚡</i>توصيل سريع 58 ولاية</div>
              </div>
            </div>
          )}
        </section>

        <Link className="oth" href={doudoune ? `/produit/${doudoune.slug}` : "/produit/doudoune-hiver-luxe"}>
          <img src="/manus-storage/doudoune-bg.jpg" alt="دواقون شتوية فاخرة" />
          <div><small>اكتشفي أيضاً عرض الشتاء 🔥</small><b>دواقون شتوية فاخرة — 7,600 دج</b></div>
        </Link>

        <div className="fb">
          <div><span>🎁</span>توصيل مجاني 58 ولاية</div>
          <div><span>🔍</span>افحصي طلبك قبل الدفع</div>
          <div><span>💛</span>الدفع عند الاستلام 100% أمان</div>
        </div>
        <div className="q">كوني دائماً مميزة ... اختاري ما يناسبك</div>

        <div className="abaya-sticky-bar">
          <div className="abaya-sticky-inner">
            <div className="abaya-sticky-price">
              <small>🚚 التوصيل مجاني 0 دج</small>
              <strong>{total} دج</strong>
              <del>14000 دج</del>
            </div>
            <a
              href="#order"
              className="abaya-sticky-btn"
              onClick={e => {
                e.preventDefault();
                scrollToOrderForm();
              }}
            >
              🛒 احجزي الآن — توصيل مجاني
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

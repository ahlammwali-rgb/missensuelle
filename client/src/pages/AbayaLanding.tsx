import React, { type FormEvent, useRef, useState } from "react";
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

export default function AbayaLanding({ product, quantity = 1 }: { product: Product; quantity?: number }) {
  const [color, setColor] = useState<AbayaColor>("green");
  const [wilaya, setWilaya] = useState("");
  const [commune, setCommune] = useState("");
  const [size, setSize] = useState("");
  const [delivery, setDelivery] = useState<"home" | "office">("home");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [orderNumber, setOrderNumber] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const checkoutStarted = useRef(false);

  const current: AbayaColor = color === "black" ? "black" : "green";
  const activeColorPreview = abayaImages.colorPreviews[current];
  const coat = getProduct("blazer-lilac-dream");
  const communes = abayaCommunesByWilaya[wilaya] ?? [];
  const total = product.price * quantity;
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
    trackPixelEvent("InitiateCheckout", { content_ids: [product.id], value: total, currency: "DZD" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (orderNumber || checkout.pending) return;
    const form = new FormData(event.currentTarget);
    const customer = String(form.get("customer") ?? "").trim();
    const phone = String(form.get("phone") ?? "").replace(/[\s().-]/g, "");
    const nextErrors: Record<string, string> = {};
    if (customer.length < 3) nextErrors.customer = "أدخلي اسمك الكامل";
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
    trackPixelEvent("Purchase", { content_ids: [product.id], value: result.total, currency: "DZD", order_id: result.orderNumber });
  }

  return (
    <div className="abaya-template" dir="rtl">
      <div className="w">
        <header className="hd">
          <Link href="/catalogue" className="hb" aria-label="القائمة"><i /><i /><i /></Link>
          <Link href="/" className="lg-link"><img className="lg" src={abayaImages.logo} alt="Miss Sensuelle" /></Link>
          <div className="ic">
            <Link href="/catalogue" aria-label="البحث"><Search size={27} /></Link>
            <a className="bag" href="#order" aria-label="اطلبي الآن" onClick={startCheckout}>
              <ShoppingBag size={27} />
              <em>{quantity}</em>
            </a>
            <span className="flag" aria-label="الجزائر">☪</span>
          </div>
        </header>

        <section className="hx hx-poster" aria-label="عباية رويال + Jump suit">
          <img
            id="hero"
            src={abayaImages.mainHero}
            alt="عباية رويال + Jump suit — عرض خاص 9600 دج"
            width="1024"
            height="840"
            fetchPriority="high"
          />
          <div className="vx-adv-bar">
            <div><i>🚚</i><b>توصيل سريع</b><small>لكل ولايات الجزائر</small></div>
            <div><i>🛡️</i><b>دفع عند الاستلام</b><small>أمان تام</small></div>
            <div><i>✅</i><b>جودة مضمونة</b><small>100%</small></div>
            <div><i>📦</i><b>إمكانية الاستبدال</b><small>خلال 7 أيام</small></div>
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
            <b>جودة تتحدث عن نفسها</b><br />
            عباية من القطيفة الفاخرة بتطريز راقٍ، مع جمبسوت أنيق، لإطلالة متكاملة في كل مناسبة.
          </div>
          <div className="pk"><div><span>👑</span><br />رضاك يهمنا</div></div>
        </div>

        <section className="o" id="order">
          <div className="o-royal-ribbon">
            <div className="o-royal-ribbon-text">
              <strong>👑 عرض ملكي خاص (عباية + جمبسوت)</strong>
              <span>كمية محدودة جداً · الدفع عند الاستلام</span>
            </div>
            <div className="o-royal-ribbon-price">
              <b>{total} دج</b>
              <del>14000 دج</del>
            </div>
          </div>
          <div className="bt">🔥 اطلبي الآن 🛒</div>
          <h3>املئي الاستمارة أدناه لتأكيد طلبك فوراً</h3>
          {orderNumber ? (
            <div className="ok" role="status">
              <h2>✔ شكراً لك، تم تسجيل طلبك</h2>
              <p>رقم الطلب: <b dir="ltr">{orderNumber}</b></p>
              <p>سنتصل بك قريباً لتأكيد التوصيل.</p>
            </div>
          ) : (
            <div className="cols">
              <form ref={formRef} id="f" noValidate onSubmit={submit} onFocusCapture={startCheckout}>
                <CheckoutDraftNotice checked={checkout.consent} onChange={checkout.setConsent} status={checkout.draftStatus} error={checkout.draftError} />
                <input type="hidden" name="color" value={selectedColorChoice.storeValue} />
                <input type="hidden" name="delivery" value={delivery} />

                <label>✨ اختاري لون العباية الملكية (مع الجمبسوت الأسود)</label>
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
                    <small>اللون المختار حالياً :</small>
                    <b>{activeColorPreview.caption}</b>
                    <span>السعر: {total} دج · الدفع عند الاستلام</span>
                  </div>
                </div>
                <div className="err" id="e_c" role={errors.color ? "alert" : undefined}>{errors.color}</div>

                <div className="fld"><i aria-hidden="true">👤</i><input id="n" name="customer" aria-label="الاسم الكامل" aria-invalid={Boolean(errors.customer)} placeholder="الاسم الكامل" autoComplete="name" /></div>
                <div className="err" id="e_n" role={errors.customer ? "alert" : undefined}>{errors.customer}</div>

                <div className="fld"><i aria-hidden="true">📞</i><input id="ph" name="phone" aria-label="رقم الهاتف" aria-invalid={Boolean(errors.phone)} inputMode="tel" placeholder="رقم الهاتف (07...)" autoComplete="tel" /></div>
                <div className="err" id="e_ph" role={errors.phone ? "alert" : undefined}>{errors.phone}</div>

                <div className="fld">
                  <i aria-hidden="true">📍</i>
                  <select id="w" name="wilaya" aria-label="الولاية" value={wilaya} onChange={event => { setWilaya(event.target.value); setCommune(""); }}>
                    <option value="">الولاية</option>
                    {abayaWilayas.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div className="err" id="e_w" role={errors.wilaya ? "alert" : undefined}>{errors.wilaya}</div>

                <div className="fld">
                  <i aria-hidden="true">🏘️</i>
                  <select id="cm" name="commune" aria-label="البلدية" disabled={!wilaya} value={commune} onChange={event => setCommune(event.target.value)}>
                    <option value="">البلدية</option>
                    {communes.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div className="err" id="e_cm" role={errors.commune ? "alert" : undefined}>{errors.commune}</div>

                <div className="fld" id="sz">
                  <i aria-hidden="true">📏</i>
                  <select id="s" name="size" aria-label="المقاس" value={size} onChange={event => setSize(event.target.value)}>
                    <option value="">المقاس</option>
                    {["S", "M", "L", "XL", "XXL"].map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div className="err" id="e_s" role={errors.size ? "alert" : undefined}>{errors.size}</div>

                <label>🚚 نوع التوصيل</label>
                <div className="sw" id="dv">
                  <button type="button" data-d="home" aria-pressed={delivery === "home"} onClick={() => setDelivery("home")}>🏠 إلى المنزل</button>
                  <button type="button" data-d="office" aria-pressed={delivery === "office"} onClick={() => setDelivery("office")}>🏢 إلى المكتب</button>
                </div>

                <div className="fld fld-textarea">
                  <i aria-hidden="true">💬</i>
                  <textarea id="nt" name="note" aria-label="ملاحظة اختيارية" rows={2} maxLength={300} placeholder="ملاحظة (اختياري)" style={{ borderRadius: 20 }} />
                </div>

                <div className="sum" id="sum">
                  المقاس: {size || "-"}<br />
                  اللون: {selectedColorChoice.label}<br />
                  الولاية: {wilaya || "-"} | البلدية: {commune || "-"}<br />
                  التوصيل: {delivery === "home" ? "إلى المنزل" : "إلى المكتب"}<br />
                  <b>الإجمالي: {total} دج</b> - الدفع عند الاستلام
                </div>

                <div className="err" id="e_f" role={errors.form || checkout.draftError ? "alert" : undefined}>{errors.form || checkout.draftError}</div>
                <button className="btn" id="b" type="submit" disabled={product.stock <= 0 || checkout.pending}>
                  {checkout.pending ? "جارٍ إرسال الطلب…" : `أؤكد طلبي الآن 🛒 — ${total} دج`}
                </button>
              </form>
              <div className="ft">
                <div><i>🛡️</i>طلبك آمن 100%</div>
                <div><i>🚚</i>توصيل سريع 58 ولاية</div>
                <div><i>🎁</i>الدفع عند الاستلام</div>
              </div>
            </div>
          )}
        </section>

        <Link className="oth" href={coat ? `/produit/${coat.slug}` : "/produit/blazer-lilac-dream"}>
          <img src={abayaImages.otherCoat} alt="معطف شتوي فاخر" />
          <div><small>اكتشفي أيضاً</small><b>معطف شتوي فاخر</b></div>
        </Link>

        <div className="fb">
          <div><span>🔒</span>رضاك يهمنا</div>
          <div><span>🚚</span>توصيل سريع لكل الولايات</div>
          <div><span>💛</span>الدفع عند الاستلام 100% أمان</div>
        </div>
        <div className="q">كوني دائماً مميزة ... اختاري ما يناسبك</div>

        <div className="abaya-sticky-bar">
          <div className="abaya-sticky-inner">
            <div className="abaya-sticky-price">
              <small>👑 عرض خاص (عباية + جمبسوت)</small>
              <strong>{total} دج</strong>
              <del>14000 دج</del>
            </div>
            <a
              href="#order"
              className="abaya-sticky-btn"
              onClick={e => {
                e.preventDefault();
                startCheckout();
                document.getElementById("order")?.scrollIntoView({ behavior: "smooth", block: "start" });
                window.setTimeout(() => {
                  const firstInput = document.getElementById("n") as HTMLInputElement | null;
                  firstInput?.focus({ preventScroll: true });
                }, 450);
              }}
            >
              🛒 اشتري الآن — اطلبي هنا
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

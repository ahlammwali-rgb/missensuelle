import React, { type FormEvent, useRef, useState } from "react";
import { Link } from "wouter";
import { Search, ShoppingBag } from "lucide-react";
import { abayaCommunesByWilaya, abayaWilayas } from "@/lib/abaya-communes";
import { coatImages } from "@/lib/coat-images";
import { getProduct, type Product } from "@/lib/store-data";
import { trackPixelEvent } from "@/lib/tracking";
import { CheckoutDraftNotice } from "@/components/CheckoutDraftNotice";
import { useCheckoutDraft } from "@/components/useCheckoutDraft";
import "./coat-template.css";

type CoatColor = "black" | "white";
const detailNames = { collar: "ياقة فرو ناعمة", buttons: "أزرار فخمة", cuffs: "أكمام فرو أنيقة", back: "تصميم أنثوي" } as const;
const colorChoices = [{ id: "black" as const, label: "أسود", hex: "#111" }, { id: "white" as const, label: "أبيض", hex: "#f4ecdf" }];

export default function CoatLanding({ product, quantity = 1 }: { product: Product; quantity?: number }) {
  const [color, setColor] = useState<CoatColor | null>(null);
  const [wilaya, setWilaya] = useState("");
  const [commune, setCommune] = useState("");
  const [size, setSize] = useState("");
  const [delivery, setDelivery] = useState<"home" | "office">("home");
  const [errors, setErrors] = useState<Record<string, string>>( {} );
  const [orderNumber, setOrderNumber] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const checkoutStarted = useRef(false);
  const current = color ?? "black";
  const images = coatImages[current];
  const abaya = getProduct("abaya-royal-emerald");
  const communes = abayaCommunesByWilaya[wilaya] ?? [];
  const total = product.price * quantity;
  const checkout = useCheckoutDraft({
    formRef,
    source: "coat",
    getItems: () => [{ productId: product.id, quantity, color: color === "white" ? "Blanc" : "Noir", size }],
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
    // Horodatage réel de commande : { createdAt: new Date().toISOString() }
    trackPixelEvent("Purchase", { content_ids: [product.id], value: result.total, currency: "DZD", order_id: result.orderNumber });
  }

  return (
    <div className={`coat-template ${current}`} dir="rtl">
      <div className="w">
        <header className="hd">
          <Link href="/catalogue" className="hb" aria-label="القائمة"><i /><i /><i /></Link>
          <Link href="/" className="logo coat-brand">MISS <i>SENSUELLE</i></Link>
          <div className="ic"><Link href="/catalogue" aria-label="البحث"><Search size={27} /></Link><a className="bag" href="#order" aria-label="اطلبي الآن" onClick={startCheckout}><ShoppingBag size={27} /></a><span className="flag" aria-label="الجزائر">☪</span></div>
        </header>
        <section className="hx" aria-label="معطف شتوي فاخر">
          <img src={images.hero} alt="معطف شتوي فاخر" width="858" height="674" fetchPriority="high" />
          <div className="hx-t1">معطف شتوي فاخر</div><div className="hx-t2">ستايل أنيق و دافئ <b>♥</b></div>
          <ul className="hx-ck"><li>قماش عالي الجودة</li><li>مناسب لجميع المناسبات</li><li>مريح و خفيف</li></ul>
          <div className="hx-pr"><small>تخفيض خاص</small><b>{product.price} DA</b>{product.oldPrice && <s>{product.oldPrice} DA</s>}</div>
          <div className="hx-av">{product.stock > 0 ? "✔ المنتج متوفر الآن" : "المنتج غير متوفر حالياً"}</div>
          <div className="hx-adv"><div><span>🚚</span>توصيل سريع<br />لكل ولايات الجزائر</div><div><span>🛡️</span>الدفع عند الاستلام<br />أمان تام</div><div><span>✅</span>ضمان 7 أيام<br />إرجاع أو استبدال</div></div>
        </section>
        <div className="g4">{(Object.keys(detailNames) as Array<keyof typeof detailNames>).map(key => <div key={key}><img src={images[key]} alt={detailNames[key]} loading="lazy" /><p>{detailNames[key]}</p></div>)}</div>
        <div className="row"><div className="man"><img src={images.mannequin} alt="معطف من كل الزوايا" loading="lazy" /><em>360° كل الزوايا</em></div><div className="card"><b>جودة تتحدث عن نفسها</b><br />فرو ناعم عند الياقة والأكمام، أزرار ذهبية فخمة، وقصة أنثوية واسعة تمنحك إطلالة راقية ودافئة.</div></div>
        <div className="trust"><div><span>💛</span>خاص بك سيدتي</div><div><span>👑</span>جودة عالية</div><div><span>🛡️</span>ضمان الجودة</div></div>
        <section className="o" id="order">
          <div className="rib">اطلبي معطفك الآن!</div><h2>اطلبي الآن</h2>
          {orderNumber ? <div className="ok" role="status"><h2>✔ شكراً لك، تم تسجيل طلبك</h2><p>رقم الطلب: <b dir="ltr">{orderNumber}</b></p><p>سنتصل بك قريباً لتأكيد التوصيل.</p></div> : (
            <form ref={formRef} noValidate onSubmit={submit} onFocusCapture={startCheckout}>
              <CheckoutDraftNotice checked={checkout.consent} onChange={checkout.setConsent} status={checkout.draftStatus} error={checkout.draftError} />
              <input type="hidden" name="color" value={color === "white" ? "Blanc" : "Noir"} />
              <input type="hidden" name="delivery" value={delivery} />
              <div className="gr">
                <div><div className="fld"><i aria-hidden="true">👤</i><input name="customer" aria-label="الاسم الكامل" aria-invalid={Boolean(errors.customer)} required placeholder="الاسم الكامل" autoComplete="name" /></div><div className="err" role={errors.customer ? "alert" : undefined}>{errors.customer}</div></div>
                <div><div className="fld"><i aria-hidden="true">📞</i><input name="phone" aria-label="رقم الهاتف" aria-invalid={Boolean(errors.phone)} type="tel" inputMode="tel" required placeholder="رقم الهاتف (07...)" autoComplete="tel" /></div><div className="err" role={errors.phone ? "alert" : undefined}>{errors.phone}</div></div>
                <div><div className="fld"><i aria-hidden="true">📍</i><select name="wilaya" aria-label="الولاية" required value={wilaya} onChange={event => { setWilaya(event.target.value); setCommune(""); }}><option value="">الولاية</option>{abayaWilayas.map(item => <option key={item}>{item}</option>)}</select></div><div className="err" role={errors.wilaya ? "alert" : undefined}>{errors.wilaya}</div></div>
                <div><div className="fld"><i aria-hidden="true">🏘️</i><select name="commune" aria-label="البلدية" required disabled={!wilaya} value={commune} onChange={event => setCommune(event.target.value)}><option value="">البلدية</option>{communes.map(item => <option key={item}>{item}</option>)}</select></div><div className="err" role={errors.commune ? "alert" : undefined}>{errors.commune}</div></div>
                <div style={{ gridColumn: "1 / -1" }}><div className="fld"><i aria-hidden="true">📏</i><select name="size" aria-label="المقاس" required value={size} onChange={event => setSize(event.target.value)}><option value="">المقاس</option>{["S", "M", "L", "XL", "XXL"].map(item => <option key={item}>{item}</option>)}</select></div><div className="err" role={errors.size ? "alert" : undefined}>{errors.size}</div></div>
              </div>
              <label>اللون</label><div className="sw">{colorChoices.map(item => <button type="button" key={item.id} aria-pressed={color === item.id} onClick={() => setColor(item.id)}><span className="dot" style={{ background: item.hex }} />{item.label}</button>)}</div><div className="err" role={errors.color ? "alert" : undefined}>{errors.color}</div>
              <label>نوع التوصيل</label><div className="sw"><button type="button" aria-pressed={delivery === "home"} onClick={() => setDelivery("home")}>🏠 إلى المنزل</button><button type="button" aria-pressed={delivery === "office"} onClick={() => setDelivery("office")}>🏢 إلى المكتب</button></div>
              <div className="fld" style={{ marginTop: 10 }}><i aria-hidden="true">💬</i><textarea name="note" aria-label="ملاحظة اختيارية" rows={2} maxLength={300} placeholder="ملاحظة (اختياري)" style={{ borderRadius: 20 }} /></div>
              <div className="sum">المقاس: {size || "—"} | اللون: {colorChoices.find(item => item.id === color)?.label ?? "—"}<br />الولاية: {wilaya || "—"} | البلدية: {commune || "—"}<br />التوصيل: {delivery === "home" ? "إلى المنزل" : "إلى المكتب"}<br /><b>سعر المنتج: <span dir="ltr">{total} DA</span></b> — الدفع عند الاستلام<br /><small>مصاريف التوصيل تُؤكد هاتفياً حسب الولاية.</small></div>
              <div className="err" role={errors.form || checkout.draftError ? "alert" : undefined}>{errors.form || checkout.draftError}</div><button className="btn" type="submit" disabled={product.stock <= 0 || checkout.pending}>{checkout.pending ? "جارٍ إرسال الطلب…" : "أكدي طلبك الآن 🛒"}</button>
            </form>
          )}
        </section>
        {abaya && <Link className="oth" href={`/produit/${abaya.slug}`}><img src={abaya.image} alt="" /><div><small>اكتشفي أيضاً</small><b>عباية رويال + Jump suit</b></div></Link>}
        <footer><div><span>🔒</span>دفع آمن 100%</div><div><span>🚚</span>توصيل سريع<br />1-3 أيام</div><div><span>💛</span>رضاك يهمنا</div></footer>
      </div>
    </div>
  );
}

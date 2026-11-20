import React, { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Search, ShoppingBag } from "lucide-react";
import { abayaCommunesByWilaya, abayaWilayas } from "@/lib/abaya-communes";
import { coatImages } from "@/lib/coat-images";
import { getProduct, type Product } from "@/lib/store-data";
import { trackPixelEvent } from "@/lib/tracking";
import { trpc } from "@/lib/trpc";
import { shippingFeeFor } from "@shared/shipping";
import { CheckoutDraftNotice } from "@/components/CheckoutDraftNotice";
import { useCheckoutDraft } from "@/components/useCheckoutDraft";
import "./coat-template.css";

type CoatColor = "black" | "white";
const detailNames = { collar: "ياقة فرو ناعمة", buttons: "أزرار فخمة", cuffs: "أكمام فرو أنيقة", back: "تصميم أنثوي" } as const;
const colorChoices = [{ id: "black" as const, label: "أسود", hex: "#111" }, { id: "white" as const, label: "أبيض", hex: "#f4ecdf" }];

export default function CoatLanding({ product, quantity = 1 }: { product: Product; quantity?: number }) {
  const cfg = product.landingConfig;
  const isBuiltIn =
    !cfg &&
    (product.id === "p-001" || product.slug === "blazer-lilac-dream") &&
    (!product.image || product.image === coatImages.black.hero);
  const dynamicColorChoices =
    !isBuiltIn && cfg?.colorSwatches && cfg.colorSwatches.length > 0
      ? cfg.colorSwatches.map((sw, idx) => ({
          id: sw.name || `اللون ${idx + 1}`,
          label: sw.name || `اللون ${idx + 1}`,
          hex: sw.hex || (idx % 2 === 0 ? "#111" : "#f4ecdf"),
          image: product.variantImages?.[idx]?.image || product.gallery?.[idx] || product.image,
        }))
      : !isBuiltIn && product.variantImages && product.variantImages.length > 0
        ? product.variantImages.map((v, idx) => ({
            id: v.name || `اللون ${idx + 1}`,
            label: v.name || `اللون ${idx + 1}`,
            hex: idx % 2 === 0 ? "#111" : "#f4ecdf",
            image: v.image || product.gallery?.[idx] || product.image,
          }))
        : !isBuiltIn && product.colors && product.colors.length > 0
          ? product.colors.map((c, idx) => ({
              id: c,
              label: c,
              hex: idx % 2 === 0 ? "#111" : "#f4ecdf",
              image: product.gallery?.[idx] || product.image,
            }))
          : !isBuiltIn && product.gallery && product.gallery.length > 0
            ? product.gallery.map((img, idx) => ({
                id: `الموديل ${idx + 1}`,
                label: `الموديل ${idx + 1}`,
                hex: idx % 2 === 0 ? "#111" : "#f4ecdf",
                image: img,
              }))
            : colorChoices.map(c => ({ ...c, image: "" }));

  const dynamicSizes = isBuiltIn
    ? ["S", "M", "L", "XL", "XXL"]
    : cfg?.sizes !== undefined
      ? cfg.sizes.map(s => s.label)
      : ["S", "M", "L", "XL", "XXL"];

  const [color, setColor] = useState<string | null>(null);
  const [wilaya, setWilaya] = useState("");
  const [commune, setCommune] = useState("");
  const [size, setSize] = useState("");
  const [delivery, setDelivery] = useState<"home" | "office">("home");
  const [errors, setErrors] = useState<Record<string, string>>( {} );
  const [orderNumber, setOrderNumber] = useState("");
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
    return () => {
      if (!isBuiltIn) document.title = prevTitle;
    };
  }, [isBuiltIn, product.arName, product.name]);
  const current: CoatColor = color === "white" ? "white" : "black";
  const images = coatImages[current];
  const abaya = getProduct("abaya-royal-emerald");
  const ratesQuery = trpc.store.shippingRates.useQuery(undefined, {
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const communes = abayaCommunesByWilaya[wilaya] ?? [];
  const total = product.price * quantity;
  const homeFee = wilaya ? shippingFeeFor(ratesQuery.data?.rates, wilaya, "home", [product.id]) : null;
  const officeFee = wilaya ? shippingFeeFor(ratesQuery.data?.rates, wilaya, "office", [product.id]) : null;
  const shippingFee = wilaya ? shippingFeeFor(ratesQuery.data?.rates, wilaya, delivery, [product.id]) : 0;
  const grandTotal = total + shippingFee;
  const activeColorValue = isBuiltIn ? (color === "white" ? "Blanc" : "Noir") : (color || dynamicColorChoices[0]?.label || "Noir");
  const checkout = useCheckoutDraft({
    formRef,
    source: "coat",
    getItems: () => [{ productId: product.id, quantity, color: activeColorValue, size }],
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
    if (dynamicSizes.length > 0 && !size) nextErrors.size = "اختاري المقاس";
    if (!color) nextErrors.color = "اختاري اللون";
    if (product.stock <= 0) nextErrors.form = "المنتج غير متوفر حالياً";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const result = await checkout.submitOrder();
    if (!result) return;
    setOrderNumber(result.orderNumber);
    // Horodatage réel de commande : { createdAt: new Date().toISOString() }
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

  return (
    <div className={`coat-template ${current}`} dir="rtl">
      <div className="w">
        <header className="hd">
          <Link href="/catalogue" className="hb" aria-label="القائمة"><i /><i /><i /></Link>
          <Link href="/" className="logo coat-brand">MISS <i>SENSUELLE</i></Link>
          <div className="ic"><Link href="/catalogue" aria-label="البحث"><Search size={27} /></Link><a className="bag" href="#order" aria-label="اطلبي الآن" onClick={startCheckout}><ShoppingBag size={27} /></a><span className="flag" aria-label="الجزائر">☪</span></div>
        </header>
        <section className="hx" aria-label={isBuiltIn ? "معطف شتوي فاخر" : (product.arName || product.name)}>
          <img
            src={isBuiltIn ? images.hero : (dynamicColorChoices.find(c => c.id === color)?.image || product.image || images.hero)}
            alt={isBuiltIn ? "معطف شتوي فاخر" : (product.arName || product.name)}
            width="858"
            height="674"
            fetchPriority="high"
          />
          <div className="hx-t1">{isBuiltIn ? "معطف شتوي فاخر" : (cfg?.heroHeadlineAr || product.arName || product.name)}</div>
          <div className="hx-t2">{isBuiltIn ? <>ستايل أنيق و دافئ <b>♥</b></> : <>{cfg?.heroBadgeAr || product.badge || "ستايل أنيق و راقٍ"} <b>♥</b></>}</div>
          {!isBuiltIn && (cfg?.heroSubheadlineAr || product.arDescription || product.description) ? (
            <p style={{ margin: "6px auto 10px", maxWidth: "92%", textAlign: "center", fontSize: 13.5, lineHeight: 1.6, opacity: 0.9 }}>
              {cfg?.heroSubheadlineAr || product.arDescription || product.description}
            </p>
          ) : null}
          <ul className="hx-ck">
            {isBuiltIn ? (
              <><li>قماش عالي الجودة</li><li>مناسب لجميع المناسبات</li><li>مريح و خفيف</li></>
            ) : (
              (product.details?.length ? product.details.slice(0, 3) : ["قماش عالي الجودة", "مناسب لجميع المناسبات", "مريح و خفيف"]).map((d, i) => <li key={i}>{d}</li>)
            )}
          </ul>
          <div className="hx-pr"><small>تخفيض خاص</small><b>{product.price} DA</b>{product.oldPrice && <s>{product.oldPrice} DA</s>}</div>
          <div className="hx-av">{product.stock > 0 ? "✔ المنتج متوفر الآن" : "المنتج غير متوفر حالياً"}</div>
          <div className="hx-adv"><div><span>🚚</span>توصيل سريع<br />لكل ولايات الجزائر</div><div><span>🛡️</span>الدفع عند الاستلام<br />أمان تام</div><div><span>✅</span>ضمان 7 أيام<br />إرجاع أو استبدال</div></div>
        </section>
        <div className="g4">
          {isBuiltIn ? (
            (Object.keys(detailNames) as Array<keyof typeof detailNames>).map(key => <div key={key}><img src={images[key]} alt={detailNames[key]} loading="lazy" /><p>{detailNames[key]}</p></div>)
          ) : (
            (product.gallery?.length ? product.gallery.slice(0, 4) : [product.image]).map((imgUrl, idx) => (
              <div key={idx}>
                <img src={imgUrl} alt="" loading="lazy" />
                <p>{product.details?.[idx] || `${product.arName || product.name} ${idx + 1}`}</p>
              </div>
            ))
          )}
        </div>
        <div className="row">
          <div className="man">
            <img src={isBuiltIn ? images.mannequin : (product.gallery?.[4] || product.image)} alt="من كل الزوايا" loading="lazy" />
            <em>360° كل الزوايا</em>
          </div>
          <div className="card">
            <b>جودة تتحدث عن نفسها</b><br />
            {isBuiltIn ? "فرو ناعم عند الياقة والأكمام، أزرار ذهبية فخمة، وقصة أنثوية واسعة تمنحك إطلالة راقية ودافئة." : (product.arDescription || product.description)}
          </div>
        </div>
        <div className="trust"><div><span>💛</span>خاص بك سيدتي</div><div><span>👑</span>جودة عالية</div><div><span>🛡️</span>ضمان الجودة</div></div>
        <section className="o" id="order">
          <div className="rib">{isBuiltIn ? "اطلبي معطفك الآن!" : "اطلبي قطعتك الآن!"}</div><h2>اطلبي الآن</h2>
          {orderNumber ? <div className="ok" role="status"><h2>✔ شكراً لك، تم تسجيل طلبك</h2><p>رقم الطلب: <b dir="ltr">{orderNumber}</b></p><p>سنتصل بك قريباً لتأكيد التوصيل.</p></div> : (
            <form ref={formRef} noValidate onSubmit={submit} onFocusCapture={startCheckout}>
              <CheckoutDraftNotice checked={checkout.consent} onChange={checkout.setConsent} status={checkout.draftStatus} error={checkout.draftError} />
              <input type="hidden" name="color" value={activeColorValue} />
              <input type="hidden" name="delivery" value={delivery} />
              <div className="gr">
                <div><div className="fld"><i aria-hidden="true">👤</i><input name="customer" aria-label="الاسم الكامل" aria-invalid={Boolean(errors.customer)} required placeholder="الاسم الكامل" autoComplete="name" /></div><div className="err" role={errors.customer ? "alert" : undefined}>{errors.customer}</div></div>
                <div><div className="fld"><i aria-hidden="true">📞</i><input name="phone" aria-label="رقم الهاتف" aria-invalid={Boolean(errors.phone)} type="tel" inputMode="tel" required placeholder="رقم الهاتف (07...)" autoComplete="tel" /></div><div className="err" role={errors.phone ? "alert" : undefined}>{errors.phone}</div></div>
                <div><div className="fld"><i aria-hidden="true">📍</i><select name="wilaya" aria-label="الولاية" required value={wilaya} onChange={event => { setWilaya(event.target.value); setCommune(""); }}><option value="">الولاية</option>{abayaWilayas.map(item => <option key={item}>{item}</option>)}</select></div><div className="err" role={errors.wilaya ? "alert" : undefined}>{errors.wilaya}</div></div>
                <div><div className="fld"><i aria-hidden="true">🏘️</i><select name="commune" aria-label="البلدية" required disabled={!wilaya} value={commune} onChange={event => setCommune(event.target.value)}><option value="">البلدية</option>{communes.map(item => <option key={item}>{item}</option>)}</select></div><div className="err" role={errors.commune ? "alert" : undefined}>{errors.commune}</div></div>
                {dynamicSizes.length > 0 ? (
                  <div style={{ gridColumn: "1 / -1" }}><div className="fld"><i aria-hidden="true">📏</i><select name="size" aria-label="المقاس" required value={size} onChange={event => setSize(event.target.value)}><option value="">المقاس</option>{dynamicSizes.map(item => <option key={item}>{item}</option>)}</select></div><div className="err" role={errors.size ? "alert" : undefined}>{errors.size}</div></div>
                ) : null}
              </div>
              <label>اللون</label><div className="sw">{dynamicColorChoices.map(item => <button type="button" key={item.id} aria-pressed={color === item.id} onClick={() => setColor(item.id)}><span className="dot" style={{ background: item.hex }} />{item.label}</button>)}</div><div className="err" role={errors.color ? "alert" : undefined}>{errors.color}</div>
              <label>نوع التوصيل</label><div className="sw"><button type="button" aria-pressed={delivery === "home"} onClick={() => setDelivery("home")}>🏠 إلى المنزل{homeFee !== null ? ` (${homeFee === 0 ? "مجاني" : `${homeFee} DA`})` : ""}</button><button type="button" aria-pressed={delivery === "office"} onClick={() => setDelivery("office")}>🏢 إلى المكتب{officeFee !== null ? ` (${officeFee === 0 ? "مجاني" : `${officeFee} DA`})` : ""}</button></div>
              <div className="fld" style={{ marginTop: 10 }}><i aria-hidden="true">💬</i><textarea name="note" aria-label="ملاحظة اختيارية" rows={2} maxLength={300} placeholder="ملاحظة (اختياري)" style={{ borderRadius: 20 }} /></div>
              <div className="sum">{dynamicSizes.length > 0 ? <>المقاس: {size || "—"} | </> : null}اللون: {dynamicColorChoices.find(item => item.id === color)?.label ?? "—"}<br />الولاية: {wilaya || "—"} | البلدية: {commune || "—"}<br />التوصيل: {delivery === "home" ? "إلى المنزل" : "إلى المكتب"} {wilaya ? `(${shippingFee === 0 ? "مجاني" : `${shippingFee} DA`})` : ""}<br /><b>المجموع: <span dir="ltr">{grandTotal} DA</span></b> — الدفع عند الاستلام{!wilaya && <><br /><small>اختاري الولاية لحساب سعر التوصيل.</small></>}</div>
              <div className="err" role={errors.form || checkout.draftError ? "alert" : undefined}>{errors.form || checkout.draftError}</div><button className="btn" type="submit" disabled={product.stock <= 0 || checkout.pending}>{checkout.pending ? "جارٍ إرسال الطلب…" : isBuiltIn ? "أكدي طلبك الآن 🛒" : `${cfg?.ctaLabelAr || "أكدي طلبك الآن"} 🛒`}</button>
            </form>
          )}
        </section>
        {!isBuiltIn && cfg?.reviews && cfg.reviews.length > 0 ? (
          <div style={{ display: "grid", gap: 8, margin: "12px 0" }}>
            {cfg.reviews.slice(0, 3).map((rev, idx) => (
              <div key={`${rev.author}-${idx}`} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "10px 12px", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, marginBottom: 4 }}>
                  <span>{rev.author}{rev.city ? ` · ${rev.city}` : ""}</span>
                  <span style={{ color: "#d4af37" }}>{"★".repeat(Math.min(5, Math.max(1, rev.rating || 5)))}</span>
                </div>
                <p style={{ margin: 0, color: "#374151" }}>« {rev.text} »</p>
              </div>
            ))}
          </div>
        ) : null}
        {isBuiltIn && abaya && <Link className="oth" href={`/produit/${abaya.slug}`}><img src={abaya.image} alt="" /><div><small>اكتشفي أيضاً</small><b>عباية رويال + Jump suit</b></div></Link>}
        <footer><div><span>🔒</span>دفع آمن 100%</div><div><span>🚚</span>توصيل سريع<br />1-3 أيام</div><div><span>💛</span>رضاك يهمنا</div></footer>
      </div>
    </div>
  );
}

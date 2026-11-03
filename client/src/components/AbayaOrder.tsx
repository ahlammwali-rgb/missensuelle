import React, { type FormEvent, useRef, useState } from "react";
import { Check, ChevronDown, House, MapPin, Package, Phone, Ruler, ShieldCheck, ShoppingBag, Truck, User } from "lucide-react";
import { abayaCommunesByWilaya, abayaWilayas } from "@/lib/abaya-communes";
import { formatDZD, type Product } from "@/lib/store-data";
import { trackPixelEvent } from "@/lib/tracking";
import { CheckoutDraftNotice } from "./CheckoutDraftNotice";
import { useCheckoutDraft } from "./useCheckoutDraft";

type Props = {
  product: Product;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  quantity: number;
  lang: "fr" | "ar";
};

export function EmeraldOrder({ product, selectedColor, setSelectedColor, quantity }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedWilaya, setSelectedWilaya] = useState("");
  const [selectedCommune, setSelectedCommune] = useState("");
  const [size, setSize] = useState("");
  const [delivery, setDelivery] = useState<"home" | "office">("home");
  const [orderNumber, setOrderNumber] = useState("");
  const [error, setError] = useState("");
  const colors = product.colors.filter(color => color.trim().toLowerCase() !== "bordeaux");
  const color = colors.includes(selectedColor) ? selectedColor : colors[0] ?? "";
  const communes = abayaCommunesByWilaya[selectedWilaya] ?? [];
  const total = product.price * quantity;
  const checkout = useCheckoutDraft({
    formRef,
    source: "abaya",
    getItems: () => [{ productId: product.id, quantity, color, size }],
    watchKey: `${selectedWilaya}|${selectedCommune}|${size}|${color}|${delivery}|${quantity}`,
    aliases: {
      customer: ["emerald-customer"], phone: ["emerald-phone"], wilaya: ["emerald-wilaya"], commune: ["emerald-commune"],
      delivery: ["emerald-delivery"],
    },
  });

  function changeWilaya(value: string) {
    setSelectedWilaya(value);
    setSelectedCommune("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (checkout.pending || orderNumber) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const customer = String(form.get("emerald-customer") ?? "").trim();
    const phone = String(form.get("emerald-phone") ?? "").replace(/[\s().-]/g, "");
    if (customer.length < 2 || !/^(?:0[567]\d{8}|\+213[567]\d{8})$/.test(phone)) {
      setError("أدخلي الاسم الكامل ورقم هاتف جزائري صحيح (مثال: 0555123456). / Indique un nom et un numéro algérien valides.");
      return;
    }
    if (!size || !color || !communes.includes(selectedCommune)) {
      setError("اختاري الولاية والبلدية والمقاس واللون لإكمال الطلب. / Choisis la wilaya, la commune, la taille et la couleur.");
      return;
    }
    const result = await checkout.submitOrder();
    if (!result) return;
    setOrderNumber(result.orderNumber);
    // Horodatage réel de commande : { createdAt: new Date().toISOString() }
    trackPixelEvent("Purchase", { content_ids: [product.id], value: result.total, currency: "DZD", order_id: result.orderNumber });
  }

  return (
    <section className="emerald-order abaya-order-mobile" id="order" dir="rtl">
      <div className="emerald-order-title">
        <span><ShoppingBag size={24} aria-hidden="true" /> اطلبي الآن</span>
        <small>استمتعي بالأناقة والراحة</small>
      </div>
      {orderNumber ? (
        <div className="emerald-success" role="status">
          <Check size={40} aria-hidden="true" />
          <h3>شكراً لك، تم تسجيل طلبك</h3>
          <small>سنتصل بك قريباً لتأكيد التفاصيل والتوصيل.</small>
          <b dir="ltr">{orderNumber}</b>
        </div>
      ) : (
        <form ref={formRef} onSubmit={submit}>
          <div className="abaya-form-intro"><ShieldCheck size={17} /><span>الدفع عند الاستلام · لا تدفعي شيئاً الآن</span></div>
          <CheckoutDraftNotice checked={checkout.consent} onChange={checkout.setConsent} status={checkout.draftStatus} error={checkout.draftError} />
          <input type="hidden" name="emerald-color" value={color} />
          <input type="hidden" name="emerald-delivery" value={delivery} />
          <div className="emerald-fields">
            <label htmlFor="abaya-customer">الاسم الكامل
              <span className="abaya-input-wrap"><User size={18} aria-hidden="true" /><input id="abaya-customer" name="emerald-customer" autoComplete="name" required minLength={2} placeholder="اسمك ولقبك" /></span>
            </label>
            <label htmlFor="abaya-phone">رقم الهاتف
              <span className="abaya-input-wrap"><Phone size={18} aria-hidden="true" /><input id="abaya-phone" name="emerald-phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="0555 12 34 56" dir="ltr" /></span>
            </label>
            <label htmlFor="abaya-wilaya">الولاية
              <span className="abaya-input-wrap"><MapPin size={18} aria-hidden="true" /><select id="abaya-wilaya" name="emerald-wilaya" required value={selectedWilaya} onChange={event => changeWilaya(event.target.value)}><option value="">اختاري ولايتك</option>{abayaWilayas.map(wilaya => <option key={wilaya} value={wilaya}>{wilaya}</option>)}</select><ChevronDown size={15} className="abaya-select-arrow" aria-hidden="true" /></span>
            </label>
            <label htmlFor="abaya-commune">البلدية
              <span className="abaya-input-wrap"><MapPin size={18} aria-hidden="true" /><select id="abaya-commune" name="emerald-commune" required disabled={!selectedWilaya} value={selectedCommune} onChange={event => setSelectedCommune(event.target.value)}><option value="">{selectedWilaya ? "اختاري بلديتك" : "اختاري الولاية أولاً"}</option>{communes.map(commune => <option key={commune} value={commune}>{commune}</option>)}</select><ChevronDown size={15} className="abaya-select-arrow" aria-hidden="true" /></span>
            </label>
          </div>
          <label className="abaya-size-label" htmlFor="abaya-size">المقاس
            <span className="abaya-input-wrap"><Ruler size={18} aria-hidden="true" /><select id="abaya-size" name="emerald-size" required value={size} onChange={event => setSize(event.target.value)}><option value="">اختاري مقاسك</option>{["S", "M", "L", "XL"].map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={15} className="abaya-select-arrow" aria-hidden="true" /></span>
          </label>
          <fieldset className="abaya-choice-group">
            <legend>اللون</legend>
            <div className="emerald-color-row">{colors.map(item => <button type="button" key={item} aria-pressed={color === item} className={color === item ? "active" : ""} onClick={() => setSelectedColor(item)}><i style={{ background: item.toLowerCase() === "noir" ? "#17151b" : "#075c42" }} aria-hidden="true" />{item === "Emerald" ? "أخضر زمردي" : item === "Noir" ? "أسود" : item}{color === item && <Check size={14} aria-hidden="true" />}</button>)}</div>
          </fieldset>
          <fieldset className="abaya-choice-group">
            <legend>نوع التوصيل</legend>
            <div className="abaya-delivery-buttons"><button type="button" className={delivery === "home" ? "active" : ""} aria-pressed={delivery === "home"} onClick={() => setDelivery("home")}><House size={18} />إلى المنزل</button><button type="button" className={delivery === "office" ? "active" : ""} aria-pressed={delivery === "office"} onClick={() => setDelivery("office")}><Package size={18} />إلى المكتب</button></div>
          </fieldset>
          <div className="abaya-order-total"><span>سعر {quantity > 1 ? `المنتج × ${quantity}` : "المنتج"}</span><strong dir="ltr">{formatDZD(total)}</strong><small>مصاريف التوصيل حسب الولاية، تُؤكد هاتفياً.</small></div>
          {(error || checkout.draftError) && <p className="abaya-form-error" role="alert">{error || checkout.draftError}</p>}
          <button className="emerald-submit" type="submit" disabled={checkout.pending}><ShoppingBag size={20} />{checkout.pending ? "جارٍ إرسال الطلب…" : "أؤكد طلبي الآن"}</button>
          <p className="abaya-call-note">سنتصل بك لتأكيد طلبك قبل إرساله.</p>
        </form>
      )}
      <div className="emerald-order-benefits"><span><ShieldCheck size={17} />طلبك آمن</span><span><Truck size={17} />توصيل سريع</span><span><Check size={17} />دفع عند الاستلام</span></div>
    </section>
  );
}

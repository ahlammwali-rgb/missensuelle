import React, { type ChangeEvent } from "react";
import "./checkout-drafts.css";

export type CheckoutDraftStatus = "idle" | "saving" | "saved" | "disabled" | "error";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  status?: CheckoutDraftStatus;
  error?: string;
};

export function CheckoutDraftNotice({ checked, onChange, status = "idle", error }: Props) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.checked);
  const statusText = status === "saving"
    ? "Enregistrement en cours… / جارٍ الحفظ…"
    : status === "saved"
      ? "Brouillon enregistré / تم حفظ المسودة"
      : status === "disabled"
        ? "Sauvegarde désactivée / تم إيقاف الحفظ"
        : "";

  return (
    <div className="checkout-draft-notice">
      <label className="checkout-draft-check">
        <input type="checkbox" checked={checked} onChange={handleChange} />
        <span className="checkout-draft-box" aria-hidden="true" />
        <span>
          <strong>Enregistrer ce formulaire pour pouvoir te rappeler</strong>
          <small>حفظ البيانات للاتصال بك لاسترجاع طلبك إذا توقفتِ قبل الإرسال. اختيار اختياري.</small>
        </span>
      </label>
      {statusText && <p className="checkout-draft-status" role="status">{statusText}</p>}
      {error && <p className="checkout-draft-error" role="alert">{error}</p>}
    </div>
  );
}

import React, { useState } from "react";
import {
  AlarmClock,
  BellRing,
  Calendar,
  Clock,
  Eye,
  MessageCircle,
  Phone,
  X,
  XCircle,
} from "lucide-react";
import type { CheckoutOrder } from "@shared/checkout";
import { formatDZD } from "@/lib/store-data";

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PostponeOrderModal({
  order,
  onClose,
  onConfirm,
}: {
  order: CheckoutOrder;
  onClose: () => void;
  onConfirm: (postponedUntil: string | null, postponedNote: string) => void;
}) {
  const [dateTimeLocal, setDateTimeLocal] = useState<string>(() => {
    if (order.postponedUntil) {
      const d = new Date(order.postponedUntil);
      if (!Number.isNaN(d.getTime())) return toLocalDateTimeInputValue(d);
    }
    const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
    return toLocalDateTimeInputValue(defaultDate);
  });
  const [note, setNote] = useState<string>(order.postponedNote || "");

  const applyQuickOffset = (minutes: number) => {
    const target = new Date(Date.now() + minutes * 60 * 1000);
    setDateTimeLocal(toLocalDateTimeInputValue(target));
  };

  const applyTonight18h = () => {
    const target = new Date();
    target.setHours(18, 0, 0, 0);
    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1);
    }
    setDateTimeLocal(toLocalDateTimeInputValue(target));
  };

  const applyTomorrow10h = () => {
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(10, 0, 0, 0);
    setDateTimeLocal(toLocalDateTimeInputValue(target));
  };

  const quickNotes = [
    "Au travail, rappeler après 17h",
    "Occupé(e), a demandé de rappeler plus tard",
    "Hésite sur la taille / couleur",
    "Attend sa paie",
  ];

  return (
    <div className="modal-layer" style={{ zIndex: 1150 }}>
      <button className="modal-backdrop" onClick={onClose} aria-label="Fermer" />
      <div className="order-modal" style={{ maxWidth: "500px", width: "92vw", padding: "22px" }}>
        <div className="modal-head">
          <div>
            <span className="eyebrow" style={{ color: "#0284c7", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <AlarmClock size={14} /> Programmer un rappel client
            </span>
            <h2 style={{ marginTop: "4px" }}>Reporter · {order.id}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer">
            <X size={19} />
          </button>
        </div>

        <p style={{ fontSize: "13px", color: "#64748b", marginTop: "6px" }}>
          Client(e) : <strong>{order.customer}</strong> ({order.phone}) · {formatDZD(order.total)}
        </p>

        <div style={{ marginTop: "14px", display: "grid", gap: "12px" }}>
          <div>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "6px" }}>
              ⚡ Raccourcis rapides :
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              <button
                type="button"
                className="button button-outline"
                style={{ height: "32px", padding: "0 10px", fontSize: "12px" }}
                onClick={() => applyQuickOffset(30)}
              >
                Dans 30 min
              </button>
              <button
                type="button"
                className="button button-outline"
                style={{ height: "32px", padding: "0 10px", fontSize: "12px" }}
                onClick={() => applyQuickOffset(60)}
              >
                Dans 1h
              </button>
              <button
                type="button"
                className="button button-outline"
                style={{ height: "32px", padding: "0 10px", fontSize: "12px" }}
                onClick={() => applyQuickOffset(120)}
              >
                Dans 2h
              </button>
              <button
                type="button"
                className="button button-outline"
                style={{ height: "32px", padding: "0 10px", fontSize: "12px" }}
                onClick={applyTonight18h}
              >
                Ce soir 18h00
              </button>
              <button
                type="button"
                className="button button-outline"
                style={{ height: "32px", padding: "0 10px", fontSize: "12px" }}
                onClick={applyTomorrow10h}
              >
                Demain 10h00
              </button>
            </div>
          </div>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
            <span>📅 Date et Heure du rappel (Optionnel)</span>
            <input
              type="datetime-local"
              value={dateTimeLocal}
              onChange={e => setDateTimeLocal(e.target.value)}
              style={{
                height: "42px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                padding: "0 12px",
                fontWeight: 700,
                fontSize: "14px",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
            <span>📝 Note du report (Optionnel)</span>
            <input
              type="text"
              placeholder="Ex: Rappeler à 17h après le travail..."
              value={note}
              onChange={e => setNote(e.target.value)}
              style={{
                height: "42px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                padding: "0 12px",
                fontSize: "13px",
              }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
              {quickNotes.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setNote(q)}
                  style={{
                    fontSize: "11px",
                    padding: "4px 8px",
                    borderRadius: "999px",
                    border: "1px solid rgba(14, 165, 233, 0.3)",
                    background: "rgba(14, 165, 233, 0.08)",
                    color: "#0369a1",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  + {q}
                </button>
              ))}
            </div>
          </label>

          <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
            <button
              type="button"
              className="button button-gradient full"
              style={{ height: "46px", borderRadius: "12px", fontSize: "14px", fontWeight: 800 }}
              onClick={() => {
                const iso = dateTimeLocal ? new Date(dateTimeLocal).toISOString() : null;
                onConfirm(iso, note.trim());
              }}
            >
              <Calendar size={16} /> Confirmer le report avec alerte rappel
            </button>

            <button
              type="button"
              className="button button-outline full"
              style={{ height: "40px", borderRadius: "12px", fontSize: "13px", fontWeight: 700 }}
              onClick={() => onConfirm(null, note.trim())}
            >
              <Clock size={15} /> Reporter sans date ni heure
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CancelOrderModal({
  order,
  onClose,
  onConfirm,
}: {
  order: CheckoutOrder;
  onClose: () => void;
  onConfirm: (cancelReason: string) => void;
}) {
  const [reason, setReason] = useState<string>(order.cancelReason || "A changé d'avis / N'en veut plus");

  const presetReasons = [
    "A changé d'avis / N'en veut plus",
    "Faux numéro / Éteint après NRP 3",
    "Prix ou frais de livraison trop cher",
    "Délai de livraison jugé trop long",
    "Double commande (Doublon)",
    "Client hors zone / Indisponible",
  ];

  return (
    <div className="modal-layer" style={{ zIndex: 1150 }}>
      <button className="modal-backdrop" onClick={onClose} aria-label="Fermer" />
      <div className="order-modal" style={{ maxWidth: "480px", width: "92vw", padding: "22px" }}>
        <div className="modal-head">
          <div>
            <span className="eyebrow" style={{ color: "#ef4444", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <XCircle size={14} /> Motif d'annulation
            </span>
            <h2 style={{ marginTop: "4px" }}>Annuler · {order.id}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer">
            <X size={19} />
          </button>
        </div>

        <p style={{ fontSize: "13px", color: "#64748b", marginTop: "6px" }}>
          Sélectionnez la raison de l'annulation pour <strong>{order.customer}</strong> ({order.phone}) :
        </p>

        <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
          {presetReasons.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              style={{
                textAlign: "left",
                padding: "10px 14px",
                borderRadius: "10px",
                border: reason === r ? "2px solid #ef4444" : "1px solid #cbd5e1",
                background: reason === r ? "rgba(239, 68, 68, 0.08)" : "var(--surface, #fff)",
                color: reason === r ? "#b91c1c" : "var(--text, #1e293b)",
                fontWeight: reason === r ? 800 : 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              {reason === r ? "🔴 " : "⚪ "} {r}
            </button>
          ))}

          <input
            type="text"
            placeholder="Ou précisez un motif personnalisé..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{
              marginTop: "4px",
              height: "42px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              padding: "0 12px",
              fontSize: "13px",
              fontWeight: 600,
            }}
          />

          <button
            type="button"
            className="button full"
            style={{
              marginTop: "8px",
              height: "46px",
              borderRadius: "12px",
              background: "#ef4444",
              color: "#fff",
              border: "none",
              fontWeight: 800,
              fontSize: "14px",
              cursor: "pointer",
            }}
            onClick={() => onConfirm(reason.trim() || "Annulée")}
          >
            Confirmer l'annulation
          </button>
        </div>
      </div>
    </div>
  );
}

export function PostponedReminderPopup({
  orders,
  onCall,
  onWhatsApp,
  onOpenOrder,
  onSnooze30Min,
  onDismiss,
}: {
  orders: CheckoutOrder[];
  onCall: (order: CheckoutOrder) => void;
  onWhatsApp: (order: CheckoutOrder) => void;
  onOpenOrder: (order: CheckoutOrder) => void;
  onSnooze30Min: (order: CheckoutOrder) => void;
  onDismiss: (orderId: string) => void;
}) {
  if (!orders.length) return null;
  const current = orders[0];

  return (
    <div className="modal-layer" style={{ zIndex: 1300 }}>
      <button className="modal-backdrop" onClick={() => onDismiss(current.id)} aria-label="Fermer" />
      <div
        className="order-modal"
        style={{
          maxWidth: "500px",
          width: "92vw",
          padding: "24px",
          border: "2px solid #0284c7",
          boxShadow: "0 20px 50px rgba(2, 132, 199, 0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 12px",
              borderRadius: "999px",
              background: "rgba(2, 132, 199, 0.14)",
              color: "#0284c7",
              fontWeight: 800,
              fontSize: "12px",
            }}
          >
            <BellRing size={15} /> ⏰ HEURE DE RAPPEL ARRIVÉE ({orders.length} en attente)
          </span>
          <button className="icon-button" onClick={() => onDismiss(current.id)} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <h2 style={{ marginTop: "12px", fontSize: "20px" }}>
          Rappeler {current.customer} maintenant !
        </h2>
        <p style={{ fontSize: "14px", color: "#475569", marginTop: "4px" }}>
          Commande <strong>{current.id}</strong> · Téléphone :{" "}
          <strong style={{ color: "#2563eb" }}>{current.phone}</strong>
        </p>

        <div
          style={{
            marginTop: "12px",
            padding: "12px 14px",
            borderRadius: "12px",
            background: "rgba(248, 250, 252, 0.95)",
            border: "1px solid #cbd5e1",
            fontSize: "13px",
            display: "grid",
            gap: "4px",
          }}
        >
          <div>
            <strong>Article :</strong> {current.product} ({formatDZD(current.total)})
          </div>
          <div>
            <strong>Wilaya :</strong> {current.wilaya} ({current.commune})
          </div>
          {current.postponedNote && (
            <div style={{ color: "#0369a1", fontWeight: 700, marginTop: "4px" }}>
              📝 Note de report : « {current.postponedNote} »
            </div>
          )}
          {current.assignedToName && (
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              🎧 Confirmateur en charge : <strong>{current.assignedToName}</strong>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "16px" }}>
          <button
            type="button"
            className="button button-gradient"
            style={{ height: "44px", borderRadius: "12px", fontWeight: 800, fontSize: "13.5px" }}
            onClick={() => {
              onCall(current);
              onDismiss(current.id);
            }}
          >
            <Phone size={15} /> Appeler maintenant
          </button>

          <button
            type="button"
            className="button"
            style={{
              height: "44px",
              borderRadius: "12px",
              background: "#10b981",
              color: "#fff",
              border: "none",
              fontWeight: 800,
              fontSize: "13.5px",
            }}
            onClick={() => {
              onWhatsApp(current);
              onDismiss(current.id);
            }}
          >
            <MessageCircle size={15} /> WhatsApp
          </button>

          <button
            type="button"
            className="button button-outline"
            style={{ height: "40px", borderRadius: "10px", fontSize: "12.5px", fontWeight: 700 }}
            onClick={() => {
              onOpenOrder(current);
              onDismiss(current.id);
            }}
          >
            <Eye size={14} /> Voir la commande
          </button>

          <button
            type="button"
            className="button button-outline"
            style={{ height: "40px", borderRadius: "10px", fontSize: "12.5px", fontWeight: 700 }}
            onClick={() => {
              onSnooze30Min(current);
              onDismiss(current.id);
            }}
          >
            <Clock size={14} /> Reporter +30 min
          </button>
        </div>
      </div>
    </div>
  );
}

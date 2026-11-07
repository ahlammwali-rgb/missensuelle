import React from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Flame,
  History,
  MessageCircle,
  PackageCheck,
  Phone,
  RotateCcw,
  Truck,
  UserCheck,
  X,
} from "lucide-react";
import type { CheckoutOrder, OrderHistoryEvent } from "@shared/checkout";
import { formatDZD } from "@/lib/store-data";

type Props = {
  order: CheckoutOrder;
  onClose: () => void;
  onCall?: (order: CheckoutOrder) => void;
  onWhatsApp?: (order: CheckoutOrder) => void;
};

function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return "Date inconnue";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-DZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function eventIconAndColor(event: OrderHistoryEvent): { icon: React.ReactNode; bg: string; color: string; border: string } {
  switch (event.type) {
    case "call":
      return {
        icon: <Phone size={15} />,
        bg: "rgba(37, 99, 235, 0.1)",
        color: "#2563eb",
        border: "rgba(37, 99, 235, 0.25)",
      };
    case "whatsapp":
      return {
        icon: <MessageCircle size={15} />,
        bg: "rgba(16, 185, 129, 0.12)",
        color: "#059669",
        border: "rgba(16, 185, 129, 0.3)",
      };
    case "edit":
      return {
        icon: <Edit3 size={15} />,
        bg: "rgba(139, 92, 246, 0.12)",
        color: "#7c3aed",
        border: "rgba(139, 92, 246, 0.28)",
      };
    case "postponed":
      return {
        icon: <Calendar size={15} />,
        bg: "rgba(14, 165, 233, 0.12)",
        color: "#0284c7",
        border: "rgba(14, 165, 233, 0.3)",
      };
    case "status_change":
      if (event.meta?.statusTo === "confirmee") {
        return {
          icon: <CheckCircle2 size={15} />,
          bg: "rgba(16, 185, 129, 0.12)",
          color: "#10b981",
          border: "rgba(16, 185, 129, 0.3)",
        };
      }
      if (event.meta?.statusTo === "ne_repond_pas") {
        return {
          icon: <Phone size={15} />,
          bg: "rgba(245, 158, 11, 0.14)",
          color: "#d97706",
          border: "rgba(245, 158, 11, 0.35)",
        };
      }
      if (event.meta?.statusTo === "annulee") {
        return {
          icon: <X size={15} />,
          bg: "rgba(239, 68, 68, 0.12)",
          color: "#ef4444",
          border: "rgba(239, 68, 68, 0.3)",
        };
      }
      return {
        icon: <Clock size={15} />,
        bg: "rgba(100, 116, 139, 0.12)",
        color: "#475569",
        border: "rgba(100, 116, 139, 0.25)",
      };
    case "shipped":
      return {
        icon: <Truck size={15} />,
        bg: "rgba(99, 102, 241, 0.12)",
        color: "#4f46e5",
        border: "rgba(99, 102, 241, 0.3)",
      };
    case "delivered":
      return {
        icon: <PackageCheck size={15} />,
        bg: "rgba(16, 185, 129, 0.15)",
        color: "#059669",
        border: "rgba(16, 185, 129, 0.35)",
      };
    case "return":
      return {
        icon: <RotateCcw size={15} />,
        bg: "rgba(244, 63, 94, 0.12)",
        color: "#e11d48",
        border: "rgba(244, 63, 94, 0.3)",
      };
    default:
      return {
        icon: <History size={15} />,
        bg: "rgba(148, 163, 184, 0.12)",
        color: "#475569",
        border: "rgba(148, 163, 184, 0.25)",
      };
  }
}

export function OrderHistoryModal({ order, onClose, onCall, onWhatsApp }: Props) {
  const events: OrderHistoryEvent[] = React.useMemo(() => {
    const raw = Array.isArray(order.history) ? [...order.history] : [];
    if (!raw.some(e => e.type === "created")) {
      raw.push({
        id: `seed-${order.id}`,
        at: order.createdAt,
        type: "created",
        actorId: "system",
        actorName: "Boutique en ligne",
        summary: `Commande créée (${order.product} — ${formatDZD(order.total)})`,
      });
    }
    return raw.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [order]);

  const callCount = order.callCount ?? events.filter(e => e.type === "call").length;
  const whatsappCount = order.whatsappCount ?? events.filter(e => e.type === "whatsapp").length;
  const editCount = events.filter(e => e.type === "edit").length;

  return (
    <div className="modal-layer" style={{ zIndex: 1100 }}>
      <button className="modal-backdrop" onClick={onClose} aria-label="Fermer l'historique" />
      <div
        className="order-modal"
        style={{
          maxWidth: "650px",
          width: "94vw",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "22px",
        }}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <History size={14} /> Traçabilité & Audit Complet
            </span>
            <h2 style={{ marginTop: "4px" }}>Historique · {order.id}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer">
            <X size={19} />
          </button>
        </div>

        {/* Client & Quick Actions */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "14px",
            borderRadius: "14px",
            background: "var(--surface-2, rgba(248, 250, 252, 0.9))",
            border: "1px solid var(--border, rgba(226, 232, 240, 0.9))",
            marginTop: "12px",
          }}
        >
          <div>
            <strong style={{ fontSize: "15px", display: "block" }}>
              {order.customer} · <span style={{ color: "#2563eb" }}>{order.phone}</span>
            </strong>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              {order.product} · <strong>{formatDZD(order.total)}</strong> · {order.wilaya} ({order.commune})
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {onCall && (
              <button
                type="button"
                className="button button-outline"
                style={{ height: "36px", padding: "0 12px", fontSize: "12px", gap: "6px" }}
                onClick={() => onCall(order)}
              >
                <Phone size={14} /> Appeler
              </button>
            )}
            {onWhatsApp && (
              <button
                type="button"
                className="button"
                style={{
                  height: "36px",
                  padding: "0 12px",
                  fontSize: "12px",
                  gap: "6px",
                  background: "#10b981",
                  color: "#fff",
                  border: "none",
                }}
                onClick={() => onWhatsApp(order)}
              >
                <MessageCircle size={14} /> WhatsApp
              </button>
            )}
          </div>
        </div>

        {/* Summary Counters */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "10px",
            marginTop: "12px",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: "rgba(37, 99, 235, 0.08)",
              border: "1px solid rgba(37, 99, 235, 0.2)",
            }}
          >
            <span style={{ fontSize: "11px", color: "#2563eb", fontWeight: 700, display: "block" }}>
              📞 Appels passés
            </span>
            <strong style={{ fontSize: "18px", color: "#1e40af" }}>{callCount}</strong>
            {order.lastCalledBy && (
              <small style={{ display: "block", fontSize: "11px", color: "#64748b" }}>
                Dernier : {order.lastCalledBy}
              </small>
            )}
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.2)",
            }}
          >
            <span style={{ fontSize: "11px", color: "#059669", fontWeight: 700, display: "block" }}>
              💬 Relances WhatsApp
            </span>
            <strong style={{ fontSize: "18px", color: "#065f46" }}>{whatsappCount}</strong>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: "rgba(139, 92, 246, 0.08)",
              border: "1px solid rgba(139, 92, 246, 0.2)",
            }}
          >
            <span style={{ fontSize: "11px", color: "#7c3aed", fontWeight: 700, display: "block" }}>
              ✏️ Modifications
            </span>
            <strong style={{ fontSize: "18px", color: "#5b21b6" }}>{editCount}</strong>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: "rgba(236, 72, 153, 0.08)",
              border: "1px solid rgba(236, 72, 153, 0.2)",
            }}
          >
            <span style={{ fontSize: "11px", color: "#db2777", fontWeight: 700, display: "block" }}>
              🎧 Confirmateur
            </span>
            <strong style={{ fontSize: "13px", color: "#9d174d", display: "block", marginTop: "2px" }}>
              {order.confirmedByName || order.assignedToName || "Non assigné"}
            </strong>
            {order.confirmedByName && (
              <small style={{ fontSize: "10px", color: "#059669", fontWeight: 700 }}>
                ✓ Confirmée par {order.confirmedByName}
              </small>
            )}
          </div>
        </div>

        {/* Status Meta Banner if Reportée / NRP / Annulée */}
        {order.status === "reportee" && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 14px",
              borderRadius: "12px",
              background: "rgba(14, 165, 233, 0.1)",
              border: "1px solid rgba(14, 165, 233, 0.3)",
              fontSize: "13px",
              color: "#0369a1",
              fontWeight: 600,
            }}
          >
            ⏰ <strong>Commande Reportée</strong>
            {order.postponedUntil
              ? ` — Rappel prévu le ${formatDateTime(order.postponedUntil)}`
              : " (Sans heure précise)"}
            {order.postponedNote && <div>📝 Note : « {order.postponedNote} »</div>}
          </div>
        )}

        {order.status === "ne_repond_pas" && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 14px",
              borderRadius: "12px",
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.35)",
              fontSize: "13px",
              color: "#b45309",
              fontWeight: 700,
            }}
          >
            🟠 Statut actuel : <strong>Ne répond pas — Niveau NRP {order.nrpLevel || 1} / 3</strong>
          </div>
        )}

        {order.status === "annulee" && order.cancelReason && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 14px",
              borderRadius: "12px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              fontSize: "13px",
              color: "#b91c1c",
              fontWeight: 600,
            }}
          >
            ❌ <strong>Motif d'annulation :</strong> {order.cancelReason}
          </div>
        )}

        {/* Timeline List */}
        <div style={{ marginTop: "18px", display: "grid", gap: "12px" }}>
          <h3 style={{ fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b", margin: 0 }}>
            Chronologie complète ({events.length} événement{events.length > 1 ? "s" : ""})
          </h3>

          {events.map(event => {
            const style = eventIconAndColor(event);
            const hasNoCallWarning = Boolean(event.meta?.noPriorCallWarning);
            const hasRapidNrpWarning = Boolean(event.meta?.rapidNrpWarning);

            return (
              <div
                key={event.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "34px 1fr",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  background: "var(--surface, #fff)",
                  border: `1px solid ${hasNoCallWarning || hasRapidNrpWarning ? "rgba(239, 68, 68, 0.45)" : style.border}`,
                  boxShadow: "0 2px 6px rgba(15, 23, 42, 0.03)",
                }}
              >
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "10px",
                    background: style.bg,
                    color: style.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {style.icon}
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "13.5px", color: "var(--text, #0f172a)" }}>
                      {event.summary}
                    </strong>
                    <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>
                      🕒 {formatDateTime(event.at)}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: "rgba(15, 23, 42, 0.06)",
                        color: "#334155",
                      }}
                    >
                      <UserCheck size={12} /> Par : {event.actorName}
                    </span>

                    {event.meta?.upsellPack && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "11px",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: "rgba(236, 72, 153, 0.14)",
                          color: "#db2777",
                        }}
                      >
                        <Flame size={12} /> Upsell Pack Duo (+2 pièces)
                      </span>
                    )}

                    {hasNoCallWarning && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "11px",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: "rgba(239, 68, 68, 0.14)",
                          color: "#dc2626",
                        }}
                      >
                        <AlertTriangle size={12} /> Sans clic d'appel préalable
                      </span>
                    )}

                    {hasRapidNrpWarning && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "11px",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: "rgba(239, 68, 68, 0.14)",
                          color: "#dc2626",
                        }}
                      >
                        <AlertTriangle size={12} /> NRP trop rapide ({event.meta?.minutesSinceLastNrp ?? 0} min d'écart)
                      </span>
                    )}
                  </div>

                  {/* Detailed Avant -> Après Table for Edits */}
                  {Array.isArray(event.changes) && event.changes.length > 0 && (
                    <div
                      style={{
                        marginTop: "4px",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        background: "rgba(248, 250, 252, 0.95)",
                        border: "1px solid rgba(203, 213, 225, 0.6)",
                        display: "grid",
                        gap: "4px",
                        fontSize: "12px",
                      }}
                    >
                      {event.changes.map((ch, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <strong style={{ color: "#475569", minWidth: "90px" }}>{ch.label} :</strong>
                          <span style={{ textDecoration: "line-through", color: "#ef4444", background: "rgba(239, 68, 68, 0.08)", padding: "1px 6px", borderRadius: "6px" }}>
                            {ch.before}
                          </span>
                          <span style={{ color: "#64748b", fontWeight: 700 }}>➔</span>
                          <span style={{ color: "#059669", fontWeight: 800, background: "rgba(16, 185, 129, 0.1)", padding: "1px 6px", borderRadius: "6px" }}>
                            {ch.after}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

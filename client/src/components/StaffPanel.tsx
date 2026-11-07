import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit3,
  Eye,
  Flame,
  History,
  KeyRound,
  MessageCircle,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { CheckoutOrder, StaffActivityLog, StaffMember } from "@shared/checkout";
import { formatDZD } from "@/lib/store-data";
import { trpc } from "@/lib/trpc";

type Props = {
  orders: CheckoutOrder[];
  notify: (msg: string, type?: "normal" | "urgent" | "victory" | "order") => void;
  onOpenOrderHistory: (order: CheckoutOrder) => void;
  onOpenOrderEdit: (order: CheckoutOrder) => void;
};

type PeriodFilter = "today" | "yesterday" | "7days" | "month" | "all";

function matchesPeriod(iso: string | undefined, period: PeriodFilter): boolean {
  if (period === "all") return true;
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetMs = d.getTime();

  if (period === "today") {
    return targetMs >= startOfToday;
  }
  if (period === "yesterday") {
    const startOfYesterday = startOfToday - 86400000;
    return targetMs >= startOfYesterday && targetMs < startOfToday;
  }
  if (period === "7days") {
    return targetMs >= Date.now() - 7 * 86400000;
  }
  if (period === "month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return targetMs >= startOfMonth;
  }
  return true;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-DZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const AVATAR_COLORS = ["#ec4899", "#8b5cf6", "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

export function StaffPanel({ orders, notify, onOpenOrderHistory, onOpenOrderEdit }: Props) {
  const utils = trpc.useUtils();
  const staffQuery = trpc.admin.staffData.useQuery(undefined, {
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
  const upsertMutation = trpc.admin.staffUpsert.useMutation({
    onSuccess: async () => {
      await utils.admin.staffData.invalidate();
      setIsFormOpen(false);
      setEditingMember(null);
      notify("Confirmateur enregistré avec succès ✅");
    },
    onError: err => notify(err.message || "Erreur lors de l'enregistrement", "urgent"),
  });
  const deleteMutation = trpc.admin.staffDelete.useMutation({
    onSuccess: async () => {
      await utils.admin.staffData.invalidate();
      notify("Confirmateur supprimé");
    },
    onError: err => notify(err.message || "Suppression impossible", "urgent"),
  });
  const markDeliveredMutation = trpc.admin.markOrderDelivered.useMutation({
    onSuccess: async () => {
      await utils.admin.orders.invalidate();
      await utils.admin.staffData.invalidate();
      notify("Statut de livraison et commission mis à jour 🎉", "victory");
    },
  });

  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>("all");
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>("all");
  const [logSearch, setLogSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"performance" | "journal" | "deliveries">("performance");

  // Form state for adding/editing a confirmateur
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [baseSalary, setBaseSalary] = useState(25000);
  const [commissionPerDelivered, setCommissionPerDelivered] = useState(150);
  const [upsellBonusPerDelivered, setUpsellBonusPerDelivered] = useState(50);
  const [active, setActive] = useState(true);

  const isOwner = staffQuery.data?.isOwner ?? true;
  const staffList = staffQuery.data?.staff ?? [];
  const activityLogs = staffQuery.data?.activityLogs ?? [];
  const orderById = useMemo(() => new Map(orders.map(o => [o.id, o])), [orders]);

  const openCreateForm = () => {
    setEditingMember(null);
    setName("");
    setPhone("");
    setCode("");
    setAvatarColor(AVATAR_COLORS[staffList.length % AVATAR_COLORS.length]);
    setBaseSalary(25000);
    setCommissionPerDelivered(150);
    setUpsellBonusPerDelivered(50);
    setActive(true);
    setIsFormOpen(true);
  };

  const openEditForm = (m: StaffMember) => {
    setEditingMember(m);
    setName(m.name);
    setPhone(m.phone);
    setCode(m.code);
    setAvatarColor(m.avatarColor || AVATAR_COLORS[0]);
    setBaseSalary(m.baseSalary);
    setCommissionPerDelivered(m.commissionPerDelivered);
    setUpsellBonusPerDelivered(m.upsellBonusPerDelivered ?? 50);
    setActive(m.active);
    setIsFormOpen(true);
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      notify("Veuillez remplir le nom et le code d'accès du confirmateur", "urgent");
      return;
    }
    upsertMutation.mutate({
      id: editingMember?.id,
      name: name.trim(),
      phone: phone.trim(),
      code: code.trim(),
      avatarColor,
      baseSalary: Number(baseSalary) || 0,
      commissionPerDelivered: Number(commissionPerDelivered) || 0,
      upsellBonusPerDelivered: Number(upsellBonusPerDelivered) || 0,
      active,
    });
  };

  // Compute detailed statistics per staff member (plus "owner" so nothing is missed)
  const staffStats = useMemo(() => {
    const profiles: Array<StaffMember & { isOwnerProfile?: boolean }> = [
      ...staffList,
      {
        id: "owner",
        name: "Admin (Patron)",
        phone: "",
        code: "••••",
        avatarColor: "#0f172a",
        baseSalary: 0,
        commissionPerDelivered: 0,
        upsellBonusPerDelivered: 0,
        active: true,
        createdAt: new Date().toISOString(),
        isOwnerProfile: true,
      },
    ];

    return profiles.map(member => {
      const memberLogs = activityLogs.filter(
        l => (l.actorId === member.id || l.actorName.toLowerCase() === member.name.toLowerCase()) && matchesPeriod(l.at, period)
      );

      const callsCount = memberLogs.filter(l => l.type === "call").length;
      const whatsappCount = memberLogs.filter(l => l.type === "whatsapp").length;
      const editsCount = memberLogs.filter(l => l.type === "edit").length;
      const warningsCount = memberLogs.filter(l => Boolean(l.warning)).length;

      // Orders assigned to or confirmed by this member in the selected period
      const assignedOrders = orders.filter(
        o =>
          (o.assignedToId === member.id ||
            o.confirmedById === member.id ||
            (o.assignedToName && o.assignedToName.toLowerCase() === member.name.toLowerCase()) ||
            (o.confirmedByName && o.confirmedByName.toLowerCase() === member.name.toLowerCase())) &&
          matchesPeriod(o.confirmedAt || o.lastCalledAt || o.createdAt, period)
      );

      const confirmedOrders = orders.filter(
        o =>
          (o.confirmedById === member.id ||
            (o.confirmedByName && o.confirmedByName.toLowerCase() === member.name.toLowerCase())) &&
          (o.status === "confirmee" || o.status === "transferee" || o.isDelivered) &&
          matchesPeriod(o.confirmedAt || o.createdAt, period)
      );

      const deliveredOrders = confirmedOrders.filter(o => Boolean(o.isDelivered) && !o.returnReceived);
      const upsellOrders = orders.filter(
        o =>
          (o.upsellById === member.id ||
            (o.upsellByName && o.upsellByName.toLowerCase() === member.name.toLowerCase())) &&
          o.quantity >= 2 &&
          matchesPeriod(o.confirmedAt || o.createdAt, period)
      );
      const deliveredUpsellOrders = upsellOrders.filter(o => Boolean(o.isDelivered) && !o.returnReceived);

      const nrpOrders = assignedOrders.filter(o => o.status === "ne_repond_pas");
      const postponedOrders = assignedOrders.filter(o => o.status === "reportee");
      const cancelledOrders = assignedOrders.filter(o => o.status === "annulee");

      const totalHandled = assignedOrders.length;
      const confirmationRate = totalHandled > 0 ? Math.round((confirmedOrders.length / totalHandled) * 100) : 0;
      const deliveryRate =
        confirmedOrders.length > 0 ? Math.round((deliveredOrders.length / confirmedOrders.length) * 100) : 0;

      const commissionTotal = deliveredOrders.length * member.commissionPerDelivered;
      const upsellBonusTotal = deliveredUpsellOrders.length * (member.upsellBonusPerDelivered || 0);
      const totalPay = member.baseSalary + commissionTotal + upsellBonusTotal;

      return {
        member,
        callsCount,
        whatsappCount,
        editsCount,
        warningsCount,
        totalHandled,
        confirmedCount: confirmedOrders.length,
        deliveredCount: deliveredOrders.length,
        upsellCount: upsellOrders.length,
        deliveredUpsellCount: deliveredUpsellOrders.length,
        nrpCount: nrpOrders.length,
        postponedCount: postponedOrders.length,
        cancelledCount: cancelledOrders.length,
        confirmationRate,
        deliveryRate,
        commissionTotal,
        upsellBonusTotal,
        totalPay,
      };
    });
  }, [staffList, activityLogs, orders, period]);

  // Filtered activity logs for the live journal
  const filteredLogs = useMemo(() => {
    return activityLogs.filter(log => {
      if (!matchesPeriod(log.at, period)) return false;
      if (selectedStaffFilter !== "all" && log.actorId !== selectedStaffFilter) return false;
      if (selectedActionFilter === "call" && log.type !== "call" && log.type !== "whatsapp") return false;
      if (selectedActionFilter === "status" && log.type !== "status_change" && log.type !== "postponed") return false;
      if (selectedActionFilter === "edit" && log.type !== "edit") return false;
      if (selectedActionFilter === "warning" && !log.warning) return false;
      if (logSearch.trim()) {
        const q = logSearch.trim().toLowerCase();
        const hay = `${log.actorName} ${log.orderId || ""} ${log.customer || ""} ${log.phone || ""} ${log.summary}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activityLogs, period, selectedStaffFilter, selectedActionFilter, logSearch]);

  // Confirmed / Transferred orders for quick delivery & commission validation
  const shippableOrConfirmedOrders = useMemo(() => {
    return orders.filter(o => o.status === "confirmee" || o.status === "transferee" || o.isDelivered);
  }, [orders]);

  return (
    <section className="admin-panel" style={{ display: "grid", gap: "20px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
          paddingBottom: "14px",
          borderBottom: "1px solid var(--border, #e2e8f0)",
        }}
      >
        <div>
          <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Users size={14} /> Call-Center COD & Gestion d'Équipe
          </span>
          <h2 style={{ marginTop: "4px" }}>Confirmateurs, Salaires, Commissions & Traçage</h2>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
            Suivez chaque appel, chaque modification, les ventes Pack Duo et calculez automatiquement les commissions sur colis livrés.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value as PeriodFilter)}
            style={{
              height: "40px",
              borderRadius: "10px",
              padding: "0 12px",
              fontWeight: 700,
              fontSize: "13px",
              border: "1px solid #cbd5e1",
            }}
          >
            <option value="today">📅 Aujourd'hui</option>
            <option value="yesterday">📅 Hier</option>
            <option value="7days">📅 7 derniers jours</option>
            <option value="month">📅 Ce mois-ci</option>
            <option value="all">📅 Toutes les dates</option>
          </select>

          {isOwner && (
            <button
              type="button"
              className="button button-gradient"
              style={{ height: "40px", padding: "0 16px", fontSize: "13px", fontWeight: 800 }}
              onClick={openCreateForm}
            >
              <UserPlus size={16} /> + Ajouter un Confirmateur
            </button>
          )}
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <button
          type="button"
          onClick={() => setActiveTab("performance")}
          style={{
            padding: "10px 16px",
            borderRadius: "12px",
            border: activeTab === "performance" ? "2px solid #ec4899" : "1px solid #cbd5e1",
            background: activeTab === "performance" ? "rgba(236, 72, 153, 0.1)" : "var(--surface, #fff)",
            color: activeTab === "performance" ? "#db2777" : "#475569",
            fontWeight: 800,
            fontSize: "13px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <DollarSign size={16} /> Salaires, Commissions & Compteurs ({staffList.length} confirmateur{staffList.length > 1 ? "s" : ""})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("journal")}
          style={{
            padding: "10px 16px",
            borderRadius: "12px",
            border: activeTab === "journal" ? "2px solid #2563eb" : "1px solid #cbd5e1",
            background: activeTab === "journal" ? "rgba(37, 99, 235, 0.1)" : "var(--surface, #fff)",
            color: activeTab === "journal" ? "#1d4ed8" : "#475569",
            fontWeight: 800,
            fontSize: "13px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <History size={16} /> Journal d'Activité en Direct ({filteredLogs.length} actions)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("deliveries")}
          style={{
            padding: "10px 16px",
            borderRadius: "12px",
            border: activeTab === "deliveries" ? "2px solid #10b981" : "1px solid #cbd5e1",
            background: activeTab === "deliveries" ? "rgba(16, 185, 129, 0.1)" : "var(--surface, #fff)",
            color: activeTab === "deliveries" ? "#059669" : "#475569",
            fontWeight: 800,
            fontSize: "13px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <PackageCheck size={16} /> Validation Colis Livrés & Commissions ({shippableOrConfirmedOrders.filter(o => o.isDelivered).length} livrés)
        </button>
      </div>

      {/* TAB 1: PERFORMANCE, SALAIRES & COMMISSIONS */}
      {activeTab === "performance" && (
        <div style={{ display: "grid", gap: "16px" }}>
          {staffList.length === 0 && (
            <div
              style={{
                padding: "24px",
                borderRadius: "16px",
                background: "rgba(236, 72, 153, 0.05)",
                border: "1px dashed rgba(236, 72, 153, 0.35)",
                textAlign: "center",
              }}
            >
              <Users size={32} style={{ color: "#ec4899", margin: "0 auto 8px" }} />
              <h3 style={{ margin: 0, fontSize: "16px" }}>Aucun confirmateur créé pour le moment</h3>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "6px 0 14px" }}>
                Ajoutez vos confirmateurs avec leur salaire de base, leur commission par commande livrée et leur code d'accès personnel.
              </p>
              {isOwner && (
                <button type="button" className="button button-gradient" onClick={openCreateForm}>
                  <Plus size={16} /> Créer mon premier confirmateur
                </button>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "16px" }}>
            {staffStats.map(st => {
              const m = st.member;
              if (m.isOwnerProfile && st.callsCount === 0 && st.confirmedCount === 0 && st.editsCount === 0 && staffList.length > 0) {
                return null;
              }
              return (
                <div
                  key={m.id}
                  style={{
                    borderRadius: "18px",
                    background: "var(--surface, #fff)",
                    border: "1px solid var(--border, #e2e8f0)",
                    padding: "18px",
                    boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)",
                    display: "grid",
                    gap: "14px",
                  }}
                >
                  {/* Card Top: Identity + Edit/Delete */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "12px",
                          background: m.avatarColor || "#ec4899",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                          fontSize: "16px",
                        }}
                      >
                        {m.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <strong style={{ fontSize: "16px" }}>{m.name}</strong>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 800,
                              padding: "2px 7px",
                              borderRadius: "999px",
                              background: m.active ? "rgba(16, 185, 129, 0.14)" : "rgba(239, 68, 68, 0.14)",
                              color: m.active ? "#059669" : "#dc2626",
                            }}
                          >
                            {m.isOwnerProfile ? "👑 Patron" : m.active ? "Actif" : "Suspendu"}
                          </span>
                        </div>
                        <small style={{ color: "#64748b", fontSize: "12px", display: "block" }}>
                          {m.isOwnerProfile
                            ? "Accès propriétaire complet"
                            : `Code connexion : ${isOwner ? m.code : "••••"} ${m.phone ? `· 📞 ${m.phone}` : ""}`}
                        </small>
                      </div>
                    </div>

                    {isOwner && !m.isOwnerProfile && (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="icon-button"
                          title="Modifier ce confirmateur"
                          onClick={() => openEditForm(m)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          style={{ color: "#ef4444" }}
                          title="Supprimer ce confirmateur"
                          onClick={() => {
                            if (window.confirm(`Supprimer le confirmateur ${m.name} ?`)) {
                              deleteMutation.mutate({ id: m.id });
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Counters Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", textAlign: "center" }}>
                    <div style={{ padding: "8px 6px", borderRadius: "10px", background: "rgba(37, 99, 235, 0.08)" }}>
                      <strong style={{ fontSize: "17px", color: "#2563eb", display: "block" }}>{st.callsCount}</strong>
                      <span style={{ fontSize: "10.5px", color: "#475569", fontWeight: 700 }}>📞 Appels</span>
                    </div>
                    <div style={{ padding: "8px 6px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.08)" }}>
                      <strong style={{ fontSize: "17px", color: "#059669", display: "block" }}>{st.confirmedCount}</strong>
                      <span style={{ fontSize: "10.5px", color: "#475569", fontWeight: 700 }}>🟢 Confirmées</span>
                    </div>
                    <div style={{ padding: "8px 6px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.08)" }}>
                      <strong style={{ fontSize: "17px", color: "#4f46e5", display: "block" }}>{st.deliveredCount}</strong>
                      <span style={{ fontSize: "10.5px", color: "#475569", fontWeight: 700 }}>📦 Livrées</span>
                    </div>
                    <div style={{ padding: "8px 6px", borderRadius: "10px", background: "rgba(236, 72, 153, 0.08)" }}>
                      <strong style={{ fontSize: "17px", color: "#db2777", display: "block" }}>{st.upsellCount}</strong>
                      <span style={{ fontSize: "10.5px", color: "#475569", fontWeight: 700 }}>🔥 Pack Duo</span>
                    </div>
                  </div>

                  {/* Secondary Status Breakdown */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      fontSize: "11.5px",
                      color: "#475569",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      background: "rgba(248, 250, 252, 0.9)",
                    }}
                  >
                    <span>🟠 NRP : <strong>{st.nrpCount}</strong></span>
                    <span>🔵 Reportées : <strong>{st.postponedCount}</strong></span>
                    <span>🔴 Annulées : <strong>{st.cancelledCount}</strong></span>
                    <span>✏️ Modifs : <strong>{st.editsCount}</strong></span>
                    <span>💬 WhatsApp : <strong>{st.whatsappCount}</strong></span>
                  </div>

                  {/* Confirmation & Delivery Rates */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
                    <div style={{ padding: "8px 10px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Taux de confirmation</span>
                      <strong style={{ fontSize: "15px", color: "#059669" }}>{st.confirmationRate}%</strong>
                    </div>
                    <div style={{ padding: "8px 10px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Taux de livraison</span>
                      <strong style={{ fontSize: "15px", color: "#2563eb" }}>{st.deliveryRate}%</strong>
                    </div>
                  </div>

                  {/* Anti-Cheat Alert Badge if any */}
                  {st.warningsCount > 0 && (
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: "10px",
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#dc2626",
                        fontSize: "12px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <AlertTriangle size={14} /> {st.warningsCount} alerte(s) anti-triche détectée(s) (statut sans appel / NRP rapide)
                    </div>
                  )}

                  {/* Payroll Box (Salaire de base + Commissions) */}
                  {!m.isOwnerProfile && (
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: "14px",
                        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        display: "grid",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#334155" }}>
                        <span>Salaire de base fixe :</span>
                        <strong>{formatDZD(m.baseSalary)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#334155" }}>
                        <span>
                          Commissions Livrées ({st.deliveredCount} × {formatDZD(m.commissionPerDelivered)}) :
                        </span>
                        <strong style={{ color: "#059669" }}>+ {formatDZD(st.commissionTotal)}</strong>
                      </div>
                      {(m.upsellBonusPerDelivered > 0 || st.deliveredUpsellCount > 0) && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#334155" }}>
                          <span>
                            Bonus Pack Duo Livrés ({st.deliveredUpsellCount} × {formatDZD(m.upsellBonusPerDelivered)}) :
                          </span>
                          <strong style={{ color: "#db2777" }}>+ {formatDZD(st.upsellBonusTotal)}</strong>
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingTop: "6px",
                          marginTop: "2px",
                          borderTop: "1px dashed rgba(16, 185, 129, 0.35)",
                          fontSize: "14px",
                        }}
                      >
                        <strong style={{ color: "#065f46" }}>💰 TOTAL À PAYER :</strong>
                        <strong style={{ fontSize: "17px", color: "#059669", fontWeight: 900 }}>
                          {formatDZD(st.totalPay)}
                        </strong>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    className="button button-outline full"
                    style={{ height: "36px", fontSize: "12px", fontWeight: 700 }}
                    onClick={() => {
                      setSelectedStaffFilter(m.id);
                      setActiveTab("journal");
                    }}
                  >
                    <History size={14} /> Voir toutes les actions de {m.name}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: JOURNAL D'ACTIVITÉ EN DIRECT */}
      {activeTab === "journal" && (
        <div style={{ display: "grid", gap: "14px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              padding: "12px",
              borderRadius: "14px",
              background: "var(--surface, #fff)",
              border: "1px solid var(--border, #e2e8f0)",
            }}
          >
            <select
              value={selectedStaffFilter}
              onChange={e => setSelectedStaffFilter(e.target.value)}
              style={{ height: "38px", borderRadius: "10px", padding: "0 10px", fontSize: "13px", fontWeight: 700 }}
            >
              <option value="all">👥 Tous les confirmateurs</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>
                  🎧 {s.name}
                </option>
              ))}
              <option value="owner">👑 Admin (Patron)</option>
            </select>

            <select
              value={selectedActionFilter}
              onChange={e => setSelectedActionFilter(e.target.value)}
              style={{ height: "38px", borderRadius: "10px", padding: "0 10px", fontSize: "13px", fontWeight: 700 }}
            >
              <option value="all">📋 Toutes les actions</option>
              <option value="call">📞 Appels & WhatsApp</option>
              <option value="status">🔄 Changements de statut & Reports</option>
              <option value="edit">✏️ Modifications de commandes</option>
              <option value="warning">⚠️ Alertes Anti-Triche uniquement</option>
            </select>

            <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
              <input
                type="text"
                placeholder="Rechercher commande, client, téléphone..."
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                style={{
                  width: "100%",
                  height: "38px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  padding: "0 12px",
                  fontSize: "13px",
                }}
              />
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
              Aucune action enregistrée pour ce filtre.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {filteredLogs.map(log => {
                const targetOrder = log.orderId ? orderById.get(log.orderId) : undefined;
                return (
                  <div
                    key={log.id}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: "var(--surface, #fff)",
                      border: log.warning
                        ? "1px solid rgba(239, 68, 68, 0.5)"
                        : "1px solid var(--border, #e2e8f0)",
                      display: "grid",
                      gap: "6px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            padding: "3px 9px",
                            borderRadius: "999px",
                            background: "rgba(37, 99, 235, 0.1)",
                            color: "#1d4ed8",
                            fontWeight: 800,
                            fontSize: "12px",
                          }}
                        >
                          🎧 {log.actorName}
                        </span>

                        {log.orderId && (
                          <button
                            type="button"
                            onClick={() => targetOrder && onOpenOrderHistory(targetOrder)}
                            style={{
                              padding: "3px 9px",
                              borderRadius: "8px",
                              background: "rgba(15, 23, 42, 0.06)",
                              border: "none",
                              color: "#0f172a",
                              fontWeight: 800,
                              fontSize: "12px",
                              cursor: targetOrder ? "pointer" : "default",
                              textDecoration: targetOrder ? "underline" : "none",
                            }}
                          >
                            {log.orderId} {log.customer ? `(${log.customer})` : ""}
                          </button>
                        )}

                        <strong style={{ fontSize: "13px", color: "var(--text, #1e293b)" }}>
                          {log.summary}
                        </strong>
                      </div>

                      <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600 }}>
                        🕒 {formatTime(log.at)}
                      </span>
                    </div>

                    {log.warning && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#dc2626",
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <AlertTriangle size={13} /> Alerte Anti-Triche : {log.warning}
                      </div>
                    )}

                    {Array.isArray(log.changes) && log.changes.length > 0 && (
                      <div
                        style={{
                          padding: "6px 10px",
                          borderRadius: "8px",
                          background: "rgba(248, 250, 252, 0.9)",
                          border: "1px solid #e2e8f0",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "10px",
                          fontSize: "11.5px",
                        }}
                      >
                        {log.changes.map((c, i) => (
                          <span key={i}>
                            <strong>{c.label}:</strong>{" "}
                            <span style={{ color: "#ef4444", textDecoration: "line-through" }}>{c.before}</span> ➔{" "}
                            <strong style={{ color: "#059669" }}>{c.after}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: VALIDATION DES COLIS LIVRÉS & COMMISSIONS */}
      {activeTab === "deliveries" && (
        <div style={{ display: "grid", gap: "12px" }}>
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              fontSize: "13px",
              color: "#065f46",
            }}
          >
            💡 <strong>Synchronisation Automatique + Manuelle :</strong> Dès qu'un colis passe au statut{" "}
            <strong>« Livré »</strong> sur E-com Delivery, la commission du confirmateur qui a confirmé la commande est{" "}
            <strong>créditée automatiquement</strong>. Vous pouvez aussi cocher/décocher manuellement un colis comme « Livré » ci-dessous.
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            {shippableOrConfirmedOrders.map(order => (
              <div
                key={order.id}
                style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "var(--surface, #fff)",
                  border: order.isDelivered ? "1px solid rgba(16, 185, 129, 0.45)" : "1px solid var(--border, #e2e8f0)",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ display: "grid", gap: "2px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <strong>{order.id}</strong>
                    <span>· {order.customer} ({order.phone})</span>
                    <strong style={{ color: "#059669" }}>{formatDZD(order.total)}</strong>
                    {order.isDelivered && (
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: "rgba(16, 185, 129, 0.15)",
                          color: "#059669",
                          fontSize: "11px",
                          fontWeight: 800,
                        }}
                      >
                        ✓ Colis Livré
                      </span>
                    )}
                  </div>
                  <small style={{ color: "#64748b", fontSize: "12px" }}>
                    {order.product} · Wilaya : {order.wilaya} · Confirmée par :{" "}
                    <strong style={{ color: "#db2777" }}>{order.confirmedByName || order.assignedToName || "Admin"}</strong>
                  </small>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    className="button button-outline"
                    style={{ height: "34px", padding: "0 10px", fontSize: "12px" }}
                    onClick={() => onOpenOrderHistory(order)}
                  >
                    <History size={14} /> Historique
                  </button>

                  {isOwner && (
                    <button
                      type="button"
                      disabled={markDeliveredMutation.isPending}
                      onClick={() =>
                        markDeliveredMutation.mutate({
                          id: order.dbId,
                          isDelivered: !order.isDelivered,
                        })
                      }
                      style={{
                        height: "34px",
                        padding: "0 12px",
                        borderRadius: "10px",
                        border: "none",
                        background: order.isDelivered ? "rgba(239, 68, 68, 0.12)" : "#10b981",
                        color: order.isDelivered ? "#dc2626" : "#fff",
                        fontWeight: 800,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      {order.isDelivered ? "Annuler Livré" : "✓ Marquer Livré (+Commission)"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL ADD / EDIT CONFIRMATEUR */}
      {isFormOpen && (
        <div className="modal-layer" style={{ zIndex: 1200 }}>
          <button className="modal-backdrop" onClick={() => setIsFormOpen(false)} aria-label="Fermer" />
          <div className="order-modal" style={{ maxWidth: "520px", width: "92vw", padding: "22px" }}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">Gestion Employé / Confirmateur</span>
                <h2>{editingMember ? `Modifier ${editingMember.name}` : "Nouveau Confirmateur"}</h2>
              </div>
              <button className="icon-button" onClick={() => setIsFormOpen(false)} aria-label="Fermer">
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} style={{ display: "grid", gap: "12px", marginTop: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
                  Nom / Prénom *
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Sarah"
                    required
                  />
                </label>
                <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
                  Téléphone
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Ex: 0550 12 34 56"
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
                <span>🔑 Code d'accès / Mot de passe personnel *</span>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="Ex: SARAH2026 (utilisé pour se connecter sur /admin)"
                  required
                />
                <small style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
                  Le confirmateur saisira ce code sur la page de connexion pour travailler sous son propre nom.
                </small>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
                  💵 Salaire de base fixe (DA)
                  <input
                    type="number"
                    min={0}
                    value={baseSalary}
                    onChange={e => setBaseSalary(Number(e.target.value))}
                    required
                  />
                </label>
                <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
                  📦 Commission / Colis Livré (DA)
                  <input
                    type="number"
                    min={0}
                    value={commissionPerDelivered}
                    onChange={e => setCommissionPerDelivered(Number(e.target.value))}
                    required
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
                  🔥 Bonus Upsell Pack Duo Livré (DA)
                  <input
                    type="number"
                    min={0}
                    value={upsellBonusPerDelivered}
                    onChange={e => setUpsellBonusPerDelivered(Number(e.target.value))}
                  />
                </label>
                <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
                  Statut du compte
                  <select value={active ? "1" : "0"} onChange={e => setActive(e.target.value === "1")}>
                    <option value="1">✅ Actif (Autorisé à se connecter)</option>
                    <option value="0">🚫 Suspendu (Accès bloqué)</option>
                  </select>
                </label>
              </div>

              <div>
                <span style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                  Couleur du badge :
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {AVATAR_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAvatarColor(c)}
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "50%",
                        background: c,
                        border: avatarColor === c ? "3px solid #0f172a" : "2px solid transparent",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="button button-gradient full"
                disabled={upsertMutation.isPending}
                style={{ marginTop: "8px", height: "46px", borderRadius: "12px", fontWeight: 800 }}
              >
                <Save size={16} /> {upsertMutation.isPending ? "Enregistrement..." : "Enregistrer le confirmateur"}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

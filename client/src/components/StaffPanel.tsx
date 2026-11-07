import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText,
  History,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type {
  CheckoutOrder,
  StaffMember,
  StaffPayrollProductBreakdown,
  StaffPayrollRecord,
} from "@shared/checkout";
import { formatDZD, getCatalogProducts } from "@/lib/store-data";
import { trpc } from "@/lib/trpc";

type Props = {
  orders: CheckoutOrder[];
  notify: (msg: string, type?: "normal" | "urgent" | "victory" | "order") => void;
  onOpenOrderHistory: (order: CheckoutOrder) => void;
  onOpenOrderEdit: (order: CheckoutOrder) => void;
};

type PeriodFilter = "salary_period" | "today" | "yesterday" | "7days" | "month" | "all";

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addOneMonthIsoDate(startYmd: string): string {
  const parts = startYmd.split("-").map(Number);
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  dt.setMonth(dt.getMonth() + 1);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateFr(ymd?: string): string {
  if (!ymd) return "—";
  const parts = ymd.slice(0, 10).split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return ymd;
}

function matchesPeriod(
  iso: string | undefined,
  period: PeriodFilter,
  salaryStartDate?: string,
  salaryEndDate?: string
): boolean {
  if (period === "all") return true;
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const targetMs = d.getTime();

  if (period === "salary_period") {
    const startStr = (salaryStartDate || "").slice(0, 10);
    const endStr = (salaryEndDate || "").slice(0, 10);
    if (startStr) {
      const [sy, sm, sd] = startStr.split("-").map(Number);
      if (!Number.isNaN(sy) && !Number.isNaN(sm) && !Number.isNaN(sd)) {
        const startMs = new Date(sy, sm - 1, sd, 0, 0, 0, 0).getTime();
        if (targetMs < startMs) return false;
      }
    }
    if (endStr) {
      const [ey, em, ed] = endStr.split("-").map(Number);
      if (!Number.isNaN(ey) && !Number.isNaN(em) && !Number.isNaN(ed)) {
        const endMs = new Date(ey, em - 1, ed, 23, 59, 59, 999).getTime();
        if (targetMs > endMs) return false;
      }
    }
    return true;
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

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

export function StaffPanel({ orders, notify, onOpenOrderHistory }: Props) {
  const utils = trpc.useUtils();
  const catalogProducts = useMemo(() => getCatalogProducts(), []);

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

  const [period, setPeriod] = useState<PeriodFilter>("salary_period");
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>("all");
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>("all");
  const [logSearch, setLogSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"performance" | "journal" | "deliveries">("performance");
  const [expandedHistoryStaffId, setExpandedHistoryStaffId] = useState<string | null>(null);

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
  const [productCommissions, setProductCommissions] = useState<Record<string, number>>({});
  const [selectedProductIdForCommission, setSelectedProductIdForCommission] = useState<string>("");
  const [selectedProductCommissionAmount, setSelectedProductCommissionAmount] = useState<number>(150);
  const [salaryStartDate, setSalaryStartDate] = useState<string>(() => getTodayIsoDate());
  const [salaryEndDate, setSalaryEndDate] = useState<string>(() => addOneMonthIsoDate(getTodayIsoDate()));
  const [active, setActive] = useState(true);

  const isOwner = staffQuery.data?.isOwner ?? true;
  const staffList = staffQuery.data?.staff ?? [];
  const activityLogs = staffQuery.data?.activityLogs ?? [];
  const orderById = useMemo(() => new Map(orders.map(o => [o.id, o])), [orders]);

  // Helper to resolve which catalog products appear in an order (supports Cross-Sell 2nd product with " + ")
  const resolveOrderProducts = (order: CheckoutOrder): Array<{ id: string; name: string }> => {
    const rawProductText = String(order.product || "").trim();
    const segments = rawProductText.includes(" + ")
      ? rawProductText.split(" + ").map(s => s.trim()).filter(Boolean)
      : [rawProductText];

    const matched: Array<{ id: string; name: string }> = [];

    segments.forEach((seg, idx) => {
      const cleanName = seg.replace(/\s*[×x]\s*\d+$/i, "").trim().toLowerCase();
      let found =
        idx === 0 && order.productId
          ? catalogProducts.find(p => p.id === order.productId)
          : undefined;

      if (!found && cleanName) {
        found = catalogProducts.find(
          p =>
            p.name.toLowerCase() === cleanName ||
            cleanName.includes(p.name.toLowerCase()) ||
            p.name.toLowerCase().includes(cleanName)
        );
      }

      if (found) {
        matched.push({ id: found.id, name: found.name });
      } else {
        matched.push({
          id: idx === 0 && order.productId ? order.productId : `custom-${cleanName || "produit"}`,
          name: seg.replace(/\s*[×x]\s*\d+$/i, "").trim() || "Produit",
        });
      }
    });

    return matched.length > 0 ? matched : [{ id: order.productId || "default", name: order.product || "Produit" }];
  };

  // Helper to get unit commission for a given member and product
  const getMemberProductCommission = (member: StaffMember, productId: string): number => {
    if (member.productCommissions && typeof member.productCommissions[productId] === "number") {
      return member.productCommissions[productId];
    }
    return member.commissionPerDelivered;
  };

  const openCreateForm = () => {
    const today = getTodayIsoDate();
    const defaultPerProduct: Record<string, number> = {};
    catalogProducts.forEach(p => {
      defaultPerProduct[p.id] = 150;
    });
    setEditingMember(null);
    setName("");
    setPhone("");
    setCode("");
    setAvatarColor(AVATAR_COLORS[staffList.length % AVATAR_COLORS.length]);
    setBaseSalary(25000);
    setCommissionPerDelivered(150);
    setUpsellBonusPerDelivered(50);
    setProductCommissions(defaultPerProduct);
    setSelectedProductIdForCommission(catalogProducts[0]?.id || "");
    setSelectedProductCommissionAmount(150);
    setSalaryStartDate(today);
    setSalaryEndDate(addOneMonthIsoDate(today));
    setActive(true);
    setIsFormOpen(true);
  };

  const openEditForm = (m: StaffMember) => {
    const today = getTodayIsoDate();
    const start = m.salaryStartDate || m.createdAt?.slice(0, 10) || today;
    const end = m.salaryEndDate || addOneMonthIsoDate(start);
    const existingMap: Record<string, number> = { ...(m.productCommissions || {}) };
    setEditingMember(m);
    setName(m.name);
    setPhone(m.phone);
    setCode(m.code);
    setAvatarColor(m.avatarColor || AVATAR_COLORS[0]);
    setBaseSalary(m.baseSalary);
    setCommissionPerDelivered(m.commissionPerDelivered);
    setUpsellBonusPerDelivered(m.upsellBonusPerDelivered ?? 50);
    setProductCommissions(existingMap);
    const firstProdId = catalogProducts[0]?.id || "";
    setSelectedProductIdForCommission(firstProdId);
    setSelectedProductCommissionAmount(
      firstProdId && typeof existingMap[firstProdId] === "number"
        ? existingMap[firstProdId]
        : m.commissionPerDelivered
    );
    setSalaryStartDate(start);
    setSalaryEndDate(end);
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
      productCommissions,
      salaryStartDate: salaryStartDate || getTodayIsoDate(),
      salaryEndDate: salaryEndDate || addOneMonthIsoDate(salaryStartDate || getTodayIsoDate()),
      payrollHistory: editingMember?.payrollHistory || [],
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
      const effectiveStart = member.salaryStartDate || member.createdAt?.slice(0, 10) || getTodayIsoDate();
      const effectiveEnd = member.salaryEndDate || addOneMonthIsoDate(effectiveStart);

      const memberLogs = activityLogs.filter(
        l =>
          (l.actorId === member.id || l.actorName.toLowerCase() === member.name.toLowerCase()) &&
          matchesPeriod(l.at, period, effectiveStart, effectiveEnd)
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
          matchesPeriod(o.confirmedAt || o.lastCalledAt || o.createdAt, period, effectiveStart, effectiveEnd)
      );

      const confirmedOrders = orders.filter(
        o =>
          (o.confirmedById === member.id ||
            (o.confirmedByName && o.confirmedByName.toLowerCase() === member.name.toLowerCase())) &&
          (o.status === "confirmee" || o.status === "transferee" || o.isDelivered) &&
          matchesPeriod(o.confirmedAt || o.createdAt, period, effectiveStart, effectiveEnd)
      );

      const deliveredOrders = confirmedOrders.filter(o => Boolean(o.isDelivered) && !o.returnReceived);
      const upsellOrders = orders.filter(
        o =>
          (o.upsellById === member.id ||
            (o.upsellByName && o.upsellByName.toLowerCase() === member.name.toLowerCase())) &&
          (o.quantity >= 2 || String(o.product || "").includes(" + ")) &&
          matchesPeriod(o.confirmedAt || o.createdAt, period, effectiveStart, effectiveEnd)
      );
      const deliveredUpsellOrders = upsellOrders.filter(o => Boolean(o.isDelivered) && !o.returnReceived);

      const nrpOrders = assignedOrders.filter(o => o.status === "ne_repond_pas");
      const postponedOrders = assignedOrders.filter(o => o.status === "reportee");
      const cancelledOrders = assignedOrders.filter(o => o.status === "annulee");

      const totalHandled = assignedOrders.length;
      const confirmationRate = totalHandled > 0 ? Math.round((confirmedOrders.length / totalHandled) * 100) : 0;
      const deliveryRate =
        confirmedOrders.length > 0 ? Math.round((deliveredOrders.length / confirmedOrders.length) * 100) : 0;

      // Per-product commission calculation on delivered orders
      const breakdownMap = new Map<string, StaffPayrollProductBreakdown>();
      const deliveredOrderDetails: Array<{
        order: CheckoutOrder;
        commission: number;
        productsLabel: string;
      }> = [];

      let commissionTotal = 0;

      deliveredOrders.forEach(order => {
        const orderProds = resolveOrderProducts(order);
        let orderComm = 0;
        orderProds.forEach(prod => {
          const unitComm = getMemberProductCommission(member, prod.id);
          orderComm += unitComm;
          const existing = breakdownMap.get(prod.id);
          if (existing) {
            existing.deliveredCount += 1;
            existing.totalCommission += unitComm;
          } else {
            breakdownMap.set(prod.id, {
              productId: prod.id,
              productName: prod.name,
              deliveredCount: 1,
              unitCommission: unitComm,
              totalCommission: unitComm,
            });
          }
        });
        commissionTotal += orderComm;
        deliveredOrderDetails.push({
          order,
          commission: orderComm,
          productsLabel: orderProds.map(p => p.name).join(" + "),
        });
      });

      const productBreakdown = Array.from(breakdownMap.values());
      const upsellBonusTotal = deliveredUpsellOrders.length * (member.upsellBonusPerDelivered || 0);
      const totalPay = member.baseSalary + commissionTotal + upsellBonusTotal;

      return {
        member,
        effectiveStart,
        effectiveEnd,
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
        productBreakdown,
        deliveredOrderDetails,
      };
    });
  }, [staffList, activityLogs, orders, period, catalogProducts]);

  // Close current salary month & start a new counting cycle
  const handleStartNewMonthCycle = (st: (typeof staffStats)[number]) => {
    const m = st.member;
    const today = getTodayIsoDate();
    const nextEnd = addOneMonthIsoDate(today);

    const confirmMsg =
      `Clôturer le mois de ${m.name} (${formatDateFr(st.effectiveStart)} au ${formatDateFr(st.effectiveEnd)}) et démarrer un NOUVEAU COMPTAGE à partir d'aujourd'hui (${formatDateFr(today)} au ${formatDateFr(nextEnd)}) ?\n\n` +
      `• Bilan archivé : ${formatDZD(st.totalPay)} (${st.confirmedCount} confirmées, ${st.deliveredCount} livrées)\n` +
      `• Vous pourrez toujours télécharger le PDF de ce mois dans l'historique du salarié.`;

    if (!window.confirm(confirmMsg)) return;

    const record: StaffPayrollRecord = {
      id: `pay-${Date.now()}`,
      closedAt: new Date().toISOString(),
      startDate: st.effectiveStart,
      endDate: st.effectiveEnd,
      baseSalary: m.baseSalary,
      commissionTotal: st.commissionTotal,
      upsellBonusTotal: st.upsellBonusTotal,
      totalPay: st.totalPay,
      callsCount: st.callsCount,
      whatsappCount: st.whatsappCount,
      handledCount: st.totalHandled,
      confirmedCount: st.confirmedCount,
      deliveredCount: st.deliveredCount,
      nrpCount: st.nrpCount,
      postponedCount: st.postponedCount,
      cancelledCount: st.cancelledCount,
      upsellCount: st.upsellCount,
      productBreakdown: st.productBreakdown,
    };

    const previousHistory = Array.isArray(m.payrollHistory) ? m.payrollHistory : [];

    upsertMutation.mutate({
      id: m.id,
      name: m.name,
      phone: m.phone,
      code: m.code,
      avatarColor: m.avatarColor,
      baseSalary: m.baseSalary,
      commissionPerDelivered: m.commissionPerDelivered,
      upsellBonusPerDelivered: m.upsellBonusPerDelivered,
      productCommissions: m.productCommissions || {},
      salaryStartDate: today,
      salaryEndDate: nextEnd,
      payrollHistory: [record, ...previousHistory],
      active: m.active,
    });
    setPeriod("salary_period");
    notify(`Nouveau mois démarré pour ${m.name} (${formatDateFr(today)} ➔ ${formatDateFr(nextEnd)}) 🎉`, "victory");
  };

  // Generate & download printable PDF Payslip for current period or archived month
  const handleDownloadPayslipPdf = (
    member: StaffMember,
    data: {
      startDate: string;
      endDate: string;
      baseSalary: number;
      commissionTotal: number;
      upsellBonusTotal: number;
      totalPay: number;
      callsCount: number;
      whatsappCount: number;
      handledCount: number;
      confirmedCount: number;
      deliveredCount: number;
      nrpCount: number;
      postponedCount: number;
      cancelledCount: number;
      upsellCount: number;
      productBreakdown: StaffPayrollProductBreakdown[];
      deliveredOrderDetails?: Array<{
        order: CheckoutOrder;
        commission: number;
        productsLabel: string;
      }>;
    }
  ) => {
    const confRate = data.handledCount > 0 ? Math.round((data.confirmedCount / data.handledCount) * 100) : 0;
    const delivRate = data.confirmedCount > 0 ? Math.round((data.deliveredCount / data.confirmedCount) * 100) : 0;

    // Build configured per-product rates table
    const configuredRatesRows = catalogProducts
      .map(p => {
        const comm = getMemberProductCommission(member, p.id);
        const deliveredRow = data.productBreakdown.find(b => b.productId === p.id);
        const qty = deliveredRow ? deliveredRow.deliveredCount : 0;
        const subTotal = deliveredRow ? deliveredRow.totalCommission : 0;
        return `
          <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;">${p.name}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${formatDZD(comm)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:800;color:#2563eb;">${qty}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:800;color:#059669;">${formatDZD(subTotal)}</td>
          </tr>
        `;
      })
      .join("");

    // Extra products not in standard catalog
    const extraBreakdownRows = data.productBreakdown
      .filter(b => !catalogProducts.some(p => p.id === b.productId))
      .map(
        b => `
          <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;">${b.productName}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${formatDZD(b.unitCommission)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:800;color:#2563eb;">${b.deliveredCount}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:800;color:#059669;">${formatDZD(b.totalCommission)}</td>
          </tr>
        `
      )
      .join("");

    const deliveredOrdersRows =
      data.deliveredOrderDetails && data.deliveredOrderDetails.length > 0
        ? data.deliveredOrderDetails
            .map(
              ({ order, commission, productsLabel }, idx) => `
              <tr>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${idx + 1}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-weight:700;">${order.id}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${formatDateFr((order.confirmedAt || order.createdAt || "").slice(0, 10))}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${order.customer} (${order.wilaya})</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${productsLabel}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatDZD(order.total)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:800;color:#059669;">+ ${formatDZD(commission)}</td>
              </tr>
            `
            )
            .join("")
        : `<tr><td colspan="7" style="padding:12px;text-align:center;color:#64748b;">Aucune commande livrée sur cette période</td></tr>`;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Fiche de Paie - ${member.name} (${formatDateFr(data.startDate)} au ${formatDateFr(data.endDate)})</title>
  <style>
    * { box-sizing: border-box; font-family: 'Segoe UI', Roboto, Arial, sans-serif; }
    body { margin: 0; padding: 24px; color: #0f172a; background: #f8fafc; }
    .sheet { max-width: 840px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    .top-bar { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #ec4899; padding-bottom: 16px; margin-bottom: 20px; }
    .brand h1 { margin: 0; font-size: 24px; color: #db2777; letter-spacing: -0.5px; }
    .brand p { margin: 4px 0 0; font-size: 12px; color: #64748b; }
    .doc-meta { text-align: right; }
    .doc-meta h2 { margin: 0; font-size: 18px; color: #0f172a; }
    .doc-meta .period-badge { display: inline-block; margin-top: 6px; padding: 4px 12px; border-radius: 999px; background: #fdf2f8; border: 1px solid #fbcfe8; color: #be185d; font-weight: 800; font-size: 12px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .card { padding: 14px 16px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; }
    .card h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
    .kpi { padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center; background: #fff; }
    .kpi strong { display: block; font-size: 20px; margin-bottom: 2px; }
    .kpi span { font-size: 11px; color: #64748b; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 22px; }
    th { background: #f1f5f9; color: #334155; text-align: left; padding: 9px 10px; font-size: 11.5px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
    .section-title { font-size: 14px; font-weight: 800; color: #0f172a; margin: 18px 0 10px; display: flex; align-items: center; gap: 8px; }
    .total-box { padding: 18px 20px; border-radius: 14px; background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 2px solid #10b981; display: grid; gap: 8px; margin-top: 16px; }
    .total-row { display: flex; justify-content: space-between; font-size: 13.5px; color: #065f46; }
    .total-final { display: flex; justify-content: space-between; align-items: center; padding-top: 10px; margin-top: 4px; border-top: 2px dashed #10b981; font-size: 18px; font-weight: 900; color: #047857; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569; }
    .sig-box { height: 75px; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 10px; }
    .no-print { text-align: center; margin-bottom: 16px; }
    .btn-print { background: #db2777; color: #fff; border: none; padding: 10px 22px; border-radius: 10px; font-weight: 800; font-size: 14px; cursor: pointer; }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { box-shadow: none; border: none; padding: 12px; max-width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>
  </div>
  <div class="sheet">
    <div class="top-bar">
      <div class="brand">
        <h1>MISS SENSUELLE</h1>
        <p>Call-Center COD & Gestion des Confirmateurs</p>
      </div>
      <div class="doc-meta">
        <h2>FICHE DE PAIE & BILAN MENSUEL</h2>
        <span class="period-badge">📅 Période : Du ${formatDateFr(data.startDate)} au ${formatDateFr(data.endDate)}</span>
        <div style="font-size:11px;color:#64748b;margin-top:4px;">Édité le ${new Date().toLocaleDateString("fr-DZ")}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>👤 Informations Salarié(e) / Confirmateur</h3>
        <div style="font-size:15px;font-weight:800;color:#0f172a;">${member.name}</div>
        <div style="font-size:12.5px;color:#475569;margin-top:4px;">Téléphone : <strong>${member.phone || "Non renseigné"}</strong></div>
        <div style="font-size:12.5px;color:#475569;margin-top:2px;">Code Agent : <strong>${member.code}</strong></div>
      </div>
      <div class="card">
        <h3>💵 Barème Rémunération Contrat</h3>
        <div style="font-size:12.5px;color:#334155;">Salaire de base mensuel : <strong>${formatDZD(data.baseSalary)}</strong></div>
        <div style="font-size:12.5px;color:#334155;margin-top:3px;">Commission standard / livré : <strong>${formatDZD(member.commissionPerDelivered)}</strong></div>
        <div style="font-size:12.5px;color:#334155;margin-top:3px;">Bonus Pack Duo / Cross-Sell livré : <strong>${formatDZD(member.upsellBonusPerDelivered || 0)}</strong></div>
      </div>
    </div>

    <div class="section-title">📊 1. Bilan d'Activité & Statistiques de Confirmation</div>
    <div class="kpi-grid">
      <div class="kpi">
        <strong style="color:#2563eb;">${data.callsCount}</strong>
        <span>📞 Appels Passés (${data.whatsappCount} WhatsApp)</span>
      </div>
      <div class="kpi">
        <strong style="color:#0f172a;">${data.handledCount}</strong>
        <span>📋 Commandes Traitées</span>
      </div>
      <div class="kpi">
        <strong style="color:#059669;">${data.confirmedCount} (${confRate}%)</strong>
        <span>🟢 Commandes Confirmées</span>
      </div>
      <div class="kpi">
        <strong style="color:#4f46e5;">${data.deliveredCount} (${delivRate}%)</strong>
        <span>📦 Colis Livrés Payés</span>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:12px;margin-bottom:20px;">
      <span>🟠 Sans réponse (NRP) : <strong>${data.nrpCount}</strong></span>
      <span>🔵 Commandes Reportées : <strong>${data.postponedCount}</strong></span>
      <span>🔴 Commandes Annulées : <strong>${data.cancelledCount}</strong></span>
      <span>🔥 Ventes Pack Duo / 2e Produit : <strong>${data.upsellCount}</strong></span>
    </div>

    <div class="section-title">🛍️ 2. Détail des Commissions par Produit (Commandes Livrées)</div>
    <table>
      <thead>
        <tr>
          <th>Produit du Catalogue</th>
          <th style="text-align:center;">Commission Unitaire</th>
          <th style="text-align:center;">Quantité Livrée</th>
          <th style="text-align:right;">Total Commission</th>
        </tr>
      </thead>
      <tbody>
        ${configuredRatesRows}
        ${extraBreakdownRows}
      </tbody>
    </table>

    ${
      data.deliveredOrderDetails
        ? `
    <div class="section-title">📦 3. Liste Détaillée des Commandes Livrées sur la Période (${data.deliveredOrderDetails.length})</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Réf</th>
          <th>Date</th>
          <th>Client & Wilaya</th>
          <th>Produit(s)</th>
          <th style="text-align:right;">Total Colis</th>
          <th style="text-align:right;">Commission</th>
        </tr>
      </thead>
      <tbody>
        ${deliveredOrdersRows}
      </tbody>
    </table>
    `
        : ""
    }

    <div class="total-box">
      <div class="total-row">
        <span>Salaire de base fixe (${formatDateFr(data.startDate)} au ${formatDateFr(data.endDate)}) :</span>
        <strong>${formatDZD(data.baseSalary)}</strong>
      </div>
      <div class="total-row">
        <span>Total Commissions sur Produits Livrés (${data.deliveredCount} colis livrés) :</span>
        <strong>+ ${formatDZD(data.commissionTotal)}</strong>
      </div>
      <div class="total-row">
        <span>Bonus Pack Duo / Cross-Sell Livrés :</span>
        <strong>+ ${formatDZD(data.upsellBonusTotal)}</strong>
      </div>
      <div class="total-final">
        <span>💰 NET À PAYER AU SALARIÉ :</span>
        <span>${formatDZD(data.totalPay)}</span>
      </div>
    </div>

    <div class="signatures">
      <div class="sig-box">
        <strong>Signature Direction / Employeur :</strong>
      </div>
      <div class="sig-box">
        <strong>Signature Salarié(e) (${member.name}) :</strong>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 350);
    };
  </script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) {
      notify("Veuillez autoriser les pop-ups pour télécharger la fiche de paie PDF", "urgent");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  // Filtered activity logs for the live journal
  const filteredLogs = useMemo(() => {
    return activityLogs.filter(log => {
      if (period !== "salary_period" && !matchesPeriod(log.at, period)) return false;
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
          <h2 style={{ marginTop: "4px" }}>Confirmateurs, Commissions par Produit & Fiches de Paie PDF</h2>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
            Définissez la commission de chaque produit, choisissez les dates de début/fin de mois de chaque salarié, relancez un nouveau comptage en fin de mois et téléchargez la fiche de paie PDF.
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
              border: "1px solid #ec4899",
              background: period === "salary_period" ? "rgba(236, 72, 153, 0.08)" : undefined,
            }}
          >
            <option value="salary_period">📆 Période du mois du salarié (Début ➔ Fin)</option>
            <option value="today">📅 Aujourd'hui</option>
            <option value="yesterday">📅 Hier</option>
            <option value="7days">📅 7 derniers jours</option>
            <option value="month">📅 Ce mois calendaire</option>
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
          <DollarSign size={16} /> Salaires, Commissions par Produit & Paie PDF ({staffList.length} confirmateur{staffList.length > 1 ? "s" : ""})
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
                Ajoutez vos confirmateurs avec leur salaire de base, leur commission personnalisée par produit et leurs dates de début/fin de mois.
              </p>
              {isOwner && (
                <button type="button" className="button button-gradient" onClick={openCreateForm}>
                  <Plus size={16} /> Créer mon premier confirmateur
                </button>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "16px" }}>
            {staffStats.map(st => {
              const m = st.member;
              if (m.isOwnerProfile && st.callsCount === 0 && st.confirmedCount === 0 && st.editsCount === 0 && staffList.length > 0) {
                return null;
              }
              const archivedMonths = Array.isArray(m.payrollHistory) ? m.payrollHistory : [];

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
                          title="Modifier salaire, commissions par produit et dates"
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

                  {/* Salary Month Period Box (Start Date -> End Date + Direct Edit & New Month Reset) */}
                  {!m.isOwnerProfile && (
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: "12px",
                        background: "rgba(236, 72, 153, 0.06)",
                        border: "1px solid rgba(236, 72, 153, 0.25)",
                        display: "grid",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                        <span style={{ fontSize: "11.5px", fontWeight: 800, color: "#be185d", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <Calendar size={13} /> Période du mois salarié :
                        </span>
                        <span style={{ fontSize: "12px", fontWeight: 900, color: "#0f172a" }}>
                          Du {formatDateFr(st.effectiveStart)} au {formatDateFr(st.effectiveEnd)}
                        </span>
                      </div>

                      {isOwner && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", alignItems: "center" }}>
                          <label style={{ fontSize: "10.5px", color: "#475569", fontWeight: 700 }}>
                            Début du mois :
                            <input
                              type="date"
                              value={st.effectiveStart}
                              onChange={e => {
                                const newStart = e.target.value;
                                if (!newStart) return;
                                upsertMutation.mutate({
                                  id: m.id,
                                  name: m.name,
                                  phone: m.phone,
                                  code: m.code,
                                  avatarColor: m.avatarColor,
                                  baseSalary: m.baseSalary,
                                  commissionPerDelivered: m.commissionPerDelivered,
                                  upsellBonusPerDelivered: m.upsellBonusPerDelivered,
                                  productCommissions: m.productCommissions || {},
                                  salaryStartDate: newStart,
                                  salaryEndDate: addOneMonthIsoDate(newStart),
                                  payrollHistory: m.payrollHistory || [],
                                  active: m.active,
                                });
                              }}
                              style={{
                                width: "100%",
                                height: "30px",
                                fontSize: "11.5px",
                                padding: "0 6px",
                                borderRadius: "8px",
                                border: "1px solid #cbd5e1",
                                marginTop: "2px",
                              }}
                            />
                          </label>
                          <label style={{ fontSize: "10.5px", color: "#475569", fontWeight: 700 }}>
                            Fin du mois :
                            <input
                              type="date"
                              value={st.effectiveEnd}
                              onChange={e => {
                                const newEnd = e.target.value;
                                if (!newEnd) return;
                                upsertMutation.mutate({
                                  id: m.id,
                                  name: m.name,
                                  phone: m.phone,
                                  code: m.code,
                                  avatarColor: m.avatarColor,
                                  baseSalary: m.baseSalary,
                                  commissionPerDelivered: m.commissionPerDelivered,
                                  upsellBonusPerDelivered: m.upsellBonusPerDelivered,
                                  productCommissions: m.productCommissions || {},
                                  salaryStartDate: st.effectiveStart,
                                  salaryEndDate: newEnd,
                                  payrollHistory: m.payrollHistory || [],
                                  active: m.active,
                                });
                              }}
                              style={{
                                width: "100%",
                                height: "30px",
                                fontSize: "11.5px",
                                padding: "0 6px",
                                borderRadius: "8px",
                                border: "1px solid #cbd5e1",
                                marginTop: "2px",
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}

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
                      <AlertTriangle size={14} /> {st.warningsCount} alerte(s) anti-triche détectée(s)
                    </div>
                  )}

                  {/* Per-Product Commission Barème & Breakdown */}
                  {!m.isOwnerProfile && (
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: "12px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        display: "grid",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "11.5px", fontWeight: 800, color: "#334155" }}>
                          🛍️ Commissions par Produit (Livrées) :
                        </span>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => openEditForm(m)}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "#db2777",
                              fontSize: "11px",
                              fontWeight: 800,
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            Modifier barème
                          </button>
                        )}
                      </div>

                      <div style={{ display: "grid", gap: "4px", fontSize: "11.5px" }}>
                        {catalogProducts.map(prod => {
                          const unitComm = getMemberProductCommission(m, prod.id);
                          const statRow = st.productBreakdown.find(b => b.productId === prod.id);
                          const qty = statRow ? statRow.deliveredCount : 0;
                          const subTotal = statRow ? statRow.totalCommission : 0;
                          return (
                            <div
                              key={prod.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "4px 6px",
                                borderRadius: "6px",
                                background: qty > 0 ? "rgba(16, 185, 129, 0.08)" : "transparent",
                              }}
                            >
                              <span style={{ color: "#1e293b", fontWeight: qty > 0 ? 700 : 500 }}>
                                {prod.name} <small style={{ color: "#64748b" }}>({formatDZD(unitComm)}/livré)</small>
                              </span>
                              <strong style={{ color: qty > 0 ? "#059669" : "#94a3b8" }}>
                                {qty} livré{qty > 1 ? "s" : ""} = {formatDZD(subTotal)}
                              </strong>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Payroll Box (Salaire de base + Commissions par produit) */}
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
                        <span>Commissions Produits Livrés ({st.deliveredCount} colis) :</span>
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

                  {/* Action Buttons: PDF Payslip + End of Month New Count + Activity Log */}
                  {!m.isOwnerProfile && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadPayslipPdf(m, {
                            startDate: st.effectiveStart,
                            endDate: st.effectiveEnd,
                            baseSalary: m.baseSalary,
                            commissionTotal: st.commissionTotal,
                            upsellBonusTotal: st.upsellBonusTotal,
                            totalPay: st.totalPay,
                            callsCount: st.callsCount,
                            whatsappCount: st.whatsappCount,
                            handledCount: st.totalHandled,
                            confirmedCount: st.confirmedCount,
                            deliveredCount: st.deliveredCount,
                            nrpCount: st.nrpCount,
                            postponedCount: st.postponedCount,
                            cancelledCount: st.cancelledCount,
                            upsellCount: st.upsellCount,
                            productBreakdown: st.productBreakdown,
                            deliveredOrderDetails: st.deliveredOrderDetails,
                          })
                        }
                        style={{
                          height: "38px",
                          borderRadius: "10px",
                          border: "1px solid #2563eb",
                          background: "rgba(37, 99, 235, 0.08)",
                          color: "#1d4ed8",
                          fontWeight: 800,
                          fontSize: "12px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                        }}
                      >
                        <FileText size={14} /> 📄 Télécharger PDF Paie
                      </button>

                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleStartNewMonthCycle(st)}
                          style={{
                            height: "38px",
                            borderRadius: "10px",
                            border: "1px solid #059669",
                            background: "rgba(16, 185, 129, 0.1)",
                            color: "#047857",
                            fontWeight: 800,
                            fontSize: "12px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                          }}
                        >
                          <RefreshCw size={14} /> 🔄 Fin du mois / Nouveau comptage
                        </button>
                      )}
                    </div>
                  )}

                  {/* Archived Payroll History Accordion */}
                  {!m.isOwnerProfile && archivedMonths.length > 0 && (
                    <div
                      style={{
                        borderRadius: "10px",
                        border: "1px solid #e2e8f0",
                        padding: "8px 10px",
                        background: "#f8fafc",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedHistoryStaffId(expandedHistoryStaffId === m.id ? null : m.id)
                        }
                        style={{
                          width: "100%",
                          border: "none",
                          background: "transparent",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "12px",
                          fontWeight: 800,
                          color: "#334155",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <span>📚 Mois clôturés archivés ({archivedMonths.length})</span>
                        <span>{expandedHistoryStaffId === m.id ? "▲ Masquer" : "▼ Voir & Télécharger PDF"}</span>
                      </button>

                      {expandedHistoryStaffId === m.id && (
                        <div style={{ display: "grid", gap: "6px", marginTop: "8px" }}>
                          {archivedMonths.map(rec => (
                            <div
                              key={rec.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: "6px",
                                padding: "6px 8px",
                                borderRadius: "8px",
                                background: "#fff",
                                border: "1px solid #e2e8f0",
                                fontSize: "11.5px",
                              }}
                            >
                              <div>
                                <strong>
                                  {formatDateFr(rec.startDate)} ➔ {formatDateFr(rec.endDate)}
                                </strong>
                                <div style={{ color: "#64748b", fontSize: "11px" }}>
                                  {rec.confirmedCount} conf. · {rec.deliveredCount} livrés · Payé :{" "}
                                  <strong style={{ color: "#059669" }}>{formatDZD(rec.totalPay)}</strong>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDownloadPayslipPdf(m, rec)}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: "8px",
                                  border: "1px solid #2563eb",
                                  background: "rgba(37, 99, 235, 0.08)",
                                  color: "#1d4ed8",
                                  fontWeight: 800,
                                  fontSize: "11px",
                                  cursor: "pointer",
                                }}
                              >
                                📄 PDF
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
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
            💡 <strong>Synchronisation Automatique + Commission par Produit :</strong> Dès qu'un colis passe au statut{" "}
            <strong>« Livré »</strong> sur E-com Delivery, la commission spécifique du produit (ou des 2 produits si Cross-Sell) est{" "}
            <strong>créditée automatiquement</strong> au confirmateur. Vous pouvez aussi cocher/décocher manuellement un colis comme « Livré » ci-dessous.
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
          <div
            className="order-modal"
            style={{ maxWidth: "600px", width: "94vw", maxHeight: "90vh", overflowY: "auto", padding: "22px" }}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">Gestion Employé / Confirmateur</span>
                <h2>{editingMember ? `Modifier ${editingMember.name}` : "Nouveau Confirmateur"}</h2>
              </div>
              <button className="icon-button" onClick={() => setIsFormOpen(false)} aria-label="Fermer">
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} style={{ display: "grid", gap: "14px", marginTop: "14px" }}>
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
              </label>

              {/* Section Dates de début et de fin du mois du salarié */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "rgba(236, 72, 153, 0.06)",
                  border: "1px solid rgba(236, 72, 153, 0.25)",
                  display: "grid",
                  gap: "10px",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#be185d" }}>
                  📅 Période du mois du salarié (Début & Fin du comptage)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 700 }}>
                    Date où le mois commence *
                    <input
                      type="date"
                      value={salaryStartDate}
                      onChange={e => {
                        const start = e.target.value;
                        setSalaryStartDate(start);
                        if (start) {
                          setSalaryEndDate(addOneMonthIsoDate(start));
                        }
                      }}
                      required
                    />
                  </label>
                  <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 700 }}>
                    Date où le mois se termine *
                    <input
                      type="date"
                      value={salaryEndDate}
                      onChange={e => setSalaryEndDate(e.target.value)}
                      required
                    />
                  </label>
                </div>
                <small style={{ fontSize: "11px", color: "#64748b" }}>
                  Le comptage des appels, confirmations, livraisons et commissions de ce salarié sera calculé entre ces deux dates.
                </small>
              </div>

              {/* Salaire de base + Commission par défaut */}
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
                  📦 Commission par défaut (DA)
                  <input
                    type="number"
                    min={0}
                    value={commissionPerDelivered}
                    onChange={e => setCommissionPerDelivered(Number(e.target.value))}
                    required
                  />
                </label>
              </div>

              {/* Section Commission par produit */}
              <div
                style={{
                  padding: "14px",
                  borderRadius: "14px",
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  display: "grid",
                  gap: "10px",
                }}
              >
                <div>
                  <strong style={{ fontSize: "13.5px", color: "#0f172a", display: "block" }}>
                    🛍️ Commission par Produit (Chaque produit a sa propre commission)
                  </strong>
                  <small style={{ fontSize: "11.5px", color: "#64748b" }}>
                    Sélectionnez un produit dans la liste ou modifiez directement la commission (en DA) de chaque produit ci-dessous :
                  </small>
                </div>

                {/* Sélecteur rapide Produit + Commission */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 0.8fr auto",
                    gap: "8px",
                    alignItems: "end",
                    padding: "10px",
                    borderRadius: "10px",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <label style={{ display: "grid", gap: "4px", fontSize: "11.5px", fontWeight: 700 }}>
                    Sélectionner un produit
                    <select
                      value={selectedProductIdForCommission}
                      onChange={e => {
                        const pid = e.target.value;
                        setSelectedProductIdForCommission(pid);
                        const currentVal =
                          typeof productCommissions[pid] === "number"
                            ? productCommissions[pid]
                            : commissionPerDelivered;
                        setSelectedProductCommissionAmount(currentVal);
                      }}
                      style={{ height: "36px", borderRadius: "8px", padding: "0 8px", fontSize: "12.5px" }}
                    >
                      {catalogProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({formatDZD(p.price)})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: "grid", gap: "4px", fontSize: "11.5px", fontWeight: 700 }}>
                    Commission (DA)
                    <input
                      type="number"
                      min={0}
                      value={selectedProductCommissionAmount}
                      onChange={e => setSelectedProductCommissionAmount(Number(e.target.value))}
                      style={{ height: "36px", borderRadius: "8px", padding: "0 8px", fontSize: "12.5px" }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedProductIdForCommission) return;
                      setProductCommissions(prev => ({
                        ...prev,
                        [selectedProductIdForCommission]: Math.max(0, Math.round(selectedProductCommissionAmount || 0)),
                      }));
                      notify("Commission du produit appliquée ✅");
                    }}
                    style={{
                      height: "36px",
                      padding: "0 12px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#059669",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    <CheckCircle2 size={14} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                    Appliquer
                  </button>
                </div>

                {/* Liste complète des produits avec leur commission respective */}
                <div style={{ display: "grid", gap: "6px" }}>
                  {catalogProducts.map(prod => {
                    const val =
                      typeof productCommissions[prod.id] === "number"
                        ? productCommissions[prod.id]
                        : commissionPerDelivered;
                    return (
                      <div
                        key={prod.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 130px",
                          alignItems: "center",
                          gap: "10px",
                          padding: "6px 10px",
                          borderRadius: "8px",
                          background: "#fff",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#1e293b" }}>
                          {prod.name}{" "}
                          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
                            ({formatDZD(prod.price)})
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <input
                            type="number"
                            min={0}
                            value={val}
                            onChange={e => {
                              const nextVal = Math.max(0, Math.round(Number(e.target.value) || 0));
                              setProductCommissions(prev => ({
                                ...prev,
                                [prod.id]: nextVal,
                              }));
                            }}
                            style={{
                              width: "90px",
                              height: "32px",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              padding: "0 8px",
                              fontWeight: 800,
                              fontSize: "12.5px",
                              color: "#059669",
                            }}
                          />
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>DA</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
                  🔥 Bonus Pack Duo / Cross-Sell Livré (DA)
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
                style={{ marginTop: "6px", height: "46px", borderRadius: "12px", fontWeight: 800 }}
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

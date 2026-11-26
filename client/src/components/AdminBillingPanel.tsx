import { useState } from "react";
import {
  CheckCircle2,
  Crown,
  ExternalLink,
  Layers,
  ReceiptText,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { gcomeHref } from "@/lib/gcome-routing";
import {
  computeBillingPrice,
  GCOME_PLANS,
  type GcomeBillingCycle,
  type GcomePaidPlanId,
  type GcomePaymentMethod,
} from "@shared/billing";

export function AdminBillingPanel({ notify }: { notify: (msg: string) => void }) {
  const billingQuery = trpc.billing.current.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const requestUpgrade = trpc.billing.requestUpgrade.useMutation();
  const markLead = trpc.billing.markSignupStatus.useMutation();

  const [cycle, setCycle] = useState<GcomeBillingCycle>("monthly");
  const [selectedMethod, setSelectedMethod] = useState<GcomePaymentMethod>("chargily");

  const data = billingQuery.data;
  const sub = data?.subscription;
  const usage = data?.usage;

  const handleRequestUpgrade = async (planId: GcomePaidPlanId) => {
    try {
      const res = await requestUpgrade.mutateAsync({
        planId,
        cycle,
        paymentMethod: selectedMethod,
      });
      await billingQuery.refetch();
      notify(`Demande enregistrée (${res.invoice.id}) — Compte Propriétaire toujours illimité ✅`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erreur lors de la demande");
    }
  };

  const handleLeadStatus = async (
    leadId: string,
    status: "new" | "contacted" | "activated" | "archived"
  ) => {
    try {
      await markLead.mutateAsync({ leadId, status });
      await billingQuery.refetch();
      notify("Statut du prospect SaaS mis à jour ✦");
    } catch {
      notify("Erreur de mise à jour");
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Current Plan Hero */}
      <section className="ecom-delivery-card">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#7c3aed" }}>
              <Crown size={15} color="#f5b301" />
              <span>GCOME SaaS · Espace Abonnement</span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>
              {sub?.isOwnerUnlimited
                ? `${sub.storeName} — Propriétaire Illimité ✅`
                : `Offre ${String(sub?.planId || "pro").toUpperCase()}`}
            </h2>
            <p style={{ fontSize: 13, opacity: 0.78, marginTop: 4 }}>
              {sub?.isOwnerUnlimited
                ? "Ta boutique principale bénéficie d'un accès illimité à vie (commandes, équipe, transporteurs et Finance IA sans restriction)."
                : `Renouvellement prévu le ${sub?.renewsAt ? new Date(sub.renewsAt).toLocaleDateString("fr-DZ") : "—"}`}
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link href={gcomeHref("/")} className="button button-outline">
              <ExternalLink size={14} /> Page d'accueil GCOME
            </Link>
            <Link href={gcomeHref("/tarifs")} className="button button-gradient">
              <Sparkles size={14} /> Voir Tarifs Publics
            </Link>
          </div>
        </div>

        {/* Live Usage Gauges */}
        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 12,
          }}
        >
          <div style={{ padding: 13, borderRadius: 14, border: "1px solid var(--border, rgba(124,58,237,0.16))" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800 }}>
              <span>Commandes ({usage?.currentMonth || "ce mois"})</span>
              <Layers size={14} color="#7c3aed" />
            </div>
            <strong style={{ fontSize: 22, fontWeight: 900, display: "block", marginTop: 4 }}>
              {usage?.ordersThisMonth ?? 0}{" "}
              <small style={{ fontSize: 12, opacity: 0.7, fontWeight: 700 }}>
                / {usage?.orderLimit ? usage.orderLimit : "Illimité"}
              </small>
            </strong>
          </div>

          <div style={{ padding: 13, borderRadius: 14, border: "1px solid var(--border, rgba(124,58,237,0.16))" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800 }}>
              <span>Membres d'équipe</span>
              <Users size={14} color="#10b981" />
            </div>
            <strong style={{ fontSize: 22, fontWeight: 900, display: "block", marginTop: 4 }}>
              {usage?.staffCount ?? 0}{" "}
              <small style={{ fontSize: 12, opacity: 0.7, fontWeight: 700 }}>
                / {usage?.staffLimit ? usage.staffLimit : "Illimité"}
              </small>
            </strong>
          </div>

          <div style={{ padding: 13, borderRadius: 14, border: "1px solid var(--border, rgba(124,58,237,0.16))" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800 }}>
              <span>Boutiques connectées</span>
              <Zap size={14} color="#f5b301" />
            </div>
            <strong style={{ fontSize: 22, fontWeight: 900, display: "block", marginTop: 4 }}>
              {usage?.storesCount ?? 1}{" "}
              <small style={{ fontSize: 12, opacity: 0.7, fontWeight: 700 }}>
                / {sub?.isOwnerUnlimited ? "Illimité" : (usage?.storeLimit ?? 1)}
              </small>
            </strong>
          </div>
        </div>
      </section>

      {/* Plans Preview & Upgrade Simulation */}
      <section className="ecom-delivery-card">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 900 }}>Grille SaaS & Test Facturation</h3>
            <small style={{ fontSize: 12.5, opacity: 0.75 }}>
              Prêt pour les futurs clients GCOME (mode préparation Chargily / CCP).
            </small>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button
              type="button"
              className={cycle === "monthly" ? "button button-gradient" : "button button-outline"}
              style={{ padding: "5px 12px", fontSize: 12 }}
              onClick={() => setCycle("monthly")}
            >
              Mensuel
            </button>
            <button
              type="button"
              className={cycle === "yearly" ? "button button-gradient" : "button button-outline"}
              style={{ padding: "5px 12px", fontSize: 12 }}
              onClick={() => setCycle("yearly")}
            >
              Annuel (-20 %)
            </button>
            <select
              value={selectedMethod}
              onChange={e => setSelectedMethod(e.target.value as GcomePaymentMethod)}
              style={{ padding: "5px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}
            >
              <option value="chargily">Chargily (CIB / Edahabia)</option>
              <option value="ccp">Virement CCP</option>
              <option value="card">Carte Intl</option>
            </select>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {GCOME_PLANS.map(plan => {
            const pr = computeBillingPrice(plan.id, cycle);
            return (
              <div
                key={plan.id}
                style={{
                  padding: 14,
                  borderRadius: 15,
                  border: plan.recommended
                    ? "2px solid #7c3aed"
                    : "1px solid var(--border, rgba(124,58,237,0.16))",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <strong>{plan.nameFr}</strong>
                  <div style={{ fontSize: 21, fontWeight: 900, marginTop: 4 }}>
                    {pr.monthlyEquivalentDzd.toLocaleString("fr-DZ")} DA
                    <small style={{ fontSize: 11.5, opacity: 0.7 }}>/mois</small>
                  </div>
                  <ul style={{ marginTop: 8, padding: 0, listStyle: "none", display: "grid", gap: 4, fontSize: 12 }}>
                    {plan.featuresFr.slice(0, 4).map((f, i) => (
                      <li key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <CheckCircle2 size={13} color="#10b981" /> <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  className={plan.recommended ? "button button-gradient" : "button button-outline"}
                  disabled={requestUpgrade.isPending}
                  onClick={() => void handleRequestUpgrade(plan.id)}
                >
                  Tester facture ({plan.nameFr})
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Incoming SaaS Signups + Invoices */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
          gap: 16,
        }}
      >
        <section className="ecom-delivery-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 900 }}>
              Inscriptions SaaS reçues ({data?.signupLeads.length ?? 0})
            </h3>
          </div>
          {!data?.signupLeads.length ? (
            <p className="ecom-note">
              Les marchands qui s'inscrivent via /gcome/inscription apparaîtront ici.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {data.signupLeads.map(lead => (
                <div
                  key={lead.id}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid var(--border, rgba(124,58,237,0.16))",
                    display: "grid",
                    gap: 4,
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                    <span>
                      {lead.storeName} ({lead.planId.toUpperCase()})
                    </span>
                    <span>{lead.status}</span>
                  </div>
                  <div style={{ opacity: 0.8 }}>
                    {lead.fullName} · {lead.phone} · {lead.wilaya}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    {(["contacted", "activated", "archived"] as const).map(st => (
                      <button
                        key={st}
                        type="button"
                        className="button button-light"
                        style={{ padding: "3px 8px", fontSize: 11 }}
                        onClick={() => void handleLeadStatus(lead.id, st)}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="ecom-delivery-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <ReceiptText size={17} color="#7c3aed" />
            <h3 style={{ fontSize: 16, fontWeight: 900 }}>
              Historique factures ({data?.invoices.length ?? 0})
            </h3>
          </div>
          {!data?.invoices.length ? (
            <p className="ecom-note">Aucune facture enregistrée pour le moment.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {data.invoices.map(inv => (
                <div
                  key={inv.id}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid var(--border, rgba(124,58,237,0.16))",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12.5,
                  }}
                >
                  <div>
                    <strong style={{ display: "block" }}>
                      {inv.id} · {inv.planId.toUpperCase()}
                    </strong>
                    <small style={{ opacity: 0.78 }}>
                      {inv.paymentMethod.toUpperCase()} · {inv.status}
                    </small>
                  </div>
                  <strong>{inv.amountDzd.toLocaleString("fr-DZ")} DA</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

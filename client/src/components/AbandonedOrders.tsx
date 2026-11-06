import { useMemo, useState } from "react";
import { ArrowRightCircle, Check, Clipboard, Eye, Filter, Phone, RefreshCw, Search, Trash2, X } from "lucide-react";
import { formatDZD } from "@/lib/store-data";
import { trpc } from "@/lib/trpc";
import type { AbandonedCheckout } from "@shared/checkout";

type RecoveryFilter = "all" | AbandonedCheckout["recoveryStatus"];
type ActivityFilter = "all" | AbandonedCheckout["activity"];

type Props = {
  items: AbandonedCheckout[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onConverted?: () => void;
};

const recoveryLabels: Record<AbandonedCheckout["recoveryStatus"], string> = { new: "Nouveau", called: "Contacté", ignored: "Ignoré" };
const activityLabels: Record<AbandonedCheckout["activity"], string> = { in_progress: "En cours", abandoned: "Abandonné (>10 min)" };

function display(value: string | number | null | undefined) {
  return value === null || value === undefined || String(value).trim() === "" ? "Non renseigné" : String(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date non renseignée";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function normalizedPhone(value: string) {
  return value.replace(/[\s().-]/g, "");
}

function isFullDzPhone(value: string) {
  const phone = normalizedPhone(value);
  return /^(?:0[567]\d{8}|\+213[567]\d{8})$/.test(phone);
}

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {}
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "true");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

export function AbandonedOrders({ items, isLoading, isError, onRetry, onConverted }: Props) {
  const [query, setQuery] = useState("");
  const [recovery, setRecovery] = useState<RecoveryFilter>("all");
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [selected, setSelected] = useState<AbandonedCheckout | null>(null);
  const [feedback, setFeedback] = useState("");
  const updateStatus = trpc.admin.updateAbandoned.useMutation({
    onSuccess: () => onRetry(),
    onError: error => setFeedback(error.message || "Impossible de mettre à jour ce brouillon."),
  });

  const convert = trpc.admin.convertAbandoned.useMutation({
    onSuccess: result => {
      onRetry();
      onConverted?.();
      setSelected(null);
      notify(`Transférée aux commandes · ${result.orderNumber}`);
    },
    onError: error => notify(error.message || "Transfert impossible."),
  });

  const deleteMutation = trpc.admin.deleteAbandoned.useMutation({
    onSuccess: () => {
      onRetry();
      setSelected(null);
      notify("Brouillon supprimé ✦");
    },
    onError: error => notify(error.message || "Impossible de supprimer ce brouillon."),
  });

  const deleteAllMutation = trpc.admin.deleteAllAbandoned.useMutation({
    onSuccess: () => {
      onRetry();
      notify("Tous les brouillons abandonnés ont été supprimés ✦");
    },
    onError: error => notify(error.message || "Suppression impossible."),
  });

  const transfer = (item: AbandonedCheckout) => {
    if (!window.confirm(`Transférer ce brouillon de ${item.customer || item.phone} vers les commandes réelles ?`)) return;
    convert.mutate({ id: item.id });
  };

  const removeAbandoned = (item: AbandonedCheckout) => {
    if (!window.confirm(`Supprimer définitivement ce brouillon de ${item.customer || item.phone || '#' + item.id} ?`)) return;
    deleteMutation.mutate({ id: item.id });
  };

  const removeAll = () => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer TOUTES les commandes abandonnées ?")) return;
    deleteAllMutation.mutate();
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(item => {
      const matchesQuery = !needle || `${item.id} ${item.phone}`.toLowerCase().includes(needle);
      return matchesQuery && (recovery === "all" || item.recoveryStatus === recovery) && (activity === "all" || item.activity === activity);
    });
  }, [items, query, recovery, activity]);

  const notify = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(current => current === message ? "" : current), 2400);
  };

  const call = async (phone: string) => {
    if (!isFullDzPhone(phone)) {
      notify("Appel indisponible : numéro algérien complet requis.");
      return;
    }
    await copyText(phone);
    window.location.href = `tel:${normalizedPhone(phone)}`;
  };

  const update = (item: AbandonedCheckout, status: AbandonedCheckout["recoveryStatus"]) => {
    setFeedback("");
    updateStatus.mutate({ id: item.id, status });
    setSelected(null);
  };

  return (
    <section className="abandoned-admin-section">
      <div className="abandoned-admin-head">
        <div><span className="eyebrow">Récupération COD</span><h2>Commandes abandonnées <span className="count-bubble">{items.length}</span></h2><p>Les brouillons enregistrés côté serveur apparaissent immédiatement, avec leur activité réelle.</p></div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {items.length > 0 && (
            <button
              type="button"
              className="button button-outline"
              style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#ef4444" }}
              onClick={removeAll}
              disabled={deleteAllMutation.isPending}
              title="Supprimer tous les brouillons d'abandons"
            >
              <Trash2 size={14} /> Supprimer tout
            </button>
          )}
          <button type="button" className="button button-outline" onClick={onRetry}><RefreshCw size={15} /> Actualiser</button>
        </div>
      </div>
      {isError && <div className="admin-data-error" role="alert"><strong>Les abandons n’ont pas pu être chargés.</strong><button type="button" className="button button-light" onClick={onRetry}>Réessayer</button></div>}
      {feedback && <p className="abandoned-feedback" role="status">{feedback}</p>}
      <div className="abandoned-controls">
        <label className="admin-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ID ou numéro de téléphone" /></label>
        <label className="period-select"><Filter size={15} /><select value={recovery} onChange={event => setRecovery(event.target.value as RecoveryFilter)}><option value="all">Tous les suivis</option><option value="new">Nouveaux</option><option value="called">Contactés</option><option value="ignored">Ignorés</option></select></label>
        <label className="period-select"><select value={activity} onChange={event => setActivity(event.target.value as ActivityFilter)}><option value="all">Toute activité</option><option value="in_progress">En cours</option><option value="abandoned">Abandonné (&gt;10 min)</option></select></label>
      </div>
      <div className="abandoned-table" aria-live="polite">
        <div className="abandoned-table-head"><span>Session</span><span>Client</span><span>Article</span><span>Localisation</span><span>Activité</span><span /></div>
        {isLoading && <div className="abandoned-empty"><strong>Chargement des brouillons enregistrés…</strong></div>}
        {!isLoading && !isError && filtered.map(item => <article className="abandoned-row" key={item.id}>
          <div data-label="Session"><strong>#{item.id}</strong><small>{formatDate(item.createdAt)}</small></div>
          <div data-label="Client"><strong>{display(item.customer)}</strong><small>{display(item.phone)}</small></div>
          <div data-label="Article"><strong>{display(item.product)}</strong><small>Qté {item.quantity} · {display(item.color)} · {display(item.size)}</small></div>
          <div data-label="Localisation"><strong>{display(item.wilaya)}</strong><small>{display(item.commune)}</small></div>
          <div data-label="Activité"><span className={`abandoned-activity abandoned-activity-${item.activity}`}>{activityLabels[item.activity]}</span><span className={`abandoned-status abandoned-status-${item.recoveryStatus}`}>{recoveryLabels[item.recoveryStatus]}</span></div>
          <div className="abandoned-row-actions"><button type="button" className="icon-button" title={isFullDzPhone(item.phone) ? "Appeler" : "Numéro incomplet"} aria-label={isFullDzPhone(item.phone) ? `Appeler ${display(item.customer)}` : "Appel indisponible : numéro incomplet"} disabled={!isFullDzPhone(item.phone)} onClick={() => void call(item.phone)}><Phone size={15} /></button><button type="button" className="icon-button abandoned-transfer" title="Transférer aux commandes" aria-label={`Transférer le brouillon ${item.id} aux commandes`} disabled={convert.isPending} onClick={() => transfer(item)}><ArrowRightCircle size={15} /></button><button type="button" className="icon-button" style={{ color: "#ef4444" }} title="Supprimer ce brouillon" aria-label={`Supprimer le brouillon ${item.id}`} disabled={deleteMutation.isPending} onClick={() => removeAbandoned(item)}><Trash2 size={15} /></button><button type="button" className="row-more" aria-label={`Voir le détail du brouillon ${item.id}`} onClick={() => setSelected(item)}><Eye size={15} /></button></div>
        </article>)}
        {!isLoading && !isError && !filtered.length && <div className="abandoned-empty"><strong>{items.length ? "Aucun brouillon pour ces filtres" : "Aucun brouillon enregistré"}</strong><p>{items.length ? "Modifie la recherche ou les filtres de suivi." : "Les informations de formulaire enregistrées avec consentement apparaîtront ici."}</p></div>}
      </div>
      {selected && <AbandonedDetails item={selected} onClose={() => setSelected(null)} onCall={call} onDelete={() => removeAbandoned(selected)} onCopy={async () => { const copied = await copyText(`${selected.id} · ${display(selected.customer)} · ${display(selected.phone)}`); notify(copied ? "Détails copiés" : "Copie indisponible dans ce navigateur."); }} onUpdate={status => update(selected, status)} onTransfer={() => transfer(selected)} pending={updateStatus.isPending || convert.isPending || deleteMutation.isPending} />}
    </section>
  );
}

function AbandonedDetails({ item, onClose, onCall, onDelete, onCopy, onUpdate, onTransfer, pending }: { item: AbandonedCheckout; onTransfer: () => void; onClose: () => void; onCall: (phone: string) => Promise<void>; onDelete: () => void; onCopy: () => Promise<void>; onUpdate: (status: AbandonedCheckout["recoveryStatus"]) => void; pending: boolean }) {
  return <div className="modal-layer"><button className="modal-backdrop" onClick={onClose} aria-label="Fermer le détail" /><div className="order-modal abandoned-modal"><div className="modal-head"><div><span className="eyebrow">Détail brouillon</span><h2>#{item.id}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={19} /></button></div><div className="modal-customer"><div className="admin-avatar">{display(item.customer).slice(0, 2).toUpperCase()}</div><div><strong>{display(item.customer)}</strong><span>{display(item.phone)}</span></div><button type="button" className="button button-outline call-button" onClick={() => void onCall(item.phone)} disabled={!isFullDzPhone(item.phone)}><Phone size={15} /> Appeler</button></div><div className="modal-details"><div><span>Article & variantes</span><strong>{display(item.product)} · Qté {item.quantity}<br />Couleur : {display(item.color)} · Taille : {display(item.size)}</strong></div><div><span>Livraison</span><strong>{display(item.delivery === "home" ? "À domicile" : item.delivery === "office" ? "Bureau" : "")}</strong></div><div><span>Adresse</span><strong>{display(item.address)}, {display(item.commune)}, {display(item.wilaya)}</strong></div><div><span>Note</span><strong>{display(item.note)}</strong></div><div><span>Total indicatif du formulaire</span><strong>{formatDZD(item.total)}</strong></div><div><span>Dates</span><strong>Créé : {formatDate(item.createdAt)}<br />Dernière activité : {formatDate(item.updatedAt)}</strong></div></div><div className="modal-actions"><p>Suivi récupération</p>{(["new", "called", "ignored"] as const).map(status => <button type="button" key={status} disabled={pending} className={`abandoned-action-${status}`} onClick={() => onUpdate(status)}>{status === "new" ? "Nouveau" : status === "called" ? <><Check size={13} /> Contacté</> : "Ignoré"}</button>)}</div><button type="button" className="button button-gradient abandoned-transfer-main" disabled={pending} onClick={onTransfer}><ArrowRightCircle size={16} /> Transférer aux commandes</button><button type="button" className="button button-outline" style={{ width: "100%", marginTop: "8px", borderColor: "rgba(239, 68, 68, 0.4)", color: "#ef4444", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }} onClick={onDelete} disabled={pending}><Trash2 size={15} /> Supprimer ce brouillon</button><button type="button" className="copy-order" onClick={() => void onCopy()}><Clipboard size={15} /> Copier les détails</button></div></div>;
}

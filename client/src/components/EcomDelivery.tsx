import { useMemo, useState } from "react";
import { PackageCheck, Truck, KeyRound, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import type { CheckoutOrder } from "@shared/checkout";
import { wilayaIdFromName, type ShippingRate } from "@shared/shipping";
import { trpc } from "@/lib/trpc";
import { formatDZD } from "@/lib/store-data";

type RowState = { selected: boolean; stopdesk: boolean; commune: string; codeStopdesk: string; refArticle: string };

export function EcomDeliveryPanel({ orders, notify, onShipped }: { orders: CheckoutOrder[]; notify: (message: string) => void; onShipped: () => void }) {
  const utils = trpc.useUtils();
  const statusQuery = trpc.ecom.status.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const ratesQuery = trpc.store.shippingRates.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const saveCredentials = trpc.ecom.saveCredentials.useMutation();
  const clearCredentials = trpc.ecom.clearCredentials.useMutation();
  const ship = trpc.ecom.ship.useMutation();
  const [apiKey, setApiKey] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmee, setConfirmee] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [lastErrors, setLastErrors] = useState<Record<string, string>>({});

  const status = statusQuery.data;
  const shipments = status?.shipments ?? {};
  const connected = Boolean(status?.configured && status.account);
  const stockAccount = Boolean(status?.configured && status.account?.stock);
  const toShip = useMemo(() => orders.filter(o => o.status === "confirmee" && !shipments[o.id]), [orders, shipments]);
  const shipped = useMemo(() => orders.filter(o => shipments[o.id]), [orders, shipments]);
  const rowOf = (order: CheckoutOrder): RowState => rows[order.id] ?? { selected: false, stopdesk: order.delivery === "office", commune: "", codeStopdesk: "", refArticle: "" };
  const patch = (order: CheckoutOrder, next: Partial<RowState>) => setRows(current => ({ ...current, [order.id]: { ...rowOf(order), ...next } }));
  const selectedOrders = toShip.filter(o => rowOf(o).selected);

  const submitCredentials = () => {
    saveCredentials.mutate({ key: apiKey, token: apiToken }, {
      onSuccess: async account => {
        setApiKey(""); setApiToken(""); setEditing(false);
        await utils.ecom.status.invalidate();
        await utils.store.shippingRates.invalidate();
        notify(`Connecté à E-com Delivery · ${account.nom_fournisseur}`);
      },
      onError: error => notify(error.message),
    });
  };

  const shipSelected = () => {
    if (!selectedOrders.length) return;
    ship.mutate({
      confirmee,
      items: selectedOrders.map(order => {
        const row = rowOf(order);
        return { orderId: order.id, stopdesk: row.stopdesk, commune: row.stopdesk ? undefined : row.commune, codeStopdesk: row.stopdesk ? row.codeStopdesk : undefined, refArticle: row.refArticle || undefined };
      }),
    }, {
      onSuccess: async results => {
        const errors: Record<string, string> = {};
        for (const r of results) if (!r.ok) errors[r.orderId] = r.error ?? "Erreur";
        setLastErrors(errors);
        const okCount = results.filter(r => r.ok).length;
        notify(`${okCount} colis créé(s) chez E-com Delivery${results.length - okCount ? ` · ${results.length - okCount} échec(s)` : ""}`);
        await utils.ecom.status.invalidate();
        onShipped();
      },
      onError: error => notify(error.message),
    });
  };

  return (
    <section className="ecom-delivery-panel">
      <div className="ecom-delivery-card">
        <div className="ecom-card-head">
          <KeyRound size={20} className="ecom-head-icon" />
          <h2>Connexion E-com Delivery</h2>
        </div>
        {statusQuery.isLoading ? <p>Vérification de la connexion…</p> : connected && !editing ? (
          <div>
            <p className="ecom-connected-badge">
              <CheckCircle2 size={17} color="#10b981" /> Connecté · <b>{status?.account?.nom_fournisseur}</b> · KEY {status?.keyPreview}
              {stockAccount && <span> · compte avec stock (référence article requise)</span>}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button className="button button-light" onClick={() => setEditing(true)}>Changer les identifiants</button>
              <button className="button button-light" onClick={() => { if (window.confirm("Déconnecter E-com Delivery ?")) clearCredentials.mutate(undefined, { onSuccess: async () => { await utils.ecom.status.invalidate(); await utils.store.shippingRates.invalidate(); notify("E-com Delivery déconnecté"); } }); }}>Déconnecter</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
            {status?.configured && status.error && <p style={{ color: "#dc2626", margin: 0 }}><AlertTriangle size={15} /> {status.error}</p>}
            <label>KEY (X-API-Key)<input className="ecom-delivery-field" value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="off" placeholder="Votre KEY" /></label>
            <label>Token (X-API-Token)<input className="ecom-delivery-field" type="password" value={apiToken} onChange={e => setApiToken(e.target.value)} autoComplete="off" placeholder="Votre Token" /></label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="button button-gradient" disabled={!apiKey.trim() || !apiToken.trim() || saveCredentials.isPending} onClick={submitCredentials}>{saveCredentials.isPending ? "Vérification…" : "Enregistrer et tester"}</button>
              {editing && <button className="button button-light" onClick={() => setEditing(false)}>Annuler</button>}
            </div>
            <small className="ecom-help-text">Les identifiants sont vérifiés auprès d'E-com Delivery puis conservés côté serveur (jamais renvoyés au navigateur).</small>
          </div>
        )}
      </div>

      <div className="ecom-delivery-card">
        <div className="ecom-card-head-between">
          <div className="ecom-card-head">
            <PackageCheck size={20} className="ecom-head-icon" />
            <h2>Commandes confirmées à expédier <span className="count-bubble">{toShip.length}</span></h2>
          </div>
          <div className="ecom-ship-actions">
            <label className="ecom-checkbox-label"><input type="checkbox" checked={confirmee} onChange={e => setConfirmee(e.target.checked)} /> Créer directement « Prêt à expédier »</label>
            <button className="button button-gradient" disabled={!connected || !selectedOrders.length || ship.isPending} onClick={shipSelected}>
              <Truck size={16} /> {ship.isPending ? "Envoi…" : `Expédier la sélection (${selectedOrders.length})`}
            </button>
          </div>
        </div>
        {!connected && <p className="ecom-note">Connectez d'abord vos identifiants E-com Delivery ci-dessus.</p>}
        {connected && !toShip.length && <p className="ecom-note">Aucune commande confirmée en attente. Confirmez des commandes dans « Vue d'ensemble ».</p>}
        <div style={{ display: "grid", gap: 10 }}>
          {connected && toShip.map(order => (
            <ShipRow key={order.id} order={order} row={rowOf(order)} patch={next => patch(order, next)} rates={ratesQuery.data?.rates} stockAccount={stockAccount} error={lastErrors[order.id]} />
          ))}
        </div>
        {connected && toShip.length > 0 && (
          <button className="button button-light" style={{ marginTop: 12 }} onClick={() => setRows(Object.fromEntries(toShip.map(o => [o.id, { ...rowOf(o), selected: !selectedOrders.length }])))}>
            {selectedOrders.length ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        )}
      </div>

      <div className="ecom-delivery-card">
        <div className="ecom-card-head">
          <Truck size={20} className="ecom-head-icon" />
          <h2>Déjà expédiées <span className="count-bubble">{shipped.length}</span></h2>
          <button className="icon-button" aria-label="Actualiser" onClick={() => void utils.ecom.status.invalidate()}><RefreshCw size={15} /></button>
        </div>
        {!shipped.length && <p className="ecom-note">Aucun colis envoyé pour le moment.</p>}
        {shipped.map(order => (
          <div key={order.id} className="ecom-shipped-row">
            <span><b>{order.customer}</b> · {order.phone} · {order.wilaya} / {order.commune}</span>
            <span>Tracking <b dir="ltr" className="ecom-trk-text">{shipments[order.id].tracking}</b> · {formatDZD(order.total)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ShipRow({ order, row, patch, rates, stockAccount, error }: { order: CheckoutOrder; row: RowState; patch: (next: Partial<RowState>) => void; rates?: Record<string, ShippingRate>; stockAccount: boolean; error?: string }) {
  const wilayaId = wilayaIdFromName(order.wilaya);
  const locations = trpc.ecom.locations.useQuery({ wilayaId: wilayaId ?? 1 }, { enabled: Boolean(wilayaId), retry: false, staleTime: 10 * 60 * 1000, refetchOnWindowFocus: false });
  const communes = locations.data?.communes ?? [];
  const stopdesks = locations.data?.stopdesks ?? [];
  const rate = wilayaId ? rates?.[String(wilayaId)] : undefined;
  const fee = rate ? (row.stopdesk ? rate.stopdesk : rate.domicile) : null;
  const normalized = (value: string) => value.trim().toLowerCase();
  const autoCommune = communes.find(c => normalized(c) === normalized(order.commune)) ?? "";
  const communeValue = row.commune || autoCommune;
  return (
    <div className={`ecom-delivery-row ${error ? "has-error" : ""}`}>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
        <input type="checkbox" checked={row.selected} onChange={e => patch({ selected: e.target.checked, commune: communeValue })} style={{ marginTop: 4 }} />
        <span style={{ flex: 1 }}>
          <b className="ecom-row-customer">{order.customer}</b> · <span dir="ltr" className="ecom-row-phone">{order.phone}</span> · <span className="ecom-row-product">{order.product}</span>
          <br /><small className="ecom-row-sub">{order.wilaya} / {order.commune} · {order.color} {order.size} · <b className="ecom-row-total">{formatDZD(order.total)}</b> à encaisser {fee !== null && <>· livraison E-com {formatDZD(fee)}</>}</small>
        </span>
      </label>
      {row.selected && (
        <div className="ecom-row-fields">
          <select className="ecom-delivery-field" value={row.stopdesk ? "stopdesk" : "home"} onChange={e => patch({ stopdesk: e.target.value === "stopdesk" })}>
            <option value="home">Domicile</option>
            <option value="stopdesk">Bureau (stopdesk)</option>
          </select>
          {row.stopdesk ? (
            <select className="ecom-delivery-field" value={row.codeStopdesk} onChange={e => patch({ codeStopdesk: e.target.value })}>
              <option value="">Choisir le bureau…</option>
              {stopdesks.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
            </select>
          ) : (
            <select className="ecom-delivery-field" value={communeValue} onChange={e => patch({ commune: e.target.value })}>
              <option value="">{locations.isLoading ? "Chargement…" : `Commune E-com (client : ${order.commune})`}</option>
              {communes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {stockAccount && <input className="ecom-delivery-field" placeholder="Réf. article (stock)" value={row.refArticle} onChange={e => patch({ refArticle: e.target.value })} />}
        </div>
      )}
      {locations.error && <p style={{ color: "#dc2626", margin: "6px 0 0" }}>{locations.error.message}</p>}
      {error && <p style={{ color: "#dc2626", margin: "6px 0 0" }}>⚠ {error}</p>}
    </div>
  );
}

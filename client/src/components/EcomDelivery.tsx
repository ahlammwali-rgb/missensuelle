import { useMemo, useState } from "react";
import { PackageCheck, Truck, KeyRound, RefreshCw, CheckCircle2, AlertTriangle, Scan } from "lucide-react";
import type { CheckoutOrder } from "@shared/checkout";
import { WILAYA_FRENCH_NAMES, matchEcomCommune, wilayaIdFromName, type ShippingRate } from "@shared/shipping";
import { abayaWilayas } from "@/lib/abaya-communes";
import { trpc } from "@/lib/trpc";
import { adjustProductStock, formatDZD } from "@/lib/store-data";
import { ParcelScannerModal } from "./ParcelScannerModal";

type RowState = {
  selected: boolean;
  wilayaId?: number;
  stopdesk: boolean;
  commune: string;
  codeStopdesk: string;
  refArticle: string;
};

export function EcomDeliveryPanel({
  orders,
  notify,
  onShipped,
}: {
  orders: CheckoutOrder[];
  notify: (message: string) => void;
  onShipped: () => void;
}) {
  const utils = trpc.useUtils();
  const statusQuery = trpc.ecom.status.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const ratesQuery = trpc.store.shippingRates.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const saveCredentials = trpc.ecom.saveCredentials.useMutation();
  const clearCredentials = trpc.ecom.clearCredentials.useMutation();
  const ship = trpc.ecom.ship.useMutation();
  const [apiKey, setApiKey] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [editing, setEditing] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [lastErrors, setLastErrors] = useState<Record<string, string>>({});

  const status = statusQuery.data;
  const shipments = status?.shipments ?? {};
  const connected = Boolean(status?.configured && status.account);
  const stockAccount = Boolean(status?.configured && status.account?.stock);
  const toShip = useMemo(
    () => orders.filter(o => o.status === "confirmee" && !shipments[o.id]),
    [orders, shipments]
  );
  const inPreparation = useMemo(
    () => orders.filter(o => shipments[o.id] && !shipments[o.id].readyToShip),
    [orders, shipments]
  );
  const shipped = useMemo(
    () => orders.filter(o => shipments[o.id]),
    [orders, shipments]
  );

  const rowOf = (order: CheckoutOrder): RowState =>
    rows[order.id] ?? {
      selected: false,
      wilayaId: wilayaIdFromName(order.wilaya, order.commune) ?? undefined,
      stopdesk: order.delivery === "office",
      commune: "",
      codeStopdesk: "",
      refArticle: "",
    };

  const patch = (order: CheckoutOrder, next: Partial<RowState>) =>
    setRows(current => ({ ...current, [order.id]: { ...rowOf(order), ...next } }));

  const selectedOrders = toShip.filter(o => rowOf(o).selected);

  const submitCredentials = () => {
    saveCredentials.mutate(
      { key: apiKey, token: apiToken },
      {
        onSuccess: async account => {
          setApiKey("");
          setApiToken("");
          setEditing(false);
          await utils.ecom.status.invalidate();
          await utils.store.shippingRates.invalidate();
          notify(`Connecté à E-com Delivery · ${account.nom_fournisseur}`);
        },
        onError: error => notify(error.message),
      }
    );
  };

  // Étape 1 : Envoi en mode « En préparation » (confirmee: false)
  const shipSelectedInPreparation = () => {
    if (!selectedOrders.length) return;
    ship.mutate(
      {
        confirmee: false,
        items: selectedOrders.map(order => {
          const row = rowOf(order);
          const wid = row.wilayaId ?? wilayaIdFromName(order.wilaya, order.commune) ?? undefined;
          return {
            orderId: order.id,
            wilayaId: wid,
            stopdesk: row.stopdesk,
            commune: row.stopdesk ? undefined : row.commune || order.commune,
            codeStopdesk: row.stopdesk ? row.codeStopdesk : undefined,
            refArticle: row.refArticle || undefined,
          };
        }),
      },
      {
        onSuccess: async results => {
          const errors: Record<string, string> = {};
          for (const r of results) {
            if (!r.ok) {
              errors[r.orderId] = r.error ?? "Erreur";
            }
          }
          setLastErrors(errors);
          const okCount = results.filter(r => r.ok).length;
          notify(
            `📦 ${okCount} colis envoyé(s) « En préparation » chez E-com Delivery (Scannez-les pour les passer en « Prêt à expédier »)${
              results.length - okCount ? ` · ${results.length - okCount} échec(s)` : ""
            }`
          );
          await utils.ecom.status.invalidate();
          onShipped();
        },
        onError: error => notify(error.message),
      }
    );
  };

  // Étape 2 : Passage d'un colis « En préparation » vers « Prêt à expédier » (confirmee: true)
  const markReadyToShip = (order: CheckoutOrder) => {
    ship.mutate(
      {
        confirmee: true,
        items: [
          {
            orderId: order.id,
            wilayaId: wilayaIdFromName(order.wilaya, order.commune) ?? undefined,
            stopdesk: order.delivery === "office",
            commune: order.commune,
          },
        ],
      },
      {
        onSuccess: async results => {
          const res = results[0];
          if (res?.ok) {
            const qty = order.quantity || 1;
            adjustProductStock(order.productId || order.product, -qty);
            notify(`🚀 Colis ${order.customer} (${res.tracking}) validé en « Prêt à expédier » · Stock décompté`);
            await utils.ecom.status.invalidate();
            onShipped();
          } else {
            notify(res?.error || "Impossible de passer en Prêt à expédier");
          }
        },
        onError: error => notify(error.message),
      }
    );
  };

  return (
    <section className="ecom-delivery-panel">
      <div className="ecom-delivery-card">
        <div className="ecom-card-head">
          <KeyRound size={20} className="ecom-head-icon" />
          <h2>Connexion E-com Delivery</h2>
        </div>
        {statusQuery.isLoading ? (
          <p>Vérification de la connexion…</p>
        ) : connected && !editing ? (
          <div>
            <p className="ecom-connected-badge">
              <CheckCircle2 size={17} color="#10b981" /> Connecté · <b>{status?.account?.nom_fournisseur}</b> · KEY{" "}
              {status?.keyPreview}
              {stockAccount && <span> · compte avec stock (référence article requise)</span>}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button className="button button-light" onClick={() => setEditing(true)}>
                Changer les identifiants
              </button>
              <button
                className="button button-light"
                onClick={() => {
                  if (window.confirm("Déconnecter E-com Delivery ?"))
                    clearCredentials.mutate(undefined, {
                      onSuccess: async () => {
                        await utils.ecom.status.invalidate();
                        await utils.store.shippingRates.invalidate();
                        notify("E-com Delivery déconnecté");
                      },
                    });
                }}
              >
                Déconnecter
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
            {status?.configured && status.error && (
              <p style={{ color: "#dc2626", margin: 0 }}>
                <AlertTriangle size={15} /> {status.error}
              </p>
            )}
            <label>
              KEY (X-API-Key)
              <input
                className="ecom-delivery-field"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                autoComplete="off"
                placeholder="Votre KEY"
              />
            </label>
            <label>
              Token (X-API-Token)
              <input
                className="ecom-delivery-field"
                type="password"
                value={apiToken}
                onChange={e => setApiToken(e.target.value)}
                autoComplete="off"
                placeholder="Votre Token"
              />
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="button button-gradient"
                disabled={!apiKey.trim() || !apiToken.trim() || saveCredentials.isPending}
                onClick={submitCredentials}
              >
                {saveCredentials.isPending ? "Vérification…" : "Enregistrer et tester"}
              </button>
              {editing && (
                <button className="button button-light" onClick={() => setEditing(false)}>
                  Annuler
                </button>
              )}
            </div>
            <small className="ecom-help-text">
              Les identifiants sont vérifiés auprès d'E-com Delivery puis conservés côté serveur (jamais renvoyés au
              navigateur).
            </small>
          </div>
        )}
      </div>

      <div className="ecom-delivery-card">
        <div className="ecom-card-head-between">
          <div className="ecom-card-head">
            <PackageCheck size={20} className="ecom-head-icon" />
            <h2>
              Commandes confirmées à envoyer « En préparation »{" "}
              <span className="count-bubble">{toShip.length}</span>
            </h2>
          </div>
          <div className="ecom-ship-actions">
            <button
              type="button"
              className="button button-scanner-action"
              onClick={() => setIsScannerOpen(true)}
              title="Scanner un colis pour le passer en Prêt à expédier"
            >
              <Scan size={16} /> Scanner (« Prêt à expédier »)
            </button>
            <button
              className="button button-gradient"
              disabled={!connected || !selectedOrders.length || ship.isPending}
              onClick={shipSelectedInPreparation}
            >
              <Truck size={16} />{" "}
              {ship.isPending
                ? "Envoi…"
                : `Envoyer en préparation (${selectedOrders.length})`}
            </button>
          </div>
        </div>
        {!connected && <p className="ecom-note">Connectez d'abord vos identifiants E-com Delivery ci-dessus.</p>}
        {connected && !toShip.length && (
          <p className="ecom-note">
            Aucune commande confirmée en attente. Confirmez des commandes dans « Vue d'ensemble ».
          </p>
        )}
        <div style={{ display: "grid", gap: 10 }}>
          {connected &&
            toShip.map(order => (
              <ShipRow
                key={order.id}
                order={order}
                row={rowOf(order)}
                patch={next => patch(order, next)}
                rates={ratesQuery.data?.rates}
                stockAccount={stockAccount}
                error={lastErrors[order.id]}
              />
            ))}
        </div>
        {connected && toShip.length > 0 && (
          <button
            className="button button-light"
            style={{ marginTop: 12 }}
            onClick={() =>
              setRows(
                Object.fromEntries(
                  toShip.map(o => [o.id, { ...rowOf(o), selected: !selectedOrders.length }])
                )
              )
            }
          >
            {selectedOrders.length ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        )}
      </div>

      {inPreparation.length > 0 && (
        <div className="ecom-delivery-card">
          <div className="ecom-card-head-between">
            <div className="ecom-card-head">
              <Scan size={20} className="ecom-head-icon" />
              <h2>
                Colis « En préparation » — En attente de scan{" "}
                <span className="count-bubble">{inPreparation.length}</span>
              </h2>
            </div>
            <button
              type="button"
              className="button button-scanner-action"
              onClick={() => setIsScannerOpen(true)}
            >
              <Scan size={16} /> Scanner les colis préparés
            </button>
          </div>
          <p className="ecom-note" style={{ marginBottom: 10 }}>
            Ces colis sont créés en mode « En préparation » sur E-com Delivery. Scannez-les avec le bouton Scanner (ou cliquez sur « Prêt à expédier ») une fois emballés.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {inPreparation.map(order => (
              <div
                key={order.id}
                className="ecom-shipped-row"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}
              >
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "#b45309",
                      fontSize: "11px",
                      fontWeight: 800,
                      marginRight: 8,
                    }}
                  >
                    📦 En préparation
                  </span>
                  <b>{order.customer}</b> · {order.phone} · {order.wilaya} / {order.commune}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span>
                    Tracking <b dir="ltr" className="ecom-trk-text">{shipments[order.id]?.tracking}</b> ·{" "}
                    {formatDZD(order.total)}
                  </span>
                  <button
                    type="button"
                    className="button button-light"
                    style={{ padding: "5px 10px", fontSize: "12px" }}
                    disabled={ship.isPending}
                    onClick={() => markReadyToShip(order)}
                  >
                    🚀 Prêt à expédier
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ecom-delivery-card">
        <div className="ecom-card-head">
          <Truck size={20} className="ecom-head-icon" />
          <h2>
            Historique des colis E-com Delivery <span className="count-bubble">{shipped.length}</span>
          </h2>
          <button
            className="icon-button"
            aria-label="Actualiser"
            onClick={() => void utils.ecom.status.invalidate()}
          >
            <RefreshCw size={15} />
          </button>
        </div>
        {!shipped.length && <p className="ecom-note">Aucun colis envoyé pour le moment.</p>}
        {shipped.map(order => {
          const isReady = Boolean(shipments[order.id]?.readyToShip);
          return (
            <div key={order.id} className="ecom-shipped-row">
              <span>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: isReady ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                    color: isReady ? "#047857" : "#b45309",
                    fontSize: "11px",
                    fontWeight: 800,
                    marginRight: 8,
                  }}
                >
                  {isReady ? "✅ Prêt à expédier" : "📦 En préparation"}
                </span>
                <b>{order.customer}</b> · {order.phone} · {order.wilaya} / {order.commune}
              </span>
              <span>
                Tracking <b dir="ltr" className="ecom-trk-text">{shipments[order.id].tracking}</b> ·{" "}
                {formatDZD(order.total)}
              </span>
            </div>
          );
        })}
      </div>

      <ParcelScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        mode="ship"
        orders={orders}
        notify={notify}
        onRefreshOrders={onShipped}
      />
    </section>
  );
}

function ShipRow({
  order,
  row,
  patch,
  rates,
  stockAccount,
  error,
}: {
  order: CheckoutOrder;
  row: RowState;
  patch: (next: Partial<RowState>) => void;
  rates?: Record<string, ShippingRate>;
  stockAccount: boolean;
  error?: string;
}) {
  const autoWilayaId = wilayaIdFromName(order.wilaya, order.commune);
  const effectiveWilayaId = row.wilayaId ?? autoWilayaId ?? 16;

  const locations = trpc.ecom.locations.useQuery(
    { wilayaId: effectiveWilayaId },
    {
      enabled: Boolean(effectiveWilayaId),
      retry: false,
      staleTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    }
  );
  const communes = locations.data?.communes ?? [];
  const stopdesks = locations.data?.stopdesks ?? [];
  const rate = effectiveWilayaId ? rates?.[String(effectiveWilayaId)] : undefined;
  const fee = rate ? (row.stopdesk ? rate.stopdesk : rate.domicile) : null;

  const autoCommune = useMemo(
    () => matchEcomCommune(effectiveWilayaId, order.commune, communes),
    [effectiveWilayaId, order.commune, communes]
  );
  const communeValue = row.commune || autoCommune;
  const canonicalWilayaAr = abayaWilayas[effectiveWilayaId - 1] || order.wilaya;
  const canonicalWilayaFr = WILAYA_FRENCH_NAMES[effectiveWilayaId] || "";

  return (
    <div className={`ecom-delivery-row ${error ? "has-error" : ""}`}>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={row.selected}
          onChange={e =>
            patch({
              selected: e.target.checked,
              wilayaId: effectiveWilayaId,
              commune: communeValue,
            })
          }
          style={{ marginTop: 4 }}
        />
        <span style={{ flex: 1 }}>
          <b className="ecom-row-customer">{order.customer}</b> ·{" "}
          <span dir="ltr" className="ecom-row-phone">{order.phone}</span> ·{" "}
          <span className="ecom-row-product">{order.product}</span>
          <br />
          <small className="ecom-row-sub">
            <b>
              {String(effectiveWilayaId).padStart(2, "0")} - {canonicalWilayaAr} ({canonicalWilayaFr})
            </b>{" "}
            / {communeValue || order.commune} · {order.color} {order.size} ·{" "}
            <b className="ecom-row-total">{formatDZD(order.total)}</b> à encaisser{" "}
            {fee !== null && <>· livraison E-com {formatDZD(fee)}</>}
          </small>
        </span>
      </label>
      {row.selected && (
        <div className="ecom-row-fields">
          <select
            className="ecom-delivery-field"
            value={row.stopdesk ? "stopdesk" : "home"}
            onChange={e => patch({ stopdesk: e.target.value === "stopdesk" })}
          >
            <option value="home">Domicile</option>
            <option value="stopdesk">Bureau (stopdesk)</option>
          </select>

          <select
            className="ecom-delivery-field"
            value={effectiveWilayaId}
            onChange={e =>
              patch({
                wilayaId: Number(e.target.value),
                commune: "",
                codeStopdesk: "",
              })
            }
            title="Wilaya E-com Delivery"
          >
            {abayaWilayas.map((wAr, idx) => {
              const wid = idx + 1;
              return (
                <option key={wid} value={wid}>
                  {String(wid).padStart(2, "0")} - {wAr} ({WILAYA_FRENCH_NAMES[wid]})
                </option>
              );
            })}
          </select>

          {row.stopdesk ? (
            <select
              className="ecom-delivery-field"
              value={row.codeStopdesk}
              onChange={e => patch({ codeStopdesk: e.target.value })}
            >
              <option value="">Choisir le bureau…</option>
              {stopdesks.map(s => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <select
              className="ecom-delivery-field"
              value={communeValue}
              onChange={e => patch({ commune: e.target.value })}
            >
              {communes.length === 0 && (
                <option value={order.commune}>
                  {locations.isLoading ? "Chargement…" : order.commune || "Commune"}
                </option>
              )}
              {communes.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {stockAccount && (
            <input
              className="ecom-delivery-field"
              placeholder="Réf. article (stock)"
              value={row.refArticle}
              onChange={e => patch({ refArticle: e.target.value })}
            />
          )}
        </div>
      )}
      {locations.error && <p style={{ color: "#dc2626", margin: "6px 0 0" }}>{locations.error.message}</p>}
      {error && <p style={{ color: "#dc2626", margin: "6px 0 0" }}>⚠ {error}</p>}
    </div>
  );
}

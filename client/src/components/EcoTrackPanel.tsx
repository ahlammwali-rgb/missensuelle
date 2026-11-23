import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, PackageCheck, RefreshCw, Truck } from "lucide-react";
import type { CheckoutOrder } from "@shared/checkout";
import { WILAYA_FRENCH_NAMES, matchEcomCommune, wilayaIdFromName, type ShippingRate } from "@shared/shipping";
import { abayaWilayas } from "@/lib/abaya-communes";
import { trpc } from "@/lib/trpc";
import { adjustProductStock, formatDZD } from "@/lib/store-data";

type EcoRowState = {
  selected: boolean;
  wilayaId?: number;
  stopdesk: boolean;
  commune: string;
  deskCommune: string;
  refArticle: string;
};

const QUICK_PLATFORMS = [
  { label: "DHD Livraison", url: "https://platform.dhd-dz.com" },
  { label: "EcoTrack App", url: "https://app.ecotrack.dz" },
  { label: "Anderson", url: "https://anderson.ecotrack.dz" },
  { label: "Yalitec", url: "https://yalitec.ecotrack.dz" },
];

export function EcoTrackPanel({
  orders,
  notify,
  onShipped,
}: {
  orders: CheckoutOrder[];
  notify: (message: string) => void;
  onShipped: () => void;
}) {
  const utils = trpc.useUtils();
  const statusQuery = trpc.ecotrack.status.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const feesQuery = trpc.ecotrack.fees.useQuery(undefined, {
    enabled: Boolean(statusQuery.data?.configured && statusQuery.data?.connected),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const productsQuery = trpc.ecotrack.products.useQuery(undefined, {
    enabled: Boolean(statusQuery.data?.configured && statusQuery.data?.connected),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const saveCredentials = trpc.ecotrack.saveCredentials.useMutation();
  const clearCredentials = trpc.ecotrack.clearCredentials.useMutation();
  const ship = trpc.ecotrack.ship.useMutation();
  const validateOrder = trpc.ecotrack.validateOrder.useMutation();

  const [baseUrl, setBaseUrl] = useState("https://platform.dhd-dz.com");
  const [token, setToken] = useState("");
  const [label, setLabel] = useState("DHD Livraison");
  const [editing, setEditing] = useState(false);
  const [showAllConfirmed, setShowAllConfirmed] = useState(false);
  const [rows, setRows] = useState<Record<string, EcoRowState>>({});
  const [lastErrors, setLastErrors] = useState<Record<string, string>>({});

  const status = statusQuery.data;
  const shipments = status?.shipments ?? {};
  const connected = Boolean(status?.configured && status.connected);
  const rates = feesQuery.data?.rates;
  const ecoProducts = productsQuery.data ?? [];

  const linkedConfirmed = useMemo(
    () => orders.filter(o => o.status === "confirmee" && !shipments[o.id] && o.carrier === "ecotrack"),
    [orders, shipments]
  );

  const otherConfirmed = useMemo(
    () => orders.filter(o => o.status === "confirmee" && !shipments[o.id] && o.carrier !== "ecotrack"),
    [orders, shipments]
  );

  const toShip = useMemo(
    () => (showAllConfirmed ? [...linkedConfirmed, ...otherConfirmed] : linkedConfirmed.length > 0 ? linkedConfirmed : otherConfirmed),
    [showAllConfirmed, linkedConfirmed, otherConfirmed]
  );

  const inPreparation = useMemo(
    () => orders.filter(o => shipments[o.id] && !shipments[o.id].readyToShip),
    [orders, shipments]
  );

  const shipped = useMemo(
    () => orders.filter(o => Boolean(shipments[o.id])),
    [orders, shipments]
  );

  const rowOf = (order: CheckoutOrder): EcoRowState =>
    rows[order.id] ?? {
      selected: false,
      wilayaId: wilayaIdFromName(order.wilaya, order.commune) ?? undefined,
      stopdesk: order.delivery === "office",
      commune: "",
      deskCommune: "",
      refArticle: "",
    };

  const patch = (order: CheckoutOrder, next: Partial<EcoRowState>) =>
    setRows(current => ({ ...current, [order.id]: { ...rowOf(order), ...next } }));

  const selectedOrders = toShip.filter(o => rowOf(o).selected);

  const submitCredentials = () => {
    saveCredentials.mutate(
      { baseUrl, token, label },
      {
        onSuccess: async res => {
          setToken("");
          setEditing(false);
          await utils.ecotrack.status.invalidate();
          await utils.ecotrack.fees.invalidate();
          notify(`Connecté à EcoTrack · ${res.label}`);
        },
        onError: err => notify(err.message),
      }
    );
  };

  const sendOrders = (validateImmediately: boolean) => {
    if (!selectedOrders.length) return;
    ship.mutate(
      {
        confirmee: validateImmediately,
        items: selectedOrders.map(order => {
          const r = rowOf(order);
          const wid = r.wilayaId ?? wilayaIdFromName(order.wilaya, order.commune) ?? undefined;
          return {
            orderId: order.id,
            wilayaId: wid,
            stopdesk: r.stopdesk,
            commune: r.stopdesk ? undefined : r.commune || order.commune,
            deskCommune: r.stopdesk ? r.deskCommune || undefined : undefined,
            refArticle: r.refArticle || undefined,
          };
        }),
      },
      {
        onSuccess: async results => {
          const errors: Record<string, string> = {};
          for (const res of results) {
            if (!res.ok) errors[res.orderId] = res.error ?? "Erreur";
          }
          setLastErrors(errors);
          const okCount = results.filter(r => r.ok).length;
          if (validateImmediately && okCount > 0) {
            results.filter(r => r.ok).forEach(r => {
              const ord = selectedOrders.find(o => o.id === r.orderId);
              if (ord) adjustProductStock(ord.productId || ord.product, -Math.max(1, ord.quantity || 1));
            });
          }
          notify(
            validateImmediately
              ? `🚀 ${okCount} colis envoyé(s) et validé(s) sur EcoTrack${results.length - okCount ? `, ${results.length - okCount} erreur(s)` : ""}`
              : `📦 ${okCount} colis envoyé(s) En préparation sur EcoTrack${results.length - okCount ? `, ${results.length - okCount} erreur(s)` : ""}`
          );
          await utils.ecotrack.status.invalidate();
          await utils.admin.orders.invalidate();
          onShipped();
        },
        onError: err => notify(err.message),
      }
    );
  };

  const handleValidateReady = (order: CheckoutOrder) => {
    const sh = shipments[order.id];
    if (!sh?.tracking) return;
    validateOrder.mutate(
      { tracking: sh.tracking },
      {
        onSuccess: async () => {
          adjustProductStock(order.productId || order.product, -Math.max(1, order.quantity || 1));
          await utils.ecotrack.status.invalidate();
          onShipped();
          notify(`✅ Colis ${sh.tracking} validé « Prêt à expédier » sur EcoTrack`);
        },
        onError: err => notify(err.message),
      }
    );
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Connexion EcoTrack */}
      <div className="ecom-delivery-card">
        <div className="ecom-card-head">
          <KeyRound size={20} className="ecom-head-icon" />
          <h2>Connexion EcoTrack API</h2>
          {connected && (
            <span className="ecom-status-pill ok">
              <CheckCircle2 size={14} /> Connecté ({status?.label})
            </span>
          )}
          {status?.configured && !status.connected && (
            <span className="ecom-status-pill warn">
              <AlertTriangle size={14} /> {status.error}
            </span>
          )}
        </div>

        {!status?.configured || editing ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.75 }}>Plateformes fréquentes :</span>
              {QUICK_PLATFORMS.map(p => (
                <button
                  key={p.url}
                  type="button"
                  className={baseUrl.replace(/\/+$/, "") === p.url ? "button button-gradient" : "button button-outline"}
                  style={{ padding: "4px 10px", fontSize: 11.5 }}
                  onClick={() => {
                    setBaseUrl(p.url);
                    setLabel(p.label);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="ecom-credentials-grid">
              <input
                className="ecom-delivery-field"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="URL DHD / EcoTrack (ex: https://platform.dhd-dz.com)"
                dir="ltr"
              />
              <input
                className="ecom-delivery-field"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Token API Bearer DHD"
                dir="ltr"
              />
              <input
                className="ecom-delivery-field"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Nom du transporteur (ex: DHD Livraison)"
              />
              <button
                className="button button-gradient"
                disabled={saveCredentials.isPending}
                onClick={submitCredentials}
              >
                {saveCredentials.isPending ? "Vérification…" : "Enregistrer & Tester EcoTrack"}
              </button>
              {editing && (
                <button className="button button-outline" onClick={() => setEditing(false)}>
                  Annuler
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="ecom-connected-bar">
            <div className="ecom-connected-bar-top">
              <span className="ecom-connected-meta">
                Plateforme : <b dir="ltr">{status.baseUrl}</b> · Token : <b dir="ltr">{status.tokenPreview}</b>
              </span>
              <div className="ecom-connected-actions">
                <button
                  className="button button-outline"
                  onClick={() => {
                    setBaseUrl(status.baseUrl);
                    setLabel(status.label || "");
                    setEditing(true);
                  }}
                >
                  Modifier
                </button>
                <button
                  className="button button-light"
                  onClick={() =>
                    clearCredentials.mutate(undefined, {
                      onSuccess: () => {
                        void utils.ecotrack.status.invalidate();
                        notify("EcoTrack déconnecté");
                      },
                    })
                  }
                >
                  Déconnecter
                </button>
              </div>
            </div>
            <div className="ecom-webhook-box">
              <span style={{ minWidth: 0, flex: "1 1 220px" }}>
                🔄 <strong>Sync auto DHD active (toutes les 5 min)</strong> · URL Webhook temps réel :{" "}
                <code dir="ltr">{`${window.location.origin}/api/ecotrack/webhook`}</code>
              </span>
              <button
                type="button"
                className="button button-light"
                style={{ padding: "4px 10px", fontSize: 11.5 }}
                onClick={() => {
                  const url = `${window.location.origin}/api/ecotrack/webhook`;
                  void navigator.clipboard?.writeText(url);
                  notify("URL Webhook DHD copiée ✦");
                }}
              >
                Copier URL Webhook
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Commandes Confirmées à expédier vers EcoTrack */}
      <div className="ecom-delivery-card">
        <div className="ecom-card-head">
          <PackageCheck size={20} className="ecom-head-icon" />
          <h2>
            Commandes EcoTrack à expédier <span className="count-bubble">{toShip.length}</span>
          </h2>
          {otherConfirmed.length > 0 && linkedConfirmed.length > 0 && (
            <button
              type="button"
              className="button button-outline"
              style={{ fontSize: 12, padding: "6px 10px" }}
              onClick={() => setShowAllConfirmed(v => !v)}
            >
              {showAllConfirmed ? "Voir seulement liées EcoTrack" : `Voir toutes (${otherConfirmed.length} autres)`}
            </button>
          )}
          <div className="ecom-card-head-actions">
            <button
              className="button button-outline"
              disabled={!connected || !selectedOrders.length || ship.isPending}
              onClick={() => sendOrders(false)}
            >
              {ship.isPending ? "Envoi…" : `📦 Envoyer En préparation (${selectedOrders.length})`}
            </button>
            <button
              className="button button-gradient"
              disabled={!connected || !selectedOrders.length || ship.isPending}
              onClick={() => sendOrders(true)}
            >
              {ship.isPending ? "Envoi…" : `🚀 Expédier & Valider (${selectedOrders.length})`}
            </button>
          </div>
        </div>

        {!connected && <p className="ecom-note">Connectez EcoTrack ci-dessus pour charger les wilayas, communes, bureaux et envoyer des colis.</p>}
        {!toShip.length && <p className="ecom-note">Aucune commande confirmée liée à EcoTrack pour le moment.</p>}

        {toShip.map(order => (
          <EcoTrackShipRow
            key={order.id}
            order={order}
            row={rowOf(order)}
            patch={next => patch(order, next)}
            rates={rates}
            ecoProducts={ecoProducts}
            error={lastErrors[order.id]}
          />
        ))}
      </div>

      {/* Colis en préparation (non encore validés via /valid/order) */}
      {inPreparation.length > 0 && (
        <div className="ecom-delivery-card" style={{ borderColor: "rgba(245, 158, 11, 0.4)" }}>
          <div className="ecom-card-head">
            <PackageCheck size={20} style={{ color: "#f59e0b" }} />
            <h2>
              Colis EcoTrack « En préparation » <span className="count-bubble">{inPreparation.length}</span>
            </h2>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {inPreparation.map(order => {
              const sh = shipments[order.id];
              return (
                <div key={order.id} className="ecom-shipped-row">
                  <span>
                    <b>{order.customer}</b> · {order.phone} · {order.wilaya} / {order.commune}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span>
                      Tracking <b dir="ltr">{sh.tracking}</b> · {formatDZD(order.total)}
                    </span>
                    <button
                      type="button"
                      className="button button-gradient"
                      style={{ padding: "5px 12px", fontSize: 12 }}
                      disabled={validateOrder.isPending}
                      onClick={() => handleValidateReady(order)}
                    >
                      🚀 Valider l'expédition
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Historique des colis EcoTrack */}
      <div className="ecom-delivery-card">
        <div className="ecom-card-head">
          <Truck size={20} className="ecom-head-icon" />
          <h2>
            Historique des colis EcoTrack <span className="count-bubble">{shipped.length}</span>
          </h2>
          <button
            className="icon-button"
            aria-label="Actualiser"
            onClick={() => void utils.ecotrack.status.invalidate()}
          >
            <RefreshCw size={15} />
          </button>
        </div>
        {!shipped.length && <p className="ecom-note">Aucun colis EcoTrack envoyé pour le moment.</p>}
        {shipped.map(order => {
          const sh = shipments[order.id];
          const labelUrl = status?.configured
            ? `${status.baseUrl}/api/v1/get/order/label?tracking=${encodeURIComponent(sh.tracking)}`
            : null;
          return (
            <div key={order.id} className="ecom-shipped-row">
              <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                <span className={sh.readyToShip ? "ecom-ready-badge" : "ecom-prep-badge"}>
                  {sh.readyToShip ? "✅ Expédiée" : "📦 En préparation"}
                </span>
                <b>{order.customer}</b> · {order.phone} · {order.wilaya} / {order.commune}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>
                  Tracking <b dir="ltr">{sh.tracking}</b> · {formatDZD(order.total)}
                </span>
                {labelUrl && (
                  <a
                    href={labelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-outline"
                    style={{ padding: "4px 10px", fontSize: 11.5 }}
                  >
                    🏷️ Étiquette
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EcoTrackShipRow({
  order,
  row,
  patch,
  rates,
  ecoProducts,
  error,
}: {
  order: CheckoutOrder;
  row: EcoRowState;
  patch: (next: Partial<EcoRowState>) => void;
  rates?: Record<string, ShippingRate>;
  ecoProducts: Array<{ reference?: string; title?: string; stock_disponible?: number }>;
  error?: string;
}) {
  const autoWilayaId = wilayaIdFromName(order.wilaya, order.commune);
  const effectiveWilayaId = row.wilayaId ?? autoWilayaId ?? 16;

  const locations = trpc.ecotrack.locations.useQuery(
    { wilayaId: effectiveWilayaId },
    {
      enabled: Boolean(effectiveWilayaId),
      retry: false,
      staleTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    }
  );

  const communes = locations.data?.communes ?? [];
  const desks = locations.data?.desks ?? [];
  const activeWilaya = locations.data?.activeWilaya ?? true;
  const rate = rates?.[String(effectiveWilayaId)];
  const stopDeskUnavailable = Boolean(row.stopdesk && rate && rate.stopdesk === 0 && desks.length === 0);

  const autoCommune = useMemo(
    () => matchEcomCommune(effectiveWilayaId, order.commune, communes),
    [effectiveWilayaId, order.commune, communes]
  );

  const autoDeskCommune = useMemo(() => {
    if (!desks.length) return autoCommune;
    const match = matchEcomCommune(
      effectiveWilayaId,
      order.commune,
      desks.map(d => d.commune)
    );
    return match || desks[0].commune;
  }, [desks, effectiveWilayaId, order.commune, autoCommune]);

  const communeValue = row.commune || autoCommune;
  const deskValue = row.deskCommune || autoDeskCommune;
  const canonicalWilayaAr = abayaWilayas[effectiveWilayaId - 1] || order.wilaya;
  const canonicalWilayaFr = WILAYA_FRENCH_NAMES[effectiveWilayaId] || "";

  const effectiveFee = rate ? (row.stopdesk ? rate.stopdesk : rate.domicile) : null;

  return (
    <div className={`ecom-delivery-row ${error || !activeWilaya || stopDeskUnavailable ? "has-error" : ""}`}>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={row.selected}
          onChange={e =>
            patch({
              selected: e.target.checked,
              wilayaId: effectiveWilayaId,
              commune: communeValue,
              deskCommune: deskValue,
            })
          }
          style={{ marginTop: 4 }}
        />
        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
          <b className="ecom-row-customer">{order.customer}</b> ·{" "}
          <span dir="ltr" className="ecom-row-phone">{order.phone}</span> ·{" "}
          <span className="ecom-row-product">{order.product}</span>
          {order.carrier === "ecotrack" && (
            <span className="ecom-linked-pill">
              📦 Liée à EcoTrack
            </span>
          )}
          <br />
          <small className="ecom-row-sub">
            <b>
              {String(effectiveWilayaId).padStart(2, "0")} - {canonicalWilayaAr} ({canonicalWilayaFr})
            </b>{" "}
            / {(row.stopdesk ? deskValue : communeValue) || order.commune} · {order.color} {order.size} ·{" "}
            <b className="ecom-row-total">{formatDZD(order.total)}</b> à encaisser
            {effectiveFee !== null && (
              <> · livraison EcoTrack {effectiveFee === 0 && row.stopdesk ? "Indisponible (0 DA)" : formatDZD(effectiveFee)}</>
            )}
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
            <option value="home">🏠 À domicile</option>
            <option value="stopdesk">🏢 Stop Desk (Bureau)</option>
          </select>

          <select
            className="ecom-delivery-field"
            value={effectiveWilayaId}
            onChange={e =>
              patch({
                wilayaId: Number(e.target.value),
                commune: "",
                deskCommune: "",
              })
            }
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
              value={deskValue}
              onChange={e => patch({ deskCommune: e.target.value })}
            >
              {desks.length === 0 && (
                <option value={deskValue || canonicalWilayaFr}>
                  {locations.isLoading ? "Chargement bureaux…" : deskValue || `${canonicalWilayaFr} (Stop Desk)`}
                </option>
              )}
              {desks.map(d => (
                <option key={d.commune} value={d.commune}>
                  {d.label}
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
                  {locations.isLoading ? "Chargement communes…" : order.commune || "Commune"}
                </option>
              )}
              {communes.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {ecoProducts.length > 0 && (
            <select
              className="ecom-delivery-field"
              value={row.refArticle}
              onChange={e => patch({ refArticle: e.target.value })}
            >
              <option value="">Produit libre (sans stock)</option>
              {ecoProducts.map(p => (
                <option key={p.reference} value={p.reference}>
                  {p.title || p.reference} ({p.stock_disponible ?? 0} en stock)
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {!activeWilaya && (
        <p style={{ color: "#d97706", margin: "6px 0 0", fontSize: 12, fontWeight: 700 }}>
          ⚠ Wilaya non active sur votre compte EcoTrack.
        </p>
      )}
      {stopDeskUnavailable && (
        <p style={{ color: "#d97706", margin: "6px 0 0", fontSize: 12, fontWeight: 700 }}>
          ⚠ Pas de bureau Stop Desk actif dans cette wilaya (passez en « À domicile »).
        </p>
      )}
      {error && <p style={{ color: "#dc2626", margin: "6px 0 0", fontSize: 12, fontWeight: 700 }}>⚠ {error}</p>}
    </div>
  );
}

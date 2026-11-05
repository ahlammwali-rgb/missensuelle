import { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  AlertCircle,
  Copy,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export function GoogleSheetPanel({
  notify,
  onOrdersUpdated,
}: {
  notify: (msg: string) => void;
  onOrdersUpdated: () => void;
}) {
  const utils = trpc.useUtils();
  const configQuery = trpc.googleSheet.getConfig.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  const saveConfig = trpc.googleSheet.saveConfig.useMutation({
    onSuccess: async () => {
      await utils.googleSheet.getConfig.invalidate();
      notify("Lien Google Sheet mis à jour avec succès ! ✦");
      setEditing(false);
    },
    onError: err => {
      notify(err.message || "Impossible d'enregistrer le lien.");
    },
  });

  const syncOrders = trpc.googleSheet.syncOrders.useMutation({
    onSuccess: async res => {
      await utils.admin.orders.invalidate();
      await utils.googleSheet.getConfig.invalidate();
      onOrdersUpdated();
      notify(
        res.added > 0
          ? `🎉 ${res.added} nouvelle(s) commande(s) importée(s) avec succès !`
          : `Toutes les commandes du Sheet sont déjà à jour (${res.totalRows} lignes analysées).`
      );
    },
    onError: err => {
      notify(err.message || "Erreur de synchronisation Google Sheet.");
    },
  });

  const data = configQuery.data;
  const [sheetUrl, setSheetUrl] = useState(data?.url || "");
  const [webhookUrl, setWebhookUrl] = useState(data?.webhookUrl || "");
  const [editing, setEditing] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Sync state when data loads
  const currentUrl = data?.url || sheetUrl;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrl.trim()) return;
    saveConfig.mutate({
      url: sheetUrl.trim(),
      webhookUrl: webhookUrl.trim(),
    });
  };

  const handleSyncNow = () => {
    syncOrders.mutate();
  };

  const appsScriptCode = `function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    sheet.appendRow([
      data.nom || "",
      data.numero || "",
      data.produit || "",
      data.variant || "",
      data.quntiter || 1,
      data.wilaya || "",
      data.comun || "",
      data.prix || "",
      "", "", "", "",
      data.date || new Date().toISOString()
    ]);
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const copyAppsScript = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(appsScriptCode);
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2000);
      }
    } catch {}
  };

  return (
    <section className="gsheet-admin-section" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header Banner */}
      <div className="gsheet-head-card app-order-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "16px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                boxShadow: "0 8px 20px rgba(16, 185, 129, 0.3)",
              }}
            >
              <FileSpreadsheet size={26} />
            </div>
            <div>
              <span className="app-head-badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                Intégration Active
              </span>
              <h2 style={{ margin: "4px 0 0", fontSize: "22px", fontWeight: 800 }}>
                Synchronisation Google Sheets
              </h2>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="aoc-btn aoc-btn-confirm"
              onClick={handleSyncNow}
              disabled={syncOrders.isPending}
              style={{ padding: "0 22px", height: "46px", borderRadius: "14px" }}
            >
              <RefreshCw size={17} className={syncOrders.isPending ? "spin-icon" : ""} />
              <span>{syncOrders.isPending ? "Synchronisation en cours…" : "📥 Synchroniser les commandes du Sheet"}</span>
            </button>

            {currentUrl && (
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="aoc-btn aoc-btn-edit"
                style={{ height: "46px", borderRadius: "14px", textDecoration: "none" }}
              >
                <span>Ouvrir le Sheet</span>
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        </div>

        {/* Live Status indicator */}
        <div
          style={{
            marginTop: "18px",
            padding: "14px 18px",
            borderRadius: "16px",
            background: data?.connected ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${data?.connected ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {data?.connected ? (
              <CheckCircle2 size={18} color="#10b981" />
            ) : (
              <AlertCircle size={18} color="#ef4444" />
            )}
            <span style={{ fontSize: "14px", fontWeight: 700, color: data?.connected ? "#10b981" : "#ef4444" }}>
              {data?.connected
                ? `Connecté en direct · ${data.rowCount} lignes de commandes et leads détectées`
                : data?.error || "Google Sheet non accessible"}
            </span>
          </div>

          {data?.lastSyncAt && (
            <small style={{ color: "var(--app-text-muted)", fontWeight: 600 }}>
              Dernière synchronisation : {new Date(data.lastSyncAt).toLocaleTimeString("fr-DZ")}
            </small>
          )}
        </div>
      </div>

      {/* Card 2: Configuration & Modification du Lien */}
      <div className="app-order-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <Link2 size={20} color="var(--app-brand)" />
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>Lien de votre Google Sheet</h3>
        </div>

        <p style={{ color: "var(--app-text-muted)", fontSize: "14px", marginTop: 0 }}>
          Vous pouvez modifier ou remplacer ce lien à tout moment. Toutes les colonnes de votre Sheet (nom, téléphone, produit, wilaya, commune, total, TikTok Lead ID) sont automatiquement lues et mappées !
        </p>

        <form onSubmit={handleSave} style={{ display: "grid", gap: "14px", maxWidth: "640px" }}>
          <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
            URL Google Sheet (Partagé en lecture ou modification)
            <input
              type="url"
              required
              value={editing ? sheetUrl : currentUrl}
              onChange={e => {
                setSheetUrl(e.target.value);
                setEditing(true);
              }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              style={{
                height: "48px",
                borderRadius: "14px",
                border: "1px solid var(--app-border)",
                padding: "0 14px",
                fontSize: "14px",
                fontWeight: 600,
                background: "var(--app-surface-sub)",
                color: "var(--app-text)",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
            URL Webhook Google Apps Script (Optionnel — pour envoyer les commandes du site vers le Sheet)
            <input
              type="url"
              value={webhookUrl}
              onChange={e => {
                setWebhookUrl(e.target.value);
                setEditing(true);
              }}
              placeholder="https://script.google.com/macros/s/.../exec"
              style={{
                height: "48px",
                borderRadius: "14px",
                border: "1px solid var(--app-border)",
                padding: "0 14px",
                fontSize: "14px",
                fontWeight: 600,
                background: "var(--app-surface-sub)",
                color: "var(--app-text)",
              }}
            />
          </label>

          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <button
              type="submit"
              className="aoc-btn aoc-btn-confirm"
              disabled={saveConfig.isPending}
              style={{ height: "46px", borderRadius: "14px" }}
            >
              <Save size={16} />
              <span>{saveConfig.isPending ? "Enregistrement…" : "Enregistrer les modifications"}</span>
            </button>

            {editing && (
              <button
                type="button"
                className="aoc-btn aoc-btn-edit"
                onClick={() => {
                  setSheetUrl(data?.url || "");
                  setWebhookUrl(data?.webhookUrl || "");
                  setEditing(false);
                }}
                style={{ height: "46px", borderRadius: "14px" }}
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Card 3: Guide de synchronisation automatique */}
      <div className="app-order-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <Sparkles size={20} color="#f59e0b" />
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>
            Comment fonctionne la synchronisation automatique ?
          </h3>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
          <div
            style={{
              padding: "16px",
              borderRadius: "16px",
              background: "var(--app-surface-sub)",
              border: "1px solid var(--app-border)",
            }}
          >
            <h4 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 800, color: "var(--app-brand)" }}>
              1. Du Google Sheet vers l'Admin 📥
            </h4>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--app-text-muted)", lineHeight: 1.6 }}>
              Cliquez sur <b>« Synchroniser les commandes du Sheet »</b> : tous les leads TikTok et commandes présents dans votre feuille sont immédiatement ajoutés à votre tableau de bord des commandes avec leur numéro, nom, article et wilaya.
            </p>
          </div>

          <div
            style={{
              padding: "16px",
              borderRadius: "16px",
              background: "var(--app-surface-sub)",
              border: "1px solid var(--app-border)",
            }}
          >
            <h4 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 800, color: "#10b981" }}>
              2. Du Site vers le Google Sheet 🚀 (Optionnel)
            </h4>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--app-text-muted)", lineHeight: 1.6 }}>
              💡 <b>Important : Vous n'avez RIEN à faire ici pour recevoir vos commandes TikTok !</b> La synchronisation de votre Sheet vers l'Admin est 100% automatique toutes les 60 secondes.<br/>Cette case Webhook est facultative : elle sert uniquement si vous voulez aussi exporter les commandes passées sur le site vers votre tableau Google Sheet. Si vous n'en avez pas besoin, laissez simplement vide.
            </p>
            <button
              type="button"
              className="aoc-btn aoc-btn-edit"
              onClick={copyAppsScript}
              style={{ marginTop: "10px", fontSize: "12px", height: "36px" }}
            >
              <Copy size={13} />
              <span>{copiedScript ? "Script copié ! 🎉" : "Copier le script Google Apps Script"}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

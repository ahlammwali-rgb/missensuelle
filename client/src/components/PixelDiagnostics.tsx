import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getMetaPixelDiagnostics, getPixelDiagnostics } from "@/lib/tracking";

function readDiagnostics() {
  return [
    { platform: "Meta", diagnostic: getMetaPixelDiagnostics(), helper: "Meta Pixel Helper", test: "Tester les événements" },
    { platform: "TikTok", diagnostic: getPixelDiagnostics(), helper: "TikTok Pixel Helper", test: "Test Events" },
  ];
}

export function PixelDiagnostics() {
  const [diagnostics, setDiagnostics] = useState(readDiagnostics);
  useEffect(() => {
    const refresh = () => setDiagnostics(readDiagnostics());
    window.addEventListener("miss-pixel-status", refresh);
    refresh();
    return () => window.removeEventListener("miss-pixel-status", refresh);
  }, []);
  return (
    <>
      {diagnostics.map(({ platform, diagnostic, helper, test }) => {
        const statusLabels = {
          "not-loaded": "Pas encore chargé",
          loading: `Chargement du script ${platform} en cours`,
          loaded: `Script ${platform} chargé dans ce navigateur`,
          error: `Erreur de chargement du script ${platform}`,
        };
        const list = diagnostic.pixelIds.length > 0 ? diagnostic.pixelIds : (diagnostic.pixelId ? [diagnostic.pixelId] : []);
        return (
          <div className="pixel-diagnostics" aria-live="polite" key={platform}>
            <div className="pixel-diagnostics-heading">
              <h3>Diagnostic {platform}{list.length > 1 ? ` (${list.length} pixels)` : ""}</h3>
              <button type="button" className="button button-light" onClick={() => setDiagnostics(readDiagnostics())}>
                <RefreshCw size={15} />Actualiser
              </button>
            </div>
            <p>
              {list.length > 1 ? "Pixels" : "Pixel"} :{" "}
              {list.length > 0
                ? list.map((pid, idx) => (
                    <span key={pid}>
                      {idx > 0 ? " · " : ""}
                      <code>{pid}</code>
                    </span>
                  ))
                : <code>Non configuré</code>}{" "}
              · {diagnostic.global ? "configuration globale du site" : "configuration locale"}
            </p>
            {diagnostic.items.length > 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "8px 0" }}>
                {diagnostic.items.map((item, idx) => (
                  <span
                    key={item.pixelId}
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "4px 9px",
                      borderRadius: "999px",
                      background: item.registered
                        ? "rgba(16, 185, 129, 0.14)"
                        : item.stage === "error"
                          ? "rgba(239, 68, 68, 0.14)"
                          : "rgba(99, 102, 241, 0.12)",
                      color: item.registered ? "#059669" : item.stage === "error" ? "#dc2626" : "inherit",
                    }}
                  >
                    #{idx + 1} {item.pixelId} · {item.registered ? "SDK OK" : statusLabels[item.stage]}
                  </span>
                ))}
              </div>
            )}
            <strong className={`pixel-diagnostics-status ${diagnostic.stage}`}>{statusLabels[diagnostic.stage]}</strong>
            {diagnostic.error && <p role="alert">{diagnostic.error} Vérifie les restrictions réseau, le consentement et les extensions actives dans ton navigateur.</p>}
            <p>{diagnostic.registered ? "Le SDK a enregistré tous ces identifiants." : "L’enregistrement de l’identifiant par le SDK n’est pas encore confirmé."}</p>
            {diagnostic.events.length > 0 && <p>Derniers appels du site : {diagnostic.events.map(item => item.name).join(" · ")}</p>}
            <small>Un script chargé ne prouve pas la réception des événements par {platform}. Vérifie aussi {helper} et « {test} » dans ton Gestionnaire d’événements. Le test de consultation ne crée aucune commande.</small>
          </div>
        );
      })}
    </>
  );
}

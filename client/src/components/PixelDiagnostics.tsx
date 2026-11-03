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
        return (
          <div className="pixel-diagnostics" aria-live="polite" key={platform}>
            <div className="pixel-diagnostics-heading"><h3>Diagnostic {platform}</h3><button type="button" className="button button-light" onClick={() => setDiagnostics(readDiagnostics())}><RefreshCw size={15} />Actualiser</button></div>
            <p>Pixel : <code>{diagnostic.pixelId || "Non configuré"}</code> · {diagnostic.global ? "configuration globale du site" : "configuration locale"}</p>
            <strong className={`pixel-diagnostics-status ${diagnostic.stage}`}>{statusLabels[diagnostic.stage]}</strong>
            {diagnostic.error && <p role="alert">{diagnostic.error} Vérifie les restrictions réseau, le consentement et les extensions actives dans ton navigateur.</p>}
            <p>{diagnostic.registered ? "Le SDK a enregistré cet identifiant." : "L’enregistrement de l’identifiant par le SDK n’est pas encore confirmé."}</p>
            {diagnostic.events.length > 0 && <p>Derniers appels du site : {diagnostic.events.map(item => item.name).join(" · ")}</p>}
            <small>Un script chargé ne prouve pas la réception des événements par {platform}. Vérifie aussi {helper} et « {test} » dans ton Gestionnaire d’événements. Le test de consultation ne crée aucune commande.</small>
          </div>
        );
      })}
    </>
  );
}

import { useState, useEffect } from "react";
import {
  Smartphone,
  Bell,
  Volume2,
  Download,
  CheckCircle2,
  Share2,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Trophy,
  PhoneCall
} from "lucide-react";
import {
  playChaChingSound,
  playUrgentAlertSound,
  playVictoryDeliveredSound,
  playAbandonedAlertSound
} from "@/lib/sound";

export type NotificationType = "order" | "urgent_issue" | "delivered" | "abandoned";

export function showPushNotification(
  title: string,
  body: string,
  tag: string,
  type: NotificationType = "order"
) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    let vibratePattern = [120, 50, 220, 40, 180];
    let requireInteraction = false;

    if (type === "urgent_issue") {
      vibratePattern = [280, 90, 280, 90, 450];
      requireInteraction = true;
    } else if (type === "delivered") {
      vibratePattern = [90, 50, 140, 50, 180, 50, 320];
    } else if (type === "abandoned") {
      vibratePattern = [80, 50, 120];
    }

    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body,
          icon: "/admin-pwa-icon.png",
          badge: "/admin-pwa-icon.png",
          vibrate: vibratePattern,
          tag,
          renotify: true,
          requireInteraction,
          data: { url: "/admin" },
        } as NotificationOptions & { vibrate?: number[]; requireInteraction?: boolean });
      }).catch(() => {
        try {
          new Notification(title, {
            body,
            icon: "/admin-pwa-icon.png",
            tag,
          });
        } catch {
          // Fallback ignored
        }
      });
    } else {
      new Notification(title, {
        body,
        icon: "/admin-pwa-icon.png",
        tag,
      });
    }
  } catch {
    // Notification error ignored
  }
}

export function MobileAppCard({ notify }: { notify: (message: string, type?: "normal" | "urgent" | "victory") => void }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");

  // Notification sound & push toggles
  const [soundOrder, setSoundOrder] = useState<boolean>(() => {
    return localStorage.getItem("ms_sound_order_enabled") !== "false";
  });
  const [soundUrgent, setSoundUrgent] = useState<boolean>(() => {
    return localStorage.getItem("ms_sound_urgent_enabled") !== "false";
  });
  const [soundVictory, setSoundVictory] = useState<boolean>(() => {
    return localStorage.getItem("ms_sound_victory_enabled") !== "false";
  });
  const [soundAbandoned, setSoundAbandoned] = useState<boolean>(() => {
    return localStorage.getItem("ms_sound_abandoned_enabled") !== "false";
  });
  const [pushOrder, setPushOrder] = useState<boolean>(() => {
    return localStorage.getItem("ms_push_order_enabled") !== "false";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check standalone mode (PWA installed and opened from home screen)
    const standaloneCheck =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standaloneCheck);

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleMobile = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isAppleMobile);

    // Check notification permission
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }

    // Capture beforeinstallprompt event (Android / Chromium)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      notify("Application Miss Sensuelle installée avec succès !", "victory");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isStandalone) {
      notify("L'application est déjà installée sur cet écran");
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          notify("Installation confirmée !", "victory");
        }
        setDeferredPrompt(null);
      } catch {
        notify("Installation annulée ou non supportée");
      }
      return;
    }

    if (isIOS) {
      setShowIOSGuide(prev => !prev);
      return;
    }

    notify("Pour installer : cliquez sur l'icône de téléchargement dans la barre d'adresse de votre navigateur ou dans le menu ⋮");
  };

  const handleRequestNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      notify("Les notifications ne sont pas supportées par ce navigateur");
      return;
    }

    try {
      const res = await Notification.requestPermission();
      setNotifPermission(res);
      if (res === "granted") {
        playChaChingSound();
        showPushNotification(
          "🛍️ Notifications Activées ! 💰",
          "Vous recevrez désormais les alertes sonores de commande, problèmes de colis et livraisons.",
          "welcome-notif",
          "order"
        );
        notify("Notifications push autorisées ! Test sonore Cha-Ching envoyé 💰", "victory");
      } else if (res === "denied") {
        notify("Notifications refusées. Autorisez-les dans les paramètres du navigateur.");
      }
    } catch {
      notify("Impossible de demander l'autorisation des notifications");
    }
  };

  // Test 1: Authentic Shopify Cha-Ching
  const handleTestChaChing = () => {
    playChaChingSound();
    showPushNotification(
      "🛍️ COMMANDE TEST SHOPIFY : Cha-Ching ! 💰 (+9 800 DZD)",
      "Amina B. (0550 12 34 56) · Doudoune Hiver Luxe · Alger",
      "test-order-sample",
      "order"
    );
    notify("Sonnerie 100% Shopify 'Cha-Ching' 💰 jouée avec succès !", "normal");
  };

  // Test 2: Urgent Red Alert Siren (Ne Répond Pas / Annulé / Reporté)
  const handleTestUrgent = () => {
    playUrgentAlertSound();
    showPushNotification(
      "🚨 INTERVENTION REQUISE : Client Ne Répond Pas !",
      "Amina K. (0555 12 34 56) · Colis CMD-1049 · Oran · Rappeler immédiatement !",
      "test-urgent-sample",
      "urgent_issue"
    );
    notify("🚨 Alerte d'intervention rouge simulée avec sirène d'urgence !", "urgent");
  };

  // Test 3: Victory Fanfare (Colis Livré en Vert)
  const handleTestVictory = () => {
    playVictoryDeliveredSound();
    showPushNotification(
      "🎉 COLIS LIVRÉ AVEC SUCCÈS ! (+9 800 DZD)",
      "Encaissement validé pour Khadidja M. · Commande CMD-1038 · Sétif",
      "test-victory-sample",
      "delivered"
    );
    notify("🎉 Colis livré vert simulé avec fanfare de victoire !", "victory");
  };

  const toggleOption = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    localStorage.setItem(key, String(value));
  };

  return (
    <div className="mobile-app-admin-card">
      <div className="mobile-card-header">
        <div className="mobile-card-title-group">
          <div className="mobile-card-icon-wrap">
            <Smartphone size={24} />
          </div>
          <div>
            <h3>
              Application Mobile & Système d'Alertes Audio Supérieur
              <Sparkles size={16} style={{ color: "#f59e0b" }} />
            </h3>
            <p>
              Notifications pour chaque événement de colis (<strong>Rouge & Alerte</strong> pour Ne répond pas / Annulé / Reporté, <strong>Vert & Victoire</strong> pour Colis Livré, et <strong>Shopify Cha-Ching 100%</strong> pour Commandes).
            </p>
          </div>
        </div>

        {isStandalone ? (
          <span className="mobile-status-badge installed">
            <CheckCircle2 size={14} /> App Installée
          </span>
        ) : deferredPrompt ? (
          <span className="mobile-status-badge ready">
            <Download size={14} /> Prêt à installer
          </span>
        ) : isIOS ? (
          <span className="mobile-status-badge ios">
            <Share2 size={14} /> Guide iPhone
          </span>
        ) : (
          <span className="mobile-status-badge ready">
            <Download size={14} /> WebAPK / PWA
          </span>
        )}
      </div>

      <div className="mobile-app-grid">
        {/* Panel 1: Installation */}
        <div className="mobile-sub-panel">
          <div>
            <h4>
              <Download size={17} style={{ color: "#8b5cf6" }} />
              1. Installer l'application sur smartphone
            </h4>
            <p>
              Installez l'icône Miss Sensuelle sur votre écran d'accueil sans passer par le store. L'application tourne en plein écran et continue de surveiller les colis en arrière-plan.
            </p>
          </div>

          <div>
            <button
              type="button"
              className="mobile-btn-primary"
              onClick={handleInstallClick}
            >
              <Download size={17} />
              {isStandalone
                ? "Application déjà installée ✓"
                : "Installer l'application sur ce téléphone"}
            </button>

            {isIOS && showIOSGuide && (
              <div className="ios-guidance-box">
                <strong>Pour installer sur iPhone / iPad :</strong>
                <ol style={{ margin: "6px 0 0 16px", padding: 0 }}>
                  <li>Appuyez sur le bouton <strong>Partager [⎋]</strong> en bas de Safari.</li>
                  <li>Faites défiler vers le bas et touchez <strong>« Sur l'écran d'accueil »</strong>.</li>
                  <li>Touchez <strong>« Ajouter »</strong> en haut à droite.</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: Push Notifications & 3 Specialized Audio Suites */}
        <div className="mobile-sub-panel">
          <div>
            <h4>
              <Bell size={17} style={{ color: "#10b981" }} />
              2. Système d'Alertes Audio Supérieur
            </h4>
            <p>
              {notifPermission === "granted"
                ? "🟢 Notifications push actives. Vos 3 sons distincts retentiront selon chaque situation de colis."
                : notifPermission === "denied"
                ? "🔴 Notifications bloquées. Veuillez les autoriser dans les paramètres du navigateur."
                : "Activez les alertes push pour recevoir les sonneries même écran éteint."}
            </p>
          </div>

          <div>
            {notifPermission !== "granted" ? (
              <button
                type="button"
                className="mobile-btn-success"
                onClick={handleRequestNotifications}
              >
                <Bell size={17} />
                Activer les notifications push
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#10b981", fontSize: "0.86rem", fontWeight: 600, marginBottom: "8px" }}>
                <ShieldCheck size={16} />
                Notifications en direct actives sur cet appareil
              </div>
            )}

            <div className="mobile-actions-row">
              <button
                type="button"
                className="mobile-btn-sound"
                onClick={handleTestChaChing}
                title="Tester la sonnerie authentique Shopify 100%"
              >
                <Volume2 size={15} />
                Shopify Cha-Ching 💰
              </button>

              <button
                type="button"
                className="mobile-btn-urgent"
                onClick={handleTestUrgent}
                title="Tester l'alerte d'urgence rouge pour colis avec problème"
              >
                <AlertTriangle size={15} />
                Alerte Colis (Rouge) 🚨
              </button>

              <button
                type="button"
                className="mobile-btn-victory"
                onClick={handleTestVictory}
                title="Tester la sonnerie de victoire pour colis livré"
              >
                <Trophy size={15} />
                Colis Livré (Vert) 🎉
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences Toggles */}
      <div className="mobile-toggles-bar">
        <label className="mobile-toggle-item">
          <input
            type="checkbox"
            checked={soundOrder}
            onChange={e => toggleOption("ms_sound_order_enabled", e.target.checked, setSoundOrder)}
          />
          <span>💰 Cha-Ching Shopify (Nouvelle commande)</span>
        </label>

        <label className="mobile-toggle-item">
          <input
            type="checkbox"
            checked={soundUrgent}
            onChange={e => toggleOption("ms_sound_urgent_enabled", e.target.checked, setSoundUrgent)}
          />
          <span>🚨 Alerte d'intervention (Ne répond pas / Annulé / Reporté)</span>
        </label>

        <label className="mobile-toggle-item">
          <input
            type="checkbox"
            checked={soundVictory}
            onChange={e => toggleOption("ms_sound_victory_enabled", e.target.checked, setSoundVictory)}
          />
          <span>🎉 Fanfare Victoire (Colis Livré en Vert)</span>
        </label>

        <label className="mobile-toggle-item">
          <input
            type="checkbox"
            checked={pushOrder}
            onChange={e => toggleOption("ms_push_order_enabled", e.target.checked, setPushOrder)}
          />
          <span>📲 Notifications Push en arrière-plan</span>
        </label>
      </div>
    </div>
  );
}

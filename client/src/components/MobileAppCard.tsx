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
  AlertCircle
} from "lucide-react";
import { playChaChingSound, playAbandonedAlertSound } from "@/lib/sound";

export function showPushNotification(title: string, body: string, tag: string) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body,
          icon: "/admin-pwa-icon.png",
          badge: "/admin-pwa-icon.png",
          vibrate: [200, 100, 200, 100, 400],
          tag,
          renotify: true,
          data: { url: "/admin" },
        } as NotificationOptions & { vibrate?: number[] });
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

export function MobileAppCard({ notify }: { notify: (message: string) => void }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");

  // Notification sound & push toggles
  const [soundOrder, setSoundOrder] = useState<boolean>(() => {
    return localStorage.getItem("ms_sound_order_enabled") !== "false";
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
      notify("Application Miss Sensuelle installée avec succès !");
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
          notify("Installation confirmée !");
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

    // Generic guidance for Chrome on desktop or Android if prompt isn't fired yet
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
          "Vous recevrez une alerte sonore 'Cha-Ching' à chaque nouvelle commande.",
          "welcome-notif"
        );
        notify("Notifications push autorisées ! Test sonore envoyé 💰");
      } else if (res === "denied") {
        notify("Notifications refusées. Autorisez-les dans les paramètres du navigateur.");
      }
    } catch (err) {
      notify("Impossible de demander l'autorisation des notifications");
    }
  };

  const handleTestChaChing = () => {
    playChaChingSound();
    notify("Sonnerie Shopify 'Cha-Ching' 💰 jouée avec succès !");
  };

  const handleTestPush = () => {
    if (notifPermission !== "granted") {
      void handleRequestNotifications();
      return;
    }
    playChaChingSound();
    showPushNotification(
      "🛍️ COMMANDE TEST : Cha-Ching ! 💰 (+9 800 DZD)",
      "Amina B. (0550 12 34 56) · Doudoune Hiver Luxe · Alger",
      "test-order-sample"
    );
    notify("Notification push test envoyée sur votre écran !");
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
              Application Mobile & Alertes Directes
              <Sparkles size={16} style={{ color: "#f59e0b" }} />
            </h3>
            <p>
              Installez l'application sur votre smartphone et recevez la sonnerie <strong>Cha-Ching</strong> (Shopify) 💰 en temps réel à chaque commande.
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
              1. Installer l'application sur ce téléphone
            </h4>
            <p>
              Ajoutez l'icône Miss Sensuelle sur votre écran d'accueil sans passer par le Play Store. Elle s'ouvre en plein écran comme une véritable application native.
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

        {/* Panel 2: Push Notifications & Audio */}
        <div className="mobile-sub-panel">
          <div>
            <h4>
              <Bell size={17} style={{ color: "#10b981" }} />
              2. Notifications Push & Sonnerie Cha-Ching
            </h4>
            <p>
              {notifPermission === "granted"
                ? "🟢 Notifications autorisées sur cet appareil. Votre téléphone vibrera et sonnera à chaque nouvelle commande."
                : notifPermission === "denied"
                ? "🔴 Notifications bloquées. Veuillez les réactiver dans les paramètres de votre navigateur."
                : "Activez les alertes push pour être immédiatement notifié même lorsque votre écran est éteint."}
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
                Notifications en direct actives sur ce téléphone
              </div>
            )}

            <div className="mobile-actions-row">
              <button
                type="button"
                className="mobile-btn-sound"
                onClick={handleTestChaChing}
                title="Tester la sonnerie de caisse enregistreuse Shopify"
              >
                <Volume2 size={15} />
                Tester Cha-Ching 💰
              </button>

              <button
                type="button"
                className="mobile-btn-test-push"
                onClick={handleTestPush}
                title="Simuler une notification de nouvelle commande"
              >
                <Bell size={15} />
                Tester la notification push
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
          <span>Sonnerie Cha-Ching 💰 à chaque nouvelle commande</span>
        </label>

        <label className="mobile-toggle-item">
          <input
            type="checkbox"
            checked={pushOrder}
            onChange={e => toggleOption("ms_push_order_enabled", e.target.checked, setPushOrder)}
          />
          <span>Notifications push en arrière-plan</span>
        </label>

        <label className="mobile-toggle-item">
          <input
            type="checkbox"
            checked={soundAbandoned}
            onChange={e => toggleOption("ms_sound_abandoned_enabled", e.target.checked, setSoundAbandoned)}
          />
          <span>Alerte sonore pour paniers abandonnés</span>
        </label>
      </div>
    </div>
  );
}

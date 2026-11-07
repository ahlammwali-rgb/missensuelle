import { useState, useEffect, useCallback } from "react";
import {
  Smartphone,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Download,
  CheckCircle2,
  Share2,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Trophy,
  Radio,
  Clock,
  Check,
  X,
  PhoneOff,
  XCircle,
  CalendarClock,
} from "lucide-react";
import {
  playChaChingSound,
  playUrgentAlertSound,
  playVictoryDeliveredSound,
  playAbandonedAlertSound,
} from "@/lib/sound";
import { trpc } from "@/lib/trpc";

export type NotificationType = "order" | "urgent_issue" | "delivered" | "abandoned";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

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
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.showNotification(title, {
            body,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-192x192.png",
            vibrate: vibratePattern,
            tag,
            renotify: true,
            requireInteraction,
            data: { url: "/admin" },
          } as NotificationOptions & { vibrate?: number[]; requireInteraction?: boolean });
        })
        .catch(() => {
          try {
            new Notification(title, {
              body,
              icon: "/icons/icon-192x192.png",
              tag,
            });
          } catch {}
        });
    } else {
      new Notification(title, {
        body,
        icon: "/icons/icon-192x192.png",
        tag,
      });
    }
  } catch {}
}

export function MobileAppCard({
  notify,
}: {
  notify: (message: string, type?: "normal" | "urgent" | "victory") => void;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [testCountdown, setTestCountdown] = useState<number | null>(null);

  // Cash Register Sound Type: "shopify" | "vintage"
  const [cashSoundType, setCashSoundType] = useState<"shopify" | "vintage">(() => {
    return (localStorage.getItem("ms_cash_sound_type") as "shopify" | "vintage") || "shopify";
  });

  // Individual problem notification toggles (Ne répond pas, Annulé, Reporté)
  const [notifNrp, setNotifNrp] = useState<boolean>(() => {
    return localStorage.getItem("ms_notif_nrp_enabled") !== "false";
  });
  const [notifCancel, setNotifCancel] = useState<boolean>(() => {
    return localStorage.getItem("ms_notif_cancel_enabled") !== "false";
  });
  const [notifDelay, setNotifDelay] = useState<boolean>(() => {
    return localStorage.getItem("ms_notif_delay_enabled") !== "false";
  });

  // General Notification sound & push toggles
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

  // TRPC queries & mutations for Web Push VAPID & preferences
  const vapidQuery = trpc.admin.getVapidPublicKey.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const savePushMutation = trpc.admin.savePushSubscription.useMutation();
  const testPushMutation = trpc.admin.testPushNotification.useMutation();

  const getPrefsQuery = trpc.admin.getNotificationPreferences.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const setPrefsMutation = trpc.admin.setNotificationPreferences.useMutation();

  // Sync server preferences on load
  useEffect(() => {
    if (getPrefsQuery.data) {
      if (getPrefsQuery.data.notifyNeRepondPas !== undefined) {
        setNotifNrp(getPrefsQuery.data.notifyNeRepondPas);
        localStorage.setItem("ms_notif_nrp_enabled", String(getPrefsQuery.data.notifyNeRepondPas));
      }
      if (getPrefsQuery.data.notifyAnnulee !== undefined) {
        setNotifCancel(getPrefsQuery.data.notifyAnnulee);
        localStorage.setItem("ms_notif_cancel_enabled", String(getPrefsQuery.data.notifyAnnulee));
      }
      if (getPrefsQuery.data.notifyReportee !== undefined) {
        setNotifDelay(getPrefsQuery.data.notifyReportee);
        localStorage.setItem("ms_notif_delay_enabled", String(getPrefsQuery.data.notifyReportee));
      }
    }
  }, [getPrefsQuery.data]);

  // Check existing push subscription on load
  const checkSubscription = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsPushSubscribed(Boolean(sub));
    } catch {
      setIsPushSubscribed(false);
    }
  }, []);

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
      if (Notification.permission === "granted") {
        void checkSubscription();
      }
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
  }, [checkSubscription, notify]);

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
      setShowIOSGuide((prev) => !prev);
      return;
    }

    notify(
      "Pour installer : cliquez sur l'icône de téléchargement dans la barre d'adresse de votre navigateur ou dans le menu ⋮"
    );
  };

  // Subscribe to Native Background Web Push via VAPID
  const handleRequestNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      notify("Les notifications ne sont pas supportées par ce navigateur");
      return;
    }

    setIsSubscribing(true);
    try {
      const res = await Notification.requestPermission();
      setNotifPermission(res);

      if (res === "granted") {
        if ("serviceWorker" in navigator && "PushManager" in window) {
          const reg = await navigator.serviceWorker.ready;
          const vapidRes = await vapidQuery.refetch();
          const publicKey = vapidRes.data?.publicKey;

          if (publicKey) {
            const applicationServerKey = urlBase64ToUint8Array(publicKey);
            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
              sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey as unknown as BufferSource,
              });
            }

            if (sub) {
              const p256dh = arrayBufferToBase64(sub.getKey ? sub.getKey("p256dh") : null);
              const auth = arrayBufferToBase64(sub.getKey ? sub.getKey("auth") : null);

              await savePushMutation.mutateAsync({
                endpoint: sub.endpoint,
                expirationTime: sub.expirationTime,
                keys: { p256dh, auth },
                userAgent: navigator.userAgent,
              });

              setIsPushSubscribed(true);
            }
          }
        }

        playChaChingSound(cashSoundType);
        notify(
          "Notifications push arrière-plan activées avec succès ! Le serveur réveillera votre téléphone à chaque nouvelle commande.",
          "victory"
        );
      } else if (res === "denied") {
        notify("Notifications refusées. Autorisez-les dans les paramètres du navigateur ou du téléphone.");
      }
    } catch (err: any) {
      console.error("Subscription error:", err);
      notify("Impossible d'activer les notifications push : " + (err?.message || "Erreur inconnue"));
    } finally {
      setIsSubscribing(false);
    }
  };

  // Background Push Test with 5-Second Delay
  const handleTestBackgroundPush = async () => {
    try {
      if (notifPermission !== "granted") {
        await handleRequestNotifications();
        return;
      }

      setTestCountdown(5);
      notify(
        "⏳ Test programmé dans 5s ! Verrouillez votre écran ou quittez l'app maintenant pour tester la réception en arrière-plan.",
        "normal"
      );

      // Trigger delayed push on server
      await testPushMutation.mutateAsync({
        type: "new_order",
        delaySeconds: 5,
      });

      // Local countdown timer for UI feedback
      let count = 5;
      const interval = setInterval(() => {
        count--;
        if (count <= 0) {
          clearInterval(interval);
          setTestCountdown(null);
        } else {
          setTestCountdown(count);
        }
      }, 1000);
    } catch (err: any) {
      setTestCountdown(null);
      notify("Erreur lors de l'envoi du test : " + (err?.message || "Erreur"));
    }
  };

  // Problem notification toggles handlers
  const handleToggleNrp = (newValue: boolean) => {
    setNotifNrp(newValue);
    localStorage.setItem("ms_notif_nrp_enabled", String(newValue));
    setPrefsMutation.mutate({ notifyNeRepondPas: newValue });
    notify(
      newValue
        ? "Alertes 'Ne répond pas' activées 🔔"
        : "Alertes 'Ne répond pas' désactivées 🔕",
      newValue ? "victory" : "normal"
    );
  };

  const handleToggleCancel = (newValue: boolean) => {
    setNotifCancel(newValue);
    localStorage.setItem("ms_notif_cancel_enabled", String(newValue));
    setPrefsMutation.mutate({ notifyAnnulee: newValue });
    notify(
      newValue
        ? "Alertes 'Commande annulée' activées 🔔"
        : "Alertes 'Commande annulée' désactivées 🔕",
      newValue ? "victory" : "normal"
    );
  };

  const handleToggleDelay = (newValue: boolean) => {
    setNotifDelay(newValue);
    localStorage.setItem("ms_notif_delay_enabled", String(newValue));
    setPrefsMutation.mutate({ notifyReportee: newValue });
    notify(
      newValue
        ? "Alertes 'Livraison reportée' activées 🔔"
        : "Alertes 'Livraison reportée' désactivées 🔕",
      newValue ? "victory" : "normal"
    );
  };

  // Master Toggle: Disable or Enable all 3 problem alerts at once
  const anyProblemEnabled = notifNrp || notifCancel || notifDelay;

  const handleToggleAllProblems = () => {
    const targetState = !anyProblemEnabled;
    setNotifNrp(targetState);
    setNotifCancel(targetState);
    setNotifDelay(targetState);

    localStorage.setItem("ms_notif_nrp_enabled", String(targetState));
    localStorage.setItem("ms_notif_cancel_enabled", String(targetState));
    localStorage.setItem("ms_notif_delay_enabled", String(targetState));

    setPrefsMutation.mutate({
      notifyNeRepondPas: targetState,
      notifyAnnulee: targetState,
      notifyReportee: targetState,
    });

    if (targetState) {
      notify("Toutes les alertes de problème (Ne répond pas, Annulé, Reporté) ont été réactivées 🔔", "victory");
    } else {
      notify("Toutes les alertes de problème (Ne répond pas, Annulé, Reporté) ont été désactivées 🔕", "normal");
    }
  };

  // Test 1: Authentic Real Cash Register
  const handleTestCashRegister = (type: "shopify" | "vintage") => {
    playChaChingSound(type);
    const label = type === "shopify" ? "Caisse Shopify (Cha-Ching 💰)" : "Caisse Vintage Mécanique (Tiroir + Clochette 🛎️)";
    showPushNotification(
      `🛍️ ${label} : (+9 800 DZD)`,
      "Amina B. (0550 12 34 56) · Doudoune Hiver Luxe · Alger",
      `test-order-${type}`,
      "order"
    );
    notify(`Son réel ${label} joué avec succès !`, "normal");
  };

  // Test 2: Urgent Red Alert Siren (Ne Répond Pas / Annulé / Reporté)
  const handleTestUrgent = () => {
    playUrgentAlertSound();
    showPushNotification(
      "🚨 INTERVENTION REQUISE : Client Ne Répond Pas !",
      "Karim M. (0555 12 34 56) · Colis CMD-1049 · Oran · Rappeler immédiatement !",
      "test-urgent-sample",
      "urgent_issue"
    );
    notify("🚨 Alerte rouge d'intervention d'urgence jouée !", "urgent");
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
    notify("🎉 Sonnerie de victoire colis livré jouée avec succès !", "victory");
  };

  const handleSelectCashSound = (type: "shopify" | "vintage") => {
    setCashSoundType(type);
    localStorage.setItem("ms_cash_sound_type", type);
    playChaChingSound(type);
    notify(
      type === "shopify"
        ? "Son configuré sur : Caisse Shopify (Cha-Ching authentique) 💰"
        : "Son configuré sur : Caisse Vintage Mécanique (Tiroir métallique + Clochette) 🛎️",
      "normal"
    );
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
              Application Mobile & Notifications en Temps Réel
              <Sparkles size={16} style={{ color: "#f59e0b" }} />
            </h3>
            <p>
              Notifications push <strong>en temps réel même écran verrouillé ou app fermée</strong>, avec vrais sons
              de caisse enregistreuse mécanique, sirène d'alerte rouge et contrôle précis de chaque alerte.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {isPushSubscribed ? (
            <span className="mobile-status-badge installed" style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>
              <Radio size={14} /> Push Arrière-Plan Actif ✅
            </span>
          ) : (
            <span className="mobile-status-badge ready" style={{ background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" }}>
              <Bell size={14} /> Push à synchroniser
            </span>
          )}

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
      </div>

      <div className="mobile-app-grid">
        {/* Panel 1: Native Background Web Push */}
        <div className="mobile-sub-panel">
          <div>
            <h4>
              <Radio size={17} style={{ color: "#10b981" }} />
              1. Réception en Arrière-Plan & Écran Éteint
            </h4>
            <p>
              Grâce au protocole <strong>Web Push VAPID</strong>, le serveur réveille votre téléphone instantanément
              dès qu'un client passe commande ou qu'un livreur signale un problème, même si votre téléphone dort dans
              votre poche.
            </p>
          </div>

          <div>
            {notifPermission !== "granted" || !isPushSubscribed ? (
              <button
                type="button"
                className="mobile-btn-success"
                onClick={handleRequestNotifications}
                disabled={isSubscribing}
                style={{ width: "100%", justifyContent: "center", marginBottom: "8px" }}
              >
                <Bell size={17} />
                {isSubscribing
                  ? "Connexion au serveur..."
                  : "Activer les notifications push (Même écran verrouillé)"}
              </button>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#f0fdf4",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #bbf7d0",
                  color: "#15803d",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  marginBottom: "8px",
                }}
              >
                <ShieldCheck size={18} />
                Téléphone connecté aux alertes serveur en arrière-plan ✓
              </div>
            )}

            {/* Background 5s Delay Test Button */}
            <button
              type="button"
              className="mobile-btn-primary"
              onClick={handleTestBackgroundPush}
              disabled={Boolean(testCountdown)}
              style={{
                width: "100%",
                justifyContent: "center",
                background: testCountdown ? "#e2e8f0" : "#6366f1",
                color: testCountdown ? "#475569" : "#ffffff",
              }}
            >
              <Clock size={16} />
              {testCountdown !== null
                ? `⏳ Verrouillez votre écran ! Arrivée dans ${testCountdown}s...`
                : "📲 Tester la notification en arrière-plan (Délai 5s)"}
            </button>
            <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "6px 0 0 2px" }}>
              Appuyez, puis verrouillez immédiatement votre écran pour voir le téléphone sonner en veille !
            </p>
          </div>
        </div>

        {/* Panel 2: Authentic Sound Suite Selection */}
        <div className="mobile-sub-panel">
          <div>
            <h4>
              <Volume2 size={17} style={{ color: "#f59e0b" }} />
              2. Vrais Sons de Caisse Enregistreuse (100% Mécanique)
            </h4>
            <p>
              Fini les bips électroniques : de vrais enregistrements audio de tiroir-caisse métallique et de sonnette.
              Choisissez votre son préféré pour les nouvelles commandes :
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              <button
                type="button"
                onClick={() => handleSelectCashSound("shopify")}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "4px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border:
                    cashSoundType === "shopify"
                      ? "2px solid #10b981"
                      : "1px solid #cbd5e1",
                  background: cashSoundType === "shopify" ? "#f0fdf4" : "#ffffff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0f172a" }}>
                    💰 Shopify Cha-Ching
                  </span>
                  {cashSoundType === "shopify" && <Check size={16} style={{ color: "#10b981" }} />}
                </div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Clochette nette et rapide identique à Shopify
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCashSound("vintage")}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "4px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border:
                    cashSoundType === "vintage"
                      ? "2px solid #10b981"
                      : "1px solid #cbd5e1",
                  background: cashSoundType === "vintage" ? "#f0fdf4" : "#ffffff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0f172a" }}>
                    🛎️ Caisse Vintage
                  </span>
                  {cashSoundType === "vintage" && <Check size={16} style={{ color: "#10b981" }} />}
                </div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Tiroir métallique coulissant + ding lourd
                </span>
              </button>
            </div>

            {/* Audio action test buttons */}
            <div className="mobile-actions-row" style={{ marginTop: "6px" }}>
              <button
                type="button"
                className="mobile-btn-sound"
                onClick={() => handleTestCashRegister("shopify")}
                title="Écouter le Cha-Ching Shopify"
              >
                <Volume2 size={15} />
                Écouter Cha-Ching 💰
              </button>

              <button
                type="button"
                className="mobile-btn-sound"
                onClick={() => handleTestCashRegister("vintage")}
                title="Écouter la Caisse Vintage"
              >
                <Volume2 size={15} />
                Écouter Caisse Vintage 🛎️
              </button>

              <button
                type="button"
                className="mobile-btn-urgent"
                onClick={handleTestUrgent}
                title="Alerte d'intervention rouge pour colis avec problème"
              >
                <AlertTriangle size={15} />
                Alerte Rouge (Ne répond pas) 🚨
              </button>

              <button
                type="button"
                className="mobile-btn-victory"
                onClick={handleTestVictory}
                title="Fanfare victoire pour colis livré"
              >
                <Trophy size={15} />
                Colis Livré (Vert) 🎉
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Dedicated Problem Notification Controls (Ne répond pas, Annulé, Reporté) */}
      <div
        style={{
          marginTop: "16px",
          background: anyProblemEnabled ? "#fff7ed" : "#f8fafc",
          border: anyProblemEnabled ? "1.5px solid #fdba74" : "1.5px solid #e2e8f0",
          borderRadius: "12px",
          padding: "14px 16px",
          transition: "all 0.2s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {anyProblemEnabled ? (
              <AlertTriangle size={20} style={{ color: "#ea580c" }} />
            ) : (
              <BellOff size={20} style={{ color: "#64748b" }} />
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                Gestion des Alertes de Problèmes (Ne répond pas, Annulé, Reporté)
                {anyProblemEnabled ? (
                  <span style={{ fontSize: "0.72rem", padding: "2px 8px", background: "#fed7aa", color: "#9a3412", borderRadius: "999px", fontWeight: 700 }}>
                    🔔 Alertes Actives
                  </span>
                ) : (
                  <span style={{ fontSize: "0.72rem", padding: "2px 8px", background: "#e2e8f0", color: "#475569", borderRadius: "999px", fontWeight: 700 }}>
                    🔕 Toutes Désactivées
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                Activez ou désactivez les notifications individuellement ou d'un seul clic :
              </div>
            </div>
          </div>

          {/* Master Button to Disable / Re-enable All 3 Problem Alerts */}
          <button
            type="button"
            onClick={handleToggleAllProblems}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.82rem",
              background: anyProblemEnabled ? "#ea580c" : "#10b981",
              color: "#ffffff",
              boxShadow: anyProblemEnabled ? "0 2px 8px rgba(234, 88, 12, 0.3)" : "0 2px 8px rgba(16, 185, 129, 0.3)",
              transition: "transform 0.1s ease",
            }}
          >
            {anyProblemEnabled ? (
              <>
                <BellOff size={15} />
                Désactiver tout (Ne répond pas, Annulé, Reporté)
              </>
            ) : (
              <>
                <Bell size={15} />
                Réactiver toutes les alertes de problème
              </>
            )}
          </button>
        </div>

        {/* 3 Individual Buttons */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "10px",
          }}
        >
          {/* Button 1: Ne Répond Pas */}
          <button
            type="button"
            onClick={() => handleToggleNrp(!notifNrp)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderRadius: "8px",
              border: notifNrp ? "1.5px solid #f97316" : "1.5px solid #cbd5e1",
              background: notifNrp ? "#ffffff" : "#f1f5f9",
              color: notifNrp ? "#0f172a" : "#64748b",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <PhoneOff size={18} style={{ color: notifNrp ? "#ea580c" : "#94a3b8" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>Client Ne Répond Pas</div>
                <div style={{ fontSize: "0.74rem", color: "#64748b" }}>Rappel livreur / client</div>
              </div>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "3px 8px",
                borderRadius: "6px",
                background: notifNrp ? "#ffedd5" : "#e2e8f0",
                color: notifNrp ? "#c2410c" : "#64748b",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {notifNrp ? (
                <>
                  <Check size={12} /> Actif
                </>
              ) : (
                <>
                  <X size={12} /> Désactivé
                </>
              )}
            </span>
          </button>

          {/* Button 2: Annulé / Refusé */}
          <button
            type="button"
            onClick={() => handleToggleCancel(!notifCancel)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderRadius: "8px",
              border: notifCancel ? "1.5px solid #ef4444" : "1.5px solid #cbd5e1",
              background: notifCancel ? "#ffffff" : "#f1f5f9",
              color: notifCancel ? "#0f172a" : "#64748b",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <XCircle size={18} style={{ color: notifCancel ? "#dc2626" : "#94a3b8" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>Commande Annulée / Refusée</div>
                <div style={{ fontSize: "0.74rem", color: "#64748b" }}>Échec ou retour colis</div>
              </div>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "3px 8px",
                borderRadius: "6px",
                background: notifCancel ? "#fee2e2" : "#e2e8f0",
                color: notifCancel ? "#b91c1c" : "#64748b",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {notifCancel ? (
                <>
                  <Check size={12} /> Actif
                </>
              ) : (
                <>
                  <X size={12} /> Désactivé
                </>
              )}
            </span>
          </button>

          {/* Button 3: Reporté */}
          <button
            type="button"
            onClick={() => handleToggleDelay(!notifDelay)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderRadius: "8px",
              border: notifDelay ? "1.5px solid #eab308" : "1.5px solid #cbd5e1",
              background: notifDelay ? "#ffffff" : "#f1f5f9",
              color: notifDelay ? "#0f172a" : "#64748b",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CalendarClock size={18} style={{ color: notifDelay ? "#ca8a04" : "#94a3b8" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>Livraison Reportée</div>
                <div style={{ fontSize: "0.74rem", color: "#64748b" }}>Report demandé par le client</div>
              </div>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "3px 8px",
                borderRadius: "6px",
                background: notifDelay ? "#fef9c3" : "#e2e8f0",
                color: notifDelay ? "#a16207" : "#64748b",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {notifDelay ? (
                <>
                  <Check size={12} /> Actif
                </>
              ) : (
                <>
                  <X size={12} /> Désactivé
                </>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Panel 3: Installation & Preferences Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginTop: "16px",
          paddingTop: "14px",
          borderTop: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="mobile-btn-primary"
            onClick={handleInstallClick}
            style={{ fontSize: "0.84rem", padding: "7px 12px" }}
          >
            <Download size={15} />
            {isStandalone
              ? "Application installée sur l'écran d'accueil ✓"
              : "Installer l'icône sur ce téléphone"}
          </button>

          {isIOS && showIOSGuide && (
            <div className="ios-guidance-box" style={{ marginTop: "6px" }}>
              <strong>Pour installer sur iPhone :</strong> Partager [⎋] → Sur l'écran d'accueil → Ajouter
            </div>
          )}
        </div>

        {/* Preferences Toggles */}
        <div className="mobile-toggles-bar" style={{ margin: 0, padding: 0 }}>
          <label className="mobile-toggle-item">
            <input
              type="checkbox"
              checked={soundOrder}
              onChange={(e) => toggleOption("ms_sound_order_enabled", e.target.checked, setSoundOrder)}
            />
            <span>💰 Caisse (Commandes)</span>
          </label>

          <label className="mobile-toggle-item">
            <input
              type="checkbox"
              checked={soundUrgent}
              onChange={(e) => toggleOption("ms_sound_urgent_enabled", e.target.checked, setSoundUrgent)}
            />
            <span>🚨 Sonnerie Sirène Problèmes</span>
          </label>

          <label className="mobile-toggle-item">
            <input
              type="checkbox"
              checked={soundVictory}
              onChange={(e) => toggleOption("ms_sound_victory_enabled", e.target.checked, setSoundVictory)}
            />
            <span>🎉 Victoire (Livré)</span>
          </label>

          <label className="mobile-toggle-item">
            <input
              type="checkbox"
              checked={pushOrder}
              onChange={(e) => toggleOption("ms_push_order_enabled", e.target.checked, setPushOrder)}
            />
            <span>📲 Push Arrière-Plan</span>
          </label>
        </div>
      </div>
    </div>
  );
}

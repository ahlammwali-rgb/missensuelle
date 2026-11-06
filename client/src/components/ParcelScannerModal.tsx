import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Camera,
  Flashlight,
  RefreshCw,
  Scan,
  Package,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Truck,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { CheckoutOrder } from "@shared/checkout";
import { adjustProductStock, formatDZD } from "@/lib/store-data";
import { playScanSound } from "@/lib/sound";
import { trpc } from "@/lib/trpc";

interface ParcelScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "ship" | "return";
  orders: CheckoutOrder[];
  notify: (msg: string) => void;
  onRefreshOrders?: () => void;
}

type ScanResult = {
  success: boolean;
  order?: CheckoutOrder;
  tracking?: string;
  newStock?: number;
  productName?: string;
  qty?: number;
  message: string;
  at: string;
};

export function ParcelScannerModal({
  isOpen,
  onClose,
  mode: initialMode,
  orders,
  notify,
  onRefreshOrders,
}: ParcelScannerModalProps) {
  const [mode, setMode] = useState<"ship" | "return">(initialMode);
  const [manualInput, setManualInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [lastScanned, setLastScanned] = useState<ScanResult | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isThrottledRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  const utils = trpc.useUtils();
  const ecomStatusQuery = trpc.ecom.status.useQuery(undefined, { refetchOnWindowFocus: false });
  const shipments = ecomStatusQuery.data?.shipments || {};

  const shipMutation = trpc.ecom.ship.useMutation();
  const markReturnMutation = trpc.admin.markReturnReceived.useMutation();

  // Keep references to latest props/state to avoid restarting camera on re-renders
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const shipmentsRef = useRef(shipments);
  shipmentsRef.current = shipments;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Load jsQR script fallback for browsers without native BarcodeDetector
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasNative = "BarcodeDetector" in window;
    const hasJsQR = "jsQR" in window;
    if (!hasNative && !hasJsQR) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Process code handler
  const handleProcessCode = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code || isProcessingRef.current) return;
      setIsProcessing(true);

      const currentOrders = ordersRef.current;
      const currentShipments = shipmentsRef.current;
      const currentMode = modeRef.current;
      const normalizedCode = code.toUpperCase().replace(/\s+/g, "");

      // Match order by tracking, id, or phone
      const matchedOrder = currentOrders.find(o => {
        const trk = (currentShipments[o.id]?.tracking || "").toUpperCase();
        if (trk && (normalizedCode === trk || normalizedCode.includes(trk))) return true;
        if (o.id.toUpperCase() === normalizedCode || o.id.toUpperCase().replace(/^MS-/, "") === normalizedCode) return true;
        const cleanPhone = o.phone.replace(/[\s\-\.]/g, "");
        const cleanCode = code.replace(/[\s\-\.]/g, "");
        if (cleanCode.length >= 8 && cleanPhone.includes(cleanCode)) return true;
        return false;
      });

      if (!matchedOrder) {
        playScanSound(false);
        setLastScanned({
          success: false,
          message: `Code "${code}" introuvable dans vos commandes.`,
          at: new Date().toLocaleTimeString("fr-DZ"),
        });
        notify(`Colis introuvable pour "${code}"`);
        setIsProcessing(false);
        return;
      }

      const qty = matchedOrder.quantity || 1;
      const productIdentifier = matchedOrder.productId || matchedOrder.product;

      if (currentMode === "ship") {
        // MODE EXPÉDITION ("Prêt à expédier")
        const alreadyShipped = Boolean(currentShipments[matchedOrder.id]) || matchedOrder.status === "transferee";
        if (alreadyShipped) {
          playScanSound(false);
          const trk = currentShipments[matchedOrder.id]?.tracking || "Déjà expédié";
          setLastScanned({
            success: false,
            order: matchedOrder,
            tracking: trk,
            message: `Ce colis a déjà été expédié (${trk}).`,
            at: new Date().toLocaleTimeString("fr-DZ"),
          });
          notify(`Colis ${matchedOrder.customer} déjà expédié !`);
          setIsProcessing(false);
          return;
        }

        try {
          const results = await shipMutation.mutateAsync({
            confirmee: true,
            items: [
              {
                orderId: matchedOrder.id,
                stopdesk: matchedOrder.delivery === "office",
                commune: matchedOrder.commune,
                codeStopdesk: undefined,
                refArticle: undefined,
              },
            ],
          });

          const res = results[0];
          if (!res || !res.ok) {
            throw new Error(res?.error || "Erreur de création du colis E-com Delivery");
          }

          // Automatically decrement stock!
          const updatedProduct = adjustProductStock(productIdentifier, -qty);
          playScanSound(true);

          setLastScanned({
            success: true,
            order: matchedOrder,
            tracking: res.tracking,
            newStock: updatedProduct?.stock,
            productName: updatedProduct?.name || matchedOrder.product,
            qty,
            message: `Colis prêt à expédier ! Stock mis à jour : -${qty}`,
            at: new Date().toLocaleTimeString("fr-DZ"),
          });

          notify(`🚀 ${matchedOrder.customer} expédié ! Tracking: ${res.tracking} · Stock ${updatedProduct?.stock ?? ""}`);
          await utils.ecom.status.invalidate();
          await utils.admin.orders.invalidate();
          onRefreshOrders?.();
        } catch (err) {
          playScanSound(false);
          setLastScanned({
            success: false,
            order: matchedOrder,
            message: err instanceof Error ? err.message : "Erreur d'expédition",
            at: new Date().toLocaleTimeString("fr-DZ"),
          });
          notify(`Échec expédition : ${err instanceof Error ? err.message : "Erreur"}`);
        }
      } else {
        // MODE RETOUR ("Réception & Remise en stock")
        if (matchedOrder.returnReceived) {
          playScanSound(false);
          setLastScanned({
            success: false,
            order: matchedOrder,
            tracking: currentShipments[matchedOrder.id]?.tracking,
            message: `Colis déjà réceptionné le ${new Date(matchedOrder.returnReceivedAt || "").toLocaleString("fr-DZ")}.`,
            at: new Date().toLocaleTimeString("fr-DZ"),
          });
          notify(`Colis ${matchedOrder.customer} déjà réceptionné au dépôt.`);
          setIsProcessing(false);
          return;
        }

        try {
          await markReturnMutation.mutateAsync({
            id: matchedOrder.dbId,
            returnReceived: true,
          });

          // Automatically increment stock!
          const updatedProduct = adjustProductStock(productIdentifier, +qty);
          playScanSound(true);

          setLastScanned({
            success: true,
            order: matchedOrder,
            tracking: currentShipments[matchedOrder.id]?.tracking,
            newStock: updatedProduct?.stock,
            productName: updatedProduct?.name || matchedOrder.product,
            qty,
            message: `Retour réceptionné au dépôt ! Stock réintégré : +${qty}`,
            at: new Date().toLocaleTimeString("fr-DZ"),
          });

          notify(`↩️ Retour ${matchedOrder.customer} validé ! +${qty} en stock (Total : ${updatedProduct?.stock ?? ""})`);
          await utils.admin.orders.invalidate();
          onRefreshOrders?.();
        } catch (err) {
          playScanSound(false);
          setLastScanned({
            success: false,
            order: matchedOrder,
            message: err instanceof Error ? err.message : "Erreur validation retour",
            at: new Date().toLocaleTimeString("fr-DZ"),
          });
          notify(`Échec retour : ${err instanceof Error ? err.message : "Erreur"}`);
        }
      }

      setIsProcessing(false);
      setManualInput("");
      if (inputRef.current) inputRef.current.focus();
    },
    [shipMutation, markReturnMutation, notify, utils, onRefreshOrders]
  );

  const handleProcessCodeRef = useRef(handleProcessCode);
  handleProcessCodeRef.current = handleProcessCode;

  // Single clean stop function
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsTorchOn(false);
  }, []);

  // Stable Camera starter that ONLY runs on isOpen / facingMode change
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let isMounted = true;
    setCameraError(null);

    const initStream = async () => {
      try {
        // Stop any previous stream first
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.muted = true;
          video.defaultMuted = true;
          video.playsInline = true;
          video.setAttribute("playsinline", "true");
          video.setAttribute("webkit-playsinline", "true");
          video.srcObject = stream;

          // Crucial for iOS Safari & Android Chrome: wait for metadata before playing
          await new Promise<void>(resolve => {
            if (video.readyState >= 2) {
              resolve();
            } else {
              video.onloadedmetadata = () => resolve();
            }
          });

          if (!isMounted) return;
          try {
            await video.play();
          } catch (e) {
            console.warn("Video auto-play interrupted:", e);
          }
        }

        setCameraActive(true);

        // Torch support check
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
        setHasTorch(Boolean(capabilities?.torch));

        // Start Scanner Loop
        type BarcodeDetectorType = new (options: { formats: string[] }) => {
          detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
        };
        const NativeDetector = (window as unknown as { BarcodeDetector?: BarcodeDetectorType }).BarcodeDetector;
        const nativeDetector = NativeDetector
          ? new NativeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "data_matrix"] })
          : null;

        let lastScanTime = 0;

        const scanLoop = async (now: number) => {
          if (!isMounted || !streamRef.current) return;

          // Run scan frame every 200ms to keep CPU & battery optimal on smartphones
          if (now - lastScanTime >= 200 && videoRef.current && videoRef.current.readyState >= 2 && !isThrottledRef.current) {
            lastScanTime = now;

            try {
              if (nativeDetector) {
                const barcodes = await nativeDetector.detect(videoRef.current);
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                  isThrottledRef.current = true;
                  await handleProcessCodeRef.current(barcodes[0].rawValue);
                  setTimeout(() => {
                    isThrottledRef.current = false;
                  }, 1500);
                }
              } else {
                // Fallback using in-memory canvas and jsQR
                const jsQR = (window as unknown as { jsQR?: (data: Uint8ClampedArray, w: number, h: number, opts?: unknown) => { data: string } | null }).jsQR;
                if (jsQR && canvasRef.current && videoRef.current) {
                  const canvas = canvasRef.current;
                  const v = videoRef.current;
                  if (v.videoWidth > 0 && v.videoHeight > 0) {
                    canvas.width = Math.min(v.videoWidth, 640);
                    canvas.height = Math.min(v.videoHeight, 480);
                    const ctx = canvas.getContext("2d", { willReadFrequently: true });
                    if (ctx) {
                      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                      const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: "dontInvert" });
                      if (code?.data) {
                        isThrottledRef.current = true;
                        await handleProcessCodeRef.current(code.data);
                        setTimeout(() => {
                          isThrottledRef.current = false;
                        }, 1500);
                      }
                    }
                  }
                }
              }
            } catch {
              // Frame dropped, continue loop
            }
          }

          if (isMounted && streamRef.current) {
            animationFrameRef.current = requestAnimationFrame(scanLoop);
          }
        };

        animationFrameRef.current = requestAnimationFrame(scanLoop);
      } catch (err) {
        if (!isMounted) return;
        console.error("Camera access error:", err);
        setCameraError("Impossible d'accéder à la caméra. Vérifiez les autorisations de votre navigateur.");
        setCameraActive(false);
      }
    };

    initStream();
    setTimeout(() => inputRef.current?.focus(), 300);

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen, facingMode, stopCamera]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const nextTorch = !isTorchOn;
      await (track as unknown as { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);
    } catch {
      // Torch not supported on front camera or specific devices
    }
  };

  if (!isOpen) return null;

  return (
    <div className="scanner-modal-overlay" onClick={onClose}>
      <div className="scanner-modal" onClick={e => e.stopPropagation()}>
        {/* Hidden offscreen canvas for fallback scanner */}
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Head */}
        <div className="scanner-modal-head">
          <div className="scanner-title-wrap">
            <Scan size={22} className="scanner-icon-glow" />
            <div>
              <h3>Scanner de Colis & Stocks</h3>
              <p>Caméra smartphone & douchette laser ultra-rapide</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="scanner-modes-bar">
          <button
            type="button"
            className={`scanner-mode-btn ${mode === "ship" ? "active ship" : ""}`}
            onClick={() => setMode("ship")}
          >
            <Truck size={17} />
            <span>1. Expédition (« Prêt à expédier »)</span>
            <small>Décrémente le stock (-1)</small>
          </button>
          <button
            type="button"
            className={`scanner-mode-btn ${mode === "return" ? "active return" : ""}`}
            onClick={() => setMode("return")}
          >
            <RotateCcw size={17} />
            <span>2. Réception Retour Dépôt</span>
            <small>Réintègre en stock (+1)</small>
          </button>
        </div>

        {/* Video / Camera Viewport */}
        <div className="scanner-viewport-wrap">
          <video
            ref={videoRef}
            className="scanner-video-element"
            playsInline
            autoPlay
            muted
          />

          {/* Holographic Aiming Reticle with laser beam */}
          <div className="scanner-target-reticle">
            <div className="reticle-corner top-left" />
            <div className="reticle-corner top-right" />
            <div className="reticle-corner bottom-left" />
            <div className="reticle-corner bottom-right" />
            <div className="scanner-laser-beam" />
            <span className="reticle-label">
              {mode === "ship" ? "Visez le QR / Colis à expédier" : "Visez le code de retour"}
            </span>
          </div>

          {/* Camera Controls Overlay */}
          <div className="scanner-cam-controls">
            {hasTorch && (
              <button
                type="button"
                className={`cam-ctrl-btn ${isTorchOn ? "active" : ""}`}
                onClick={toggleTorch}
                title="Lampe torche"
              >
                <Flashlight size={18} />
              </button>
            )}
            <button
              type="button"
              className="cam-ctrl-btn"
              onClick={() => {
                setFacingMode(prev => (prev === "environment" ? "user" : "environment"));
              }}
              title="Changer de caméra"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          {cameraError && (
            <div className="scanner-cam-error">
              <Camera size={24} />
              <p>{cameraError}</p>
              <button
                className="button button-light"
                onClick={() => setFacingMode(prev => (prev === "environment" ? "user" : "environment"))}
              >
                Changer de caméra ou réessayer
              </button>
            </div>
          )}
        </div>

        {/* Douchette / Manual Input Bar */}
        <div className="scanner-input-container">
          <label className="scanner-input-label">
            <Scan size={16} />
            <span>Entrée Douchette USB/Bluetooth ou Saisie manuelle :</span>
          </label>
          <div className="scanner-input-row">
            <input
              ref={inputRef}
              className="scanner-text-field"
              placeholder="Bipez à la douchette ou collez le n° tracking / commande..."
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && manualInput.trim()) {
                  handleProcessCode(manualInput);
                }
              }}
              disabled={isProcessing}
            />
            <button
              type="button"
              className={`button ${mode === "ship" ? "button-gradient" : "button-return-action"}`}
              disabled={!manualInput.trim() || isProcessing}
              onClick={() => handleProcessCode(manualInput)}
            >
              {isProcessing ? "Traitement…" : "Valider"}
            </button>
          </div>
        </div>

        {/* Live Feedback Card for Last Scanned Parcel */}
        {lastScanned && (
          <div className={`scanner-result-card ${lastScanned.success ? "success" : "error"}`}>
            <div className="result-card-head">
              {lastScanned.success ? (
                <CheckCircle2 size={22} className="result-icon-success" />
              ) : (
                <AlertTriangle size={22} className="result-icon-error" />
              )}
              <div className="result-card-title">
                <strong>{lastScanned.message}</strong>
                <span>{lastScanned.at}</span>
              </div>
            </div>

            {lastScanned.order && (
              <div className="result-order-details">
                <div className="result-row">
                  <span>Client :</span>
                  <strong>{lastScanned.order.customer} ({lastScanned.order.phone})</strong>
                </div>
                <div className="result-row">
                  <span>Destination :</span>
                  <span>{lastScanned.order.wilaya} · {lastScanned.order.commune}</span>
                </div>
                {lastScanned.tracking && (
                  <div className="result-row">
                    <span>N° Tracking E-com :</span>
                    <b className="result-trk-badge">{lastScanned.tracking}</b>
                  </div>
                )}
                {lastScanned.newStock !== undefined && (
                  <div className="result-stock-chip">
                    {mode === "ship" ? (
                      <>
                        <TrendingDown size={15} color="#ef4444" />
                        <span>Stock {lastScanned.productName} déduit (-{lastScanned.qty || 1}) ➔ <b>{lastScanned.newStock} en stock</b></span>
                      </>
                    ) : (
                      <>
                        <TrendingUp size={15} color="#10b981" />
                        <span>Stock {lastScanned.productName} réintégré (+{lastScanned.qty || 1}) ➔ <b>{lastScanned.newStock} en stock</b></span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

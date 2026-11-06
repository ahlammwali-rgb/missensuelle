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
  const streamRef = useRef<MediaStream | null>(null);
  const html5QrCodeRef = useRef<unknown>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isScanningRef = useRef(false);

  const utils = trpc.useUtils();
  const ecomStatusQuery = trpc.ecom.status.useQuery(undefined, { refetchOnWindowFocus: false });
  const shipments = ecomStatusQuery.data?.shipments || {};

  const shipMutation = trpc.ecom.ship.useMutation();
  const markReturnMutation = trpc.admin.markReturnReceived.useMutation();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Clean stop of camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    const html5Qr = html5QrCodeRef.current as { isScanning?: boolean; stop?: () => Promise<void> } | null;
    if (html5Qr && html5Qr.isScanning && html5Qr.stop) {
      html5Qr.stop().catch(() => {});
    }
    setCameraActive(false);
  }, []);

  // Process a scanned or typed code
  const handleProcessCode = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code || isProcessing) return;
      setIsProcessing(true);

      const normalizedCode = code.toUpperCase().replace(/\s+/g, "");

      // Match order by tracking, id, or phone
      let matchedOrder = orders.find(o => {
        const trk = (shipments[o.id]?.tracking || "").toUpperCase();
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

      if (mode === "ship") {
        // MODE EXPÉDITION ("Prêt à expédier")
        const alreadyShipped = Boolean(shipments[matchedOrder.id]) || matchedOrder.status === "transferee";
        if (alreadyShipped) {
          playScanSound(false);
          const trk = shipments[matchedOrder.id]?.tracking || "Déjà expédié";
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
          // Call E-com ship directly with confirmee: true (Prêt à expédier)
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
            tracking: shipments[matchedOrder.id]?.tracking,
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
            tracking: shipments[matchedOrder.id]?.tracking,
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
    [orders, shipments, isProcessing, mode, shipMutation, markReturnMutation, notify, utils, onRefreshOrders]
  );

  // Initialize camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);

      // Check flashlight support
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
      setHasTorch(Boolean(capabilities?.torch));

      // BarcodeDetector API detection loop
      const detectorClass = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;

      if (detectorClass) {
        const detector = new detectorClass({
          formats: ["qr_code", "code_128", "code_39", "ean_13", "data_matrix"],
        });

        const scanFrame = async () => {
          if (!streamRef.current || !videoRef.current || !isOpen) return;
          if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && !isScanningRef.current) {
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                isScanningRef.current = true;
                await handleProcessCode(barcodes[0].rawValue);
                await new Promise(r => setTimeout(r, 1200));
                isScanningRef.current = false;
              }
            } catch {
              // Frame dropped or detection error
            }
          }
          if (streamRef.current && isOpen) {
            requestAnimationFrame(scanFrame);
          }
        };

        requestAnimationFrame(scanFrame);
      } else {
        // Fallback: Html5Qrcode dynamic loader
        loadHtml5QrcodeFallback();
      }
    } catch (err) {
      setCameraError("Impossible d'accéder à la caméra. Vérifiez les autorisations.");
      setCameraActive(false);
    }
  }, [facingMode, stopCamera, handleProcessCode, isOpen]);

  // Fallback loader for browsers without native BarcodeDetector
  const loadHtml5QrcodeFallback = () => {
    const existing = (window as unknown as { Html5Qrcode?: unknown }).Html5Qrcode;
    if (existing) {
      initHtml5Qrcode();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
    script.async = true;
    script.onload = () => initHtml5Qrcode();
    document.body.appendChild(script);
  };

  const initHtml5Qrcode = () => {
    type Html5QrcodeConstructor = new (elementId: string) => {
      start: (
        camera: { facingMode: string },
        config: { fps: number; qrbox: { width: number; height: number } },
        onSuccess: (decodedText: string) => void
      ) => Promise<void>;
      stop: () => Promise<void>;
      isScanning: boolean;
    };

    const Html5QrcodeClass = (window as unknown as { Html5Qrcode: Html5QrcodeConstructor }).Html5Qrcode;
    if (!Html5QrcodeClass) return;

    try {
      const qrScanner = new Html5QrcodeClass("scanner-video-box");
      html5QrCodeRef.current = qrScanner;
      qrScanner
        .start(
          { facingMode: facingMode },
          { fps: 15, qrbox: { width: 260, height: 260 } },
          async (decodedText: string) => {
            if (!isScanningRef.current) {
              isScanningRef.current = true;
              await handleProcessCode(decodedText);
              await new Promise(r => setTimeout(r, 1200));
              isScanningRef.current = false;
            }
          }
        )
        .then(() => setCameraActive(true))
        .catch(() => setCameraError("Erreur d'initialisation du lecteur"));
    } catch {
      // Ignored
    }
  };

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
      // Not supported
    }
  };

  // Toggle camera on/off or change camera
  useEffect(() => {
    if (isOpen) {
      startCamera();
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="scanner-modal-overlay" onClick={onClose}>
      <div className="scanner-modal" onClick={e => e.stopPropagation()}>
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
        <div className="scanner-viewport-wrap" id="scanner-video-box">
          <video ref={videoRef} className="scanner-video-element" playsInline autoPlay muted />

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
                startCamera();
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
              <button className="button button-light" onClick={startCamera}>
                Réessayer la caméra
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

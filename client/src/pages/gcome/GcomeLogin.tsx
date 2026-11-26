import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { GcomeLogo } from "@/components/GcomeLogo";
import { useGcomeLang } from "@/lib/gcome-i18n";
import { gcomeHref } from "@/lib/gcome-routing";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import "@/pages/gcome/gcome-app.css";

interface GcomeLoginViewProps {
  /** Called right after successful password/code auth (e.g. invalidate + open admin). */
  onAuthenticated?: () => void;
  /** Optional first-time claim block when used inside AdminAuthGate */
  claimSlot?: React.ReactNode;
}

export function GcomeLoginView({ onAuthenticated, claimSlot }: GcomeLoginViewProps) {
  const { lang, dir, toggleLang, tx } = useGcomeLang();
  const { theme, toggleTheme } = useTheme();
  const utils = trpc.useUtils();
  const loginPassword = trpc.auth.loginPassword.useMutation();

  const [roleTab, setRoleTab] = useState<"owner" | "staff">("owner");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      await loginPassword.mutateAsync({ password });
      setPassword("");
      await utils.auth.me.invalidate();
      onAuthenticated?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : tx("Mot de passe ou code confirmateur incorrect.", "كلمة المرور أو رمز المؤكد غير صحيح.")
      );
    }
  };

  return (
    <div className="gcome-app-shell gc-split-auth" dir={dir} lang={lang} style={{ paddingBottom: 0 }}>
      {/* Left / Mobile Fullscreen Native App Auth Form */}
      <div className="gc-auth-form-pane">
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Link href={gcomeHref("/")} style={{ textDecoration: "none" }}>
            <GcomeLogo variant="compact" lang={lang} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button type="button" onClick={toggleLang} className="gc-pill-btn">
              <Globe size={14} />
              <span>{lang === "fr" ? "عربي" : "FR"}</span>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="gc-pill-btn"
              style={{ width: 36, padding: 0 }}
              aria-label={tx("Changer le thème", "تغيير المظهر")}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>

        {/* Center Card */}
        <div style={{ marginBlock: "auto", paddingBlock: 28 }}>
          <span className="gc-eyebrow">
            <KeyRound size={14} />
            <span>{tx("Connexion Sécurisée GCOME", "دخول آمن إلى لوحة التحكم")}</span>
          </span>
          <h1 style={{ marginTop: 12, fontSize: "clamp(1.65rem, 6vw, 2.25rem)", fontWeight: 900, lineHeight: 1.12 }}>
            {tx("Content de te revoir 👋", "مرحباً بعودتك 👋")}
          </h1>
          <p style={{ marginTop: 6, fontSize: 13.5, color: "var(--gc-text-muted)", lineHeight: 1.55 }}>
            {tx(
              "Accède à tes commandes, ton équipe de confirmation et ton suivi DHD / E-com en temps réel.",
              "ادخل إلى طلباتك، فريق التأكيد، وتتبع الطرود المباشر في مكان واحد."
            )}
          </p>

          {/* Pill Tab Owner vs Staff */}
          <div style={{ marginTop: 18 }}>
            <div className="gc-segmented">
              <button
                type="button"
                onClick={() => setRoleTab("owner")}
                className={`gc-segmented-btn${roleTab === "owner" ? " is-active" : ""}`}
              >
                {tx("Propriétaire / Admin", "صاحب المتجر / المدير")}
              </button>
              <button
                type="button"
                onClick={() => setRoleTab("staff")}
                className={`gc-segmented-btn${roleTab === "staff" ? " is-active" : ""}`}
              >
                {tx("Confirmateur", "فريق التأكيد")}
              </button>
            </div>
          </div>

          {claimSlot ? (
            <div style={{ marginTop: 18 }}>{claimSlot}</div>
          ) : (
            <form onSubmit={handleSubmit} style={{ marginTop: 18, display: "grid", gap: 14 }}>
              <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 800 }}>
                <span>
                  {roleTab === "owner"
                    ? tx("Mot de passe Administrateur", "كلمة مرور المدير")
                    : tx("Code Confirmateur personnel", "الرمز الشخصي لمؤكد الطلبات")}
                </span>
                <div style={{ position: "relative" }}>
                  <input
                    id="gcome-login-password"
                    className="gc-input"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ paddingInlineEnd: 46 }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={tx("Afficher ou masquer", "إظهار أو إخفاء")}
                    style={{
                      position: "absolute",
                      top: "50%",
                      insetInlineEnd: 10,
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: 0,
                      color: "var(--gc-text-muted)",
                      cursor: "pointer",
                      padding: 6,
                    }}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>

              {errorMsg && (
                <div
                  role="alert"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: "#EF4444",
                    fontSize: 12.5,
                    fontWeight: 700,
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                className="gc-btn-hero-primary"
                style={{ width: "100%" }}
                disabled={loginPassword.isPending}
              >
                <ShieldCheck size={18} />
                <span>
                  {loginPassword.isPending
                    ? tx("Connexion en cours…", "جاري الدخول…")
                    : tx("Accéder au Dashboard", "الدخول إلى لوحة التحكم")}
                </span>
              </button>
            </form>
          )}

          {/* Quick links below */}
          <div
            style={{
              marginTop: 20,
              padding: 13,
              borderRadius: 16,
              background: "var(--gc-surface)",
              border: "1px solid var(--gc-border)",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              fontSize: 12.5,
            }}
          >
            <span style={{ color: "var(--gc-text-muted)", fontWeight: 700 }}>
              {tx("Pas encore de boutique ?", "ليس لديك متجر بعد؟")}
            </span>
            <Link
              href={gcomeHref("/inscription")}
              style={{ color: "var(--gc-primary)", fontWeight: 900, textDecoration: "none" }}
            >
              {tx("Essai gratuit 14 jours →", "تجربة 14 يوم مجاناً ←")}
            </Link>
          </div>
        </div>

        {/* Bottom mini footer */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, fontSize: 12, color: "var(--gc-text-muted)" }}>
          <Link href={gcomeHref("/")} style={{ color: "var(--gc-primary)", fontWeight: 800, textDecoration: "none" }}>
            ← {tx("Découvrir GCOME 3 en 1", "اكتشف منصة GCOME")}
          </Link>
          <Link href={gcomeHref("/tarifs")} style={{ color: "var(--gc-text-muted)", fontWeight: 700, textDecoration: "none" }}>
            {tx("Voir les tarifs", "الأسعار")}
          </Link>
        </div>
      </div>

      {/* Right Desktop Animated Visual Showcase */}
      <div className="gc-auth-showcase-pane">
        <div style={{ maxWidth: 460, marginInline: "auto", display: "grid", gap: 18 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 12px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              color: "#FDE047",
              fontSize: 12,
              fontWeight: 800,
              width: "fit-content",
            }}
          >
            <Sparkles size={14} /> {tx("Tableau de bord 3 en 1 · Live", "لوحة تحكم 3 في 1")}
          </span>

          <h2 style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.15 }}>
            {tx(
              "Pilote ta boutique, tes confirmatrices et tes livraisons depuis une seule interface.",
              "أدِر متجرك، فريق التأكيد، وشحنات 58 ولاية من واجهة واحدة."
            )}
          </h2>

          <div style={{ display: "grid", gap: 10 }}>
            {[
              { icon: TrendingUp, label: tx("Finance IA : Bénéfice net & ROAS réel FB/TikTok", "المالية الذكية: صافي الربح و ROAS") },
              { icon: Users, label: tx("Confirmateurs avec appels, rappels & commissions", "مؤكدو الطلبات مع احتساب العمولات") },
              { icon: Truck, label: tx("EcoTrack / DHD & E-com 58 wilayas intégrés", "ربط مباشر مع DHD و E-com لـ 58 ولاية") },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 12,
                    borderRadius: 15,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    fontSize: 13.5,
                    fontWeight: 700,
                  }}
                >
                  <Icon size={18} color="#FDE047" />
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 16,
              background: "rgba(16,185,129,0.16)",
              border: "1px solid rgba(52,211,153,0.35)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <CheckCircle2 size={18} color="#6EE7B7" />
            <span>{tx("Session chiffrée · Alertes push mobile actives", "جلسة مشفرة · تنبيهات فورية مفعلة")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GcomeLoginPage() {
  const [, setLocation] = useLocation();
  const me = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });

  useEffect(() => {
    document.title = "Connexion GCOME — Tableau de bord";
  }, []);

  useEffect(() => {
    if (me.data?.role === "admin") {
      setLocation("/admin");
    }
  }, [me.data, setLocation]);

  return <GcomeLoginView onAuthenticated={() => setLocation("/admin")} />;
}

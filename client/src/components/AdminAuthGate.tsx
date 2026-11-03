import { useState, type ReactNode, type FormEvent } from "react";
import { AlertCircle, KeyRound, LogIn, RefreshCw, ShieldCheck } from "lucide-react";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

type Props = { children: ReactNode };

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="admin-auth-shell">
      <section className="admin-auth-card" role="alert">
        <AlertCircle size={25} aria-hidden="true" />
        <span className="eyebrow">Administration</span>
        <h1>Connexion indisponible</h1>
        <p>{message}</p>
        <button type="button" className="button button-gradient" onClick={onRetry}>
          <RefreshCw size={16} /> Réessayer
        </button>
      </section>
    </main>
  );
}

export function AdminAuthGate({ children }: Props) {
  const me = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const setupStatus = trpc.auth.setupStatus.useQuery(undefined, {
    enabled: Boolean(me.data),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const utils = trpc.useUtils();
  const claimAdmin = trpc.auth.claimAdmin.useMutation();
  const loginPassword = trpc.auth.loginPassword.useMutation();
  const [code, setCode] = useState("");
  const [claimError, setClaimError] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  if (me.isLoading) {
    return <main className="admin-auth-shell"><section className="admin-auth-card" role="status" aria-live="polite"><span className="eyebrow">Administration</span><h1>Vérification de l’accès…</h1><p>Nous vérifions la session administrateur avant d’ouvrir les données enregistrées.</p><span className="admin-auth-spinner" aria-hidden="true" /></section></main>;
  }

  if (me.error) {
    return <ErrorState message="La session n’a pas pu être vérifiée. Les données admin restent masquées." onRetry={() => void me.refetch()} />;
  }

  if (!me.data) {
    const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setPasswordError("");
      try {
        await loginPassword.mutateAsync({ password });
        setPassword("");
        await utils.auth.me.invalidate();
      } catch (error) {
        setPasswordError(error instanceof Error ? error.message : "Mot de passe incorrect.");
      }
    };

    return (
      <main className="admin-auth-shell">
        <section className="admin-auth-card">
          <div className="admin-auth-icon"><KeyRound size={24} /></div>
          <span className="eyebrow">Espace Administration</span>
          <h1>Connexion Miss Sensuelle</h1>
          <p>Saisissez votre mot de passe administrateur pour accéder aux commandes, au catalogue et aux pixels.</p>
          <form className="admin-activation-form" onSubmit={submitPassword}>
            <label htmlFor="admin-password-input">Mot de passe administrateur</label>
            <input
              id="admin-password-input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
            />
            {passwordError && <p className="admin-auth-error" role="alert">{passwordError}</p>}
            <button type="submit" className="button button-gradient" disabled={loginPassword.isPending}>
              <ShieldCheck size={16} /> {loginPassword.isPending ? "Connexion…" : "Accéder à l’administration"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (me.data.role === "admin") return <>{children}</>;

  if (setupStatus.isLoading) {
    return <main className="admin-auth-shell"><section className="admin-auth-card" role="status" aria-live="polite"><span className="eyebrow">Compte connecté</span><h1>Vérification de l’activation…</h1><p>Nous vérifions si l’activation propriétaire est encore disponible.</p><span className="admin-auth-spinner" aria-hidden="true" /></section></main>;
  }

  if (setupStatus.error) {
    return <ErrorState message="L’état d’activation n’a pas pu être chargé. Aucun écran de commande n’est ouvert." onRetry={() => void setupStatus.refetch()} />;
  }

  if (!setupStatus.data?.configured && setupStatus.data?.setupAvailable) {
    const submitClaim = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setClaimError("");
      try {
        await claimAdmin.mutateAsync({ code });
        setCode("");
        await utils.auth.me.invalidate();
      } catch (error) {
        setClaimError(error instanceof Error ? error.message : "Code d’activation invalide ou déjà utilisé.");
      }
    };

    return (
      <main className="admin-auth-shell">
        <section className="admin-auth-card">
          <div className="admin-auth-icon"><KeyRound size={24} /></div>
          <span className="eyebrow">Première activation</span>
          <h1>Active le compte propriétaire</h1>
          <p>Ton compte est bien connecté, mais l’espace admin n’est pas encore activé. Saisis le code privé reçu séparément.</p>
          <form className="admin-activation-form" onSubmit={submitClaim}>
            <label htmlFor="admin-activation-code">Code d’activation privé</label>
            <input id="admin-activation-code" type="password" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} required />
            {claimError && <p className="admin-auth-error" role="alert">{claimError}</p>}
            <button type="submit" className="button button-gradient" disabled={claimAdmin.isPending}>
              <ShieldCheck size={16} /> {claimAdmin.isPending ? "Activation…" : "Activer l’administration"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-auth-shell">
      <section className="admin-auth-card" role="alert">
        <div className="admin-auth-icon"><ShieldCheck size={24} /></div>
        <span className="eyebrow">Accès restreint</span>
        <h1>Compte non administrateur</h1>
        <p>Cette session est connectée, mais elle ne possède pas le rôle admin. Les commandes restent protégées.</p>
        <button type="button" className="button button-light" onClick={() => void me.refetch()}><RefreshCw size={16} /> Vérifier à nouveau</button>
      </section>
    </main>
  );
}

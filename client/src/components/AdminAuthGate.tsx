import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import { AlertCircle, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { GcomeLoginView } from "@/pages/gcome/GcomeLogin";

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
  useEffect(() => {
    try {
      if (localStorage.getItem("ms_admin_has_session") === "1") {
        void utils.admin.orders.prefetch();
      }
    } catch {}
  }, [utils]);
  useEffect(() => {
    try {
      if (me.data?.role === "admin") {
        localStorage.setItem("ms_admin_has_session", "1");
      } else if (!me.isLoading && !me.data) {
        localStorage.removeItem("ms_admin_has_session");
      }
    } catch {}
  }, [me.data, me.isLoading]);
  const claimAdmin = trpc.auth.claimAdmin.useMutation();
  const [code, setCode] = useState("");
  const [claimError, setClaimError] = useState("");

  if (me.isLoading) {
    return <main className="admin-auth-shell"><section className="admin-auth-card" role="status" aria-live="polite"><span className="eyebrow">Administration</span><h1>Vérification de l’accès…</h1><p>Nous vérifions la session administrateur avant d’ouvrir les données enregistrées.</p><span className="admin-auth-spinner" aria-hidden="true" /></section></main>;
  }

  if (me.error) {
    return <ErrorState message="La session n’a pas pu être vérifiée. Les données admin restent masquées." onRetry={() => void me.refetch()} />;
  }

  if (!me.data) {
    return <GcomeLoginView />;
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
      <GcomeLoginView
        claimSlot={
          <form className="admin-activation-form" onSubmit={submitClaim}>
            <label htmlFor="admin-activation-code">Code d’activation privé propriétaire</label>
            <input id="admin-activation-code" className="gc-input" type="password" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} required />
            {claimError && <p className="admin-auth-error" role="alert">{claimError}</p>}
            <button type="submit" className="gc-btn-hero-primary" style={{ width: "100%" }} disabled={claimAdmin.isPending}>
              <ShieldCheck size={16} /> {claimAdmin.isPending ? "Activation…" : "Activer l’administration"}
            </button>
          </form>
        }
      />
    );
  }

  return (
    <main className="admin-auth-shell">
      <section className="admin-auth-card" role="alert">
        <div className="admin-auth-icon"><KeyRound size={24} /></div>
        <span className="eyebrow">Accès restreint</span>
        <h1>Compte non administrateur</h1>
        <p>Cette session est connectée, mais elle ne possède pas le rôle admin. Les commandes restent protégées.</p>
        <button type="button" className="button button-light" onClick={() => void me.refetch()}><RefreshCw size={16} /> Vérifier à nouveau</button>
      </section>
    </main>
  );
}

import { createContext, useContext, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Globe2, Heart, Menu, Search, ShoppingBag, Sparkles, X } from "lucide-react";
import { formatDZD, type CartLine } from "@/lib/store-data";

export type Language = "fr" | "ar";
const LanguageContext = createContext<{ lang: Language; setLang: (lang: Language) => void }>({ lang: "fr", setLang: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem("miss-sensuelle-language") as Language) || "fr");
  useEffect(() => {
    localStorage.setItem("miss-sensuelle-language", lang);
    document.documentElement.lang = lang === "ar" ? "ar" : "fr";
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.body.classList.toggle("is-arabic", lang === "ar");
  }, [lang]);
  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() { return useContext(LanguageContext); }

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  return <button className="language-toggle" onClick={() => setLang(lang === "fr" ? "ar" : "fr")} aria-label="Changer de langue"><Globe2 size={14} /><span>{lang === "fr" ? "العربية" : "Français"}</span></button>;
}

export function ScrollReveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = document.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)");
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.08 });
    node.forEach(item => observer.observe(item));
    setVisible(true);
    return () => observer.disconnect();
  }, []);
  return <div className={`reveal ${visible ? "reveal-mounted" : ""} ${className}`}>{children}</div>;
}

export function StoreHeader({ cartCount, onOpenCart }: { cartCount: number; onOpenCart: () => void }) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { lang } = useLanguage();
  const links = lang === "ar" ? [{ label: "الجديد", href: "/catalogue" }, { label: "أزياء", href: "/catalogue?cat=mode" }, { label: "جمال", href: "/catalogue?cat=beaute" }, { label: "عدسات", href: "/catalogue?cat=lentilles" }] : [{ label: "Nouveautés", href: "/catalogue" }, { label: "Mode", href: "/catalogue?cat=mode" }, { label: "Beauté", href: "/catalogue?cat=beaute" }, { label: "Lentilles", href: "/catalogue?cat=lentilles" }];
  return (
    <header className="site-header">
      <div className="announcement"><Sparkles size={14} /> Livraison partout en Algérie · Paiement à la livraison <span>—</span> <b>Commande tranquille, on te confirme par téléphone.</b></div>
      <div className="nav-wrap container">
        <button className="mobile-menu" aria-label="Ouvrir le menu" onClick={() => setOpen(value => !value)}>{open ? <X size={21} /> : <Menu size={21} />}</button>
        <Link href="/" className="wordmark" onClick={() => setOpen(false)}><span className="wordmark-star">✦</span><span>miss</span><em>sensuelle</em></Link>
        <nav className={`main-nav ${open ? "is-open" : ""}`}>
          {links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}
        </nav>
        <div className="nav-actions">
          <LanguageToggle />
          <button className="icon-button nav-search" aria-label="Rechercher" onClick={() => navigate("/catalogue")}><Search size={19} /></button>
          <button className="bag-button" onClick={onOpenCart}><ShoppingBag size={18} /><span>Panier</span>{cartCount > 0 && <b>{cartCount}</b>}</button>
        </div>
      </div>
    </header>
  );
}

export function StoreFooter() {
  return <footer className="site-footer"><div className="footer-grid container"><div><Link href="/" className="wordmark footer-wordmark"><span className="wordmark-star">✦</span><span>miss</span><em>sensuelle</em></Link><p>Les looks et détails beauté qui font passer une journée ordinaire en moment signature.</p><div className="social-row"><span>ig</span><span>tk</span><span>fb</span></div></div><div><h4>Découvrir</h4><Link href="/catalogue">Tous les produits</Link><Link href="/catalogue?cat=mode">Mode femme</Link><Link href="/catalogue?cat=beaute">Beauté</Link></div><div><h4>Besoin d'aide ?</h4><span>Livraison en Algérie</span><span>Paiement à la livraison</span><span>Confirmation par téléphone</span></div><div className="footer-sticker"><span>made for</span><strong>your<br />glow</strong><Heart size={20} fill="currentColor" /></div></div><div className="footer-bottom container"><span>© 2026 Miss Sensuelle</span><span>Mode · Beauté · Good mood</span></div></footer>;
}

export function CartDrawer({ cart, open, onClose, onUpdate, onCheckout }: { cart: CartLine[]; open: boolean; onClose: () => void; onUpdate: (id: string, delta: number) => void; onCheckout: () => void }) {
  const total = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  return <div className={`drawer-layer ${open ? "is-open" : ""}`} aria-hidden={!open}>
    <button className="drawer-backdrop" onClick={onClose} aria-label="Fermer le panier" />
    <aside className="cart-drawer"><div className="drawer-head"><div><span className="eyebrow">Ton panier</span><h2>Les coups de cœur</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
      <div className="cart-lines">{cart.length === 0 ? <div className="empty-cart"><div className="empty-orb">✦</div><h3>Ton panier est encore sage.</h3><p>Ajoute une pièce qui te fait vraiment vibrer.</p><Link href="/catalogue" className="button button-dark" onClick={onClose}>Voir la boutique <ArrowRight size={16} /></Link></div> : cart.map(line => <div className="cart-line" key={line.id}><img src={line.image} alt="" /><div className="cart-line-info"><strong>{line.name}</strong><span>{formatDZD(line.price)}</span><div className="qty-control"><button onClick={() => onUpdate(line.id, -1)}>−</button><b>{line.quantity}</b><button onClick={() => onUpdate(line.id, 1)}>+</button></div></div></div>)}</div>
      {cart.length > 0 && <div className="cart-summary"><div><span>Sous-total</span><strong>{formatDZD(total)}</strong></div><small>Livraison calculée avec l'équipe selon ta wilaya.</small><button className="button button-gradient full" onClick={onCheckout}>Commander maintenant <ArrowRight size={16} /></button></div>}
    </aside>
  </div>;
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = { nouvelle: { label: "Nouvelle", className: "status-new" }, confirmee: { label: "Confirmée", className: "status-confirmed" }, annulee: { label: "Annulée", className: "status-cancelled" }, reportee: { label: "Reportée", className: "status-postponed" }, ne_repond_pas: { label: "Ne répond pas", className: "status-noanswer" }, transferee: { label: "Transférée", className: "status-transferred" } };
  const current = map[status] ?? map.nouvelle;
  return <span className={`status-pill ${current.className}`}><i />{current.label}</span>;
}

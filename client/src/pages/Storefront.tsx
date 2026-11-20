import { FormEvent, lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Flame, Heart, Home, LayoutGrid, MapPin, Minus, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, Star, Truck, X } from "lucide-react";
import "./home-app.css";
import { CartDrawer, ScrollReveal, StoreFooter, StoreHeader, useLanguage } from "@/components/StoreLayout";
import { categories, formatDZD, getCatalogProducts, getProduct, isCatalogSyncDone, darkHeroImage, beautyImage, products, type CartLine, type CategoryId, type Order, type Product, wilayas } from "@/lib/store-data";
import { abayaCommunesByWilaya, abayaWilayas } from "@/lib/abaya-communes";
import { trackPixelEvent } from "@/lib/tracking";
import { trpc } from "@/lib/trpc";
import { shippingFeeFor } from "@shared/shipping";
import { EmeraldOrder } from "@/components/AbayaOrder";
import { CheckoutDraftNotice } from "@/components/CheckoutDraftNotice";
import { useCheckoutDraft } from "@/components/useCheckoutDraft";
import { submitCheckoutOrder } from "@/lib/checkout-api";
import { getAbayaPhotoLabel, isSuppliedAbayaPhoto } from "@/lib/abaya-gallery";

const CoatLanding = lazy(() => import("./CoatLanding"));
const AbayaLanding = lazy(() => import("./AbayaLanding"));
const DoudouneLanding = lazy(() => import("./DoudouneLanding"));
const ExtensionsLanding = lazy(() => import("./ExtensionsLanding"));
const PerruqueLanding = lazy(() => import("./PerruqueLanding"));
const BadilLanding = lazy(() => import("./BadilLanding"));
const PyjamaLanding = lazy(() => import("./PyjamaLanding"));

function LandingFallback() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }} role="status" aria-label="Chargement du produit">
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: "3px solid rgba(148,163,184,0.28)",
          borderTopColor: "#e0145f",
          animation: "spin 0.75s linear infinite",
        }}
      />
    </div>
  );
}

function ProductCard({ product, onAdd, index = 0 }: { product: typeof products[number]; onAdd: (product: typeof products[number]) => void; index?: number }) {
  const { lang } = useLanguage();
  const name = lang === "ar" && product.arName ? product.arName : product.name;
  const categoryLabel = lang === "ar" && product.arCategoryLabel ? product.arCategoryLabel : product.categoryLabel;
  const discountPct =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : 0;
  return (
    <article className="app-vignette">
      <Link href={`/produit/${product.slug}`} className="app-vignette-media">
        <img src={product.image} alt={name} loading="lazy" />
        <div className="app-vignette-badges">
          <span className="app-badge-tag">{product.badge ?? (lang === "ar" ? "اختيار مميز" : "Coup de cœur")}</span>
          {discountPct > 0 && <span className="app-discount-pill">-{discountPct}%</span>}
        </div>
        <span className="app-vignette-rating">
          <Star size={12} fill="currentColor" /> 4.9
        </span>
      </Link>
      <div className="app-vignette-body">
        <span className="app-vignette-cat">{categoryLabel}</span>
        <Link href={`/produit/${product.slug}`} className="app-vignette-title">
          {name}
        </Link>
        <div className="app-vignette-price-row">
          <strong>{formatDZD(product.price)}</strong>
          {product.oldPrice && product.oldPrice > product.price && <del>{formatDZD(product.oldPrice)}</del>}
        </div>
        <div className="app-vignette-actions">
          <Link href={`/produit/${product.slug}`} className="app-order-cta">
            {lang === "ar" ? "اطلبي الآن" : "Commander"} <ArrowRight size={14} />
          </Link>
          <button
            type="button"
            className="app-cart-mini-btn"
            onClick={() => onAdd(product)}
            aria-label={`${lang === "ar" ? "إضافة" : "Ajouter"} ${name}`}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function HomePage({ onAdd }: { onAdd: (product: typeof products[number]) => void }) {
  const { lang } = useLanguage();
  const catalog = useCatalogProducts();
  const [activeCat, setActiveCat] = useState<CategoryId | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const heroSpotlight = useMemo(() => {
    const preferred = [
      catalog.find(p => p.id === "p-008"),
      catalog.find(p => p.id === "p-005"),
      catalog.find(p => p.id === "p-007"),
    ].filter((p): p is Product => Boolean(p));
    if (preferred.length >= 2) return preferred.slice(0, 2);
    return catalog.slice(0, 2);
  }, [catalog]);

  const visibleProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalog.filter(product => {
      const catMatch = activeCat === "all" || product.category === activeCat;
      if (!catMatch) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        (product.arName?.toLowerCase().includes(q) ?? false) ||
        product.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [catalog, activeCat, searchQuery]);

  return (
    <>
      <StoreHeader cartCount={0} onOpenCart={() => window.dispatchEvent(new CustomEvent("open-cart"))} />
      <main className="app-home">
        <div className="app-container">
          <div className="app-top-strip">
            <div className="app-greeting">
              <div className="app-greeting-badge">
                <Sparkles size={20} />
              </div>
              <div>
                <h2>{lang === "ar" ? "مرحباً بك في Miss Sensuelle" : "Bienvenue chez Miss Sensuelle"}</h2>
                <p>{lang === "ar" ? "أزياء، جمال وتوصيل سريع لـ 58 ولاية" : "Mode, beauté & livraison 58 wilayas"}</p>
              </div>
            </div>
            <label className="app-search-box">
              <Search size={18} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={lang === "ar" ? "ابحثي عن عباية، دودون، إكستنشن..." : "Rechercher abaya, doudoune, extensions..."}
              />
            </label>
          </div>

          <section className="app-hero-banner">
            <div className="app-hero-copy">
              <span className="app-hero-pill">
                <Flame size={14} /> {lang === "ar" ? "تشكيلة حصرية · عروض اليوم" : "COLLECTION EXCLUSIVE · OFFRES DU MOMENT"}
              </span>
              <h1>
                {lang === "ar" ? (
                  <>
                    تألقي <em>بإطلالة ساحرة</em> كل يوم.
                  </>
                ) : (
                  <>
                    Révèle ton <em>éclat</em> avec style.
                  </>
                )}
              </h1>
              <p>
                {lang === "ar"
                  ? "قطع مختارة بعناية وجودة مضمونة، الدفع عند الاستلام وتوصيل سريع لباب منزلك أو للمكتب."
                  : "Des pièces tendance sélectionnées avec soin, paiement à la livraison et expédition rapide partout en Algérie."}
              </p>
              <div className="app-hero-actions">
                <a href="#app-products" className="app-btn-primary">
                  {lang === "ar" ? "تسوقي الآن" : "Découvrir les produits"} <ArrowRight size={16} />
                </a>
                <Link href="/catalogue" className="app-btn-ghost">
                  {lang === "ar" ? "كل الكتالوج" : "Voir tout le catalogue"}
                </Link>
              </div>
            </div>
            <div className="app-hero-visual">
              {heroSpotlight.map(item => (
                <Link key={item.id} href={`/produit/${item.slug}`} className="app-hero-mini-card">
                  <img src={item.image} alt={lang === "ar" && item.arName ? item.arName : item.name} />
                  <div className="app-hero-mini-meta">
                    <strong>{lang === "ar" && item.arName ? item.arName : item.name}</strong>
                    <span>{formatDZD(item.price)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <div className="app-promo-strip" aria-label="Avantages">
            <span className="app-promo-chip"><Truck size={16} /> {lang === "ar" ? "توصيل 58 ولاية" : "Livraison 58 Wilayas"}</span>
            <span className="app-promo-chip"><ShieldCheck size={16} /> {lang === "ar" ? "الدفع عند الاستلام" : "Paiement à la livraison"}</span>
            <span className="app-promo-chip"><Sparkles size={16} /> {lang === "ar" ? "جودة مضمونة 100%" : "Qualité premium vérifiée"}</span>
            <span className="app-promo-chip"><Clock3 size={16} /> {lang === "ar" ? "تأكيد سريع بالهاتف" : "Confirmation rapide"}</span>
          </div>

          <section id="app-categories">
            <div className="app-sec-head">
              <div>
                <span className="app-eyebrow">{lang === "ar" ? "التصنيفات" : "Catégories"}</span>
                <h2>{lang === "ar" ? "اختاري الفئة التي تناسبك" : "Explore par univers"}</h2>
              </div>
              <Link href="/catalogue" className="app-sec-link">
                {lang === "ar" ? "عرض الكل" : "Tout voir"} <ArrowRight size={15} />
              </Link>
            </div>
            <div className="app-category-grid">
              {categories.map(category => {
                const count = catalog.filter(p => p.category === category.id).length;
                const isSelected = activeCat === category.id;
                return (
                  <button
                    type="button"
                    key={category.id}
                    onClick={() => setActiveCat(isSelected ? "all" : category.id)}
                    className={`app-cat-card cat-${category.color} ${isSelected ? "is-selected" : ""}`}
                  >
                    <div className="app-cat-info">
                      <span className="app-cat-kicker">{category.kicker}</span>
                      <h3>{lang === "ar" ? category.arLabel : category.label}</h3>
                      <span className="app-cat-count">
                        {count} {lang === "ar" ? "منتج" : "articles"} <ArrowRight size={12} />
                      </span>
                    </div>
                    <img className="app-cat-thumb" src={category.image} alt="" />
                  </button>
                );
              })}
            </div>
          </section>

          <section id="app-products">
            <div className="app-sec-head">
              <div>
                <span className="app-eyebrow">{lang === "ar" ? "منتجاتنا" : "Boutique"}</span>
                <h2>{lang === "ar" ? "أجمل القطع المختارة لك" : "Nos meilleures pièces"}</h2>
              </div>
              <span className="app-sec-link" style={{ color: "var(--app-muted)" }}>
                {visibleProducts.length} {lang === "ar" ? "منتج" : "produits"}
              </span>
            </div>

            <div className="app-filter-pills">
              <button
                type="button"
                className={`app-pill ${activeCat === "all" ? "active" : ""}`}
                onClick={() => setActiveCat("all")}
              >
                {lang === "ar" ? "الكل" : "Tout"} <span>{catalog.length}</span>
              </button>
              {categories.map(category => (
                <button
                  type="button"
                  key={category.id}
                  className={`app-pill ${activeCat === category.id ? "active" : ""}`}
                  onClick={() => setActiveCat(category.id)}
                >
                  {lang === "ar" ? category.arLabel : category.label}{" "}
                  <span>{catalog.filter(p => p.category === category.id).length}</span>
                </button>
              ))}
            </div>

            <div className="app-product-grid">
              {visibleProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} onAdd={onAdd} index={index} />
              ))}
            </div>

            {visibleProducts.length === 0 && (
              <div className="empty-state" style={{ marginBottom: 24 }}>
                <div className="empty-orb">✦</div>
                <h2>{lang === "ar" ? "لا توجد نتائج" : "Aucun produit trouvé"}</h2>
                <button
                  type="button"
                  className="button button-dark"
                  onClick={() => {
                    setActiveCat("all");
                    setSearchQuery("");
                  }}
                >
                  {lang === "ar" ? "إظهار كل المنتجات" : "Afficher tous les produits"}
                </button>
              </div>
            )}
          </section>

          <section className="app-trust-grid">
            <div className="app-trust-card">
              <div className="app-trust-icon" style={{ background: "linear-gradient(135deg, #ec4899, #f472b6)" }}>
                <Truck size={20} />
              </div>
              <div>
                <b>{lang === "ar" ? "توصيل سريع" : "Livraison rapide"}</b>
                <span>{lang === "ar" ? "للمنزل أو المكتب" : "Domicile ou Stop Desk"}</span>
              </div>
            </div>
            <div className="app-trust-card">
              <div className="app-trust-icon" style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <b>{lang === "ar" ? "دفع آمن" : "Paiement à la livraison"}</b>
                <span>{lang === "ar" ? "عند استلام الطلب" : "Zéro risque à l'achat"}</span>
              </div>
            </div>
            <div className="app-trust-card">
              <div className="app-trust-icon" style={{ background: "linear-gradient(135deg, #f59e0b, #fbbf24)" }}>
                <Star size={20} />
              </div>
              <div>
                <b>{lang === "ar" ? "تقييم ممتاز" : "Noté 4.9 / 5"}</b>
                <span>{lang === "ar" ? "+5000 زبونة راضية" : "+5000 clientes satisfaites"}</span>
              </div>
            </div>
            <div className="app-trust-card">
              <div className="app-trust-icon" style={{ background: "linear-gradient(135deg, #059669, #34d399)" }}>
                <Clock3 size={20} />
              </div>
              <div>
                <b>{lang === "ar" ? "خدمة متواصلة" : "Confirmation express"}</b>
                <span>{lang === "ar" ? "تأكيد فوري بالهاتف" : "Appel de suivi rapide"}</span>
              </div>
            </div>
          </section>
        </div>

        <nav className="app-bottom-nav" aria-label="Navigation mobile">
          <a href="#top" className="is-active" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <Home size={19} />
            <span>{lang === "ar" ? "الرئيسية" : "Accueil"}</span>
          </a>
          <a href="#app-categories">
            <LayoutGrid size={19} />
            <span>{lang === "ar" ? "الفئات" : "Catégories"}</span>
          </a>
          <Link href="/catalogue">
            <Sparkles size={19} />
            <span>{lang === "ar" ? "الكتالوج" : "Catalogue"}</span>
          </Link>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-cart"))}>
            <ShoppingBag size={19} />
            <span>{lang === "ar" ? "السلة" : "Panier"}</span>
          </button>
        </nav>
      </main>
      <StoreFooter />
    </>
  );
}

function CataloguePage({ onAdd }: { onAdd: (product: typeof products[number]) => void }) {
  const catalog = useCatalogProducts();
  const searchParams = new URLSearchParams(window.location.search);
  const [active, setActive] = useState<CategoryId | "all">((searchParams.get("cat") as CategoryId) || "all");
  const [query, setQuery] = useState("");
  const { lang } = useLanguage();
  const visibleProducts = useMemo(() => catalog.filter(product => (active === "all" || product.category === active) && product.name.toLowerCase().includes(query.toLowerCase())), [active, query]);
  return <><StoreHeader cartCount={0} onOpenCart={() => window.dispatchEvent(new CustomEvent("open-cart"))} /><main className="catalogue-page container"><div className="catalogue-hero"><div><span className="eyebrow">{lang === "ar" ? "اكتشفي مزاجك" : "Shop the mood"}</span><h1>{lang === "ar" ? <>كل ما<br /><em>يناسبك.</em></> : <>Tout ce qui te<br /><em>va si bien.</em></>}</h1></div><p>{lang === "ar" ? "قصات سهلة، ألوان تمنحك الابتسامة وتفاصيل جمال تجمعينها بحب." : "Des silhouettes faciles, des couleurs qui donnent le sourire et des détails beauté à collectionner."}</p></div><div className="catalogue-toolbar"><div className="filter-pills"><button className={active === "all" ? "active" : ""} onClick={() => setActive("all")}>{lang === "ar" ? "الكل" : "Tout"} <span>{catalog.length}</span></button>{categories.map(category => <button key={category.id} className={active === category.id ? "active" : ""} onClick={() => setActive(category.id)}>{lang === "ar" ? category.arLabel : category.label} <span>{catalog.filter(product => product.category === category.id).length}</span></button>)}</div><label className="search-field"><SearchIcon /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={lang === "ar" ? "ابحثي عن قطعة تحبينها" : "Rechercher un coup de cœur"} /></label></div><div className="catalogue-result"><span>{visibleProducts.length} {lang === "ar" ? "قطعة" : "pièces à shopper"}</span><button className="sort-button">{lang === "ar" ? "ترتيب حسب" : "Trier par"} <b>{lang === "ar" ? "المفضلة" : "Nos favoris"}</b><ChevronDown size={15} /></button></div><div className="product-grid catalogue-grid">{visibleProducts.map((product, index) => <ProductCard key={product.id} product={product} onAdd={onAdd} index={index} />)}</div>{visibleProducts.length === 0 && <div className="empty-state"><div className="empty-orb">✦</div><h2>{lang === "ar" ? "لا توجد نتائج بعد." : "Pas encore de match."}</h2><p>{lang === "ar" ? "جربي بحثاً آخر أو اكتشفي كل القطع." : "Essaie une autre recherche ou explore toutes les pièces."}</p><button className="button button-dark" onClick={() => { setActive("all"); setQuery(""); }}>{lang === "ar" ? "إعادة التعيين" : "Réinitialiser"}</button></div>}</main><StoreFooter /></>;
}

function useCatalogProducts() {
  const [catalog, setCatalog] = useState<Product[]>(() => getCatalogProducts());
  useEffect(() => {
    const refresh = () => setCatalog(getCatalogProducts());
    refresh();
    window.addEventListener("miss-sensuelle-catalog-updated", refresh);
    window.addEventListener("miss-sensuelle-catalog-synced", refresh);
    return () => {
      window.removeEventListener("miss-sensuelle-catalog-updated", refresh);
      window.removeEventListener("miss-sensuelle-catalog-synced", refresh);
    };
  }, []);
  return catalog;
}

function SearchIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>; }

function ProductPage({ onAdd, slugOverride }: { onAdd: (product: typeof products[number]) => void; slugOverride?: string }) {
  const [, params] = useRoute("/produit/:slug");
  const [, paramsAlt] = useRoute("/produits/:slug");
  const [, paramsEn] = useRoute("/product/:slug");
  const slug = slugOverride ?? params?.slug ?? paramsAlt?.slug ?? paramsEn?.slug ?? "";
  const catalog = useCatalogProducts();
  const [syncDone, setSyncDone] = useState<boolean>(() => isCatalogSyncDone());
  useEffect(() => {
    if (isCatalogSyncDone()) {
      setSyncDone(true);
      return;
    }
    const onSynced = () => setSyncDone(true);
    window.addEventListener("miss-sensuelle-catalog-synced", onSynced);
    window.addEventListener("miss-sensuelle-catalog-updated", onSynced);
    return () => {
      window.removeEventListener("miss-sensuelle-catalog-synced", onSynced);
      window.removeEventListener("miss-sensuelle-catalog-updated", onSynced);
    };
  }, []);
  const product = useMemo(() => {
    const normalized = slug.toLowerCase().trim();
    return (
      catalog.find((p) => p.slug.toLowerCase() === normalized || p.id.toLowerCase() === normalized) ??
      getProduct(slug)
    );
  }, [catalog, slug]);
  const effectiveTemplate = product?.landingTemplate ?? (
    product?.id === "p-001" ? "coat" :
    product?.id === "p-007" ? "abaya" :
    (product?.id === "p-008" || product?.slug === "doudoune-hiver-luxe") ? "doudoune" :
    (product?.id === "p-009" || product?.slug === "perruque-longue") ? "perruque" :
    (product?.id === "p-010" || product?.slug === "badil-microblading") ? "badil" :
    (product?.id === "p-011" || product?.slug === "pyjama-ete") ? "pyjama" :
    (product?.id === "p-005" || product?.slug === "extensions-silk-wave" || product?.slug === "extensions-cheveux") ? "extensions" :
    "standard"
  );
  const isVest = effectiveTemplate === "coat";
  const isEmerald = effectiveTemplate === "abaya";
  const isDoudoune = effectiveTemplate === "doudoune";
  const isExtensions = effectiveTemplate === "extensions";
  const isPerruque = effectiveTemplate === "perruque";
  const isBadil = effectiveTemplate === "badil";
  const isPyjama = effectiveTemplate === "pyjama";
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(product?.colors[0] ?? "");
  const gallery = product?.gallery ?? (product ? [product.image] : []);
  const [activeImage, setActiveImage] = useState(gallery[0] ?? "");
  const { lang } = useLanguage();
  useEffect(() => {
    setActiveImage(gallery[0] ?? "");
    setSelectedColor(product?.colors[0] ?? "");
  }, [slug, product?.id]);
  useLayoutEffect(() => {
    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {}
    const raf = window.requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [slug, product?.id]);
  useEffect(() => { if (product) trackPixelEvent("ViewContent", { content_type: "product", content_id: product.id, content_ids: [product.id], content_name: product.name, value: product.price, currency: "DZD" }); }, [product?.id]);
  useEffect(() => { document.body.classList.toggle("vest-experience", Boolean(isVest)); return () => document.body.classList.remove("vest-experience"); }, [isVest]);
  if (!product && !syncDone) return <LandingFallback />;
  if (!product) return <div className="not-found-inline"><h1>Cette pièce a disparu.</h1><Link href="/catalogue" className="button button-dark">Retour à la boutique</Link></div>;
  const displayName = lang === "ar" && product.arName ? product.arName : product.name;
  if (isVest) return <Suspense fallback={<LandingFallback />}><CoatLanding key={product.id} product={product} quantity={quantity} /></Suspense>;
  if (isEmerald) return <Suspense fallback={<LandingFallback />}><AbayaLanding key={product.id} product={product} quantity={quantity} /></Suspense>;
  if (isDoudoune) return <Suspense fallback={<LandingFallback />}><DoudouneLanding key={product.id} product={product} quantity={quantity} /></Suspense>;
  if (isExtensions) return <Suspense fallback={<LandingFallback />}><ExtensionsLanding key={product.id} product={product} quantity={quantity} /></Suspense>;
  if (isPerruque) return <Suspense fallback={<LandingFallback />}><PerruqueLanding key={product.id} product={product} /></Suspense>;
  if (isBadil) return <Suspense fallback={<LandingFallback />}><BadilLanding key={product.id} product={product} /></Suspense>;
  if (isPyjama) return <Suspense fallback={<LandingFallback />}><PyjamaLanding key={product.id} product={product} /></Suspense>;
  const displayCategory = lang === "ar" && product.arCategoryLabel ? product.arCategoryLabel : product.categoryLabel;
  const displayDescription = lang === "ar" && product.arDescription ? product.arDescription : product.description;
  return <><StoreHeader cartCount={0} onOpenCart={() => window.dispatchEvent(new CustomEvent("open-cart"))} /><main className={`product-page container ${isVest ? "vest-product-page" : ""}`}><Link href="/catalogue" className="back-link"><ArrowLeft size={16} /> Retour à la boutique</Link><div className="product-detail"><div className="detail-visual"><div className="detail-image"><img src={activeImage} alt={displayName} /><span style={{ background: product.accent }} /></div><div className="gallery-heading"><span>{lang === "ar" ? "صور المنتج" : "Photos du produit"}</span><b>{gallery.length} {lang === "ar" ? "صور" : "vues"}</b></div><div className="product-gallery">{gallery.map((image, index) => <button key={`${image}-${index}`} className={activeImage === image ? "active" : ""} onClick={() => setActiveImage(image)} aria-label={`Voir la photo ${index + 1}`}><img src={image} alt="" /></button>)}</div><div className="detail-note"><Sparkles size={16} /> {lang === "ar" ? "قطعة مختارة بحب من ميس سنسويل" : "Pièce choisie avec amour par Miss Sensuelle"}</div><a className="button button-gradient start-now-button start-now-under-gallery" href="#order" onClick={() => trackPixelEvent("InitiateCheckout", { content_ids: [product.id], value: product.price, currency: "DZD" })}>{lang === "ar" ? "ابدئي الآن" : "Commencer maintenant"} <ArrowRight size={18} /></a></div><div className="detail-copy"><span className="product-category">{displayCategory}</span><div className="detail-title-row"><h1>{displayName}</h1><button className="heart-button static"><Heart size={20} /></button></div><div className="detail-rating"><span><Star size={14} fill="currentColor" /> 4.9</span><small>·</small><span>{lang === "ar" ? "18 تقييم" : "18 avis"}</span></div><div className="detail-price"><strong>{formatDZD(product.price)}</strong>{product.oldPrice && <del>{formatDZD(product.oldPrice)}</del>}</div><p className="detail-description">{displayDescription}</p><div className="detail-option"><span>{lang === "ar" ? "اللون" : "Couleur"} <b>{selectedColor}</b></span><div className="color-options">{product.colors.map((color, index) => <button key={color} className={selectedColor === color ? "selected" : ""} onClick={() => setSelectedColor(color)}><i style={{ background: ["#9B82F6", "#F2E7D7", "#79B5FF", "#1D2433", "#C87B5B", "#F7DC5A"][index % 6] }} />{color}</button>)}</div></div><div className="detail-option"><span>{lang === "ar" ? "الكمية" : "Quantité"}</span><div className="quantity-control"><button onClick={() => setQuantity(value => Math.max(1, value - 1))}><Minus size={16} /></button><b>{quantity}</b><button onClick={() => setQuantity(value => value + 1)}><Plus size={16} /></button></div></div><div className="delivery-card"><div><Truck size={18} /><span><b>{lang === "ar" ? "توصيل في كل الجزائر" : "Livraison partout en Algérie"}</b>{lang === "ar" ? "نتصل بك للتأكيد" : "On te contacte pour confirmer"}</span></div><div><ShieldCheck size={18} /><span><b>{lang === "ar" ? "الدفع عند الاستلام" : "Paiement à la livraison"}</b>{lang === "ar" ? "ادفعي عند استلام طلبك" : "Tu paies à la réception"}</span></div></div><div className="detail-accordion"><details open><summary>{lang === "ar" ? "عن هذه القطعة" : "À propos de cette pièce"} <ChevronDown size={16} /></summary><ul>{product.details.map(detail => <li key={detail}><Check size={15} />{detail}</li>)}</ul></details><details><summary>{lang === "ar" ? "التوصيل والاسترجاع" : "Livraison & retours"} <ChevronDown size={16} /></summary><p>{lang === "ar" ? "نتواصل معك بعد تأكيد الطلب لتنظيم التوصيل حسب ولايتك." : "La livraison est organisée avec toi après confirmation téléphonique. On t'indique le délai selon ta wilaya."}</p></details></div></div></div>{isVest && <VestSalesSections product={product} />}<ProductOrderFlow product={product} quantity={quantity} /><ProductFAQ product={product} /></main><StoreFooter /></>;
}
function ShoppingIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8h12l1 12H5L6 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg>; }

function ProductOrderFlow({ product, quantity = 1 }: { product: typeof products[number]; quantity?: number }) {
  const { lang } = useLanguage();
  const [color, setColor] = useState(product.colors[0] ?? "");
  const [delivery, setDelivery] = useState<"home" | "office">("home");
  const [selectedWilaya, setSelectedWilaya] = useState("");
  const [selectedCommune, setSelectedCommune] = useState("");
  const [sent, setSent] = useState(false);
  const [orderNum, setOrderNum] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const checkoutStarted = useRef(false);

  const ratesQuery = trpc.store.shippingRates.useQuery(undefined, {
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const communeOptions = selectedWilaya ? (abayaCommunesByWilaya[selectedWilaya] ?? [selectedWilaya]) : [];
  const subtotal = product.price * quantity;
  const homeFee = selectedWilaya ? shippingFeeFor(ratesQuery.data?.rates, selectedWilaya, "home", [product.id]) : null;
  const officeFee = selectedWilaya ? shippingFeeFor(ratesQuery.data?.rates, selectedWilaya, "office", [product.id]) : null;
  const shippingFee = selectedWilaya ? shippingFeeFor(ratesQuery.data?.rates, selectedWilaya, delivery, [product.id]) : 0;
  const grandTotal = subtotal + shippingFee;

  const checkout = useCheckoutDraft({
    formRef,
    source: "product",
    getItems: () => [{ productId: product.id, quantity, color, size: "" }],
    watchKey: `${color}|${selectedWilaya}|${selectedCommune}|${delivery}|${quantity}`,
    aliases: {
      customer: ["flow-customer"],
      phone: ["flow-phone"],
      wilaya: ["flow-wilaya"],
      commune: ["flow-commune"],
      address: ["flow-address"],
    },
  });

  function startCheckout() {
    if (checkoutStarted.current) return;
    checkoutStarted.current = true;
    trackPixelEvent("InitiateCheckout", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: product.name,
      quantity,
      value: grandTotal,
      currency: "DZD",
    });
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sent || checkout.pending) return;
    const form = new FormData(event.currentTarget);
    const customer = String(form.get("flow-customer") || "Cliente Miss Sensuelle");
    const phone = String(form.get("flow-phone") || "");
    const wilaya = String(form.get("flow-wilaya") || "");
    const commune = String(form.get("flow-commune") || "");
    const address = String(form.get("flow-address") || "");
    const note = delivery === "office" ? "Livraison au bureau (Stop Desk)" : "Livraison à domicile";

    const result = await checkout.submitOrder();
    const serverOrderNumber = result?.orderNumber || `MS-${Math.floor(1000 + Math.random() * 8999)}`;
    const finalTotal = result?.total ?? grandTotal;

    const order: Order = { id: serverOrderNumber, createdAt: new Date().toISOString(), customer, phone, product: `${product.name}${color ? ` · ${color}` : ""}`, quantity, total: finalTotal, wilaya, commune, address, note, status: "nouvelle" };
    try { const existing = JSON.parse(localStorage.getItem("miss-sensuelle-orders") || "[]") as Order[]; localStorage.setItem("miss-sensuelle-orders", JSON.stringify([order, ...existing])); } catch { /* confirmation visuelle conservée */ }

    trackPixelEvent("Purchase", {
      content_type: "product",
      content_id: product.id,
      content_ids: [product.id],
      content_name: product.name,
      quantity,
      value: finalTotal,
      currency: "DZD",
      order_id: serverOrderNumber,
      phone,
      customer,
    });
    setOrderNum(serverOrderNumber);
    setSent(true);
  };

  return <section className="product-order-flow" id="order"><div className="flow-intro"><span className="eyebrow">02 · {lang === "ar" ? "الطلب المباشر" : "Commande directe"}</span><h2>{lang === "ar" ? <>اطلبيها<br /><em>بكل سهولة.</em></> : <>Commande-la<br /><em>en quelques gestes.</em></>}</h2><p>{lang === "ar" ? "أدخلي معلوماتك، اختاري اللون وطريقة التوصيل. سيظهر المبلغ قبل الإرسال." : "Renseigne tes informations, choisis ta couleur et ton mode de livraison. Le total est clair avant l'envoi."}</p><div className="flow-steps"><span className="active"><b>01</b>{lang === "ar" ? "معلوماتك" : "Tes infos"}</span><i /><span><b>02</b>{lang === "ar" ? "اللون" : "Ta couleur"}</span><i /><span><b>03</b>{lang === "ar" ? "التوصيل" : "Livraison"}</span></div></div><div className="flow-layout"><form ref={formRef} className="flow-form" onSubmit={submit} onFocusCapture={startCheckout}>{sent ? <div className="flow-success"><div>✦</div><span>{lang === "ar" ? "شكراً! تم تسجيل طلبك." : "Merci, ta commande est bien enregistrée."}</span>{orderNum && <strong>#{orderNum}</strong>}<small>{lang === "ar" ? "سنتصل بك قريباً لتأكيدها." : "On t'appelle très vite pour la confirmer."}</small></div> : <><CheckoutDraftNotice checked={checkout.consent} onChange={checkout.setConsent} status={checkout.draftStatus} error={checkout.draftError} /><input type="hidden" name="delivery" value={delivery} /><input type="hidden" name="color" value={color} /><section className="flow-card"><div className="flow-card-title"><b>01</b><div><h3>{lang === "ar" ? "معلومات التواصل" : "Informations de contact"}</h3><p>{lang === "ar" ? "أدخلي بيانات استلام طلبك" : "Pour pouvoir te joindre et préparer ton colis"}</p></div></div><div className="flow-fields"><input name="flow-customer" required placeholder={lang === "ar" ? "الاسم الكامل" : "Nom complet"} /><input name="flow-phone" required pattern="[0-9 +()-]{8,}" placeholder={lang === "ar" ? "رقم الهاتف" : "Numéro de téléphone"} /><select name="flow-wilaya" required value={selectedWilaya} onChange={event => { setSelectedWilaya(event.target.value); setSelectedCommune(""); }}><option value="" disabled>{lang === "ar" ? "اختاري الولاية" : "Choisis ta wilaya"}</option>{abayaWilayas.map(w => <option key={w} value={w}>{w}</option>)}</select><select key={selectedWilaya} name="flow-commune" required value={selectedCommune} onChange={event => setSelectedCommune(event.target.value)}><option value="" disabled>{lang === "ar" ? "اختاري البلدية" : "Choisis ta commune"}</option>{communeOptions.map(c => <option key={c} value={c}>{c}</option>)}</select><textarea name="flow-address" placeholder={lang === "ar" ? "عنوان إضافي (اختياري)" : "Adresse complémentaire (facultative)"} /></div></section><section className="flow-card"><div className="flow-card-title"><b>02</b><div><h3>{lang === "ar" ? "اختاري اللون" : "Choisis ta couleur"}</h3><p>{lang === "ar" ? "اختيارك يحدد القطعة التي سنجهزها" : "La couleur sélectionnée sera préparée dans ton colis"}</p></div></div><div className="flow-choice-grid">{product.colors.map((item, index) => <button type="button" key={item} className={color === item ? "selected" : ""} onClick={() => setColor(item)}><i style={{ background: ["#9B82F6", "#F2E7D7", "#79B5FF", "#1D2433", "#F7DC5A"][index % 5] }} />{item}</button>)}</div></section><section className="flow-card"><div className="flow-card-title"><b>03</b><div><h3>{lang === "ar" ? "طريقة التوصيل" : "Mode de livraison"}</h3><p>{lang === "ar" ? "اختاري المكان الأنسب لاستلام طلبك" : "Choisis l'endroit le plus pratique pour toi"}</p></div></div><div className="delivery-choice"><button type="button" className={delivery === "home" ? "selected" : ""} onClick={() => setDelivery("home")}><MapPin size={18} /><span><b>{lang === "ar" ? "إلى المنزل" : "À domicile"}{homeFee !== null ? ` · ${homeFee === 0 ? (lang === "ar" ? "مجاني" : "Gratuit") : formatDZD(homeFee)}` : ""}</b><small>{lang === "ar" ? "نوصّل طلبك إلى عنوانك" : "On vient jusqu'à ton adresse"}</small></span></button><button type="button" className={delivery === "office" ? "selected" : ""} onClick={() => setDelivery("office")}><PackageIcon /><span><b>{lang === "ar" ? "إلى المكتب (Stop Desk)" : "Au bureau (Stop Desk)"}{officeFee !== null ? ` · ${officeFee === 0 ? (lang === "ar" ? "مجاني" : "Gratuit") : formatDZD(officeFee)}` : ""}</b><small>{lang === "ar" ? "استلام من مكتب التوصيل" : "Retrait en agence / stop desk"}</small></span></button></div></section>{checkout.draftError && <p style={{ color: "#b91c1c", fontWeight: 700, fontSize: ".9rem" }}>{checkout.draftError}</p>}<button className="button button-gradient flow-submit" type="submit" disabled={checkout.pending}>{checkout.pending ? (lang === "ar" ? "جارٍ الإرسال..." : "Envoi en cours...") : (lang === "ar" ? "أرسلي طلبي الآن" : "Envoyer ma commande")} <ArrowRight size={17} /></button></>}</form><aside className="flow-summary"><span className="eyebrow">{lang === "ar" ? "ملخص الطلب" : "Résumé de la commande"}</span><div className="summary-product"><img src={product.image} alt="" /><div><strong>{product.name}</strong><span>{lang === "ar" ? "اللون المفضل" : "Couleur choisie"} : {color} · ×{quantity}</span></div></div><div className="summary-lines"><div><span>{lang === "ar" ? "سعر المنتج" : "Prix du produit"}</span><b>{formatDZD(subtotal)}</b></div><div><span>{lang === "ar" ? "التوصيل" : "Livraison"}</span><b>{selectedWilaya ? (shippingFee === 0 ? (lang === "ar" ? "مجاني" : "Gratuit") : formatDZD(shippingFee)) : (lang === "ar" ? "يحدد حسب الولاية" : "Selon ta wilaya")}</b></div><div className="summary-total"><span>{lang === "ar" ? "المبلغ الإجمالي" : "Total"}</span><strong>{formatDZD(grandTotal)}</strong></div></div><div className="cod-note"><ShieldCheck size={17} /><span><b>{lang === "ar" ? "الدفع عند الاستلام" : "Paiement à la livraison"}</b>{lang === "ar" ? "لن تدفعي شيئاً الآن" : "Tu ne paies rien maintenant"}</span></div></aside></div></section>;
}
function PackageIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></svg>; }

function EmeraldExactLanding({ product, gallery, activeImage, setActiveImage, selectedColor, setSelectedColor, quantity }: { product: typeof products[number]; gallery: string[]; activeImage: string; setActiveImage: (image: string) => void; selectedColor: string; setSelectedColor: (color: string) => void; quantity: number }) {
  const { lang } = useLanguage();
  const thumbs = [...gallery, gallery[0]].slice(0, 5);
  return <><div className="emerald-topbar"><Link href="/" className="emerald-menu">☰</Link><Link href="/" className="emerald-logo"><img src="/manus-storage/logo_75c9d837.jpg" alt="Miss Sensuelle" /></Link><div className="emerald-actions"><span>⌕</span><span>🛍</span><span>🇩🇿</span></div></div><main className="emerald-page"><div className="emerald-hero emerald-photo-hero"><img src="/manus-storage/1000013293_30889d5d.jpg" alt="Abaya Royal et Jumpsuit — offre spéciale Miss Sensuelle" width={1024} height={840} fetchPriority="high" /></div><div className="emerald-guarantees"><div><span>🚚</span><b>توصيل سريع</b><small>لكل ولايات الجزائر</small></div><div><span>🛡</span><b>الدفع عند الاستلام</b><small>أمان تام</small></div><div><span>♢</span><b>جودة مضمونة</b><small>100%</small></div><div><span>↻</span><b>إمكانية الاستبدال</b><small>خلال 7 أيام</small></div></div><div className="emerald-details"><div className="emerald-detail-grid">{thumbs.map((image, index) => <div key={`${image}-detail-${index}`}><img src={image} alt={getAbayaPhotoLabel(image, index, lang)} className={isSuppliedAbayaPhoto(image) ? "abaya-supplied-detail" : undefined} loading="lazy" /><b>{getAbayaPhotoLabel(image, index, lang)}</b></div>)}</div><div className="emerald-pair"><div><b>جودة تتحدث عن نفسها</b><br />عباية من القطيفة الخضراء الفاخرة بتطريز راقٍ، مع جمبسوت أنيق، لإطلالة متكاملة في كل مناسبة.</div><div>👑<br /><b>رضاك يهمنا</b></div></div><div className="emerald-review-row"><div className="emerald-review"><span>س</span><div><b>★★★★★</b><p>ممتازة و مريحة بزاف، جودة عالية و تسريع رائع</p><small>سارة · وهران</small></div></div><div className="emerald-social">👑<strong>أكثر من<br />5000 زبونة راضية</strong>♥</div></div></div><EmeraldOrder product={product} selectedColor={selectedColor} setSelectedColor={setSelectedColor} quantity={quantity} lang={lang} /></main><footer className="emerald-footer"><strong>Miss Sensuelle</strong><span>كوني دائماً مميزة ... اختاري ما يناسبك</span></footer></>;
}

function VestSalesSections({ product }: { product: typeof products[number] }) {
  const { lang } = useLanguage();
  const images = (product.gallery ?? [product.image]).slice(1, 5);
  return <section className="vest-sales-sections"><div className="vest-offer-banner"><div><span className="vest-kicker">عرض خاص · MISS SENSUELLE</span><h2>{lang === "ar" ? "معطف شتوي فاخر" : "L'icon coat de la saison"}</h2><p>{lang === "ar" ? "ستايل أنيق ودافئ، بتفاصيل فاخرة تليق بكل إطلالة." : "Une silhouette iconique, chaude et élégante, pensée pour faire tourner les têtes."}</p></div><div className="vest-offer-price"><small>{lang === "ar" ? "السعر الخاص" : "Offre spéciale"}</small><strong>{formatDZD(product.price)}</strong>{product.oldPrice && <del>{formatDZD(product.oldPrice)}</del>}<span>{lang === "ar" ? "كمية محدودة" : "Quantité limitée"}</span></div></div><div className="vest-benefit-grid"><article><span>✦</span><strong>{lang === "ar" ? "قماش فاخر" : "Tissu premium"}</strong><p>{lang === "ar" ? "ناعم، دافئ ويدوم" : "Doux, chaud et durable"}</p></article><article><span>✧</span><strong>{lang === "ar" ? "تفاصيل أنيقة" : "Détails signature"}</strong><p>{lang === "ar" ? "أزرار ولمسات فرو" : "Boutons et finitions fourrées"}</p></article><article><span>⌁</span><strong>{lang === "ar" ? "قصة أنثوية" : "Coupe flatteuse"}</strong><p>{lang === "ar" ? "Une silhouette qui se remarque" : "Marque la taille avec élégance"}</p></article></div><div className="vest-photo-strip">{images.map((image, index) => <div key={`${image}-${index}`}><img src={image} alt="" /><span>{["360°", "Détails", "Douceur", "Dos élégant"][index]}</span></div>)}</div><div className="vest-social-proof"><div className="vest-stars">★★★★★</div><p>{lang === "ar" ? "وصلتني في 3 أيام، نفس الصورة تماماً. معطف رائع ودافئ وأنيق جداً." : "Reçue en 3 jours, exactement comme sur les photos. Elle est chaude, élégante et vraiment canon."}</p><strong>{lang === "ar" ? "سارة · وهران" : "Sarah · Oran"}</strong></div><div className="vest-urgency"><div><span>🔥</span><strong>{lang === "ar" ? "لا تفوتي الفرصة" : "Ne laisse pas passer l'occasion"}</strong><small>{lang === "ar" ? "الكمية محدودة · الدفع عند الاستلام" : "Stock limité · paiement à la livraison"}</small></div><a href="#order" onClick={() => trackPixelEvent("InitiateCheckout", { content_ids: [product.id], value: product.price, currency: "DZD" })}>{lang === "ar" ? "اطلبي الآن" : "Commander maintenant"} <ArrowRight size={17} /></a></div></section>;
}

function ProductFAQ({ product }: { product: typeof products[number] }) {
  const { lang } = useLanguage();
  return <section className="product-faq"><div><span className="eyebrow">04 · {lang === "ar" ? "معلومات تهمك" : "Infos utiles"}</span><h2>{lang === "ar" ? <>أسئلة<br /><em>قبل الطلب.</em></> : <>Les réponses<br /><em>avant de craquer.</em></>}</h2><p>{lang === "ar" ? "كل التفاصيل المهمة عن السعر والتوصيل والتأكيد." : "Les détails importants sur le prix, la livraison et la confirmation."}</p></div><div className="faq-list"><details open><summary>{lang === "ar" ? "كيف يتم الدفع؟" : "Comment se passe le paiement ?"}<ChevronDown size={16} /></summary><p>{lang === "ar" ? "الدفع عند الاستلام بعد تأكيد الطلب هاتفياً." : "Tu paies à la réception, après la confirmation de ta commande par téléphone."}</p></details><details><summary>{lang === "ar" ? "كم يستغرق التوصيل؟" : "Quel est le délai de livraison ?"}<ChevronDown size={16} /></summary><p>{lang === "ar" ? "نحدد المدة حسب الولاية عند الاتصال بك للتأكيد." : "Le délai est précisé selon ta wilaya lors de l'appel de confirmation."}</p></details><details><summary>{lang === "ar" ? "هل يمكن تغيير اللون؟" : "Puis-je changer de couleur ?"}<ChevronDown size={16} /></summary><p>{lang === "ar" ? "اختاري لونك المفضل في الطلب، ويمكنك تعديله عند التأكيد." : "Choisis ta couleur dans le formulaire et confirme-la avec notre équipe au téléphone."}</p></details><details><summary>{lang === "ar" ? "ماذا يحدث بعد الإرسال؟" : "Que se passe-t-il après l'envoi ?"}<ChevronDown size={16} /></summary><p>{lang === "ar" ? `سنحفظ طلب ${product.name} ونتصل بك سريعاً لتأكيده.` : `Ta demande pour ${product.name} est enregistrée et notre équipe t'appelle rapidement.`}</p></details></div></section>;
}

export function CheckoutPage({ cart, onClear }: { cart: CartLine[]; onClear: () => void }) {
  const [, navigate] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [checkoutWilaya, setCheckoutWilaya] = useState("");
  const checkoutCommunes = checkoutWilaya ? (abayaCommunesByWilaya[checkoutWilaya] ?? []) : [];
  const total = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customer = String(form.get("customer") || "Cliente Miss Sensuelle");
    const phone = String(form.get("phone") || "");
    const wilaya = String(form.get("wilaya") || "");
    const commune = String(form.get("commune") || "");
    const address = String(form.get("address") || "");
    const note = String(form.get("note") || "");
    let id = `MS-${Math.floor(1000 + Math.random() * 8999)}`;
    try {
      const token = globalThis.crypto?.randomUUID?.() ?? `00000000-0000-4000-8000-${String(Date.now()).padStart(12, "0").slice(-12)}`;
      const res = await submitCheckoutOrder(token, {
        source: "cart",
        customer,
        phone,
        wilaya,
        commune,
        address,
        note,
        delivery: "home",
        items: cart.map(line => ({ productId: line.id, quantity: line.quantity, color: line.colors[0] ?? "", size: "" })),
      });
      id = res.orderNumber;
    } catch { /* fallback local */ }
    const savedOrder: Order = {
      id,
      createdAt: new Date().toISOString(),
      customer,
      phone,
      product: cart.map(line => `${line.name} ×${line.quantity}`).join(", "),
      quantity: cart.reduce((sum, line) => sum + line.quantity, 0),
      total,
      wilaya,
      commune,
      address,
      note,
      status: "nouvelle",
    };
    try {
      const existing = JSON.parse(localStorage.getItem("miss-sensuelle-orders") || "[]") as Order[];
      localStorage.setItem("miss-sensuelle-orders", JSON.stringify([savedOrder, ...existing]));
    } catch { /* La confirmation reste possible si le stockage du navigateur est indisponible. */ }
    trackPixelEvent("Purchase", { content_ids: cart.map(line => line.id), value: total, currency: "DZD", order_id: id });
    setOrderId(id); setSubmitted(true); onClear();
  };
  if (submitted) return <><StoreHeader cartCount={0} onOpenCart={() => {}} /><main className="success-page container"><div className="success-confetti">✦</div><span className="eyebrow">Commande bien reçue</span><h1>Merci, c'est<br /><em>dans la boîte.</em></h1><p>On va t'appeler très vite pour confirmer les détails de ta commande et organiser la livraison.</p><div className="order-ticket"><span>Ton numéro de commande</span><strong>{orderId}</strong><small>Pense à le garder précieusement</small></div><Link href="/catalogue" className="button button-dark">Continuer mes achats <ArrowRight size={16} /></Link></main><StoreFooter /></>;
  return <><StoreHeader cartCount={cart.reduce((sum, line) => sum + line.quantity, 0)} onOpenCart={() => {}} /><main className="checkout-page container"><Link href="/catalogue" className="back-link"><ArrowLeft size={16} /> Retour à la boutique</Link><div className="checkout-layout"><div><span className="eyebrow">Dernière étape</span><h1>On prépare ton<br /><em>colis.</em></h1><p className="checkout-intro">Remplis tes infos et on t'appelle pour confirmer. Paiement à la livraison, zéro stress.</p><form className="checkout-form" onSubmit={submit}><div className="form-section"><div className="form-section-title"><span>01</span><div><h3>Tes coordonnées</h3><p>Pour qu'on puisse te joindre facilement</p></div></div><div className="field-grid"><label>Nom complet<input name="customer" required placeholder="Ex. Imane Benali" /></label><label>Téléphone<input name="phone" required pattern="[0-9 +()-]{8,}" placeholder="05 50 00 00 00" /></label></div></div><div className="form-section"><div className="form-section-title"><span>02</span><div><h3>Où te livrer ?</h3><p>La livraison arrive jusqu'à ta porte</p></div></div><div className="field-grid"><label>Wilaya<select name="wilaya" required value={checkoutWilaya} onChange={e => setCheckoutWilaya(e.target.value)}><option value="" disabled>Choisir ta wilaya</option>{abayaWilayas.map(wilaya => <option key={wilaya} value={wilaya}>{wilaya}</option>)}</select></label><label>Commune{checkoutCommunes.length > 0 ? <select key={checkoutWilaya} name="commune" required defaultValue=""><option value="" disabled>Choisir ta commune</option>{checkoutCommunes.map(c => <option key={c} value={c}>{c}</option>)}</select> : <input name="commune" required placeholder="Commune" />}</label></div><label>Adresse complète<input name="address" required placeholder="Rue, cité, bâtiment, étage..." /></label><label>Note pour la livraison <span className="optional">Optionnel</span><textarea name="note" rows={3} placeholder="Une précision pour notre équipe ?" /></label></div><button className="button button-gradient full checkout-submit" type="submit">Confirmer ma commande <ArrowRight size={17} /></button></form></div><aside className="checkout-summary"><span className="eyebrow">Ton récap'</span><h3>Les pièces choisies</h3><div className="checkout-lines">{cart.length ? cart.map(line => <div className="checkout-line" key={line.id}><img src={line.image} alt="" /><div><strong>{line.name}</strong><span>Qté {line.quantity}</span></div><b>{formatDZD(line.price * line.quantity)}</b></div>) : <p>Ton panier est vide. <Link href="/catalogue">Retourner à la boutique</Link></p>}</div><div className="summary-total"><span>Total à payer</span><strong>{formatDZD(total)}</strong></div><div className="cod-note"><ShieldCheck size={17} /><span><b>Paiement à la livraison</b>Tu paies uniquement quand tu reçois ton colis.</span></div></aside></div></main><StoreFooter /></>;
}

export default function Storefront({ cart, onAdd, onUpdate, onClear }: { cart: CartLine[]; onAdd: (product: typeof products[number]) => void; onUpdate: (id: string, delta: number) => void; onClear: () => void }) {
  const [cartOpen, setCartOpen] = useState(false);
  useEffect(() => { const handler = () => setCartOpen(true); window.addEventListener("open-cart", handler); return () => window.removeEventListener("open-cart", handler); }, []);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const addAndOpen = (product: typeof products[number]) => { onAdd(product); setCartOpen(true); };
  return <><RouteContent onAdd={addAndOpen} cart={cart} onClear={onClear} /><CartDrawer cart={cart} open={cartOpen} onClose={() => setCartOpen(false)} onUpdate={onUpdate} onCheckout={() => { setCartOpen(false); window.location.href = "/commande"; }} /><div className="mobile-cart-trigger" onClick={() => setCartOpen(true)}><ShoppingIcon />{count > 0 && <b>{count}</b>}</div></>;
}

function RouteContent({ onAdd, cart, onClear }: { onAdd: (product: typeof products[number]) => void; cart: CartLine[]; onClear: () => void }) {
  const [location] = useLocation();
  useLayoutEffect(() => {
    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {}
  }, [location]);
  const [home] = useRoute("/");
  const [catalogue] = useRoute("/catalogue");
  const [product] = useRoute("/produit/:slug");
  const [produits] = useRoute("/produits/:slug");
  const [productEn] = useRoute("/product/:slug");
  const [checkout] = useRoute("/commande");
  const [doudoune] = useRoute("/doudoune");
  const [doudouneAlt] = useRoute("/doudoune-hiver-luxe");
  const [extensions] = useRoute("/extensions");
  const [extensionsAlt] = useRoute("/extensions-cheveux");
  const [extensionsSilk] = useRoute("/extensions-silk-wave");
  const [abaya] = useRoute("/abaya");
  const [abayaAlt] = useRoute("/abaya-royal-emerald");
  const [manteau] = useRoute("/manteau");
  const [badil] = useRoute("/badil-microblading");
  const [badilShort] = useRoute("/badil");
  const [microblading] = useRoute("/microblading");
  const [pyjama] = useRoute("/pyjama");
  const [pyjamaEte] = useRoute("/pyjama-ete");
  const [pyjamaSensuelle] = useRoute("/pyjama-sensuelle");

  if (catalogue) return <CataloguePage onAdd={onAdd} />;
  if (product || produits || productEn) return <ProductPage onAdd={onAdd} />;
  if (doudoune || doudouneAlt) return <ProductPage onAdd={onAdd} slugOverride="doudoune-hiver-luxe" />;
  if (extensions || extensionsAlt || extensionsSilk) return <ProductPage onAdd={onAdd} slugOverride="extensions-silk-wave" />;
  if (abaya || abayaAlt) return <ProductPage onAdd={onAdd} slugOverride="abaya-royal-emerald" />;
  if (manteau) return <ProductPage onAdd={onAdd} slugOverride="blazer-lilac-dream" />;
  if (badil || badilShort || microblading) return <ProductPage onAdd={onAdd} slugOverride="badil-microblading" />;
  if (pyjama || pyjamaEte || pyjamaSensuelle) return <ProductPage onAdd={onAdd} slugOverride="pyjama-ete" />;
  if (checkout) return <CheckoutPage cart={cart} onClear={onClear} />;
  if (home) return <HomePage onAdd={onAdd} />;
  return <div className="not-found-inline"><h1>Page introuvable.</h1><Link href="/" className="button button-dark">Retour à l'accueil</Link></div>;
}

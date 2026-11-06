import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Heart, MapPin, Minus, Plus, ShieldCheck, Sparkles, Star, Truck, X } from "lucide-react";
import { CartDrawer, ScrollReveal, StoreFooter, StoreHeader, useLanguage } from "@/components/StoreLayout";
import { categories, formatDZD, getCatalogProducts, getProduct, darkHeroImage, beautyImage, products, type CartLine, type CategoryId, type Order, type Product, wilayas } from "@/lib/store-data";
import { trackPixelEvent } from "@/lib/tracking";
import { EmeraldOrder } from "@/components/AbayaOrder";
import { CheckoutDraftNotice } from "@/components/CheckoutDraftNotice";
import { useCheckoutDraft } from "@/components/useCheckoutDraft";
import { submitCheckoutOrder } from "@/lib/checkout-api";
import { getAbayaPhotoLabel, isSuppliedAbayaPhoto } from "@/lib/abaya-gallery";
import CoatLanding from "./CoatLanding";
import AbayaLanding from "./AbayaLanding";
import DoudouneLanding from "./DoudouneLanding";

function ProductCard({ product, onAdd, index = 0 }: { product: typeof products[number]; onAdd: (product: typeof products[number]) => void; index?: number }) {
  const { lang } = useLanguage();
  const name = lang === "ar" && product.arName ? product.arName : product.name;
  const categoryLabel = lang === "ar" && product.arCategoryLabel ? product.arCategoryLabel : product.categoryLabel;
  return <article className="product-card reveal" style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}><Link href={`/produit/${product.slug}`} className="product-image"><img src={product.image} alt={name} /><span className="product-glow" style={{ background: product.accent }} /><span className="product-badge">{product.badge ?? (lang === "ar" ? "اختيار مميز" : "Coup de cœur")}</span><button className="heart-button" onClick={event => { event.preventDefault(); }} aria-label={lang === "ar" ? "إضافة للمفضلة" : "Ajouter aux favoris"}><Heart size={17} /></button></Link><div className="product-info"><div><span className="product-category">{categoryLabel}</span><Link href={`/produit/${product.slug}`}><h3>{name}</h3></Link></div><button className="add-mini" onClick={() => onAdd(product)} aria-label={`${lang === "ar" ? "إضافة" : "Ajouter"} ${name}`}><Plus size={18} /></button></div><div className="product-price"><strong>{formatDZD(product.price)}</strong>{product.oldPrice && <del>{formatDZD(product.oldPrice)}</del>}</div></article>;
}

export function HomePage({ onAdd }: { onAdd: (product: typeof products[number]) => void }) {
  const { lang } = useLanguage();
  const catalog = useCatalogProducts();
  const featuredCatalog = [catalog.find(product => product.id === "p-008"), catalog.find(product => product.id === "p-007"), ...catalog.filter(product => product.id !== "p-007" && product.id !== "p-008").slice(0, 2)].filter((product): product is Product => Boolean(product));
  return <><StoreHeader cartCount={0} onOpenCart={() => window.dispatchEvent(new CustomEvent("open-cart"))} /><main>
    <section className="hero container"><div className="hero-copy"><span className="eyebrow"><Sparkles size={15} /> {lang === "ar" ? "طاقة جديدة لإطلالتك" : "La nouvelle énergie de ton dressing"}</span><h1>{lang === "ar" ? <>تألقي<br /><em>بطريقتك.</em></> : <>Own your<br /><em>glow.</em></>}</h1><p>{lang === "ar" ? "قطع تلفت الأنظار وتفاصيل جمال تغيّر كل شيء. اكتشفي مزاجك مع ميس سنسويل." : "Des pièces qui font tourner les têtes, des détails beauté qui changent tout. Ta vibe, en version Miss Sensuelle."}</p><div className="hero-actions"><Link href="/catalogue" className="button button-dark">{lang === "ar" ? "تسوقي الجديد" : "Shopper les nouveautés"} <ArrowRight size={17} /></Link><Link href="/catalogue?cat=beaute" className="text-link">{lang === "ar" ? "اكتشفي الجمال" : "Voir la beauté"} <ArrowDown size={16} /></Link></div><div className="hero-proof"><div className="avatar-stack"><span>IM</span><span>LK</span><span>SA</span><b>+2k</b></div><span>{lang === "ar" ? <>فتيات في<br /><strong>#MissMood</strong></> : <>filles déjà dans<br /><strong>la #MissMood</strong></>}</span></div></div><div className="hero-visual"><div className="hero-blob blob-one" /><div className="hero-blob blob-two" /><div className="hero-image-frame"><img src={darkHeroImage} alt="Look Miss Sensuelle" /><div className="hero-float-card float-top"><Sparkles size={16} /><span>new energy</span></div><div className="hero-float-card float-bottom"><span>01</span><b>glow<br />edit</b><ArrowRight size={18} /></div><div className="hero-sticker">✦<span>feel<br />pretty</span></div></div></div><div className="hero-scroll"><span>{lang === "ar" ? "مرري لاكتشاف المزيد" : "Scroll to explore"}</span><ArrowDown size={15} /></div></section>
    <section className="marquee"><div className="marquee-track"><span>{lang === "ar" ? "أسلوبك، قواعدك" : "YOUR STYLE, YOUR RULES"}</span><i>✦</i><span>{lang === "ar" ? "توصيل لكل الجزائر" : "LIVRAISON PARTOUT EN ALGÉRIE"}</span><i>✦</i><span>{lang === "ar" ? "الدفع عند الاستلام" : "PAY ON DELIVERY"}</span><i>✦</i><span>{lang === "ar" ? "أسلوبك، قواعدك" : "YOUR STYLE, YOUR RULES"}</span><i>✦</i></div></section>
    <ScrollReveal><section className="section container category-section"><div className="section-heading"><div><span className="eyebrow">{lang === "ar" ? "اكتشفي عوالمنا" : "Tes univers"}</span><h2>{lang === "ar" ? <>اختاري<br /><em>مزاجك.</em></> : <>Choisis ta <em>mood.</em></>}</h2></div><Link href="/catalogue" className="text-link">{lang === "ar" ? "اكتشفي الكل" : "Tout voir"} <ArrowRight size={16} /></Link></div><div className="category-ribbon">{categories.map((category, index) => <Link href={`/catalogue?cat=${category.id}`} className={`category-card category-${category.color}`} key={category.id}><div className="category-copy"><span>{category.kicker}</span><h3>{lang === "ar" ? category.arLabel : category.label}</h3><small>{category.count} <ArrowRight size={13} /></small></div><img src={category.image} alt="" /><b className="category-number">0{index + 1}</b></Link>)}</div></section></ScrollReveal>
    <ScrollReveal><section className="section container featured-section"><div className="section-heading"><div><span className="eyebrow">Sélection Miss</span><h2>Les pièces qui font <em>tilt.</em></h2></div><Link href="/catalogue" className="text-link">Shopper tout <ArrowRight size={16} /></Link></div><div className="product-grid">{featuredCatalog.map((product, index) => <ProductCard key={product.id} product={product} onAdd={onAdd} index={index} />)}</div></section></ScrollReveal>
    <ScrollReveal><section className="editorial container"><div className="editorial-card editorial-lilac"><div className="editorial-copy"><span className="eyebrow">Glow guide</span><h2>Le détail qui change <em>tout.</em></h2><p>Un look simple, une touche de couleur et le bon accessoire. C'est tout ce qu'il faut pour créer ton moment signature.</p><Link href="/catalogue?cat=beaute" className="button button-light">Découvrir la beauty edit <ArrowRight size={16} /></Link></div><div className="editorial-orb orb-a" /><div className="editorial-orb orb-b" /><div className="editorial-shape">✦</div></div><div className="editorial-card editorial-image"><img src={beautyImage} alt="Beauty edit Miss Sensuelle" /><div className="image-caption"><span>the beauty edit</span><strong>soft glam<br />all day</strong></div></div></section></ScrollReveal>
    <ScrollReveal><section className="trust-strip"><div className="container trust-grid"><div><Truck size={22} /><span><b>Livraison Algérie</b>On vient jusqu'à toi</span></div><div><ShieldCheck size={22} /><span><b>Paiement à la livraison</b>Commande sans stress</span></div><div><Clock3 size={22} /><span><b>Confirmation rapide</b>On t'appelle pour valider</span></div></div></section></ScrollReveal>
    <section className="newsletter container"><div><span className="eyebrow">Miss mood mail</span><h2>Un peu de glow<br /><em>dans ta boîte.</em></h2></div><div><p>Les nouveautés, les drops et les petites inspirations beauté. Pas de spam, juste les bons vibes.</p><div className="newsletter-form"><input placeholder="Ton adresse email" /><button className="button button-dark">Je m'inscris <ArrowRight size={16} /></button></div></div></section>
  </main><StoreFooter /></>;
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

function useCatalogProducts() { const [catalog, setCatalog] = useState<Product[]>(products); useEffect(() => setCatalog(getCatalogProducts()), []); return catalog; }

function SearchIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>; }

function ProductPage({ onAdd, slugOverride }: { onAdd: (product: typeof products[number]) => void; slugOverride?: string }) {
  const [, params] = useRoute("/produit/:slug");
  const [, paramsAlt] = useRoute("/produits/:slug");
  const [, paramsEn] = useRoute("/product/:slug");
  const slug = slugOverride ?? params?.slug ?? paramsAlt?.slug ?? paramsEn?.slug ?? "";
  const product = getProduct(slug);
  const isVest = product?.id === "p-001";
  const isEmerald = product?.id === "p-007";
  const isDoudoune = product?.id === "p-008" || product?.slug === "doudoune-hiver-luxe";
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(product?.colors[0] ?? "");
  const gallery = product?.gallery ?? (product ? [product.image] : []);
  const [activeImage, setActiveImage] = useState(gallery[0] ?? "");
  const { lang } = useLanguage();
  useEffect(() => { setActiveImage(gallery[0] ?? ""); }, [params?.slug]);
  useEffect(() => { if (product) trackPixelEvent("ViewContent", { content_type: "product", content_id: product.id, content_ids: [product.id], content_name: product.name, value: product.price, currency: "DZD" }); }, [product?.id]);
  useEffect(() => { document.body.classList.toggle("vest-experience", Boolean(isVest)); return () => document.body.classList.remove("vest-experience"); }, [isVest]);
  if (!product) return <div className="not-found-inline"><h1>Cette pièce a disparu.</h1><Link href="/catalogue" className="button button-dark">Retour à la boutique</Link></div>;
  const displayName = lang === "ar" && product.arName ? product.arName : product.name;
  if (isVest) return <CoatLanding key={product.id} product={product} quantity={quantity} />;
  if (isEmerald) return <AbayaLanding key={product.id} product={product} quantity={quantity} />;
  if (isDoudoune) return <DoudouneLanding key={product.id} product={product} quantity={quantity} />;
  const displayCategory = lang === "ar" && product.arCategoryLabel ? product.arCategoryLabel : product.categoryLabel;
  const displayDescription = lang === "ar" && product.arDescription ? product.arDescription : product.description;
  return <><StoreHeader cartCount={0} onOpenCart={() => window.dispatchEvent(new CustomEvent("open-cart"))} /><main className={`product-page container ${isVest ? "vest-product-page" : ""}`}><Link href="/catalogue" className="back-link"><ArrowLeft size={16} /> Retour à la boutique</Link><div className="product-detail"><div className="detail-visual"><div className="detail-image"><img src={activeImage} alt={displayName} /><span style={{ background: product.accent }} /></div><div className="gallery-heading"><span>{lang === "ar" ? "صور المنتج" : "Photos du produit"}</span><b>{gallery.length} {lang === "ar" ? "صور" : "vues"}</b></div><div className="product-gallery">{gallery.map((image, index) => <button key={`${image}-${index}`} className={activeImage === image ? "active" : ""} onClick={() => setActiveImage(image)} aria-label={`Voir la photo ${index + 1}`}><img src={image} alt="" /></button>)}</div><div className="detail-note"><Sparkles size={16} /> {lang === "ar" ? "قطعة مختارة بحب من ميس سنسويل" : "Pièce choisie avec amour par Miss Sensuelle"}</div><a className="button button-gradient start-now-button start-now-under-gallery" href="#order" onClick={() => trackPixelEvent("InitiateCheckout", { content_ids: [product.id], value: product.price, currency: "DZD" })}>{lang === "ar" ? "ابدئي الآن" : "Commencer maintenant"} <ArrowRight size={18} /></a></div><div className="detail-copy"><span className="product-category">{displayCategory}</span><div className="detail-title-row"><h1>{displayName}</h1><button className="heart-button static"><Heart size={20} /></button></div><div className="detail-rating"><span><Star size={14} fill="currentColor" /> 4.9</span><small>·</small><span>{lang === "ar" ? "18 تقييم" : "18 avis"}</span></div><div className="detail-price"><strong>{formatDZD(product.price)}</strong>{product.oldPrice && <del>{formatDZD(product.oldPrice)}</del>}</div><p className="detail-description">{displayDescription}</p><div className="detail-option"><span>{lang === "ar" ? "اللون" : "Couleur"} <b>{selectedColor}</b></span><div className="color-options">{product.colors.map((color, index) => <button key={color} className={selectedColor === color ? "selected" : ""} onClick={() => setSelectedColor(color)}><i style={{ background: ["#9B82F6", "#F2E7D7", "#79B5FF", "#1D2433", "#C87B5B", "#F7DC5A"][index % 6] }} />{color}</button>)}</div></div><div className="detail-option"><span>{lang === "ar" ? "الكمية" : "Quantité"}</span><div className="quantity-control"><button onClick={() => setQuantity(value => Math.max(1, value - 1))}><Minus size={16} /></button><b>{quantity}</b><button onClick={() => setQuantity(value => value + 1)}><Plus size={16} /></button></div></div><div className="delivery-card"><div><Truck size={18} /><span><b>{lang === "ar" ? "توصيل في كل الجزائر" : "Livraison partout en Algérie"}</b>{lang === "ar" ? "نتصل بك للتأكيد" : "On te contacte pour confirmer"}</span></div><div><ShieldCheck size={18} /><span><b>{lang === "ar" ? "الدفع عند الاستلام" : "Paiement à la livraison"}</b>{lang === "ar" ? "ادفعي عند استلام طلبك" : "Tu paies à la réception"}</span></div></div><div className="detail-accordion"><details open><summary>{lang === "ar" ? "عن هذه القطعة" : "À propos de cette pièce"} <ChevronDown size={16} /></summary><ul>{product.details.map(detail => <li key={detail}><Check size={15} />{detail}</li>)}</ul></details><details><summary>{lang === "ar" ? "التوصيل والاسترجاع" : "Livraison & retours"} <ChevronDown size={16} /></summary><p>{lang === "ar" ? "نتواصل معك بعد تأكيد الطلب لتنظيم التوصيل حسب ولايتك." : "La livraison est organisée avec toi après confirmation téléphonique. On t'indique le délai selon ta wilaya."}</p></details></div></div></div>{isVest && <VestSalesSections product={product} />}<ProductOrderFlow product={product} /><ProductFAQ product={product} /></main><StoreFooter /></>;
}
function ShoppingIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8h12l1 12H5L6 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg>; }

function ProductOrderFlow({ product }: { product: typeof products[number] }) {
  const { lang } = useLanguage();
  const [color, setColor] = useState(product.colors[0] ?? "");
  const [delivery, setDelivery] = useState("home");
  const [selectedWilaya, setSelectedWilaya] = useState("");
  const [sent, setSent] = useState(false);
  const communeOptions = selectedWilaya ? ["Centre-ville", "Nouvelle ville", "Centre", "Hydra", "El Eulma", "Akid Lotfi", "Autre commune"] : [];
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customer = String(form.get("flow-customer") || "Cliente Miss Sensuelle");
    const phone = String(form.get("flow-phone") || "");
    const wilaya = String(form.get("flow-wilaya") || "");
    const commune = String(form.get("flow-commune") || "");
    const address = String(form.get("flow-address") || "");
    const note = delivery === "office" ? "Livraison au bureau" : "Livraison à domicile";
    let serverOrderNumber = `MS-${Math.floor(1000 + Math.random() * 8999)}`;
    try {
      const token = globalThis.crypto?.randomUUID?.() ?? `00000000-0000-4000-8000-${String(Date.now()).padStart(12, "0").slice(-12)}`;
      const res = await submitCheckoutOrder(token, {
        source: "product",
        customer,
        phone,
        wilaya,
        commune,
        address,
        note,
        delivery: delivery === "office" ? "office" : "home",
        items: [{ productId: product.id, quantity: 1, color, size: "" }],
      });
      serverOrderNumber = res.orderNumber;
    } catch { /* fallback local */ }
    const order: Order = { id: serverOrderNumber, createdAt: new Date().toISOString(), customer, phone, product: `${product.name} · ${color}`, quantity: 1, total: product.price, wilaya, commune, address, note, status: "nouvelle" };
    try { const existing = JSON.parse(localStorage.getItem("miss-sensuelle-orders") || "[]") as Order[]; localStorage.setItem("miss-sensuelle-orders", JSON.stringify([order, ...existing])); } catch { /* confirmation visuelle conservée */ }
    trackPixelEvent("Purchase", { content_ids: [product.id], value: product.price, currency: "DZD", order_id: serverOrderNumber });
    setSent(true);
  };
  return <section className="product-order-flow" id="order"><div className="flow-intro"><span className="eyebrow">02 · {lang === "ar" ? "الطلب المباشر" : "Commande directe"}</span><h2>{lang === "ar" ? <>اطلبيها<br /><em>بكل سهولة.</em></> : <>Commande-la<br /><em>en quelques gestes.</em></>}</h2><p>{lang === "ar" ? "أدخلي معلوماتك، اختاري اللون وطريقة التوصيل. سيظهر المبلغ قبل الإرسال." : "Renseigne tes informations, choisis ta couleur et ton mode de livraison. Le total est clair avant l'envoi."}</p><div className="flow-steps"><span className="active"><b>01</b>{lang === "ar" ? "معلوماتك" : "Tes infos"}</span><i /><span><b>02</b>{lang === "ar" ? "اللون" : "Ta couleur"}</span><i /><span><b>03</b>{lang === "ar" ? "التوصيل" : "Livraison"}</span></div></div><div className="flow-layout"><form className="flow-form" onSubmit={submit}>{sent ? <div className="flow-success"><div>✦</div><span>{lang === "ar" ? "شكراً! تم تسجيل طلبك." : "Merci, ta commande est bien enregistrée."}</span><small>{lang === "ar" ? "سنتصل بك قريباً لتأكيدها." : "On t'appelle très vite pour la confirmer."}</small></div> : <><section className="flow-card"><div className="flow-card-title"><b>01</b><div><h3>{lang === "ar" ? "معلومات التواصل" : "Informations de contact"}</h3><p>{lang === "ar" ? "أدخلي بيانات استلام طلبك" : "Pour pouvoir te joindre et préparer ton colis"}</p></div></div><div className="flow-fields"><input name="flow-customer" required placeholder={lang === "ar" ? "الاسم الكامل" : "Nom complet"} /><input name="flow-phone" required pattern="[0-9 +()-]{8,}" placeholder={lang === "ar" ? "رقم الهاتف" : "Numéro de téléphone"} /><select name="flow-wilaya" required value={selectedWilaya} onChange={event => { setSelectedWilaya(event.target.value); }}><option value="" disabled>{lang === "ar" ? "اختاري الولاية" : "Choisis ta wilaya"}</option>{wilayas.map(w => <option key={w}>{w}</option>)}</select><select key={selectedWilaya} name="flow-commune" required defaultValue=""><option value="" disabled>{lang === "ar" ? "اختاري البلدية" : "Choisis ta commune"}</option>{communeOptions.map(commune => <option key={commune}>{commune}</option>)}</select><textarea name="flow-address" placeholder={lang === "ar" ? "عنوان إضافي (اختياري)" : "Adresse complémentaire (facultative)"} /></div></section><section className="flow-card"><div className="flow-card-title"><b>02</b><div><h3>{lang === "ar" ? "اختاري اللون" : "Choisis ta couleur"}</h3><p>{lang === "ar" ? "اختيارك يحدد القطعة التي سنجهزها" : "La couleur sélectionnée sera préparée dans ton colis"}</p></div></div><div className="flow-choice-grid">{product.colors.map((item, index) => <button type="button" key={item} className={color === item ? "selected" : ""} onClick={() => setColor(item)}><i style={{ background: ["#9B82F6", "#F2E7D7", "#79B5FF", "#1D2433", "#F7DC5A"][index % 5] }} />{item}</button>)}</div></section><section className="flow-card"><div className="flow-card-title"><b>03</b><div><h3>{lang === "ar" ? "طريقة التوصيل" : "Mode de livraison"}</h3><p>{lang === "ar" ? "اختاري المكان الأنسب لاستلام طلبك" : "Choisis l'endroit le plus pratique pour toi"}</p></div></div><div className="delivery-choice"><button type="button" className={delivery === "home" ? "selected" : ""} onClick={() => setDelivery("home")}><MapPin size={18} /><span><b>{lang === "ar" ? "إلى المنزل" : "À domicile"}</b><small>{lang === "ar" ? "نوصّل طلبك إلى عنوانك" : "On vient jusqu'à ton adresse"}</small></span></button><button type="button" className={delivery === "office" ? "selected" : ""} onClick={() => setDelivery("office")}><PackageIcon /><span><b>{lang === "ar" ? "إلى المكتب" : "Au bureau"}</b><small>{lang === "ar" ? "توصيل إلى مقر العمل" : "Livraison sur ton lieu de travail"}</small></span></button></div></section><button className="button button-gradient flow-submit" type="submit">{lang === "ar" ? "أرسلي طلبي الآن" : "Envoyer ma commande"} <ArrowRight size={17} /></button></>}</form><aside className="flow-summary"><span className="eyebrow">{lang === "ar" ? "ملخص الطلب" : "Résumé de la commande"}</span><div className="summary-product"><img src={product.image} alt="" /><div><strong>{product.name}</strong><span>{lang === "ar" ? "اللون المفضل" : "Couleur choisie"} : {color}</span></div></div><div className="summary-lines"><div><span>{lang === "ar" ? "سعر المنتج" : "Prix du produit"}</span><b>{formatDZD(product.price)}</b></div><div><span>{lang === "ar" ? "التوصيل" : "Livraison"}</span><b>{lang === "ar" ? "يحدد حسب الولاية" : "Selon ta wilaya"}</b></div><div className="summary-total"><span>{lang === "ar" ? "المبلغ الإجمالي" : "Total"}</span><strong>{formatDZD(product.price)}</strong></div></div><div className="cod-note"><ShieldCheck size={17} /><span><b>{lang === "ar" ? "الدفع عند الاستلام" : "Paiement à la livraison"}</b>{lang === "ar" ? "لن تدفعي شيئاً الآن" : "Tu ne paies rien maintenant"}</span></div></aside></div></section>;
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
  return <><StoreHeader cartCount={cart.reduce((sum, line) => sum + line.quantity, 0)} onOpenCart={() => {}} /><main className="checkout-page container"><Link href="/catalogue" className="back-link"><ArrowLeft size={16} /> Retour à la boutique</Link><div className="checkout-layout"><div><span className="eyebrow">Dernière étape</span><h1>On prépare ton<br /><em>colis.</em></h1><p className="checkout-intro">Remplis tes infos et on t'appelle pour confirmer. Paiement à la livraison, zéro stress.</p><form className="checkout-form" onSubmit={submit}><div className="form-section"><div className="form-section-title"><span>01</span><div><h3>Tes coordonnées</h3><p>Pour qu'on puisse te joindre facilement</p></div></div><div className="field-grid"><label>Nom complet<input name="customer" required placeholder="Ex. Imane Benali" /></label><label>Téléphone<input name="phone" required pattern="[0-9 +()-]{8,}" placeholder="05 50 00 00 00" /></label></div></div><div className="form-section"><div className="form-section-title"><span>02</span><div><h3>Où te livrer ?</h3><p>La livraison arrive jusqu'à ta porte</p></div></div><div className="field-grid"><label>Wilaya<select name="wilaya" required defaultValue=""><option value="" disabled>Choisir ta wilaya</option>{wilayas.map(wilaya => <option key={wilaya}>{wilaya}</option>)}</select></label><label>Commune<input name="commune" required placeholder="Ex. Hydra" /></label></div><label>Adresse complète<input name="address" required placeholder="Rue, cité, bâtiment, étage..." /></label><label>Note pour la livraison <span className="optional">Optionnel</span><textarea name="note" rows={3} placeholder="Une précision pour notre équipe ?" /></label></div><button className="button button-gradient full checkout-submit" type="submit">Confirmer ma commande <ArrowRight size={17} /></button></form></div><aside className="checkout-summary"><span className="eyebrow">Ton récap'</span><h3>Les pièces choisies</h3><div className="checkout-lines">{cart.length ? cart.map(line => <div className="checkout-line" key={line.id}><img src={line.image} alt="" /><div><strong>{line.name}</strong><span>Qté {line.quantity}</span></div><b>{formatDZD(line.price * line.quantity)}</b></div>) : <p>Ton panier est vide. <Link href="/catalogue">Retourner à la boutique</Link></p>}</div><div className="summary-total"><span>Total à payer</span><strong>{formatDZD(total)}</strong></div><div className="cod-note"><ShieldCheck size={17} /><span><b>Paiement à la livraison</b>Tu paies uniquement quand tu reçois ton colis.</span></div></aside></div></main><StoreFooter /></>;
}

export default function Storefront({ cart, onAdd, onUpdate, onClear }: { cart: CartLine[]; onAdd: (product: typeof products[number]) => void; onUpdate: (id: string, delta: number) => void; onClear: () => void }) {
  const [cartOpen, setCartOpen] = useState(false);
  useEffect(() => { const handler = () => setCartOpen(true); window.addEventListener("open-cart", handler); return () => window.removeEventListener("open-cart", handler); }, []);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const addAndOpen = (product: typeof products[number]) => { onAdd(product); setCartOpen(true); };
  return <><RouteContent onAdd={addAndOpen} cart={cart} onClear={onClear} /><CartDrawer cart={cart} open={cartOpen} onClose={() => setCartOpen(false)} onUpdate={onUpdate} onCheckout={() => { setCartOpen(false); window.location.href = "/commande"; }} /><div className="mobile-cart-trigger" onClick={() => setCartOpen(true)}><ShoppingIcon />{count > 0 && <b>{count}</b>}</div></>;
}

function RouteContent({ onAdd, cart, onClear }: { onAdd: (product: typeof products[number]) => void; cart: CartLine[]; onClear: () => void }) {
  const [home] = useRoute("/");
  const [catalogue] = useRoute("/catalogue");
  const [product] = useRoute("/produit/:slug");
  const [produits] = useRoute("/produits/:slug");
  const [productEn] = useRoute("/product/:slug");
  const [checkout] = useRoute("/commande");
  const [doudoune] = useRoute("/doudoune");
  const [doudouneAlt] = useRoute("/doudoune-hiver-luxe");
  const [abaya] = useRoute("/abaya");
  const [abayaAlt] = useRoute("/abaya-royal-emerald");
  const [manteau] = useRoute("/manteau");

  if (catalogue) return <CataloguePage onAdd={onAdd} />;
  if (product || produits || productEn) return <ProductPage onAdd={onAdd} />;
  if (doudoune || doudouneAlt) return <ProductPage onAdd={onAdd} slugOverride="doudoune-hiver-luxe" />;
  if (abaya || abayaAlt) return <ProductPage onAdd={onAdd} slugOverride="abaya-royal-emerald" />;
  if (manteau) return <ProductPage onAdd={onAdd} slugOverride="blazer-lilac-dream" />;
  if (checkout) return <CheckoutPage cart={cart} onClear={onClear} />;
  if (home) return <HomePage onAdd={onAdd} />;
  return <div className="not-found-inline"><h1>Page introuvable.</h1><Link href="/" className="button button-dark">Retour à l'accueil</Link></div>;
}

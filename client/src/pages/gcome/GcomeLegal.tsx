import { Link } from "wouter";
import { FileCheck2, Lock, RotateCcw } from "lucide-react";
import { GcomeShell } from "@/components/gcome/GcomeShell";
import { useGcomeLang } from "@/lib/gcome-i18n";
import { gcomeHref } from "@/lib/gcome-routing";

export type LegalDocKind = "cgu" | "privacy" | "refund";

export default function GcomeLegal({ kind }: { kind: LegalDocKind }) {
  const { tx } = useGcomeLang();

  const meta =
    kind === "cgu"
      ? {
          icon: FileCheck2,
          title: tx("Conditions Générales d'Utilisation (CGU)", "شروط الاستخدام العامة"),
          updated: "26/11/2026",
          sections: [
            {
              h: tx("1. Objet de la plateforme GCOME", "1. موضوع منصة GCOME"),
              p: tx(
                "GCOME est une solution SaaS e-commerce 3 en 1 (boutiques & landing pages, gestion des commandes et équipe de confirmation, expédition & Finance IA) dédiée aux marchands.",
                "GCOME هي منصة تجارة إلكترونية 3 في 1 تجمع المتجر، فريق التأكيد، التوصيل، والمالية الذكية."
              ),
            },
            {
              h: tx("2. Accès, essais & abonnements", "2. الحسابات والاشتراكات"),
              p: tx(
                "Les offres Starter et Pro incluent une période d'essai gratuit de 14 jours. Le marchand demeure seul responsable de l'exactitude des produits vendus, des prix en Dinars et de la livraison aux clients.",
                "تتضمن باقات Starter و Pro فترة تجربة مجانية 14 يوماً. يبقى التاجر مسؤولاً عن جودة منتجاته والالتزام بتسليم الطلبات."
              ),
            },
            {
              h: tx("3. Disponibilité & API tierces", "3. التوفر وربط شركات التوصيل"),
              p: tx(
                "GCOME s'appuie sur les clés API renseignées par le marchand (Meta, TikTok, EcoTrack/DHD, E-com Delivery, Google Sheets). La plateforme optimise les appels et quotas mais ne saurait être tenue responsable des maintenances des opérateurs tiers.",
                "تعتمد المنصة على مفاتيح الربط الخاصة بالتاجر (فيسبوك، تيك توك، شركات التوصيل). تضمن المنصة حماية البيانات وأداء السيرفر بأقصى كفاءة."
              ),
            },
          ],
        }
      : kind === "privacy"
        ? {
            icon: Lock,
            title: tx("Politique de Confidentialité", "سياسة الخصوصية وحماية البيانات"),
            updated: "26/11/2026",
            sections: [
              {
                h: tx("1. Données collectées", "1. البيانات المجمعة"),
                p: tx(
                  "Seules les données nécessaires au traitement des commandes (nom, téléphone, adresse de livraison, montants) et à la facturation d'abonnement sont traitées de façon cloisonnée.",
                  "تُستخدم بيانات الزبائن حصرياً لتأكيد وشحن الطلبات، وتحظى بيانات كل متجر بحماية وتشفير كامل."
                ),
              },
              {
                h: tx("2. Pixels & CAPI Serveur", "2. البيكسل وتقنية CAPI"),
                p: tx(
                  "Les identifiants personnels transmis à Meta Conversions API (CAPI) ou TikTok Events API sont hachés en SHA-256 avant envoi et exclusivement dédiés à la mesure publicitaire du marchand.",
                  "يتم تشفير بيانات المشتري بتقنية SHA-256 قبل إرسالها إلى فيسبوك وتيك توك لضمان الخصوصية الكاملة."
                ),
              },
              {
                h: tx("3. Conservation & droits", "3. الاحتفاظ بالبيانات وحقوقك"),
                p: tx(
                  "Tu peux exporter tes commandes au format CSV ou demander la suppression de tes données d'inscription à tout moment.",
                  "يمكنك تصدير بياناتك بصيغة CSV أو طلب حذف حسابك وبياناتك في أي وقت."
                ),
              },
            ],
          }
        : {
            icon: RotateCcw,
            title: tx("Politique de Remboursement & Annulation", "سياسة الإلغاء والاسترجاع"),
            updated: "26/11/2026",
            sections: [
              {
                h: tx("1. Période d'essai gratuit", "1. الفترة التجريبية المجانية"),
                p: tx(
                  "Pendant les 14 jours d'essai gratuit, tu peux tester librement GCOME et annuler sans aucun frais.",
                  "خلال 14 يوماً من التجربة المجانية، يمكنك الإلغاء في أي وقت بدون أي رسوم."
                ),
              },
              {
                h: tx("2. Annulation d'abonnement", "2. إلغاء الاشتراك الشهري أو السنوي"),
                p: tx(
                  "Tu peux rétrograder ou annuler ton abonnement depuis la section Abonnement de ton tableau de bord. L'accès reste actif jusqu'à la fin de la période déjà réglée.",
                  "يمكنك تعديل أو إلغاء اشتراكك من صفحة الاشتراك في لوحة التحكم، ويستمر وصولك لنهاية المدة المدفوعة."
                ),
              },
              {
                h: tx("3. Erreur de paiement Chargily / CCP", "3. في حال خطأ الدفع عبر الذهبية أو CCP"),
                p: tx(
                  "En cas de double débit technique ou d'erreur de virement vérifiée, le remboursement ou crédit de période est traité sous 48 à 72h ouvrées.",
                  "في حال تكرار الدفع تقنياً، يتم التحقق وإعادة المبلغ أو تمديد الاشتراك خلال 48 إلى 72 ساعة عمل."
                ),
              },
            ],
          };

  const Icon = meta.icon;

  return (
    <GcomeShell
      activeTab="pricing"
      titleFr={`${meta.title} · GCOME`}
      titleAr={`${meta.title} · GCOME`}
      descriptionFr={meta.title}
      descriptionAr={meta.title}
    >
      <section className="gc-section" style={{ paddingTop: 26 }}>
        <div className="gcome-container" style={{ maxWidth: 780 }}>
          <div className="gc-card" style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 42, height: 42, borderRadius: 14, background: "var(--gc-surface-muted)", color: "var(--gc-primary)", display: "grid", placeItems: "center" }}>
                <Icon size={20} />
              </span>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900 }}>{meta.title}</h1>
                <small style={{ color: "var(--gc-text-muted)", fontSize: 12 }}>
                  {tx(`Dernière mise à jour : ${meta.updated}`, `آخر تحديث: ${meta.updated}`)}
                </small>
              </div>
            </div>

            {meta.sections.map((sec, idx) => (
              <div key={idx} style={{ paddingTop: 10, borderTop: "1px solid var(--gc-border)" }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>{sec.h}</h2>
                <p style={{ fontSize: 13.8, lineHeight: 1.65, color: "var(--gc-text-muted)" }}>{sec.p}</p>
              </div>
            ))}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, paddingTop: 8 }}>
              <Link href={gcomeHref("/cgu")} className="gc-pill-btn">
                {tx("CGU", "الشروط")}
              </Link>
              <Link href={gcomeHref("/confidentialite")} className="gc-pill-btn">
                {tx("Confidentialité", "الخصوصية")}
              </Link>
              <Link href={gcomeHref("/remboursement")} className="gc-pill-btn">
                {tx("Remboursement", "الاسترجاع")}
              </Link>
              <Link href={gcomeHref("/tarifs")} className="gc-pill-btn is-primary">
                {tx("Retour aux tarifs", "العودة للأسعار")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </GcomeShell>
  );
}

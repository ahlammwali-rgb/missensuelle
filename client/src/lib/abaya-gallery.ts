export const abayaPhotoReplacements = [
  {
    index: 0,
    before: "/manus-storage/v-hero_de8d807e.jpg",
    after: "/manus-storage/1000013380_bec708f3.jpg",
    fr: "Abaya noire — vue de face",
    ar: "العباية السوداء — أمام",
  },
  {
    index: 1,
    before: "/manus-storage/v-t1_a8d96eaa.jpg",
    after: "/manus-storage/1000013441_32a2f5a7.jpg",
    fr: "Détails des broderies",
    ar: "تفاصيل التطريز",
  },
  {
    index: 3,
    before: "/manus-storage/v-t3_94820277.jpg",
    after: "/manus-storage/1000013443_62a3a920.jpg",
    fr: "Abaya verte — détails portés",
    ar: "العباية الخضراء — تفاصيل الإطلالة",
  },
] as const;

/** Ne remplace que les images et positions explicitement annotées. */
export function replaceAnnotatedAbayaPhotos(gallery: string[]): string[] {
  return gallery.map((image, index) => {
    const replacement = abayaPhotoReplacements.find(item => item.index === index && item.before === image);
    return replacement?.after ?? image;
  });
}

export function isSuppliedAbayaPhoto(image: string): boolean {
  return abayaPhotoReplacements.some(item => item.after === image);
}

export function getAbayaPhotoLabel(image: string, index: number, lang: "fr" | "ar"): string {
  const replacement = abayaPhotoReplacements.find(item => item.after === image);
  if (replacement) return replacement[lang];
  const labels = ["العباية - أمام", "العباية - خلف", "الجمبسوت - أمام", "الجمبسوت - خلف", "تفاصيل القماش"];
  return labels[index] ?? (lang === "ar" ? "صورة المنتج" : "Photo du produit");
}

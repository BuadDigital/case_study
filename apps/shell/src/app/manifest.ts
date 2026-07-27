import type { MetadataRoute } from "next";

/** Web app manifest for installable shell (field inspector PWA + all roles). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "نظام إجادة الداخلي",
    short_name: "إجادة",
    description:
      "نظام إجادة الداخلي — المهام التشغيلية، ظروف المفاتيح، والمعاملات.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    lang: "ar",
    dir: "rtl",
    background_color: "#f5f3ee",
    theme_color: "#102b4e",
    categories: ["business", "productivity"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "معاينة العقار",
        short_name: "معاينة",
        description: "قائمة معاينات الميدان",
        url: "/property-inspection?source=pwa",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "المهام",
        short_name: "مهام",
        url: "/operations-tasks?source=pwa",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "إدارة التعذرات",
        short_name: "تعذرات",
        url: "/failures?source=pwa",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}

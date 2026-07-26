import type { MetadataRoute } from "next";

/** Web app manifest for installable shell (government reviewer PWA + all roles). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "نظام إجادة الداخلي",
    short_name: "إجادة",
    description:
      "نظام إجادة الداخلي — المهام التشغيلية، ظروف المفاتيح، والمعاملات.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    lang: "ar",
    dir: "rtl",
    background_color: "#f5f3ee",
    theme_color: "#102b4e",
    categories: ["business", "productivity"],
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
  };
}

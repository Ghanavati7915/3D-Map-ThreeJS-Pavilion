
import tailwindcss from "@tailwindcss/vite";
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
    ssr:false,
    css: ["@/assets/css/main.css", "@/assets/css/font.css"],
    modules: ["cap-module","@nuxt/icon","@nuxtjs/device"],
    icon: {
        provider: "none",
        collections: [
            { id: "solar", icons: () => import("@iconify-json/solar/icons.json") },
            { id: "ph", icons: () => import("@iconify-json/ph/icons.json") },
            { id: "lucide", icons: () => import("@iconify-json/lucide/icons.json") },
        ],
        serverBundle: "local",
        clientBundle: { scan: true },
    },
    vite: {plugins: [tailwindcss()],assetsInclude: ['**/*.glb']},
  devServer: {
    port: 3000
  }
})
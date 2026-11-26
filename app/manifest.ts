import type { MetadataRoute } from "next";

// Makes Life OS installable: Chrome / Edge offer "Install Life OS", which adds a
// desktop + Start-menu shortcut and opens the app in its own window.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Life OS",
    short_name: "Life OS",
    description: "Goals, tasks and habits — know exactly what to do today.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

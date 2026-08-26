import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: ".",
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ["pdfjs-dist"],
  },
  server: {
    port: 3000,
    // Backend chỉ cho phép CORS từ đúng http://localhost:3000. Mặc định Vite thấy cổng 3000
    // bận thì lặng lẽ nhảy sang 3001, và mọi lời gọi API sau đó bị CORS chặn với thông báo
    // khó hiểu. strictPort làm Vite báo lỗi ngay để biết cổng đang bị chiếm.
    strictPort: true,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-math": ["katex", "qrcode", "react-to-print"],
          "vendor-ui": [
            "lucide-react",
            "@radix-ui/react-slot",
            "class-variance-authority",
            "clsx",
            "tailwind-merge",
          ],
        },
      },
    },
  },
});

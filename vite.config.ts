import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // ✅ Add this
  server: {
    host: true, // allows access from phone on same Wi-Fi
    port: 5173,
    proxy: {
      // ✅ API calls from frontend like /api/... will be forwarded to backend
      "/api": {
        target: "http://localhost:4000", // <-- change 4000 to your backend port
        changeOrigin: true,
        secure: false,
      },

      // ✅ so guest photos /uploads/... also work on phone
      "/uploads": {
        target: "http://localhost:4000", // same backend
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
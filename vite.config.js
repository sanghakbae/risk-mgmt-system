import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/risk-mgmt-system/",
  plugins: [react()],
});
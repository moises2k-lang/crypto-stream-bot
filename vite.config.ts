import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React libraries
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            // Radix UI components split by type
            if (id.includes('@radix-ui')) {
              if (id.includes('dialog') || id.includes('dropdown') || id.includes('toast')) {
                return 'ui-core';
              }
              return 'ui-extended';
            }
            // Charts library separate chunk
            if (id.includes('recharts')) {
              return 'charts';
            }
            // i18n separate chunk
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'i18n';
            }
            // Supabase separate chunk
            if (id.includes('@supabase')) {
              return 'supabase';
            }
            // Other node_modules
            return 'vendor';
          }
        },
      },
    },
  },
}));

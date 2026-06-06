import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { UserConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    build: {
        chunkSizeWarningLimit: 600,
        rollupOptions: {
            output: {
                manualChunks: {
                    // Firebase core — loaded on every page
                    'firebase-core': ['firebase/app', 'firebase/auth'],
                    // Firestore — loaded on most pages but separately
                    'firebase-firestore': ['firebase/firestore'],
                    // Storage — only on photo/upload pages
                    'firebase-storage': ['firebase/storage'],
                    // Charts — only on Dashboard
                    'charts': ['recharts'],
                    // PDF generation — only on Print pages
                    'pdf': ['html2pdf.js', 'pdf-lib'],
                    // Stable React vendor chunk
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    // UI utilities
                    'vendor-ui': ['lucide-react', 'react-hot-toast', 'clsx', 'tailwind-merge'],
                },
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        coverage: {
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'src/test/'],
        },
    },
});

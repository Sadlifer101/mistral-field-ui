import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ mode }) => {
  // Development-only visual preview (npm run dev:preview --mode preview).
  // The Convex data layer is replaced by synthetic fixtures so the existing
  // screens can be inspected without authentication. Never applied to the
  // normal dev server (mode "development") or a production build.
  const previewAliases =
    mode === 'preview'
      ? [
          {
            find: /^convex\/react$/,
            replacement: path.resolve(__dirname, 'src/preview/convex-react-shim.ts'),
          },
          {
            find: /^@convex-dev\/auth\/react$/,
            replacement: path.resolve(__dirname, 'src/preview/auth-react-shim.ts'),
          },
          {
            find: /^@convex-dev\/auth\/methods\/google\/react$/,
            replacement: path.resolve(__dirname, 'src/preview/auth-react-shim.ts'),
          },
        ]
      : [];

  return {
    appType: 'spa' as const,
    plugins: [
      react(),
      tailwindcss(),
      {
        // `/nurse` is an in-app route (see readNurseSurface in src/App.tsx), but
        // the dev-only preview harness is served from nurse.html at the project
        // root. Vite's html fallback resolves an extension-less /nurse to
        // nurse.html when that file exists, which shadowed the real field-unit
        // entry point and rendered the harness instead of the app. Rewriting the
        // route to index.html here keeps both URLs working:
        //   /nurse        -> the real app (Convex auth)
        //   /nurse.html   -> the fixture-only preview harness
        name: 'nurse-route-entry',
        apply: 'serve' as const,
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            const url = req.url ?? '';
            if (/^\/nurse(?:[/?#]|$)/.test(url)) {
              req.url = `/index.html${url.slice('/nurse'.length)}`;
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: [
        ...previewAliases,
        { find: '@convex', replacement: path.resolve(__dirname, '../../convex/_generated') },
        { find: '@', replacement: path.resolve(__dirname, '.') },
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      fs: {
        allow: ['../..'],
      },
    },
  };
});

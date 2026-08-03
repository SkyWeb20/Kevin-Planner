# TubeMaster

TubeMaster is a Chrome extension scaffold built with Vite, Vue 3, TypeScript, and Vuetify.

## Development

Install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

## Build the extension

```bash
npm run build
```

Chrome loads extensions from the built `dist` directory:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose `dist`.

The Manifest V3 configuration is in `public/manifest.json`; the service worker source is `src/background.ts`.

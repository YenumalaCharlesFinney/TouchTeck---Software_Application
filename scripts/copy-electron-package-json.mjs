// electron/*.ts compiles to CommonJS under dist-electron/, but the repo root
// package.json declares "type":"module" — without a nested package.json
// pinning dist-electron/ back to commonjs, Node would try to parse the
// compiled main.js/preload.js as ESM and fail immediately on startup.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist-electron', { recursive: true });
copyFileSync('electron/package.json', 'dist-electron/package.json');

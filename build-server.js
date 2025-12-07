import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

const externalPackages = Object.keys(pkg.dependencies || {}).filter(dep => {
  return dep !== '@nupidentity/sdk';
});

await esbuild.build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  outdir: 'dist',
  format: 'esm',
  external: externalPackages,
  minify: false,
  sourcemap: false,
  target: 'node20',
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});

console.log('✅ Server build complete (SDK bundled)');

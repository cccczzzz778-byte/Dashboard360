import { access, copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const runtimeAssets = [
  'maplibre-gl.css',
  'maplibre-gl.mjs',
  'maplibre-gl-worker.mjs',
  'maplibre-gl-shared.mjs'
] as const;

export async function ensureMapLibreVendorAssets(root = process.cwd()): Promise<void> {
  const sourceDir = join(root, 'node_modules', 'maplibre-gl', 'dist');
  const targetDir = join(root, 'public', 'vendor', 'maplibre');
  await mkdir(targetDir, { recursive: true });

  for (const file of runtimeAssets) {
    const source = join(sourceDir, file);
    await access(source);
    await copyFile(source, join(targetDir, file));
  }
}

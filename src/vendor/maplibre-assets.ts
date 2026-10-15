import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function ensureMapLibreVendorAssets(root = process.cwd()): Promise<void> {
  const source = path.join(process.cwd(), 'node_modules', 'maplibre-gl', 'dist');
  const target = path.join(root, 'public', 'vendor', 'maplibre');
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true, force: true });
}

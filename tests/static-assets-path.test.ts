import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolvePublicDir } from '../src/app.js';

test('production build resolves static assets from project-level public directory', () => {
  const root = path.join('/app');
  assert.equal(resolvePublicDir(root), path.join(root, 'public'));
});

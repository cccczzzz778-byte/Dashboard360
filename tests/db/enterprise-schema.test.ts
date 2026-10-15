import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const schemaUrl = new URL('../../src/db/enterprise-schema.ts', import.meta.url);

test('enterprise schema is additive and creates required core tables and indexes', () => {
  assert.ok(existsSync(schemaUrl), 'src/db/enterprise-schema.ts must exist');
  const sqlSource = readFileSync(schemaUrl, 'utf8').toLowerCase();

  for (const table of [
    'users',
    'user_scopes',
    'sessions',
    'integration_sources',
    'integration_runs',
    'risk_scores',
    'risk_factors',
    'alerts'
  ]) {
    assert.match(sqlSource, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+${table}\\b`), `missing additive table ${table}`);
  }

  assert.match(sqlSource, /create\s+index\s+if\s+not\s+exists[\s\S]*sessions[\s\S]*(expires|last_seen)/);
  assert.match(sqlSource, /create\s+index\s+if\s+not\s+exists[\s\S]*integration_runs[\s\S]*(source|started|finished|success)/);
  assert.match(sqlSource, /create\s+index\s+if\s+not\s+exists[\s\S]*risk_scores[\s\S]*(institution|calculated)/);
  assert.match(sqlSource, /create\s+index\s+if\s+not\s+exists[\s\S]*alerts[\s\S]*(status|severity|created|updated)/);

  assert.doesNotMatch(sqlSource, /\bdrop\s+(table|column|index)\b/);
  assert.doesNotMatch(sqlSource, /\btruncate\b/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { hardenHttpServer } from '../../src/runtime/http.js';

test('http server uses bounded production timeouts and header limits', () => {
  const server = hardenHttpServer(http.createServer());
  assert.equal(server.requestTimeout, 30_000);
  assert.equal(server.headersTimeout, 35_000);
  assert.equal(server.keepAliveTimeout, 5_000);
  assert.equal(server.maxHeadersCount, 100);
  server.close();
});

test('runtime Docker image is multi-stage, production-only and non-root', () => {
  const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
  assert.match(dockerfile, /FROM node:22-bookworm-slim AS build/);
  assert.match(dockerfile, /FROM node:22-bookworm-slim AS runtime/);
  assert.match(dockerfile, /npm prune --omit=dev/);
  assert.match(dockerfile, /USER node/);
  assert.doesNotMatch(dockerfile.split('FROM node:22-bookworm-slim AS runtime')[1] ?? '', /COPY tests/);
});

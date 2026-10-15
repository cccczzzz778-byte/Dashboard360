import type http from 'node:http';

export function hardenHttpServer<T extends http.Server>(server: T): T {
  server.requestTimeout = 30_000;
  server.headersTimeout = 35_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 100;
  return server;
}

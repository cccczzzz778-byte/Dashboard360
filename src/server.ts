import { createServer } from './app.js';
import { hardenHttpServer } from './runtime/http.js';

const port = Number(process.env.PORT ?? 3000);
const app = createServer();
const server = hardenHttpServer(app.listen(port, '0.0.0.0', () => {
  console.log(`buxoro-ssb-360 listening on ${port}`);
}));

let shuttingDown = false;

async function closeDependencies() {
  const redis = app.locals.redisClient;
  if (redis?.isOpen) {
    try { await redis.quit(); } catch { /* best effort */ }
  }
  const pool = app.locals.pool;
  if (pool) {
    try { await pool.end(); } catch { /* best effort */ }
  }
}

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ type: 'shutdown', signal }));

  const force = setTimeout(() => {
    console.error(JSON.stringify({ type: 'shutdown_timeout' }));
    process.exit(1);
  }, 10_000);
  force.unref();

  server.close(async error => {
    await closeDependencies();
    clearTimeout(force);
    if (error) {
      console.error(JSON.stringify({ type: 'shutdown_error', code: (error as NodeJS.ErrnoException).code ?? 'server_close_error' }));
      process.exit(1);
    }
    process.exit(0);
  });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

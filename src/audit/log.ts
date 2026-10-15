export function audit(event: string, metadata: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ type: 'audit', event, at: new Date().toISOString(), ...metadata }));
}

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

const MCP_URL = 'https://mcp.supabase.com/mcp?project_ref=zzqgtclvuetemzhqzhbq';
const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.cursor', 'mcp.json'), 'utf8'));
const token = cfg.mcpServers['Supabase conta principal'].env.SUPABASE_ACCESS_TOKEN;
const sessionId = randomUUID();

const res = await fetch(MCP_URL, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'Mcp-Session-Id': sessionId,
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 't', version: '1' },
    },
  }),
});

console.log('status', res.status);
for (const [k, v] of res.headers.entries()) {
  if (k.toLowerCase().includes('session') || k.toLowerCase().includes('content')) {
    console.log('header', k, v);
  }
}
const text = await res.text();
console.log('body len', text.length);
console.log('body preview', text.slice(0, 800));

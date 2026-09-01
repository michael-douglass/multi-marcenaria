import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

const fn = process.argv[2];
if (!fn) {
  console.error('Usage: node scripts/deploy-edge-via-mcp.mjs <function-name>');
  process.exit(1);
}

const payloadPath = path.resolve('.deploy-payloads', `_deploy-${fn}.mcp.json`);
if (!fs.existsSync(payloadPath)) {
  const fallback = path.resolve('.deploy-payloads', `_deploy-${fn}.json`);
  if (!fs.existsSync(fallback)) {
    console.error(`Missing payload: ${payloadPath}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(fallback, 'utf8'));
  delete raw.project_id;
  fs.writeFileSync(payloadPath, JSON.stringify(raw));
}

const args = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.cursor', 'mcp.json'), 'utf8'));
const token = cfg.mcpServers['Supabase conta principal'].env.SUPABASE_ACCESS_TOKEN;
const MCP_URL = 'https://mcp.supabase.com/mcp?project_ref=zzqgtclvuetemzhqzhbq';
const sessionId = randomUUID();

async function mcpRequest(body, extraHeaders = {}) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'Mcp-Session-Id': sessionId,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

const init = await mcpRequest({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'deploy-edge-via-mcp', version: '1.0.0' },
  },
});

if (init.status >= 400) {
  console.error('initialize failed', init.status, init.text.slice(0, 500));
  process.exit(1);
}

const serverSessionId = init.headers.get('mcp-session-id') || sessionId;

await mcpRequest(
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { 'Mcp-Session-Id': serverSessionId },
);

const call = await mcpRequest(
  {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'deploy_edge_function',
      arguments: args,
    },
  },
  { 'Mcp-Session-Id': serverSessionId },
);

console.log('deploy status', call.status);
console.log(call.text.slice(0, 4000));

if (call.status >= 400 || call.text.includes('"isError":true')) {
  process.exit(1);
}

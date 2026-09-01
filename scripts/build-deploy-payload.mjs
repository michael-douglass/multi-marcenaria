import fs from 'node:fs';
import path from 'node:path';

const base = path.resolve('supabase/functions');
const outDir = path.resolve('.deploy-payloads');
const projectId = 'zzqgtclvuetemzhqzhbq';

const configs = {
  'reset-user-password': [
    'reset-user-password/index.ts',
    '_shared/cors.ts',
    '_shared/empresa-tables.ts',
  ],
  'analyze-lead-photos': [
    'analyze-lead-photos/index.ts',
    '_shared/cors.ts',
    '_shared/lead-knowledge.ts',
    '_shared/iris-sky-prompts.ts',
  ],
  'chat-iris-sky': [
    'chat-iris-sky/index.ts',
    '_shared/cors.ts',
    '_shared/lead-knowledge.ts',
    '_shared/iris-sky-prompts.ts',
  ],
  'index-lead-knowledge': [
    'index-lead-knowledge/index.ts',
    '_shared/cors.ts',
    '_shared/lead-knowledge.ts',
    '_shared/iris-sky-prompts.ts',
  ],
};

for (const [name, rels] of Object.entries(configs)) {
  const files = rels.map((rel) => ({
    name: rel,
    content: fs.readFileSync(path.join(base, rel), 'utf8'),
  }));
  const args = {
    name,
    entrypoint_path: `${name}/index.ts`,
    verify_jwt: true,
    files,
  };
  const argsWithProject = { project_id: projectId, ...args };
  const out = path.join(outDir, `_deploy-${name}.json`);
  fs.writeFileSync(out, JSON.stringify(argsWithProject));
  fs.writeFileSync(path.join(outDir, `_deploy-${name}.mcp.json`), JSON.stringify(args));
  const total = files.reduce((s, f) => s + f.content.length, 0);
  console.log(`${name}: ${files.length} files, ${total} chars -> ${out}`);
}

import fs from 'node:fs';
import path from 'node:path';

const fn = process.argv[2];
if (!fn) {
  console.error('Usage: node scripts/read-mcp-args.mjs <function-name>');
  process.exit(1);
}

const argsPath = path.resolve('.deploy-payloads', `${fn}.mcp-args.json`);
const args = JSON.parse(fs.readFileSync(argsPath, 'utf8'));
process.stdout.write(JSON.stringify(args));

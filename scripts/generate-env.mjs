import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve('.env');
const target = resolve('public/env.js');
const values = {};
const publicKeys = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']);

if (existsSync(source)) {
  for (const rawLine of readFileSync(source, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (publicKeys.has(key)) values[key] = value;
  }
}

mkdirSync(resolve('public'), { recursive: true });
writeFileSync(target, `window.__env = ${JSON.stringify(values, null, 2)};\n`, 'utf8');

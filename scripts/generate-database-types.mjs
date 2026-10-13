import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import prettier from 'prettier';

function projectUrlFromEnvFile() {
  const envFile = resolve('.env');
  if (!existsSync(envFile)) return '';

  for (const rawLine of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('VITE_SUPABASE_URL=')) continue;
    const value = line.slice('VITE_SUPABASE_URL='.length).trim();
    return value.replace(/^(['"])(.*)\1$/, '$2');
  }
  return '';
}

const projectUrl = process.env.VITE_SUPABASE_URL || projectUrlFromEnvFile();
const projectRef = projectUrl.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/)?.[1];

if (!projectRef) {
  console.error('Configure VITE_SUPABASE_URL com a URL do projeto Supabase no .env.');
  process.exit(1);
}

const cli = resolve('node_modules/supabase/dist/supabase.js');
const result = spawnSync(
  process.execPath,
  [cli, 'gen', 'types', 'typescript', '--project-id', projectRef, '--schema', 'public'],
  { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, env: process.env },
);

if (result.error || result.status !== 0 || !result.stdout?.includes('export type Database')) {
  console.error(
    'Não foi possível gerar os tipos. Faça login com `npx supabase login` ou configure SUPABASE_ACCESS_TOKEN.',
  );
  process.exit(1);
}

const target = resolve('src/app/core/models/database.generated.ts');
const prettierConfig = await prettier.resolveConfig(target);
const formatted = await prettier.format(result.stdout, { ...prettierConfig, filepath: target });
writeFileSync(target, formatted, 'utf8');
console.log(`Tipos do esquema public atualizados em ${target}`);

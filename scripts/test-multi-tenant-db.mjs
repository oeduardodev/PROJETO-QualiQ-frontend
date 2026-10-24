import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createServer } from 'node:net';

const directory = mkdtempSync(join(tmpdir(), 'qualiq-tenant-pg-'));
const reservation = createServer();
await new Promise((done) => reservation.listen(0, '127.0.0.1', done));
const port = reservation.address().port;
await new Promise((done) => reservation.close(done));
const run = (command, args) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    stdio: command === 'pg_ctl' ? 'ignore' : 'pipe',
  });
let started = false;
try {
  run('initdb', [
    '-D',
    join(directory, 'data'),
    '-U',
    'postgres',
    '--encoding=UTF8',
    '--locale=C',
    '--auth=trust',
  ]);
  run('pg_ctl', [
    '-D',
    join(directory, 'data'),
    '-l',
    join(directory, 'postgres.log'),
    '-o',
    `-h 127.0.0.1 -p ${port}`,
    '-w',
    'start',
  ]);
  started = true;
  for (const file of [
    'supabase/tests/fixtures/multi_tenant_base.sql',
    'supabase/migrations/20261024100000_implantation_role.sql',
    'supabase/migrations/20261024101000_multi_tenant_foundation.sql',
    'supabase/migrations/20261024101500_tenant_settings.sql',
    'supabase/migrations/20261024102000_tenant_integrations_and_ai.sql',
    'supabase/migrations/20261024103000_catalog_rls.sql',
    'supabase/migrations/20261024104000_remove_unscoped_auth_trigger.sql',
    'supabase/migrations/20261024105000_clear_global_profile_scope.sql',
    'supabase/tests/multi_tenant.sql',
  ]) {
    run('psql', [
      '-X',
      '-h',
      '127.0.0.1',
      '-p',
      String(port),
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      file,
    ]);
    console.log(`${file}: OK`);
  }
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  if (started) run('pg_ctl', ['-D', join(directory, 'data'), '-m', 'fast', '-w', 'stop']);
  const root = resolve(tmpdir()) + sep;
  if (resolve(directory).startsWith(root) && directory.includes('qualiq-tenant-pg-'))
    rmSync(directory, { recursive: true, force: true });
}

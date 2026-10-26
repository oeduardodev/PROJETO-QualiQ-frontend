import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createServer } from 'node:net';

const directory = mkdtempSync(join(tmpdir(), 'qualiq-notifications-pg-'));
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
    'supabase/tests/fixtures/user_notifications_base.sql',
    'supabase/migrations/20261026120000_user_notifications.sql',
    'supabase/tests/user_notifications.sql',
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
  if (resolve(directory).startsWith(root) && directory.includes('qualiq-notifications-pg-'))
    rmSync(directory, { recursive: true, force: true });
}

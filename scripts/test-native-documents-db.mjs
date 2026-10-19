import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';

// Requires PostgreSQL binaries on PATH. This never uses the project's database credentials.
const directory = resolve('tmp', `native-documents-pg-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const reservation = createServer();
await new Promise((done) => reservation.listen(0, '127.0.0.1', done));
const port = reservation.address().port;
await new Promise((done) => reservation.close(done));
const run = (command, args) =>
  execFileSync(command, args, { encoding: 'utf8', windowsHide: true, stdio: command === 'pg_ctl' ? 'ignore' : 'pipe' });
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
    'supabase/tests/fixtures/native_documents_base.sql',
    'supabase/migrations/20261018170000_native_documents.sql',
    'supabase/tests/native_documents.sql',
  ]) {
    const result = run('psql', [
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
    if (file.endsWith('/native_documents.sql')) console.log(result);
  }
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  if (started) run('pg_ctl', ['-D', join(directory, 'data'), '-m', 'fast', '-w', 'stop']);
}

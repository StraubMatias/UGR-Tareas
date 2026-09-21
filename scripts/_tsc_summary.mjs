import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = '/home/matute/tareasUGR';
const errPath = '/tmp/tsc_errors.txt';
const outPath = '/tmp/tsc_summary.txt';
const srcListPath = '/tmp/src_files.txt';

async function walk(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, acc);
    else if (/\.(ts|tsx|js|mjs|jsx)$/.test(e.name)) acc.push(relative(root, p));
  }
  return acc;
}

async function main() {
  const files = (await walk(join(root, 'src'))).sort();
  await writeFile(srcListPath, files.join('\n') + '\n');

  let errText = '';
  try {
    const st = await stat(errPath);
    if (st.size > 0) errText = await readFile(errPath, 'utf8');
  } catch {}

  if (!errText.includes('error TS')) {
    const r = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    errText = `${r.stdout || ''}${r.stderr || ''}`;
    await writeFile(errPath, errText);
  }

  const filesC = new Map();
  const codesC = new Map();
  let total = 0;
  for (const line of errText.split('\n')) {
    if (!line.includes('error TS')) continue;
    total++;
    const f = line.split('(')[0];
    filesC.set(f, (filesC.get(f) || 0) + 1);
    const m = line.match(/error (TS\d+)/);
    if (m) codesC.set(m[1], (codesC.get(m[1]) || 0) + 1);
  }

  const sortMap = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const out = [`TOTAL=${total}`, 'BY_FILE:'];
  for (const [f, c] of sortMap(filesC)) out.push(`${String(c).padStart(4)} ${f}`);
  out.push('BY_CODE:');
  for (const [k, c] of sortMap(codesC)) out.push(`${String(c).padStart(4)} ${k}`);
  out.push('SRC_FILES:');
  out.push(...files);
  await writeFile(outPath, out.join('\n') + '\n');
  console.log(`wrote summary total=${total} files=${files.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

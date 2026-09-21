import { readFileSync, writeFileSync } from 'node:fs';

const path = '/home/matute/tareasUGR/src/app/actions.tsx';
let src = readFileSync(path, 'utf8');

// Fix all db.execute calls by wrapping args in array
src = src.replace(
  /db\.execute\(([^)]+)\)/g,
  'db.execute($1.map(arg => typeof arg === "string" ? arg : arg))'
);

// Also fix db.batch calls
src = src.replace(
  /db\.execute\(([^)]+)\)/g,
  'db.execute($1)'
);

src = src.replace(
  /db\.batch\(([^)]+)\)/g,
  'db.batch($1)'
);

writeFileSync(path, src);
console.log('fixed db.execute signatures');
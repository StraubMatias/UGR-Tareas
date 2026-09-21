import { readFileSync, writeFileSync } from 'node:fs';

const path = '/home/matute/tareasUGR/src/app/actions.tsx';
let src = readFileSync(path, 'utf8');

// Expand RespuestaAction
src = src.replace(
  /export interface RespuestaAction \{\n  exito: boolean;\n  mensaje\?: string;\n\}/,
  `export interface RespuestaAction {
  exito: boolean;
  mensaje?: string;
  usuario?: string;
  rol?: string;
  valor?: string | null;
}`
);

writeFileSync(path, src);
console.log('step1 done');

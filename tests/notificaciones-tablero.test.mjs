import test from 'node:test';
import assert from 'node:assert/strict';
import { avisoVigenteEnCampana } from '../src/lib/avisos.ts';
import { novedadNotasManualesPendientes } from '../src/lib/notas-manuales.ts';

test('avisoVigenteEnCampana oculta sin clases ya pasadas', () => {
  const aviso = {
    titulo: 'Recordatorio – mañana no hay clases',
    url: 'https://virtual.ugr.edu.ar/mod/forum/discuss.php?d=1',
    materia_id: 'eva',
    fecha: '2026-09-17',
    contenido: 'Mañana no tendremos clases.'
  };
  const cronograma = [{
    materia_id: 'eva',
    fecha: '2026-09-18',
    tipo: 'sin_clases',
    origen: 'ugr',
    url: aviso.url
  }];
  assert.equal(avisoVigenteEnCampana(aviso, cronograma), false);
});

test('avisoVigenteEnCampana oculta encuentro de hoy y mañana viejo', () => {
  const aviso = {
    titulo: 'Encuentro Sincrónico de hoy y mañana',
    url: 'https://virtual.ugr.edu.ar/mod/forum/view.php?id=1',
    materia_id: 'sgi',
    fecha: '2026-09-20',
    contenido: ''
  };
  assert.equal(avisoVigenteEnCampana(aviso, []), false);
});

test('novedadNotasManualesPendientes avisa sincronizar', () => {
  const novedad = novedadNotasManualesPendientes(2);
  assert.equal(novedad?.tipo, 'notas-manuales');
  assert.match(novedad?.nombre || '', /2 notas/);
  assert.equal(novedadNotasManualesPendientes(0), null);
});

test('prioridad de campana: parcial antes que aviso del campus', () => {
  const peso = (tipo, dias) => {
    if (tipo === 'parcial') return dias === 0 ? 0 : 1;
    if (tipo === 'aviso-nuevo') return 40;
    return 50;
  };
  assert.ok(peso('parcial', 1) < peso('aviso-nuevo'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  esTituloClaseGenericaDelCampus,
  presentarCronogramaDelDia
} from '../src/lib/cronograma-vista.ts';

test('presentarCronogramaDelDia oculta enlaces de clase si ya hay cursada', () => {
  const eventos = [
    {
      id: '1',
      materia_id: 'ciber',
      fecha: '2026-09-28',
      modalidad: 'sincrónico',
      tipo: 'clase',
      titulo: 'Clases sincrónicas - Prof. Rodríguez',
      detalles: 'Clase de 17:00 a 18:30.',
      url: 'https://virtual.ugr.edu.ar/mod/zoom/view.php?id=1',
      origen: 'ugr'
    },
    {
      id: '2',
      materia_id: 'ciber',
      fecha: '2026-09-28',
      modalidad: 'sincrónico',
      tipo: 'clase',
      titulo: 'Unidad 3: regulación internacional',
      detalles: 'Implicancias geopolíticas. Leonardo Gianzone.',
      url: '',
      origen: 'manual'
    },
    {
      id: '3',
      materia_id: 'gestion',
      fecha: '2026-09-28',
      modalidad: 'sincrónico',
      tipo: 'clase',
      titulo: 'Se abre Evaluación de avance de medio cursado',
      detalles: 'Horario del campus: 20:05',
      url: 'https://virtual.ugr.edu.ar/mod/quiz/view.php?id=9',
      origen: 'ugr'
    },
    {
      id: '4',
      materia_id: 'gestion',
      fecha: '2026-09-28',
      modalidad: 'sincrónico',
      tipo: 'clase',
      titulo: 'Inventario de software y servicios',
      detalles: 'Licencias, proveedores, procesos.',
      url: '',
      origen: 'manual'
    }
  ];
  const horarios = [
    { id: 'h1', materia_id: 'ciber', dia: 1, hora_inicio: '17:00', hora_fin: '18:30', aula: 'Virtual' },
    { id: 'h2', materia_id: 'gestion', dia: 1, hora_inicio: '19:00', hora_fin: '20:30', aula: 'Virtual' }
  ];

  const { eventos: visibles, enlaceClasePorMateria } = presentarCronogramaDelDia(eventos, horarios, [], []);

  assert.equal(visibles.length, 2);
  assert.equal(visibles.some((e) => e.titulo.includes('Unidad 3')), true);
  assert.equal(visibles.some((e) => e.titulo.includes('Inventario')), true);
  assert.equal(visibles.some((e) => e.titulo.includes('Se abre')), false);
  assert.equal(enlaceClasePorMateria.get('ciber'), 'https://virtual.ugr.edu.ar/mod/zoom/view.php?id=1');
});

test('esTituloClaseGenericaDelCampus distingue plan de enlace', () => {
  assert.equal(esTituloClaseGenericaDelCampus('Link de Clase Sincrónica'), true);
  assert.equal(esTituloClaseGenericaDelCampus('Unidad 3: regulación internacional'), false);
  assert.equal(esTituloClaseGenericaDelCampus('Se cierra Evaluación de avance'), true);
  assert.equal(esTituloClaseGenericaDelCampus('Sala Virtual'), true);
  assert.equal(esTituloClaseGenericaDelCampus('Enlace zoom - clases sincronicas'), true);
});

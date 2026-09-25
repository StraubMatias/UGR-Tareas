import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obtenerGrupoDeAlumno,
  obtenerCompanerosDeGrupo,
  obtenerAlumnosSinGrupo,
  obtenerResumenGruposTarea,
  obtenerResumenTareasAlumno,
  formatearFechaDDMMAAAA,
  calcularEstadoSemaforo
} from '../src/core/cursada.ts';

test('obtenerGrupoDeAlumno: encuentra el grupo correspondiente o retorna null', () => {
  const tareaGrupal = {
    id: 't1',
    grupal: true,
    grupos: [
      { id: 'g1', nombre: 'Equipo Alfa', integrantes: ['Ana', 'Beto'] },
      { id: 'g2', nombre: 'Equipo Beta', integrantes: ['Caro', 'David'] }
    ]
  };

  assert.equal(obtenerGrupoDeAlumno(tareaGrupal, 'Ana')?.nombre, 'Equipo Alfa');
  assert.equal(obtenerGrupoDeAlumno(tareaGrupal, 'beto')?.id, 'g1');
  assert.equal(obtenerGrupoDeAlumno(tareaGrupal, 'David')?.nombre, 'Equipo Beta');
  assert.equal(obtenerGrupoDeAlumno(tareaGrupal, 'Esteban'), null);
  assert.equal(obtenerGrupoDeAlumno({ grupal: false }, 'Ana'), null);
});

test('obtenerCompanerosDeGrupo: devuelve los otros integrantes excluyendo al alumno', () => {
  const tareaGrupal = {
    grupal: true,
    grupos: [
      { id: 'g1', nombre: 'Equipo Alfa', integrantes: ['Ana', 'Beto', 'Caro'] }
    ]
  };

  assert.deepEqual(obtenerCompanerosDeGrupo(tareaGrupal, 'Ana'), ['Beto', 'Caro']);
  assert.deepEqual(obtenerCompanerosDeGrupo(tareaGrupal, 'beto'), ['Ana', 'Caro']);
  assert.deepEqual(obtenerCompanerosDeGrupo(tareaGrupal, 'Desconocido'), []);
});

test('obtenerAlumnosSinGrupo y obtenerResumenGruposTarea: calcula alumnos sin grupo y estadísticas', () => {
  const tarea = {
    grupal: true,
    cupo_maximo: 3,
    grupos: [
      { id: 'g1', nombre: 'Equipo Alfa', integrantes: ['Ana', 'Beto'] }
    ]
  };
  const listaAlumnos = ['Ana', 'Beto', 'Caro', 'David'];

  const sinGrupo = obtenerAlumnosSinGrupo(tarea, listaAlumnos);
  assert.deepEqual(sinGrupo, ['Caro', 'David']);

  const resumen = obtenerResumenGruposTarea(tarea, listaAlumnos);
  assert.equal(resumen.totalGrupos, 1);
  assert.equal(resumen.totalIntegrantes, 2);
  assert.equal(resumen.totalSinGrupo, 2);
  assert.deepEqual(resumen.sinGrupo, ['Caro', 'David']);
  assert.equal(resumen.cupo, 3);
});

test('obtenerResumenTareasAlumno: calcula pendientes, completadas, futuras y total correctamente', () => {
  const materias = [
    {
      id: 'm1',
      nombre: 'Materia 1',
      tareas: [
        { id: 't1', nombre: 'T1', inicio: 'Sin fecha', fin: '2026-10-01', completadoPor: ['Ana'], conNota: false, grupal: false },
        { id: 't2', nombre: 'T2', inicio: 'Sin fecha', fin: '2026-10-02', completadoPor: [], conNota: false, grupal: true },
        { id: 't3', nombre: 'T3 (foro)', inicio: '2099-01-01', fin: '2099-01-10', completadoPor: [], conNota: false, grupal: false }
      ]
    }
  ];

  const resumen = obtenerResumenTareasAlumno('Ana', materias);
  assert.equal(resumen.completadas.length, 1);
  assert.equal(resumen.pendientes.length, 1);
  assert.equal(resumen.futuras.length, 1);
  assert.equal(resumen.total, 3);
  assert.equal(resumen.totalGrupales, 1);
  assert.equal(resumen.grupales.length, 1);
});

test('obtenerResumenTareasAlumno: tarea grupal con nota no cuenta en Grupales', () => {
  const materias = [
    {
      id: 'm1',
      nombre: 'Materia 1',
      tareas: [
        {
          id: 't1',
          nombre: 'TP grupal',
          inicio: 'Sin fecha',
          fin: '2026-10-01',
          completadoPor: ['Ana'],
          conNota: true,
          grupal: true,
          notas: { Ana: '8' }
        },
        {
          id: 't2',
          nombre: 'Otro grupal',
          inicio: 'Sin fecha',
          fin: '2026-10-02',
          completadoPor: [],
          conNota: true,
          grupal: true
        }
      ]
    }
  ];
  const resumen = obtenerResumenTareasAlumno('Ana', materias);
  assert.equal(resumen.completadas.length, 1);
  assert.equal(resumen.grupales.length, 1);
  assert.equal(resumen.grupales[0].id, 't2');
  assert.equal(resumen.totalGrupales, 1);
});

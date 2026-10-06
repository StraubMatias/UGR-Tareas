import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obtenerGrupoDeAlumno,
  obtenerCompanerosDeGrupo,
  obtenerAlumnosSinGrupo,
  obtenerResumenGruposTarea,
  obtenerResumenTareasAlumno,
  historialPorAlumno,
  formatearFechaDDMMAAAA,
  calcularEstadoSemaforo,
  tareaCompletadaPor,
  faseEntregaDesdeHitos,
  textoBadgeFaseEntrega,
  tareaUsaEntregasMultiplesCampus,
  notaTableroVisibleParaAlumno,
  notasCerradasEntregaCampus,
  tareaEstaHabilitada,
  obtenerDiasHastaApertura,
  obtenerTextoApertura
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

test('tareaCompletadaPor con Entrega 2 abierta usa la marcación local del tablero', () => {
  const base = {
    id: 't1',
    nombre: 'Entregas del trabajo práctico- caso',
    inicio: null,
    fin: null,
    conNota: true,
    notas: { Ana: 8 },
    entregas: {
      Ana: [{
        numero: 3,
        indiceEntrega: 2,
        esActiva: true,
        estado: 'Reabierto',
        nota: null,
        pendiente: true
      }]
    }
  };
  assert.equal(tareaCompletadaPor({ ...base, completadoPor: [] }, 'Ana'), false);
  assert.equal(tareaCompletadaPor({ ...base, completadoPor: ['Ana'] }, 'Ana'), true);
});

test('obtenerResumenTareasAlumno: grupal entregada sin nota sigue en Grupales', () => {
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
          notas: {}
        }
      ]
    }
  ];
  const resumen = obtenerResumenTareasAlumno('Ana', materias);
  assert.equal(resumen.faltaNota.length, 1);
  assert.equal(resumen.grupales.length, 1);
  assert.equal(resumen.grupales[0].id, 't1');
  assert.equal(resumen.completadas.length, 0);
});

test('entrega múltiple marcada en Entrega 2 va a Sin nota aunque Entrega 1 tenga 10', () => {
  const materias = [{
    id: 'm1',
    nombre: 'SGSI',
    tareas: [{
      id: 't1',
      nombre: 'Entregas del trabajo práctico- caso',
      inicio: 'Sin fecha',
      fin: '2026-10-07',
      conNota: true,
      grupal: true,
      completadoPor: ['Ana'],
      notas: {},
      entregas: {
        Ana: [
          { numero: 2, indiceEntrega: 1, esActiva: false, estado: 'Calificado', nota: '10', pendiente: false },
          { numero: 3, indiceEntrega: 2, esActiva: true, estado: 'Reabierto', nota: null, pendiente: true }
        ]
      }
    }]
  }];
  const resumen = obtenerResumenTareasAlumno('Ana', materias);
  assert.equal(resumen.faltaNota.length, 1);
  assert.equal(resumen.grupales.length, 1);
  assert.equal(resumen.grupales[0].id, 't1');
});

test('tareaUsaEntregasMultiplesCampus distingue SGSI de EGR', () => {
  assert.equal(tareaUsaEntregasMultiplesCampus({ nombre: 'Entregas del trabajo práctico- Análisis' }), true);
  assert.equal(tareaUsaEntregasMultiplesCampus({ nombre: 'Trabajo Práctico Final Primer Entrega DIS-A' }), false);
});

test('EGR con nota 8 sigue entregada aunque queden hitos basura en DB', () => {
  const tarea = {
    id: 't',
    nombre: 'Trabajo Práctico Final Primer Entrega DIS-A',
    conNota: true,
    completadoPor: ['Ana'],
    notas: { Ana: '8' },
    entregas: {
      Ana: [{ numero: 3, indiceEntrega: 1, esActiva: true, pendiente: true, estado: 'Reabierto', nota: null }]
    }
  };
  assert.equal(tareaCompletadaPor(tarea, 'Ana'), true);
});

test('faseEntregaDesdeHitos indica Entrega 2 cuando el campus está reabierto', () => {
  const hitos = [
    { numero: 2, indiceEntrega: 1, esActiva: false, estado: 'Reabierto', nota: '8', pendiente: false },
    { numero: 3, indiceEntrega: 2, esActiva: true, estado: 'Reabierto', nota: null, pendiente: true }
  ];
  const fase = faseEntregaDesdeHitos(hitos);
  assert.equal(fase?.etiqueta, 'Entrega 2');
  assert.equal(fase?.requiereEntrega, true);
  const tarea = {
    id: 't',
    nombre: 'Entregas del trabajo práctico- caso',
    entregas: { Ana: hitos },
    completadoPor: [],
    conNota: true,
    notas: { Ana: '8' }
  };
  assert.match(textoBadgeFaseEntrega(tarea, 'Ana'), /Entrega 2/);
  assert.equal(tareaCompletadaPor(tarea, 'Ana'), false);
  assert.equal(tareaCompletadaPor({ ...tarea, completadoPor: ['Ana'] }, 'Ana'), true);
  assert.equal(notaTableroVisibleParaAlumno(tarea, 'Ana'), false);
  assert.deepEqual(notasCerradasEntregaCampus(tarea, 'Ana'), [{ indice: 1, nota: '8' }]);
});

test('historialPorAlumno solo incluye materias del filtro de inscripción', () => {
  const materias = [
    {
      id: 'm1',
      nombre: 'Uno',
      tareas: [{
        id: 't1',
        nombre: 'TP',
        inicio: '2020-01-01',
        fin: '2020-02-01',
        completadoPor: ['Ana'],
        conNota: false,
        notas: {}
      }]
    },
    {
      id: 'm2',
      nombre: 'Dos',
      tareas: [{
        id: 't2',
        nombre: 'TP2',
        inicio: '2020-01-01',
        fin: '2020-02-01',
        completadoPor: ['Ana'],
        conNota: false,
        notas: {}
      }]
    }
  ];
  const sinFiltro = historialPorAlumno('Ana', materias, [], []);
  assert.equal(sinFiltro.length, 2);
  const soloM1 = historialPorAlumno('Ana', materias, [], [], new Set(['m1']));
  assert.equal(soloM1.length, 1);
  assert.equal(soloM1[0].materia, 'Uno');
});

test('tareaEstaHabilitada respeta la hora de apertura del campus', () => {
  const dia = '2030-06-15';
  const inicio = `${dia}T17:34`;
  const antes = new Date(`${dia}T17:33:00.000-03:00`).getTime();
  const despues = new Date(`${dia}T17:34:00.000-03:00`).getTime();
  assert.equal(tareaEstaHabilitada(inicio, antes), false);
  assert.equal(tareaEstaHabilitada(inicio, despues), true);
});

test('obtenerResumenTareasAlumno clasifica como futura si abre más tarde el mismo día', () => {
  const dia = '2030-06-15';
  const inicio = `${dia}T17:34`;
  const materias = [{
    id: 'm1',
    nombre: 'Gestión',
    tareas: [{
      id: 't1',
      nombre: 'Herramientas de Gestión de Activos',
      inicio,
      fin: '2030-07-01',
      conNota: false,
      completadoPor: [],
      notas: {}
    }]
  }];
  const antes = new Date(`${dia}T12:00:00.000-03:00`).getTime();
  const resumen = obtenerResumenTareasAlumno('Ana', materias);
  assert.equal(tareaEstaHabilitada(inicio, antes), false);
  assert.equal(resumen.futuras.length, 1);
  assert.equal(resumen.pendientes.length, 0);
});

test('obtenerTextoApertura muestra la hora cuando abre más tarde el mismo día', () => {
  const dia = '2030-06-15';
  const inicio = `${dia}T17:34`;
  const ahora = new Date(`${dia}T10:00:00.000-03:00`).getTime();
  assert.equal(obtenerDiasHastaApertura(inicio, ahora), 0);
  assert.equal(obtenerTextoApertura(0, inicio, ahora), 'Abre hoy a las 17:34');
});

test('formatearFechaDDMMAAAA ignora la hora en inicio con T', () => {
  assert.equal(formatearFechaDDMMAAAA('2026-10-06T17:34'), '06-10-2026');
});

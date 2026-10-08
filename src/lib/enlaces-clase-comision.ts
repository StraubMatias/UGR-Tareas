/**
 * Resuelve URLs de clase (Zoom / URL Moodle) para el calendario.
 * Fuente única: `database/enlaces-clase-comision.json` (también la usa ugr-sync).
 */
import catalogo from '../../database/enlaces-clase-comision.json' with { type: 'json' };

export type EntradaEnlaceClase = {
  materia: string;
  titulo: string;
  urlCampus: string;
  dia?: number;
  horaInicio?: string;
  profesorClave?: 'rodriguez' | 'gianzone';
};

const ENLACES = catalogo as EntradaEnlaceClase[];

function normalizarNombre(nombre: string) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase();
}

function textoPlanNormalizado(texto: string) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function profesorEnTextoPlan(texto: string): 'rodriguez' | 'gianzone' | null {
  const n = textoPlanNormalizado(texto);
  if (/gianzone|leonardo/.test(n)) return 'gianzone';
  if (/rodr[ií]guez|gonzalo/.test(n)) return 'rodriguez';
  return null;
}

function minutosDesdeHora(hora: string | null | undefined) {
  const m = String(hora || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function enlacesParaMateria(nombreMateria: string) {
  const n = normalizarNombre(nombreMateria);
  if (!n) return [];
  return ENLACES.filter((entrada) => {
    const frag = normalizarNombre(entrada.materia);
    return n.includes(frag) || frag.split(/\s+/).filter((p) => p.length > 3).every((p) => n.includes(p));
  });
}

/** Mejor URL según materia, horario y (si hay) docente del cronograma del día. */
export function enlaceClaseComisionParaContexto(
  nombreMateria: string,
  opciones: { dia?: number | string; horaInicio?: string; textoPlan?: string } = {}
): string {
  const candidatos = enlacesParaMateria(nombreMateria);
  if (candidatos.length === 0) return '';

  const docente = profesorEnTextoPlan(opciones.textoPlan || '');
  if (docente) {
    const porDocente = candidatos.find((e) => e.profesorClave === docente);
    if (porDocente) return porDocente.urlCampus;
  }

  const sinProfesor = candidatos.filter((e) => !e.profesorClave);
  if (sinProfesor.length === 1) return sinProfesor[0].urlCampus;
  if (candidatos.length === 1 && !candidatos[0].profesorClave) return candidatos[0].urlCampus;

  const diaNum = Number(opciones.dia);
  const inicio = minutosDesdeHora(opciones.horaInicio);
  let mejor = candidatos.find((e) => !e.profesorClave) ?? candidatos[0];
  let puntaje = -1;
  for (const entrada of candidatos) {
    if (entrada.profesorClave) continue;
    let p = 0;
    if (entrada.dia && entrada.dia === diaNum) p += 100;
    const hi = minutosDesdeHora(entrada.horaInicio);
    if (hi !== null && inicio !== null && Math.abs(hi - inicio) <= 20) p += 80;
    if (p > puntaje) {
      puntaje = p;
      mejor = entrada;
    }
  }
  return mejor?.urlCampus && !mejor.profesorClave ? mejor.urlCampus : '';
}

export function enlaceClaseComisionParaHorario(
  nombreMateria: string,
  dia: number | string,
  horaInicio: string
): string {
  return enlaceClaseComisionParaContexto(nombreMateria, { dia, horaInicio });
}

export function enlaceClaseComisionParaMateria(nombreMateria: string): string {
  const lista = enlacesParaMateria(nombreMateria).filter((e) => !e.profesorClave);
  return lista.length === 1 ? lista[0].urlCampus : '';
}

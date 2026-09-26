import { useCallback, useEffect, useState } from 'react';

type FuenteSync = 'ugr' | 'siu';

const ETAPAS: Record<FuenteSync, { hasta: number; texto: string }[]> = {
  ugr: [
    { hasta: 18, texto: 'Conectando con UGR Virtual…' },
    { hasta: 38, texto: 'Leyendo tu cursada…' },
    { hasta: 58, texto: 'Buscando tareas y fechas…' },
    { hasta: 78, texto: 'Actualizando el tablero…' },
    { hasta: 100, texto: 'Casi listo…' }
  ],
  siu: [
    { hasta: 22, texto: 'Conectando con SIU Guaraní…' },
    { hasta: 48, texto: 'Leyendo el plan de estudio…' },
    { hasta: 72, texto: 'Importando notas…' },
    { hasta: 100, texto: 'Guardando en el tablero…' }
  ]
};

function etapaParaProgreso(fuente: FuenteSync, progreso: number) {
  const lista = ETAPAS[fuente];
  return lista.find((e) => progreso <= e.hasta)?.texto ?? lista[lista.length - 1].texto;
}

/** Avance estimado mientras corre una server action de sync (no hay % real del servidor). */
export function useProgresoSyncEstimado(activo: boolean, fuente: FuenteSync) {
  const [progreso, setProgreso] = useState(0);
  const [etapa, setEtapa] = useState('');

  useEffect(() => {
    if (!activo) return undefined;

    const inicio = Date.now();
    const escalaMs = fuente === 'ugr' ? 95_000 : 38_000;

    const intervalo = window.setInterval(() => {
      const segundos = (Date.now() - inicio) / 1000;
      const normalizado = segundos / (escalaMs / 1000);
      const curva = 1 - Math.exp(-normalizado * 2.4);
      const pct = Math.min(93, Math.round(curva * 93));
      setProgreso(pct);
      setEtapa(etapaParaProgreso(fuente, pct));
    }, 150);

    return () => window.clearInterval(intervalo);
  }, [activo, fuente]);

  const marcarCompletado = useCallback(async () => {
    setProgreso(100);
    setEtapa('¡Listo!');
    await new Promise((resolver) => window.setTimeout(resolver, 450));
  }, []);

  return {
    progreso: activo ? progreso : 0,
    etapa: activo ? etapa : '',
    marcarCompletado
  };
}

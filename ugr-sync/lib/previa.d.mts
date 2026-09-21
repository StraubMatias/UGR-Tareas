export function sincronizarConPrevia(opciones: {
  db: unknown;
  usuario: string;
  confirmar?: boolean;
  previaId?: string;
  ids?: string[];
  idsAvisos?: string[];
  idsEventos?: string[];
  detectar?: () => Promise<unknown>;
  ahora?: number;
}): Promise<{
  insertadas?: number;
  urlsActualizadas?: number;
  urlsParcialesActualizadas?: number;
  avisosAceptados?: number;
  avisosRechazados?: number;
  eventosInsertados?: number;
  previaId?: string;
  confirmar?: boolean;
  [clave: string]: unknown;
}>;

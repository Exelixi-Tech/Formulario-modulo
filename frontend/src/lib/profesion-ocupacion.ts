import type { CatalogItem } from './api';
import type { ProfesionOcupacionFields, TomadorData } from '../types';

/**
 * Profesión (maprofes → cprofesion) y ocupación (maocupac → cocupacion) del tomador RCV.
 * La emisión las recibe por separado cuando el tomador trae ocupacionSeparada.
 */

type ProfesionOcupacion = Pick<
  TomadorData,
  'cprofesion' | 'xprofesion' | 'cocupacion' | 'xocupacion' | 'ocupacionSeparada'
>;

/** Qué campos se muestran (y por lo tanto se exigen). */
export interface ProfesionOcupacionVisibility {
  profesion: boolean;
  ocupacion: boolean;
  actividad: boolean;
}

/**
 * Profesión obligatoria y además ocupación o actividad económica, solo de lo que está en
 * pantalla. Claves: `${prefix}profesion` y `${prefix}ocupacion`.
 */
export function validateProfesionOcupacion(
  person: ProfesionOcupacionFields,
  prefix: string,
  visible: ProfesionOcupacionVisibility,
): Record<string, string> {
  const e: Record<string, string> = {};
  // La emisión necesita el código: un nombre autollenado sin código en el catálogo no basta.
  if (visible.profesion && !person.cprofesion) {
    e[`${prefix}profesion`] = 'Seleccione la profesión';
  }
  const hasOcup = visible.ocupacion && Boolean(person.cocupacion || person.xocupacion);
  const hasAct = visible.actividad && Boolean(person.cactividad || person.xactividad);
  if ((visible.ocupacion || visible.actividad) && !hasOcup && !hasAct) {
    e[`${prefix}ocupacion`] = visible.ocupacion && visible.actividad
      ? 'Indique ocupación o actividad económica'
      : visible.ocupacion ? 'Seleccione la ocupación' : 'Seleccione la actividad económica';
  }
  return e;
}

/** Profesión, ocupación y actividad de `src` para copiarlas a otra persona. */
export function pickProfesionOcupacion(src: ProfesionOcupacionFields): ProfesionOcupacionFields {
  return {
    cprofesion: src.cprofesion,
    xprofesion: src.xprofesion,
    cocupacion: src.cocupacion,
    xocupacion: src.xocupacion,
    cactividad: src.cactividad,
    xactividad: src.xactividad,
    ocupacionSeparada: src.ocupacionSeparada,
  };
}

function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Código del catálogo cuyo nombre coincide con el texto (Sis2000 solo devuelve el nombre). */
export function catalogCodeFromLabel(items: CatalogItem[], label: string | undefined): string | undefined {
  const key = normalizeLabel(String(label ?? ''));
  if (!key) return undefined;
  const found = items.find((i) => normalizeLabel(String(i.label)) === key);
  return found ? String(found.code) : undefined;
}

/**
 * Marca el tomador con ocupacionSeparada. Si viene de la versión anterior del formulario, el código
 * en cprofesion es una ocupación y se pasa a cocupacion. Un nombre sin código (autollenado de
 * Sis2000) ya es la profesión y no se mueve. Devuelve null si no hay nada que cambiar.
 */
export function migrateOcupacionSeparada(t: ProfesionOcupacion): Partial<TomadorData> | null {
  if (t.ocupacionSeparada) return null;
  const hasLegacyCode = t.cprofesion != null && String(t.cprofesion).trim() !== '';
  if (!hasLegacyCode) return { ocupacionSeparada: true };
  return {
    ocupacionSeparada: true,
    cocupacion: t.cocupacion ?? t.cprofesion,
    xocupacion: t.xocupacion ?? t.xprofesion,
    cprofesion: undefined,
    xprofesion: undefined,
  };
}

/** Completa los códigos que faltan buscando el nombre en los catálogos. Null si no hay cambios. */
export function resolveProfesionOcupacionCodes(
  t: ProfesionOcupacion,
  catalogs: { profesiones: CatalogItem[]; ocupaciones: CatalogItem[] },
): Partial<TomadorData> | null {
  const patch: Partial<TomadorData> = {};
  if (!t.cprofesion && t.xprofesion) {
    const code = catalogCodeFromLabel(catalogs.profesiones, t.xprofesion);
    if (code) patch.cprofesion = code;
  }
  if (!t.cocupacion && t.xocupacion) {
    const code = catalogCodeFromLabel(catalogs.ocupaciones, t.xocupacion);
    if (code) patch.cocupacion = code;
  }
  return Object.keys(patch).length ? patch : null;
}

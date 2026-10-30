import type { CatalogItem } from './api';
import type { TomadorData } from '../types';

/**
 * Profesión (maprofes → cprofesion) y ocupación (maocupac → cocupacion) del tomador RCV.
 * La emisión las recibe por separado cuando el tomador trae ocupacionSeparada.
 */

type ProfesionOcupacion = Pick<
  TomadorData,
  'cprofesion' | 'xprofesion' | 'cocupacion' | 'xocupacion' | 'ocupacionSeparada'
>;

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

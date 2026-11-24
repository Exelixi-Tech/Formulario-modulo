/**
 * Nombre o apellido que en realidad es otro campo o un rótulo del documento (24-nov-2026).
 *
 * Con la foto de la cédula girada el OCR devolvió el sexo como nombre y la póliza RCV
 * 18-1-0000139376 se registró con el nombre «Masculino». Misma lista cerrada que el OCR
 * (server/src/services/nombreNoEsDato.js): se compara el VALOR COMPLETO, así que un nombre
 * compuesto, un apellido real («Casado», «Viuda de Pérez») o una razón social («Venezolana de
 * Instrumentación…») no se tocan. No aplica a personas jurídicas (J/G/C).
 */
const NO_ES_DATO = new Set([
  // Sexo
  'M', 'F', 'MASC', 'FEM', 'MASCULINO', 'FEMENINO', 'SEXO',
  // Estado civil
  'SOLTERO A', 'CASADO A', 'DIVORCIADO A', 'VIUDO A', 'CONCUBINO A',
  'SOLTERA', 'CASADA', 'DIVORCIADO', 'DIVORCIADA', 'VIUDO', 'VIUDA', 'CONCUBINO', 'CONCUBINA',
  'ESTADO CIVIL', 'EDO CIVIL', 'E CIVIL',
  // Nacionalidad
  'VENEZOLANO', 'VENEZOLANA', 'VENEZOLANO A', 'EXTRANJERO', 'EXTRANJERA', 'EXTRANJERO A', 'NACIONALIDAD',
  // Rótulos de la cédula
  'NOMBRE', 'NOMBRES', 'APELLIDO', 'APELLIDOS', 'NOMBRES Y APELLIDOS', 'NOMBRE Y APELLIDO',
  'APELLIDOS Y NOMBRES', 'CEDULA', 'CEDULA DE IDENTIDAD', 'IDENTIFICACION',
  'REPUBLICA BOLIVARIANA DE VENEZUELA', 'FIRMA', 'FIRMA TITULAR', 'FIRMA DEL TITULAR', 'TITULAR',
  'DIRECTOR', 'FECHA DE NACIMIENTO', 'F NACIMIENTO', 'F EXPEDICION', 'F VENCIMIENTO',
]);

/** «Soltero» y «Casado» son también apellidos reales: en `apellido` se respetan; en `nombre` no. */
const SOLO_EN_NOMBRE = new Set(['SOLTERO', 'CASADO']);

function normalizar(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .trim();
}

/** true si el valor completo es sexo, estado civil, nacionalidad o un rótulo (no un nombre). */
export function noEsNombre(valor: unknown, campo: 'nombre' | 'apellido' = 'nombre'): boolean {
  const n = normalizar(valor);
  if (!n) return false;
  if (NO_ES_DATO.has(n)) return true;
  return campo === 'nombre' && SOLO_EN_NOMBRE.has(n);
}

/** Valor para precargar desde el OCR: vacío si no es un nombre (para que se escriba). */
export function nombreDesdeOcr(valor: unknown, campo: 'nombre' | 'apellido' = 'nombre'): string {
  const s = String(valor ?? '');
  return noEsNombre(s, campo) ? '' : s;
}

/** Mensaje de validación o null si el valor sirve. */
export function errorNombreNoEsDato(
  valor: unknown,
  campo: 'nombre' | 'apellido',
): string | null {
  if (!noEsNombre(valor, campo)) return null;
  const dicho = String(valor ?? '').trim();
  return campo === 'nombre'
    ? `«${dicho}» no es un nombre. Escribe el nombre como aparece en la cédula.`
    : `«${dicho}» no es un apellido. Escribe el apellido como aparece en la cédula.`;
}

import { PERSON_FIELD_LIMITS } from './field-limits';

const { venezuelanCedulaDigitsMin, venezuelanCedulaDigitsMax } = PERSON_FIELD_LIMITS;

export function countIdentificacionDigits(value?: string): number {
  return (value ?? '').replace(/\D/g, '').length;
}

/** Documento extranjero (E) o pasaporte (P): ej. cédula de ciudadanía Colombia, hasta 10 dígitos. */
export const FOREIGN_IDENTIFICACION_DIGITS_MAX = 10;

function isForeignTipoDoc(tipoDoc?: string): boolean {
  const t = String(tipoDoc ?? '').trim().toUpperCase();
  return t === 'E' || t === 'P';
}

/** RIF de persona jurídica (J/G/C) con dígito verificador, ej. J-31317476-9: 9 dígitos, como en Sis2000. */
export const RIF_JURIDICO_DIGITS_MAX = 9;

function isRifJuridicoTipoDoc(tipoDoc?: string): boolean {
  return ['J', 'G', 'C'].includes(String(tipoDoc ?? '').trim().toUpperCase());
}

/** Pasaporte (P): número alfanumérico de 5 a 15 caracteres (ej. EM2849387). */
export const PASAPORTE_MIN_LENGTH = 5;
export const PASAPORTE_MAX_LENGTH = 15;

export function isPasaporteTipoDoc(tipoDoc?: string): boolean {
  return String(tipoDoc ?? '').trim().toUpperCase() === 'P';
}

/**
 * Sis2000 guarda la identificación en maclient.cci_rif (NUMERIC) y los SP de emisión reciben
 * @xrif_* numeric: un pasaporte con letras no se puede emitir. Se acepta en pantalla (OCR) pero
 * se bloquea con un mensaje que indica la alternativa (RIF personal E del extranjero).
 */
export const PASAPORTE_ALFANUMERICO_MSG =
  'Sis2000 solo admite identificación numérica. Para pasaporte alfanumérico use el RIF personal (E-xxxxxxxx-x) del extranjero';

export const PERSONA_JURIDICA_NO_PERMITIDA_MSG =
  'Debe ser persona natural (V, E o P). El RIF jurídico (J/G/C) solo aplica al tomador';

export function isRifJuridico(tipoDoc?: string): boolean {
  return isRifJuridicoTipoDoc(tipoDoc);
}

/**
 * Pasaporte alfanumérico en titular/tomador de personas: Sis2000 guarda el pasaporte completo en
 * maclient.cid ('P-EM2849387') y solo los dígitos en cci_rif (2849387), como SysIP.
 * Límites: 13 caracteres (cid de 15 con 'P-') y entre 5 y 9 dígitos (numeric(9) del SP).
 */
export const PASAPORTE_ALFA_MAX_LENGTH = 13;
export const PASAPORTE_ALFA_DIGITS_MIN = 5;
export const PASAPORTE_ALFA_DIGITS_MAX = 9;

export const PASAPORTE_ALFA_FORMATO_MSG =
  `El pasaporte con letras debe tener máximo ${PASAPORTE_ALFA_MAX_LENGTH} letras o números y entre ${PASAPORTE_ALFA_DIGITS_MIN} y ${PASAPORTE_ALFA_DIGITS_MAX} dígitos`;

/**
 * Validación del número de pasaporte; undefined si no es P o si es emitible en Sis2000.
 * permitirAlfanumerico: solo titular y tomador de personas (RCV, asegurados adicionales y
 * beneficiarios siguen exigiendo pasaporte numérico).
 */
export function validatePasaporte(
  identificacion?: string,
  tipoDoc?: string,
  opts?: { permitirAlfanumerico?: boolean },
): string | undefined {
  if (!isPasaporteTipoDoc(tipoDoc)) return undefined;
  const v = String(identificacion ?? '').trim().toUpperCase();
  if (!v) return 'La identificación es obligatoria';
  if (!/^[A-Z0-9]+$/.test(v)) return 'El pasaporte solo admite letras y números';
  if (v.length < PASAPORTE_MIN_LENGTH || v.length > PASAPORTE_MAX_LENGTH) {
    return `El pasaporte debe tener entre ${PASAPORTE_MIN_LENGTH} y ${PASAPORTE_MAX_LENGTH} caracteres`;
  }
  if (/[A-Z]/.test(v)) {
    if (!opts?.permitirAlfanumerico) return PASAPORTE_ALFANUMERICO_MSG;
    const digits = countIdentificacionDigits(v);
    if (
      v.length > PASAPORTE_ALFA_MAX_LENGTH ||
      digits < PASAPORTE_ALFA_DIGITS_MIN ||
      digits > PASAPORTE_ALFA_DIGITS_MAX
    ) {
      return PASAPORTE_ALFA_FORMATO_MSG;
    }
    return undefined;
  }
  if (v.length > FOREIGN_IDENTIFICACION_DIGITS_MAX) {
    return `El pasaporte numérico no puede tener más de ${FOREIGN_IDENTIFICACION_DIGITS_MAX} dígitos`;
  }
  return undefined;
}

/** Máximo de caracteres según tipo de documento: V = cédula venezolana (8); J/G/C = RIF (9); E = extranjero (10); P = pasaporte (15). */
export function secondaryIdentificacionMax(tipoDoc?: string): number {
  if (isPasaporteTipoDoc(tipoDoc)) return PASAPORTE_MAX_LENGTH;
  if (isForeignTipoDoc(tipoDoc)) return FOREIGN_IDENTIFICACION_DIGITS_MAX;
  if (isRifJuridicoTipoDoc(tipoDoc)) return RIF_JURIDICO_DIGITS_MAX;
  return venezuelanCedulaDigitsMax;
}

/**
 * Validación de cédula para asegurado, beneficiario y conductor (no tomador).
 * soloPersonaNatural: titular/asegurado/beneficiario de personas no puede ser J/G/C.
 */
export function validateSecondaryPersonIdentificacion(
  identificacion?: string,
  tipoDoc?: string,
  opts?: { soloPersonaNatural?: boolean; permitirPasaporteAlfanumerico?: boolean },
): string | undefined {
  if (opts?.soloPersonaNatural && isRifJuridicoTipoDoc(tipoDoc)) {
    return PERSONA_JURIDICA_NO_PERMITIDA_MSG;
  }
  if (isPasaporteTipoDoc(tipoDoc)) {
    return validatePasaporte(identificacion, tipoDoc, {
      permitirAlfanumerico: opts?.permitirPasaporteAlfanumerico,
    });
  }
  const digits = countIdentificacionDigits(identificacion);
  if (!String(identificacion ?? '').trim() || digits === 0) {
    return 'La identificación es obligatoria';
  }
  if (digits < venezuelanCedulaDigitsMin) {
    return `La identificación debe tener al menos ${venezuelanCedulaDigitsMin} dígitos`;
  }
  if (isForeignTipoDoc(tipoDoc)) {
    if (digits > FOREIGN_IDENTIFICACION_DIGITS_MAX) {
      return `La identificación no puede tener más de ${FOREIGN_IDENTIFICACION_DIGITS_MAX} dígitos (documento extranjero)`;
    }
  } else if (isRifJuridicoTipoDoc(tipoDoc)) {
    if (digits > RIF_JURIDICO_DIGITS_MAX) {
      return `La identificación no puede tener más de ${RIF_JURIDICO_DIGITS_MAX} dígitos (RIF con dígito verificador)`;
    }
  } else if (digits > venezuelanCedulaDigitsMax) {
    return `La identificación no puede tener más de ${venezuelanCedulaDigitsMax} dígitos (cédula venezolana)`;
  }
  return undefined;
}

export const SECONDARY_IDENTIFICACION_MAX_LENGTH = venezuelanCedulaDigitsMax;

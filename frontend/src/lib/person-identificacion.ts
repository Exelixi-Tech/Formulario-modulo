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

/** Máximo de dígitos según tipo de documento: V = cédula venezolana (8); J/G/C = RIF (9); E/P = extranjero (10). */
export function secondaryIdentificacionMax(tipoDoc?: string): number {
  if (isForeignTipoDoc(tipoDoc)) return FOREIGN_IDENTIFICACION_DIGITS_MAX;
  if (isRifJuridicoTipoDoc(tipoDoc)) return RIF_JURIDICO_DIGITS_MAX;
  return venezuelanCedulaDigitsMax;
}

/** Validación de cédula para asegurado, beneficiario y conductor (no tomador). */
export function validateSecondaryPersonIdentificacion(
  identificacion?: string,
  tipoDoc?: string,
): string | undefined {
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

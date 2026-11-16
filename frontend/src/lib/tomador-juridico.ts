import { isPersonaJuridica } from './diligencia';

/** Contexto del flujo para decidir si una persona con RIF J/G/C se trata como persona jurídica. */
export interface PersonaJuridicaCtx {
  /** Prefijo del formulario: 'tom_' (tomador), 'aseg_' (titular), 'benef_'… */
  prefix: string;
  /** Emisión RCV La Mundial. */
  rcv: boolean;
  /** Patrimoniales (incendio, hogar…). */
  patrimoniales: boolean;
  /** Personas La Mundial (funerario, vida, AP, salud, viajero). */
  personas: boolean;
}

/**
 * Regla común de persona jurídica (antes duplicada en EmissionStep):
 * - isJuridica: RIF J/G/C en patrimoniales, RCV o tomador de personas → sin sexo ni estado civil;
 *   la fecha es de constitución.
 * - isJuridicaRcv: UI de RCV jurídico (razón social, sin apellido, fecha de constitución opcional).
 *   Aplica a RCV y al tomador de personas.
 * En personas solo el tomador y el beneficiario preferencial de Vida (prefijo 'bpref_') pueden ser
 * jurídicos; titular, asegurados y beneficiarios por fallecimiento son naturales.
 */
export function resolvePersonaJuridica(
  tipoDoc: string | undefined,
  ctx: PersonaJuridicaCtx,
): { isJuridica: boolean; isJuridicaRcv: boolean } {
  const pj = isPersonaJuridica(tipoDoc);
  const personasTomador = ctx.personas && (ctx.prefix === 'tom_' || ctx.prefix === BENEF_PREFERENCIAL_PREFIX);
  const isJuridica = pj && (ctx.patrimoniales || ctx.rcv || personasTomador);
  const isJuridicaRcv = isJuridica && (ctx.rcv || personasTomador);
  return { isJuridica, isJuridicaRcv };
}

/**
 * RCV y tomador de personas: Emisión solo trata J como jurídico (G/C → V) y V admite máx. 8 dígitos.
 * Devuelve el error a mostrar antes del pago, o undefined.
 */
export function validateRifJuridicoEmitible(
  tipoDoc: string | undefined,
  identificacion: string | undefined,
  maxCedulaV: number,
): string | undefined {
  const t = String(tipoDoc ?? '').trim().toUpperCase();
  if (t === 'G' || t === 'C') {
    return 'Solo se admite RIF jurídico J (G y C no están habilitados)';
  }
  if (t === 'V' && String(identificacion ?? '').replace(/\D/g, '').length > maxCedulaV) {
    return `La cédula venezolana tiene máximo ${maxCedulaV} dígitos (no el RIF con dígito verificador)`;
  }
  return undefined;
}

/** Prefijo del formulario del beneficiario preferencial de Vida (personas). */
export const BENEF_PREFERENCIAL_PREFIX = 'bpref_';

/** Ramos de Vida (Sis2000) donde se ofrece el beneficiario preferencial (puede ser jurídico). */
export const RAMOS_VIDA_BENEF_PREFERENCIAL: readonly number[] = [1];

/** RIF jurídico del beneficiario preferencial: letra + 9 dígitos (J-123456789). */
export const RIF_JURIDICO_PREFERENCIAL_DIGITOS = 9;

/**
 * Beneficiario preferencial jurídico (J/G/C): el RIF lleva exactamente 9 dígitos.
 * Devuelve el error a mostrar o undefined (también para persona natural: sigue la regla de siempre).
 */
export function validateRifBeneficiarioPreferencial(
  tipoDoc: string | undefined,
  identificacion: string | undefined,
): string | undefined {
  if (!isPersonaJuridica(tipoDoc)) return undefined;
  const digits = String(identificacion ?? '').replace(/\D/g, '');
  if (digits.length !== RIF_JURIDICO_PREFERENCIAL_DIGITOS) {
    return `El RIF debe tener la letra y ${RIF_JURIDICO_PREFERENCIAL_DIGITOS} dígitos (ej. J-123456789)`;
  }
  return undefined;
}

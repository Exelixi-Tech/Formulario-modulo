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
 * En personas solo el tomador puede ser jurídico (titular, asegurados y beneficiarios son naturales).
 */
export function resolvePersonaJuridica(
  tipoDoc: string | undefined,
  ctx: PersonaJuridicaCtx,
): { isJuridica: boolean; isJuridicaRcv: boolean } {
  const pj = isPersonaJuridica(tipoDoc);
  const personasTomador = ctx.personas && ctx.prefix === 'tom_';
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

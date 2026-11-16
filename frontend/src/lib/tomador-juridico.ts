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

/** RIF jurídico de un beneficiario: letra + 9 dígitos (J-40084902-0 se escribe 400849020). */
export const RIF_JURIDICO_BENEFICIARIO_DIGITOS = 9;

/**
 * Personas (Vida y demás, salvo funerario): los beneficiarios por fallecimiento pueden ser persona
 * jurídica J/G/C (p. ej. un banco o empresa con parentesco «Socio (a)»), como en SysIP.
 * Funerario (cproducto 57 o xproducto «funer…») sigue solo con persona natural.
 * No depende de cramo: el SSO de algunos productos no lo manda.
 */
export function beneficiarioJuridicoPermitido(meta: Record<string, unknown> | null | undefined): boolean {
  const cproducto = String(meta?.cproducto ?? '').trim();
  const xproducto = String(meta?.xproducto ?? '').trim().toLowerCase();
  return cproducto !== '57' && !xproducto.includes('funer');
}

/**
 * Beneficiario jurídico (J/G/C): el RIF lleva exactamente 9 dígitos.
 * Devuelve el error a mostrar o undefined (persona natural: undefined).
 */
export function validateRifBeneficiarioJuridico(
  tipoDoc: string | undefined,
  identificacion: string | undefined,
): string | undefined {
  if (!isPersonaJuridica(tipoDoc)) return undefined;
  const digits = String(identificacion ?? '').replace(/\D/g, '');
  if (digits.length !== RIF_JURIDICO_BENEFICIARIO_DIGITOS) {
    return `El RIF debe tener la letra y ${RIF_JURIDICO_BENEFICIARIO_DIGITOS} dígitos (ej. J-400849020)`;
  }
  return undefined;
}

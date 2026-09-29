import { checkFuneralCedulaPoliza } from './api';

const FUNERARIO_RAMO = 9;
const FUNERARIO_PRODUCTO = '57';

/**
 * Ramo Sis2000 donde se busca la póliza vigente, según el producto del SSO.
 * Funerario (57 o sin producto) sigue en ramo 9; otro producto usa el ramo del SSO.
 * @param meta metadataCanal del SSO
 */
export function polizaVigenteCramo(meta: Record<string, unknown> | null | undefined): number {
  const prod = String(meta?.cproducto ?? '').trim();
  if (!prod || prod === FUNERARIO_PRODUCTO) return FUNERARIO_RAMO;
  const cramo = Number(meta?.cramo);
  return Number.isInteger(cramo) && cramo > 0 ? cramo : FUNERARIO_RAMO;
}

/**
 * Texto para el usuario: "funeraria" solo en funerario.
 * @param cramo ramo consultado
 */
export function polizaVigenteLabel(cramo: number): string {
  return cramo === FUNERARIO_RAMO ? 'póliza funeraria vigente' : 'póliza vigente de este producto';
}

/**
 * Consulta Sis2000: ¿esta cédula ya tiene póliza vigente en el ramo del producto?
 * Si tiene menos de 6 dígitos no consulta (aún incompleta).
 */
export async function cedulaTienePolizaVigente(identificacion: string, cramo = FUNERARIO_RAMO): Promise<{
  blocked: boolean;
  message: string;
  cnpoliza?: string;
}> {
  const digits = String(identificacion || '').replace(/\D/g, '');
  if (digits.length < 6) return { blocked: false, message: '' };
  const res = await checkFuneralCedulaPoliza(digits, cramo);
  if (res.blocked) {
    return {
      blocked: true,
      message: res.message || `Ya existe una ${polizaVigenteLabel(cramo)} para esta cédula.`,
      cnpoliza: res.cnpoliza,
    };
  }
  return { blocked: false, message: '' };
}

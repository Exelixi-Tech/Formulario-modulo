import { checkFuneralCedulaPoliza } from './api';
import { shouldUseTarjetaPublicApi } from './rcv-tarjeta-flow';

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
 * Texto cuando la consulta no responde: no se sabe si la cédula tiene póliza vigente.
 * @param cramo ramo consultado
 */
export function polizaVigenteNoConfirmada(cramo: number): string {
  return `No se pudo confirmar si esta cédula ya tiene una ${polizaVigenteLabel(cramo)}. Inténtalo de nuevo; si continúa, avisa a soporte.`;
}

export interface PlanPolizaVigente {
  cplan: string;
  cramo?: number;
}

/**
 * Plan a contratar si ya se conoce: el elegido (al volver desde Emisión) o el de la tarjeta.
 * Sin plan, el servidor solo tranca si el producto no deja ningún plan disponible.
 */
export function planParaPolizaVigente(
  selectedPlan: { cplan?: string } | null | undefined,
  metadataCanal: Record<string, unknown> | null | undefined,
): PlanPolizaVigente | null {
  const elegido = selectedPlan as { cplan?: unknown; cramo?: unknown } | null | undefined;
  const fuente = elegido?.cplan
    ? elegido
    : shouldUseTarjetaPublicApi() && metadataCanal?.cplan
      ? metadataCanal
      : null;
  if (!fuente) return null;
  const cramo = Number(fuente.cramo);
  return {
    cplan: String(fuente.cplan).trim(),
    cramo: Number.isInteger(cramo) && cramo > 0 ? cramo : undefined,
  };
}

/**
 * Consulta Sis2000: ¿esta cédula ya tiene póliza vigente del plan (o del producto, si aún no hay plan)?
 * Si tiene menos de 6 dígitos no consulta (aún incompleta).
 * Si la consulta falla (p. ej. 403 de nest-api) lanza error: no se puede afirmar que no tiene póliza.
 * `aviso`: tiene póliza vigente de otro plan; se informa pero no tranca.
 */
export async function cedulaTienePolizaVigente(
  identificacion: string,
  cramo = FUNERARIO_RAMO,
  plan?: PlanPolizaVigente | null,
): Promise<{
  blocked: boolean;
  message: string;
  cnpoliza?: string;
  aviso?: string;
}> {
  const digits = String(identificacion || '').replace(/\D/g, '');
  if (digits.length < 6) return { blocked: false, message: '' };
  const res = await checkFuneralCedulaPoliza(digits, cramo, plan);
  if (res.blocked) {
    return {
      blocked: true,
      message: res.message || `Ya existe una ${polizaVigenteLabel(cramo)} para esta cédula.`,
      cnpoliza: res.cnpoliza,
    };
  }
  if (!res.success) {
    throw new Error(res.message || 'No se pudo verificar la cédula.');
  }
  return { blocked: false, message: '', cnpoliza: res.cnpoliza, aviso: res.aviso };
}

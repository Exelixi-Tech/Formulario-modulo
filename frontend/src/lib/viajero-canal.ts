/**
 * Canal Viajero (productos 25/26 o ramos 5/25): no aplica bloqueo de póliza funeraria vigente.
 */
export function isViajeroPersonasCanal(
  meta: Record<string, unknown> | null | undefined,
): boolean {
  if (!meta || typeof meta !== 'object') return false;
  const prod = String(meta.cproducto ?? '').trim();
  if (prod === '25' || prod === '26') return true;
  // Accidentes personales (78/79) comparte ramo 5 con viajero pero sí valida póliza vigente.
  if (prod === '78' || prod === '79') return false;
  const cramo = Number(meta.cramo);
  if (cramo === 5 || cramo === 25) return true;
  const label = `${meta.canal ?? ''} ${meta.nombre ?? ''}`.toLowerCase();
  return label.includes('viajero');
}

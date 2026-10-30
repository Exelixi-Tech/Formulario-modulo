/**
 * Regla de póliza vigente del titular, la misma de speeValidatePersonGeneral en Sis2000:
 * el titular no puede tener dos pólizas vigentes del mismo ramo y plan. El tomador (pagador)
 * no se valida. Los planes BANAC* quedan fuera de la regla, como en el SP.
 */

function normalizarPlan(cplan) {
  return String(cplan ?? '').trim().toUpperCase();
}

function planExceptuado(cplan) {
  return normalizarPlan(cplan).startsWith('BANAC');
}

/** Mismo ramo y mismo plan: el mismo código de plan existe en varios ramos. */
function mismoPlan(a, b) {
  return Number(a?.cramo) === Number(b?.cramo) && normalizarPlan(a?.cplan) === normalizarPlan(b?.cplan);
}

/**
 * @param {object} input
 * @param {{ cramo?: number, cplan: string } | null} [input.plan] plan a contratar, si ya se conoce
 * @param {Array<{ cramo: number, cplan?: string, cnpoliza?: string }>} [input.vigentes] pólizas vigentes del titular
 * @param {Array<{ cramo: number, cplan: string }>} [input.catalogo] planes que ofrece el producto
 * @returns {{ blocked: boolean, vigente?: { cramo: number, cplan?: string, cnpoliza?: string } }}
 */
function evaluarPolizaVigenteTitular({ plan = null, vigentes = [], catalogo = [] } = {}) {
  const conPlan = vigentes.filter((v) => normalizarPlan(v?.cplan));
  if (plan && normalizarPlan(plan.cplan)) {
    if (planExceptuado(plan.cplan)) return { blocked: false, vigente: conPlan[0] };
    const igual = conPlan.find((v) => mismoPlan(v, plan));
    return igual ? { blocked: true, vigente: igual } : { blocked: false, vigente: conPlan[0] };
  }
  if (!conPlan.length) return { blocked: false };
  // Plan todavía sin elegir: solo se tranca si el producto no deja ningún plan disponible.
  const disponibles = catalogo.filter(
    (p) => planExceptuado(p.cplan) || !conPlan.some((v) => mismoPlan(v, p)),
  );
  return { blocked: catalogo.length > 0 && disponibles.length === 0, vigente: conPlan[0] };
}

module.exports = { evaluarPolizaVigenteTitular, mismoPlan, normalizarPlan };

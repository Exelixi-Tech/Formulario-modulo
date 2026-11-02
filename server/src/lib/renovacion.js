/**
 * Renovación = póliza nueva enlazada (cnpoliza_rel). Lógica pura del módulo Formulario.
 * El dato lo arma nest-api GET /api/v1/renovacion/:cnpoliza; aquí solo se valida la entrada,
 * se aplica el permiso de pruebas fuera de ventana y se recorta lo que va al navegador.
 */

const CNPOLIZA_RE = /^[0-9A-Z][0-9A-Z-]{2,29}$/;

/** Motivos que el .env de pruebas puede saltar (nunca ANULADA ni YA_RENOVADA). */
const MOTIVOS_VENTANA = new Set(['ANTES_DE_VENTANA', 'FUERA_DE_VENTANA']);

function normalizarCnpoliza(raw) {
  const s = String(raw ?? '').trim().toUpperCase();
  return CNPOLIZA_RE.test(s) ? s : null;
}

function permiteFueraVentana(env = process.env) {
  return String(env.RENOVACION_PERMITIR_FUERA_VENTANA || '').trim().toLowerCase() === 'true';
}

/**
 * Aplica RENOVACION_PERMITIR_FUERA_VENTANA (solo pruebas): una póliza fuera de la ventana
 * 30/30 se trata como elegible y se deja la advertencia. Anulada o ya renovada siguen bloqueadas.
 */
function aplicarPermisoVentana(data, env = process.env) {
  if (!data || data.elegible !== false) return data;
  if (!permiteFueraVentana(env) || !MOTIVOS_VENTANA.has(String(data.motivo || ''))) return data;
  const advertencias = Array.isArray(data.advertencias) ? [...data.advertencias] : [];
  advertencias.push(`Prueba: fuera de la ventana de renovación (${data.motivo}). ${data.mensaje || ''}`.trim());
  return { ...data, elegible: true, forzada_fuera_ventana: true, advertencias };
}

/** Lo que se manda al navegador (sin columnas internas que no usa el formulario). */
function respuestaCliente(data) {
  const po = data.poliza_origen || {};
  return {
    tipo: data.tipo,
    elegible: Boolean(data.elegible),
    motivo: data.motivo ?? null,
    mensaje: data.mensaje ?? null,
    forzada_fuera_ventana: Boolean(data.forzada_fuera_ventana),
    renovada_por: data.renovada_por ?? null,
    poliza_origen: {
      cnpoliza: po.cnpoliza ?? null,
      cramo: po.cramo ?? null,
      xramo: po.xramo ?? null,
      cplan: po.cplan ?? null,
      xplan: po.xplan ?? null,
      cproducto: po.cproducto ?? null,
      ifrecuencia: po.ifrecuencia ?? null,
      xfrecuencia: po.xfrecuencia ?? null,
      fdesde: po.fdesde ?? null,
      fhasta: po.fhasta ?? null,
      estado: po.estado ?? null,
    },
    tomador: data.tomador ?? null,
    titular: data.titular ?? null,
    beneficiario_preferencial: data.beneficiario_preferencial ?? null,
    conductor: data.conductor ?? null,
    asegurados: Array.isArray(data.asegurados) ? data.asegurados : [],
    beneficiarios: Array.isArray(data.beneficiarios) ? data.beneficiarios : [],
    vehiculo: data.vehiculo ?? null,
    fdesde_sugerida: data.fdesde_sugerida ?? null,
    fhasta_sugerida: data.fhasta_sugerida ?? null,
    continuidad: Boolean(data.continuidad),
    plan_actual: data.plan_actual ?? null,
    otros_planes: Array.isArray(data.otros_planes) ? data.otros_planes : [],
    advertencias: Array.isArray(data.advertencias) ? data.advertencias : [],
    emision_sugerida: data.emision_sugerida ?? {
      flujo: 'renovacion',
      cnpoliza_rel: po.cnpoliza ?? null,
      itipoEmi: 'NU',
    },
  };
}

/**
 * Regla "póliza vigente" en renovación: la vigente encontrada no bloquea si es la misma
 * póliza que se renueva (cnpoliza_rel). Cualquier otra sigue bloqueando.
 */
function esLaPolizaQueSeRenueva(cnpolizaVigente, cnpolizaRel) {
  const a = normalizarCnpoliza(cnpolizaVigente);
  const b = normalizarCnpoliza(cnpolizaRel);
  return Boolean(a && b && a === b);
}

module.exports = {
  normalizarCnpoliza,
  permiteFueraVentana,
  aplicarPermisoVentana,
  respuestaCliente,
  esLaPolizaQueSeRenueva,
};

/**
 * Funerario — consulta de póliza vigente por cédula (antes de avanzar).
 */
const express = require('express');
const { checkPolizaVigentePersonas, getPlanesPersonas } = require('../services/nestApiClient');
const { evaluarPolizaVigenteTitular } = require('../services/polizaVigenteRegla');

const router = express.Router();

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return {};
  const parts = token.split('.');
  if (parts.length < 2) return {};
  try {
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/** Canal SSO desde JWT (form-api no pisa nexusMetadata) + query. */
function funeralCanalFromReq(req) {
  const payload = decodeJwtPayload(req.nexusToken);
  const meta = { ...(payload.metadata || {}), ...(req.nexusMetadata || {}) };
  if (payload.canal && !meta.canal) meta.canal = payload.canal;
  const q = req.query || {};
  const keys = [
    'centidad', 'citem', 'cgestor', 'cgestor_in', 'cproducto', 'cproductor',
    'cusuario', 'ccanalalt', 'ccanalalt_in',
  ];
  for (const key of keys) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      meta[key] = String(q[key]).trim();
    }
  }
  return meta;
}

router.get('/planes', async (req, res) => {
  const meta = funeralCanalFromReq(req);
  const cproducto = meta.cproducto || process.env.LAMUNDIAL_PRODUCTO_FUNERARIO || '57';
  const cramo = cproducto === '57'
    ? 45
    : (req.query.cramo != null ? Number(req.query.cramo) : 9);
  if (String(meta.cproductor || '') === '80080') delete meta.cproductor;
  meta.cproducto = cproducto;
  try {
    const planes = await getPlanesPersonas(cramo, meta);
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    });
    return res.json({ success: true, planes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[personas/planes]', msg);
    return res.status(err.status || 502).json({
      success: false,
      code: err.code || 'PERSONAS_PLANES_ERROR',
      message: msg,
    });
  }
});

/**
 * Planes (ramo + plan) que ofrece el producto del canal. El SSO trae el ramo del producto
 * (vida 47), pero las pólizas quedan en el ramo de cada plan (vida 1): la búsqueda usa esos ramos.
 * Si no se pueden leer devuelve [] y se busca solo en el ramo indicado.
 */
async function planesDelProducto(req, cramo) {
  const meta = funeralCanalFromReq(req);
  const cproducto = String(
    req.body?.cproducto ?? meta.cproducto ?? process.env.LAMUNDIAL_PRODUCTO_FUNERARIO ?? '',
  ).trim() || '57';
  if (String(meta.cproductor || '') === '80080') delete meta.cproductor;
  try {
    const planes = await getPlanesPersonas(cramo, { ...meta, cproducto });
    return planes
      .map((p) => ({ cramo: Number(p?.cramo), cplan: String(p?.cplan ?? '').trim() }))
      .filter((p) => Number.isInteger(p.cramo) && p.cramo > 0 && p.cplan);
  } catch (err) {
    console.warn('[personas/poliza-vigente] planes del producto:', err instanceof Error ? err.message : err);
    return [];
  }
}

router.post('/poliza-vigente', async (req, res) => {
  const rif = String(req.body?.rif ?? req.body?.identificacion ?? '').replace(/\D/g, '');
  const cramo = req.body?.cramo != null ? Number(req.body.cramo) : 9;
  const tipoPoliza = cramo === 9 ? 'póliza funeraria vigente' : 'póliza vigente de este producto';
  // Plan a contratar, si ya se conoce (tarjeta o al volver desde Emisión). Sin plan solo se tranca
  // si el producto no deja ningún plan disponible; el plan exacto lo vuelve a validar Emisión (SP).
  const cplan = String(req.body?.cplan ?? '').trim();
  const cramoPlan = Number(req.body?.cramoPlan);
  const plan = cplan
    ? { cplan, cramo: Number.isInteger(cramoPlan) && cramoPlan > 0 ? cramoPlan : undefined }
    : null;

  if (rif.length < 6) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_CEDULA',
      message: 'La cédula debe tener al menos 6 dígitos.',
    });
  }

  try {
    const catalogo = plan ? [] : await planesDelProducto(req, cramo);
    const ramos = plan?.cramo ? [plan.cramo] : [...new Set([cramo, ...catalogo.map((p) => p.cramo)])];
    const vigentes = [];
    for (const ramo of ramos) {
      const result = await checkPolizaVigentePersonas({ rif, cramo: ramo });
      if (result.hasVigente) vigentes.push({ cramo: ramo, cplan: result.cplan, cnpoliza: result.cnpoliza });
    }
    const { blocked, vigente } = evaluarPolizaVigenteTitular({ plan, vigentes, catalogo });
    const poliza = vigente?.cnpoliza ? ` (póliza ${vigente.cnpoliza})` : '';
    if (blocked) {
      const queTiene = plan ? 'este plan' : catalogo.length > 1 ? 'los planes de este producto' : 'el plan de este producto';
      return res.status(200).json({
        success: true,
        blocked: true,
        code: 'PERSONAS_DUPLICATE',
        cnpoliza: vigente?.cnpoliza,
        message: `Esta cédula ya tiene vigente ${queTiene}${poliza}. No se puede contratar el mismo plan otra vez.`,
      });
    }
    if (vigente) {
      return res.json({
        success: true,
        blocked: false,
        cnpoliza: vigente.cnpoliza,
        aviso: `Esta cédula ya tiene una ${tipoPoliza} del plan ${vigente.cplan}${poliza}. Puede contratar otro plan, no el mismo.`,
        message: `Tiene una ${tipoPoliza} del plan ${vigente.cplan}.`,
      });
    }
    return res.json({
      success: true,
      blocked: false,
      message: `No hay ${tipoPoliza} para esta cédula.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[personas/poliza-vigente]', msg);
    return res.status(err.status || 502).json({
      success: false,
      code: err.code || 'PERSONAS_POLIZA_CHECK_ERROR',
      message: msg,
    });
  }
});

module.exports = router;

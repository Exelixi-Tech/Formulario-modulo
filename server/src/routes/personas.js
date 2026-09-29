/**
 * Funerario — consulta de póliza vigente por cédula (antes de avanzar).
 */
const express = require('express');
const { checkPolizaVigentePersonas, getPlanesPersonas } = require('../services/nestApiClient');

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
 * Ramos donde buscar la póliza vigente. El SSO trae el ramo del producto (vida 47),
 * pero las pólizas quedan en el ramo del plan (vida 1): se agregan los ramos de los
 * planes del producto. Funerario (57 / sin producto) sigue solo en su ramo.
 */
async function ramosPolizaVigente(req, cramo) {
  const meta = funeralCanalFromReq(req);
  const cproducto = String(req.body?.cproducto ?? meta.cproducto ?? '').trim();
  const ramos = [cramo];
  if (!cproducto || cproducto === '57') return ramos;
  if (String(meta.cproductor || '') === '80080') delete meta.cproductor;
  try {
    const planes = await getPlanesPersonas(cramo, { ...meta, cproducto });
    for (const plan of planes) {
      const n = Number(plan?.cramo);
      if (Number.isInteger(n) && n > 0 && !ramos.includes(n)) ramos.push(n);
    }
  } catch (err) {
    console.warn('[personas/poliza-vigente] planes del producto:', err instanceof Error ? err.message : err);
  }
  return ramos;
}

router.post('/poliza-vigente', async (req, res) => {
  const rif = String(req.body?.rif ?? req.body?.identificacion ?? '').replace(/\D/g, '');
  const cramo = req.body?.cramo != null ? Number(req.body.cramo) : 9;
  const tipoPoliza = cramo === 9 ? 'póliza funeraria vigente' : 'póliza vigente de este producto';

  if (rif.length < 6) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_CEDULA',
      message: 'La cédula debe tener al menos 6 dígitos.',
    });
  }

  try {
    let result = { hasVigente: false };
    for (const ramo of await ramosPolizaVigente(req, cramo)) {
      result = await checkPolizaVigentePersonas({ rif, cramo: ramo });
      if (result.hasVigente) break;
    }
    if (result.hasVigente) {
      return res.status(200).json({
        success: true,
        blocked: true,
        code: 'PERSONAS_DUPLICATE',
        cnpoliza: result.cnpoliza,
        message: `Ya existe una ${tipoPoliza} para esta cédula.`,
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

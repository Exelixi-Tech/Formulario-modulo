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
  const keys = ['centidad', 'citem', 'cgestor', 'cproducto', 'cproductor', 'ccanalalt', 'ccanalalt_in'];
  for (const key of keys) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      meta[key] = String(q[key]).trim();
    }
  }
  return meta;
}

router.get('/planes', async (req, res) => {
  const cramo = req.query.cramo != null ? Number(req.query.cramo) : 9;
  const meta = funeralCanalFromReq(req);
  try {
    const planes = await getPlanesPersonas(cramo, meta);
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

router.post('/poliza-vigente', async (req, res) => {
  const rif = String(req.body?.rif ?? req.body?.identificacion ?? '').replace(/\D/g, '');
  const cramo = req.body?.cramo != null ? Number(req.body.cramo) : 9;

  if (rif.length < 6) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_CEDULA',
      message: 'La cédula debe tener al menos 6 dígitos.',
    });
  }

  try {
    const result = await checkPolizaVigentePersonas({ rif, cramo });
    if (result.hasVigente) {
      return res.status(200).json({
        success: true,
        blocked: true,
        code: 'PERSONAS_DUPLICATE',
        cnpoliza: result.cnpoliza,
        message: 'Ya existe una póliza funeraria vigente para esta cédula.',
      });
    }
    return res.json({
      success: true,
      blocked: false,
      message: 'No hay póliza funeraria vigente para esta cédula.',
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

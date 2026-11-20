/**
 * /api/rcv-cotizacion — Emitir RCV desde cotización de SysIP (cotizacionID firmado en el nexus_token).
 *
 * Formulario solo LEE la cotización para fijar el vehículo y el tomador y comparar el OCR del carnet.
 * La emisión y sus validaciones las hace Emisión. El número sale de la metadata del token, nunca del
 * query ni del body.
 */
const express = require('express');
const { getCotizacionAuto } = require('../services/nestApiClient');

const router = express.Router();

const COTIZACION_ID_RE = /^\d{1,20}$/;

/** cotizacionID (o cotizacionId) de la metadata verificada del token; null si no hay o no es válido. */
function readCotizacionId(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = String(metadata.cotizacionID ?? metadata.cotizacionId ?? '').trim();
  return COTIZACION_ID_RE.test(raw) && Number(raw) > 0 ? raw : null;
}

const codigoNombre = (v) => (v && typeof v === 'object' ? { codigo: v.codigo ?? null, nombre: v.nombre ?? '' } : null);

/** Solo lo que Formulario necesita (sin primas ni coberturas). */
function toVistaFormulario(c) {
  const v = c.vehiculo || {};
  const t = c.tomador || {};
  return {
    cproces: String(c.cproces ?? ''),
    tomador: { tipoDoc: t.tipoDoc ?? null, documento: t.documento != null ? String(t.documento) : null, nombre: t.nombre ?? '' },
    vehiculo: {
      marca: codigoNombre(v.marca),
      modelo: codigoNombre(v.modelo),
      version: codigoNombre(v.version),
      anio: v.anio != null ? Number(v.anio) : null,
      uso: codigoNombre(v.uso),
      tipo: codigoNombre(v.tipo),
      puestos: v.puestos ?? null,
      toneladas: v.toneladas ?? null,
      tipoPlaca: v.tipoPlaca ?? null,
    },
  };
}

/**
 * GET /api/rcv-cotizacion/vehiculo
 * 200 { success, data: { cproces, tomador, vehiculo } } · 403 sin cotización en el token · 404 no existe · 502 nest-api.
 */
router.get('/vehiculo', async (req, res) => {
  const cproces = readCotizacionId(req.nexusMetadata);
  if (!cproces) {
    return res.status(403).json({
      success: false,
      code: 'COTIZACION_NO_EN_TOKEN',
      message: 'La sesión no trae una cotización. Vuelve a abrirla desde SysIP.',
    });
  }
  try {
    const cotizacion = await getCotizacionAuto(cproces);
    return res.json({ success: true, data: toVistaFormulario(cotizacion) });
  } catch (err) {
    const status = err.httpStatus === 404 ? 404 : 502;
    console.warn(`[rcv-cotizacion/vehiculo] cproces=${cproces} ${err.code || ''} ${err.message}`);
    return res.status(status).json({ success: false, code: err.code || 'COTIZACION_NO_DISPONIBLE', message: err.message });
  }
});

module.exports = router;
module.exports._internal = { readCotizacionId, toVistaFormulario };

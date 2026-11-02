/**
 * Renovar = póliza nueva (cnpoliza_rel). Precarga del Formulario saltando OCR.
 * La key de nest-api vive en el server (scope renovacion:read); el navegador nunca la ve.
 */
const express = require('express');
const { getRenovacion } = require('../services/nestApiClient');
const { normalizarCnpoliza, aplicarPermisoVentana, respuestaCliente } = require('../lib/renovacion');

const router = express.Router();

router.get('/:cnpoliza', async (req, res) => {
  const cnpoliza = normalizarCnpoliza(req.params.cnpoliza);
  res.set({ 'Cache-Control': 'no-store, private' });
  if (!cnpoliza) {
    return res.status(400).json({
      success: false,
      code: 'RENOVACION_POLIZA_INVALIDA',
      message: 'Número de póliza inválido.',
    });
  }
  try {
    const data = aplicarPermisoVentana(await getRenovacion(cnpoliza));
    return res.json({ success: true, data: respuestaCliente(data) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[renovacion]', cnpoliza, msg);
    const status = err.status === 404 ? 404 : (err.status === 401 || err.status === 403 ? 502 : (err.status || 502));
    return res.status(status).json({
      success: false,
      code: err.status === 404 ? 'RENOVACION_POLIZA_NO_ENCONTRADA' : (err.code || 'RENOVACION_ERROR'),
      message: err.status === 404
        ? 'No se encontró la póliza a renovar.'
        : 'No se pudieron consultar los datos de la póliza a renovar.',
    });
  }
});

module.exports = router;

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizarCnpoliza,
  aplicarPermisoVentana,
  respuestaCliente,
  esLaPolizaQueSeRenueva,
} = require('../src/lib/renovacion');

test('normalizarCnpoliza acepta el formato Sis2000 y rechaza basura', () => {
  assert.equal(normalizarCnpoliza(' 18-1-0130481024 '), '18-1-0130481024');
  assert.equal(normalizarCnpoliza('49-1-1100016139'), '49-1-1100016139');
  assert.equal(normalizarCnpoliza('../etc'), null);
  assert.equal(normalizarCnpoliza(''), null);
  assert.equal(normalizarCnpoliza("1' OR 1=1"), null);
});

test('fuera de ventana solo se permite con la variable de pruebas', () => {
  const data = { elegible: false, motivo: 'ANTES_DE_VENTANA', mensaje: 'Aún no', advertencias: [] };
  assert.equal(aplicarPermisoVentana(data, {}).elegible, false);
  const forzada = aplicarPermisoVentana(data, { RENOVACION_PERMITIR_FUERA_VENTANA: 'true' });
  assert.equal(forzada.elegible, true);
  assert.equal(forzada.forzada_fuera_ventana, true);
  assert.equal(forzada.advertencias.length, 1);
});

test('anulada o ya renovada siguen bloqueadas aunque esté la variable', () => {
  const env = { RENOVACION_PERMITIR_FUERA_VENTANA: 'true' };
  assert.equal(aplicarPermisoVentana({ elegible: false, motivo: 'ANULADA' }, env).elegible, false);
  assert.equal(aplicarPermisoVentana({ elegible: false, motivo: 'YA_RENOVADA' }, env).elegible, false);
});

test('respuestaCliente arma emision_sugerida si falta', () => {
  const out = respuestaCliente({ elegible: true, poliza_origen: { cnpoliza: '18-1-1' } });
  assert.deepEqual(out.emision_sugerida, { flujo: 'renovacion', cnpoliza_rel: '18-1-1', itipoEmi: 'NU' });
  assert.deepEqual(out.asegurados, []);
});

test('la póliza vigente solo se ignora si es la que se renueva', () => {
  assert.equal(esLaPolizaQueSeRenueva('18-1-0130481024', '18-1-0130481024'), true);
  assert.equal(esLaPolizaQueSeRenueva('18-1-0130481025', '18-1-0130481024'), false);
  assert.equal(esLaPolizaQueSeRenueva(undefined, '18-1-0130481024'), false);
});

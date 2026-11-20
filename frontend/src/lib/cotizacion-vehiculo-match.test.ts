import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compararVehiculo,
  mensajeNoCoincide,
  mismoDocumento,
  splitNombreCompleto,
} from './cotizacion-vehiculo-match.ts';

const cot = {
  marca: { codigo: '021', nombre: 'TOYOTA' },
  modelo: { codigo: '005', nombre: 'COROLLA XEI' },
  anio: 2015,
};

test('mismo vehículo por texto: coincide (modelo abreviado en el carnet, acentos y mayúsculas)', () => {
  const r = compararVehiculo({ marca: 'Toyota', modelo: 'corolla', año: '2015' }, cot);
  assert.equal(r.coincide, true);
  assert.deepEqual(r.diferencias, []);
  assert.equal(mensajeNoCoincide(r), null);
});

test('por código INMA cuando ambos lo traen ("21" = "021")', () => {
  assert.equal(compararVehiculo({ marca: 'X', modelo: 'Y', año: 2015, cmarca: '21', cmodelo: '5' }, cot).coincide, true);
  const r = compararVehiculo({ marca: 'TOYOTA', modelo: 'COROLLA', año: 2015, cmarca: '22', cmodelo: '5' }, cot);
  assert.equal(r.coincide, false);
  assert.deepEqual(r.diferencias.map((d) => d.campo), ['marca']);
});

test('otra marca u otro año: no coincide y el aviso dice qué', () => {
  const r = compararVehiculo({ marca: 'FORD', modelo: 'FIESTA', año: '2012' }, cot);
  assert.equal(r.coincide, false);
  assert.deepEqual(r.diferencias.map((d) => d.campo), ['marca', 'modelo', 'año']);
  assert.match(mensajeNoCoincide(r) ?? '', /marca: FORD vs TOYOTA/);
  assert.match(mensajeNoCoincide(r) ?? '', /año: 2012 vs 2015/);
});

test('sin OCR o incompleto: no coincide (no se precarga)', () => {
  const r = compararVehiculo(null, cot);
  assert.equal(r.coincide, false);
  assert.equal(r.sinDatosOcr, true);
  assert.match(mensajeNoCoincide(r) ?? '', /No se pudo leer/);
  assert.equal(compararVehiculo({ marca: 'TOYOTA', modelo: 'COROLLA' }, cot).coincide, false);
});

test('mismoDocumento ignora tipo, ceros a la izquierda y separadores', () => {
  assert.equal(mismoDocumento('V-12.345.678', '12345678'), true);
  assert.equal(mismoDocumento('012345678', 12345678), true);
  assert.equal(mismoDocumento('12345678', '87654321'), false);
  assert.equal(mismoDocumento('', ''), false);
});

test('splitNombreCompleto como el server de Emisión', () => {
  assert.deepEqual(splitNombreCompleto('ANA MARIA PEREZ GOMEZ', 'V'), { nombre: 'ANA MARIA', apellido: 'PEREZ GOMEZ' });
  assert.deepEqual(splitNombreCompleto('ANA PEREZ', 'V'), { nombre: 'ANA', apellido: 'PEREZ' });
  assert.deepEqual(splitNombreCompleto('EMPRESA C.A.', 'J'), { nombre: 'EMPRESA C.A.', apellido: '' });
});

/**
 * Se corre con: node --test frontend/src/lib/nombre-no-es-dato.test.ts
 * RCV 18-1-0000139376: no se puede continuar con un nombre o apellido que sea solo sexo, estado
 * civil, nacionalidad o un rótulo de la cédula.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { errorNombreNoEsDato, noEsNombre, nombreDesdeOcr } from './nombre-no-es-dato.ts';

test('bloquea sexo, estado civil, nacionalidad y rótulos', () => {
  for (const v of [
    'Masculino', 'FEMENINO', 'M', 'Soltero(a)', 'Casado', 'VIUDA', 'Venezolano', 'NOMBRES',
    'Apellidos', 'CÉDULA DE IDENTIDAD', 'Estado civil',
  ]) {
    assert.equal(noEsNombre(v, 'nombre'), true, v);
  }
  assert.match(errorNombreNoEsDato('Masculino', 'nombre') ?? '', /«Masculino» no es un nombre/);
  assert.match(errorNombreNoEsDato('VENEZOLANO', 'apellido') ?? '', /no es un apellido/);
});

test('deja pasar nombres, apellidos y razones sociales reales', () => {
  const casos: [string, 'nombre' | 'apellido'][] = [
    ['Danry Fernando', 'nombre'],
    ['Rodriguez Peña', 'apellido'],
    ['Casado', 'apellido'],
    ['Soltero', 'apellido'],
    ['Viuda de Pérez', 'apellido'],
    ['María Soltero', 'nombre'],
    ['Venezolana de Instrumentación Mecanica y Electricidad Venime', 'nombre'],
    ['Nacional de Repuestos', 'nombre'],
    ['', 'nombre'],
  ];
  for (const [v, campo] of casos) {
    assert.equal(noEsNombre(v, campo), false, v);
    assert.equal(errorNombreNoEsDato(v, campo), null, v);
  }
});

test('precarga desde el OCR: «Masculino» queda vacío; un nombre real pasa igual', () => {
  assert.equal(nombreDesdeOcr('Masculino', 'nombre'), '');
  assert.equal(nombreDesdeOcr('DANRY FERNANDO', 'nombre'), 'DANRY FERNANDO');
  assert.equal(nombreDesdeOcr('RODRIGUEZ PEÑA', 'apellido'), 'RODRIGUEZ PEÑA');
  assert.equal(nombreDesdeOcr(undefined, 'nombre'), '');
});

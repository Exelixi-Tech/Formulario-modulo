/**
 * Emitir RCV desde cotización de SysIP — comparación pura (sin red ni store) entre lo que leyó el OCR del
 * carnet y el vehículo de la cotización. Pruebas: node --test src/lib/cotizacion-vehiculo-match.test.ts
 *
 * Criterio: marca + modelo + año. Por código INMA cuando ambos lados lo traen; si no, por texto normalizado
 * (sin acentos, mayúsculas, espacios simples). El modelo coincide si un texto contiene al otro (el carnet
 * suele abreviar: "COROLLA" vs "COROLLA XEI"). La versión no se exige: el carnet casi nunca la trae.
 */

export interface CodigoNombre {
  codigo: string | number | null;
  nombre: string;
}

export interface VehiculoCotizacion {
  marca: CodigoNombre | null;
  modelo: CodigoNombre | null;
  anio: number | null;
}

/** Lo leído del carnet. Los códigos solo si el OCR ya se resolvió contra el catálogo INMA. */
export interface VehiculoOcr {
  marca?: string | null;
  modelo?: string | null;
  año?: string | number | null;
  cmarca?: string | null;
  cmodelo?: string | null;
}

export type CampoVehiculo = 'marca' | 'modelo' | 'año';

export interface DiferenciaVehiculo {
  campo: CampoVehiculo;
  leido: string;
  cotizacion: string;
}

export interface ResultadoComparacion {
  /** true: lo leído es el mismo vehículo; se puede precargar placa, seriales y color. */
  coincide: boolean;
  /** true: el OCR no trajo marca, modelo o año; no hay con qué comparar. */
  sinDatosOcr: boolean;
  diferencias: DiferenciaVehiculo[];
}

export function normalizarTexto(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Códigos INMA comparables ("021" = "21"). */
function normalizarCodigo(v: unknown): string {
  const s = String(v ?? '').trim();
  return /^\d+$/.test(s) ? String(Number(s)) : s.toUpperCase();
}

function contieneUnoAlOtro(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function mismoCampo(
  ocrTexto: unknown,
  ocrCodigo: unknown,
  cot: CodigoNombre | null,
  porInclusion: boolean,
): boolean {
  if (!cot) return false;
  const cOcr = normalizarCodigo(ocrCodigo);
  const cCot = normalizarCodigo(cot.codigo);
  if (cOcr && cCot) return cOcr === cCot;
  const tOcr = normalizarTexto(ocrTexto);
  const tCot = normalizarTexto(cot.nombre);
  if (!tOcr || !tCot) return false;
  return porInclusion ? contieneUnoAlOtro(tOcr, tCot) : tOcr === tCot;
}

export function compararVehiculo(ocr: VehiculoOcr | null | undefined, cot: VehiculoCotizacion): ResultadoComparacion {
  const marcaOcr = normalizarTexto(ocr?.marca);
  const modeloOcr = normalizarTexto(ocr?.modelo);
  const anioOcr = parseInt(String(ocr?.año ?? ''), 10);
  const sinDatosOcr = (!marcaOcr && !ocr?.cmarca) || (!modeloOcr && !ocr?.cmodelo) || !Number.isFinite(anioOcr);

  const diferencias: DiferenciaVehiculo[] = [];
  if (!mismoCampo(ocr?.marca, ocr?.cmarca, cot.marca, true)) {
    diferencias.push({ campo: 'marca', leido: marcaOcr || '—', cotizacion: cot.marca?.nombre || '—' });
  }
  if (!mismoCampo(ocr?.modelo, ocr?.cmodelo, cot.modelo, true)) {
    diferencias.push({ campo: 'modelo', leido: modeloOcr || '—', cotizacion: cot.modelo?.nombre || '—' });
  }
  if (!Number.isFinite(anioOcr) || anioOcr !== Number(cot.anio)) {
    diferencias.push({
      campo: 'año',
      leido: Number.isFinite(anioOcr) ? String(anioOcr) : '—',
      cotizacion: cot.anio != null ? String(cot.anio) : '—',
    });
  }
  return { coincide: !sinDatosOcr && diferencias.length === 0, sinDatosOcr, diferencias };
}

/** Texto del aviso cuando no se precarga (null si coincide). */
export function mensajeNoCoincide(r: ResultadoComparacion): string | null {
  if (r.coincide) return null;
  if (r.sinDatosOcr) {
    return 'No se pudo leer marca, modelo y año del carnet para compararlos con la cotización. Escribe placa, seriales y color a mano.';
  }
  const detalle = r.diferencias.map((d) => `${d.campo}: ${d.leido} vs ${d.cotizacion}`).join('; ');
  return `El carnet leído no coincide con el vehículo de la cotización (${detalle}). Escribe placa, seriales y color a mano.`;
}

/** Misma cédula/RIF (solo dígitos; el tipo V/E/J se ignora porque el OCR a veces no lo trae). */
export function mismoDocumento(a: unknown, b: unknown): boolean {
  const da = String(a ?? '').replace(/\D/g, '').replace(/^0+/, '');
  const db = String(b ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return da !== '' && da === db;
}

/** Nombre completo de la cotización → nombre/apellido (misma regla que el server de Emisión). */
export function splitNombreCompleto(nombreCompleto: unknown, tipoDoc: unknown): { nombre: string; apellido: string } {
  const full = String(nombreCompleto ?? '').trim().replace(/\s+/g, ' ');
  const tipo = String(tipoDoc ?? '').trim().toUpperCase().charAt(0);
  if (['J', 'G', 'C'].includes(tipo)) return { nombre: full, apellido: '' };
  const words = full ? full.split(' ') : [];
  if (words.length <= 1) return { nombre: full, apellido: full };
  if (words.length === 2) return { nombre: words[0], apellido: words[1] };
  if (words.length === 3) return { nombre: words[0], apellido: words.slice(1).join(' ') };
  return { nombre: words.slice(0, 2).join(' '), apellido: words.slice(2).join(' ') };
}

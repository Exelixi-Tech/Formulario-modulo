/**
 * Emitir RCV desde cotización de SysIP en Formulario (flujo OCR → Formulario → Emisión → Pagos).
 *
 * Solo aplica si el nexus_token trae `cotizacionID`; sin él Formulario sigue exactamente igual.
 * Al abrir: lee la cotización (server de Formulario → nest-api), fija vehículo (año, marca, modelo,
 * versión, uso) e identidad del tomador con los datos de la cotización y compara el carnet leído por OCR:
 *   - coincide (marca + modelo + año): se conservan placa, seriales y color que precargó el OCR;
 *   - no coincide: se limpian (el usuario los escribe) y se muestra un aviso con las diferencias.
 * Los datos personales del OCR de la cédula (fecha de nacimiento, sexo, estado civil) solo se conservan
 * si la cédula leída es la del tomador de la cotización.
 */
import { create } from 'zustand';
import { rcvCotizacionApi, type CotizacionFormulario } from './api';
import { decodeNexusTokenMetadata, getNexusToken } from './nexus-token-client';
import { resolveOcrModelo } from './vehicle-carnet-labels';
import { useWizardStore } from '../store/wizardStore';
import {
  compararVehiculo,
  mensajeNoCoincide,
  mismoDocumento,
  splitNombreCompleto,
  type ResultadoComparacion,
} from './cotizacion-vehiculo-match';

const NEXUS_TOKEN_KEY = 'nexus_access_token_formulario';
const COTIZACION_ID_RE = /^\d{1,20}$/;
/** Placa/seriales se limpian una sola vez por cotización: al volver a Formulario no se borra lo escrito. */
const APLICADA_KEY = (cproces: string) => `formulario_cotizacion_aplicada_${cproces}`;

export function readCotizacionIdFromToken(): string | null {
  const token = getNexusToken(NEXUS_TOKEN_KEY);
  const meta = token ? decodeNexusTokenMetadata(token) : null;
  const raw = String(meta?.cotizacionID ?? meta?.cotizacionId ?? '').trim();
  return COTIZACION_ID_RE.test(raw) && Number(raw) > 0 ? raw : null;
}

export function isCotizacionFlow(): boolean {
  try {
    return readCotizacionIdFromToken() != null;
  } catch {
    return false;
  }
}

type Estado = 'inactivo' | 'cargando' | 'listo' | 'error';

interface CotizacionFormularioState {
  estado: Estado;
  cotizacion: CotizacionFormulario | null;
  comparacion: ResultadoComparacion | null;
  /** Aviso para el paso del vehículo cuando no se precargó desde el OCR. */
  aviso: string | null;
  error: string | null;
}

export const useCotizacionFormulario = create<CotizacionFormularioState>()(() => ({
  estado: 'inactivo',
  cotizacion: null,
  comparacion: null,
  aviso: null,
  error: null,
}));

/** true cuando los datos de la cotización ya se aplicaron: selectores e identidad quedan fijos. */
export function useCotizacionFija(): boolean {
  return useCotizacionFormulario((s) => s.estado === 'listo');
}

function codigo(v: { codigo: string | number | null } | null | undefined): string {
  return v?.codigo != null ? String(v.codigo) : '';
}

function yaAplicada(cproces: string): boolean {
  try {
    return sessionStorage.getItem(APLICADA_KEY(cproces)) === '1';
  } catch {
    return false;
  }
}

function marcarAplicada(cproces: string): void {
  try {
    sessionStorage.setItem(APLICADA_KEY(cproces), '1');
  } catch {
    /* sin storage: se volvería a limpiar al recargar, nada más */
  }
}

function aplicarAlWizard(c: CotizacionFormulario, comparacion: ResultadoComparacion): void {
  const store = useWizardStore.getState();
  const v = c.vehiculo;
  const primeraVez = !yaAplicada(c.cproces);

  store.setVehicle({
    año: v.anio != null ? String(v.anio) : '',
    cmarca: codigo(v.marca),
    marca: v.marca?.nombre ?? '',
    cmodelo: codigo(v.modelo),
    modelo: v.modelo?.nombre ?? '',
    cversion: codigo(v.version),
    ccategoria_uso: v.uso?.codigo ?? undefined,
    xcategoria_uso: v.uso?.nombre ?? '',
    uso: v.uso?.nombre ?? '',
    // Otro vehículo en el carnet: nada de lo leído sirve.
    ...(!comparacion.coincide && primeraVez ? { placa: '', serial: '', serialMotor: '', color: '' } : {}),
  });

  const tipoDoc = String(c.tomador.tipoDoc ?? 'V').trim().toUpperCase().charAt(0) || 'V';
  const documento = String(c.tomador.documento ?? '').replace(/\D/g, '');
  const ocrCedula = store.documents?.cedula?.ocr?.identificacion ?? store.tomador.identificacion;
  const esElTomador = mismoDocumento(ocrCedula, documento);
  const nombres = splitNombreCompleto(c.tomador.nombre, tipoDoc);
  store.setTomador({
    tipoDoc,
    identificacion: documento,
    // Si la cédula leída es la del tomador, el OCR parte mejor nombre y apellido.
    nombre: esElTomador && store.tomador.nombre ? store.tomador.nombre : nombres.nombre,
    apellido: esElTomador && store.tomador.apellido ? store.tomador.apellido : nombres.apellido,
    ...(!esElTomador && primeraVez ? { fechaNac: '', sexo: '', estadoCivil: '' } : {}),
  });

  if (primeraVez) marcarAplicada(c.cproces);
}

/** Lee la cotización del token y la aplica al wizard (una vez por carga de página). */
export async function cargarCotizacionFormulario(): Promise<void> {
  if (!isCotizacionFlow()) return;
  if (useCotizacionFormulario.getState().estado !== 'inactivo') return;
  useCotizacionFormulario.setState({ estado: 'cargando', error: null });
  try {
    const { data } = await rcvCotizacionApi.vehiculo();
    const c = data.data;
    const { documents, vehicle } = useWizardStore.getState();
    const cert = documents?.certificado?.ocr;
    // Lo leído del carnet; sin documentos del OCR, lo que el módulo OCR dejó en el vehículo.
    const ocr = cert
      ? { marca: cert.marca, modelo: resolveOcrModelo(cert), año: cert.año }
      : { marca: vehicle.marca, modelo: vehicle.modelo, año: vehicle.año };
    const comparacion = compararVehiculo(ocr, c.vehiculo);
    aplicarAlWizard(c, comparacion);
    useCotizacionFormulario.setState({
      estado: 'listo',
      cotizacion: c,
      comparacion,
      aviso: mensajeNoCoincide(comparacion),
    });
  } catch (err) {
    const message =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? (err instanceof Error ? err.message : 'No se pudo leer la cotización.');
    useCotizacionFormulario.setState({ estado: 'error', error: message });
  }
}

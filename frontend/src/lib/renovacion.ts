/**
 * Renovar = póliza nueva enlazada (cnpoliza_rel, itipoEmi NU).
 *
 * Entrada: `/ocr/?nexus_token=…&renovar=<cnpoliza>` (OCR salta directo a Formulario) o
 * `/formulario/?nexus_token=…&renovar=<cnpoliza>`. El server del módulo consulta nest-api
 * `GET /api/v1/renovacion/:cnpoliza` (la key nunca llega al navegador) y aquí se precarga el store.
 *
 * Sin `renovar` ni `renovacion` en la sesión del flujo, nada de esto se ejecuta: el flujo normal
 * (OCR → Formulario → Emisión → Pagos) queda igual.
 */
import { useWizardStore } from '../store/wizardStore';
import { fetchRenovacion, type RenovacionApiData, type RenovacionPersonaApi } from './api';
import { mapProprietaryToPerson } from './map-proprietary';
import { persistProductFromHints } from './product';
import type { FuneralPerson, VehicleData } from '../types';

export type RenovacionEstado = 'pendiente' | 'cargando' | 'listo' | 'bloqueada' | 'error';

/** Lo que viaja en la sesión del flujo (Emisión y Pagos lo leen de `state.renovacion`). */
export interface RenovacionState {
  flujo: 'renovacion';
  cnpoliza_rel: string;
  itipoEmi: 'NU';
  estado: RenovacionEstado;
  precargada?: boolean;
  tipo?: 'RCV' | 'PERSONAS' | string;
  mensaje?: string | null;
  motivo?: string | null;
  fdesde_sugerida?: string | null;
  fhasta_sugerida?: string | null;
  continuidad?: boolean;
  forzada_fuera_ventana?: boolean;
  ifrecuencia?: string | null;
  xplan_anterior?: string | null;
  fhasta_anterior?: string | null;
  plan_actual?: RenovacionApiData['plan_actual'];
  otros_planes?: RenovacionApiData['otros_planes'];
  advertencias?: string[];
}

const CNPOLIZA_RE = /^[0-9A-Z][0-9A-Z-]{2,29}$/;

/** `?renovar=<cnpoliza>` (o `?flujo=renovacion&cnpoliza=<n>`). */
export function getRenovarParam(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const qs = new URLSearchParams(window.location.search);
    const raw = qs.get('renovar')
      || (qs.get('flujo') === 'renovacion' ? qs.get('cnpoliza') : null);
    const s = String(raw ?? '').trim().toUpperCase();
    return CNPOLIZA_RE.test(s) ? s : null;
  } catch {
    return null;
  }
}

export function getRenovacion(): RenovacionState | null {
  const r = (useWizardStore.getState() as unknown as { renovacion?: RenovacionState | null }).renovacion;
  return r && r.flujo === 'renovacion' && r.cnpoliza_rel ? r : null;
}

export function useRenovacion(): RenovacionState | null {
  return useWizardStore((s) => {
    const r = (s as unknown as { renovacion?: RenovacionState | null }).renovacion;
    return r && r.flujo === 'renovacion' && r.cnpoliza_rel ? r : null;
  });
}

/** Renovación ya precargada: identidad (cédula, placa, serial) en solo lectura. */
export function useRenovacionBloqueaIdentidad(): boolean {
  const r = useRenovacion();
  return Boolean(r?.precargada);
}

function setRenovacion(next: RenovacionState | null) {
  useWizardStore.setState({ renovacion: next } as never);
}

/** ¿Hay que consultar y precargar? (URL nueva o sesión del flujo que viene de OCR sin precarga). */
export function debeIniciarRenovacion(): boolean {
  const desdeUrl = getRenovarParam();
  const actual = getRenovacion();
  if (desdeUrl && (!actual || actual.cnpoliza_rel !== desdeUrl)) return true;
  return Boolean(actual && !actual.precargada && actual.estado !== 'bloqueada');
}

function personaToProprietary(p: RenovacionPersonaApi) {
  return {
    xnombre: p.xnombre ?? undefined,
    xapellido: p.xapellido ?? undefined,
    fnacimiento: p.fnacimiento ?? undefined,
    isexo: p.isexo ?? undefined,
    ipersona: p.icedula ?? undefined,
    iestado_civil: p.iestado_civil ?? undefined,
    cestado: p.cestado ?? undefined,
    cciudad: p.cciudad ?? undefined,
    cci_rif: p.cci_rif ?? undefined,
    xcorreo: p.xcorreo ?? undefined,
    xtelefono: p.xtelefono ?? undefined,
    xavecalle: p.xdireccion ?? undefined,
  };
}

function mismaPersona(a?: RenovacionPersonaApi | null, b?: RenovacionPersonaApi | null): boolean {
  const da = String(a?.cci_rif ?? '').replace(/\D/g, '');
  const db = String(b?.cci_rif ?? '').replace(/\D/g, '');
  return Boolean(da && db && da === db);
}

function mapVehiculo(v: NonNullable<RenovacionApiData['vehiculo']>): Partial<VehicleData> {
  const out: Partial<VehicleData> = { tipoPlaca: 'nacional' };
  if (v.xplaca) out.placa = String(v.xplaca).trim().toUpperCase();
  if (v.cano != null) out.año = String(v.cano);
  if (v.xmarca) out.marca = v.xmarca;
  if (v.xmodelo) out.modelo = v.xmodelo;
  if (v.cmarca) out.cmarca = String(v.cmarca);
  if (v.cmodelo) out.cmodelo = String(v.cmodelo);
  if (v.cversion) out.cversion = String(v.cversion);
  if (v.xcolor) out.color = v.xcolor;
  if (v.xsercar) out.serial = String(v.xsercar).trim().toUpperCase();
  if (v.xsermot) out.serialMotor = String(v.xsermot).trim().toUpperCase();
  return out;
}

function mapAseguradoPersonas(
  a: RenovacionApiData['asegurados'][number],
  idx: number,
): FuneralPerson {
  const cid = String(a.cid ?? '').trim();
  const tipoDoc = /^[VEJGPC]/i.test(cid) ? cid.charAt(0).toUpperCase() : 'V';
  const base = mapProprietaryToPerson(personaToProprietary({
    cci_rif: a.cci_rif,
    icedula: tipoDoc,
    xnombre: a.xnombre,
    xapellido: a.xapellido,
    isexo: a.isexo,
    iestado_civil: a.iestado_civil,
    fnacimiento: a.fnacimiento,
  } as RenovacionPersonaApi));
  return {
    tipoDoc: base.tipoDoc || tipoDoc,
    identificacion: base.identificacion || '',
    nombre: base.nombre || '',
    apellido: base.apellido || '',
    fechaNac: base.fechaNac || '',
    sexo: base.sexo || '',
    estadoCivil: base.estadoCivil || undefined,
    parentesco: String(a.cparentesco ?? (idx === 0 ? '1' : '')),
  };
}

function mapBeneficiarioPersonas(b: RenovacionApiData['beneficiarios'][number]): FuneralPerson {
  const cid = String(b.cid ?? '').trim();
  const tipoDoc = /^[VEJGPC]/i.test(cid) ? cid.charAt(0).toUpperCase() : 'V';
  return {
    tipoDoc,
    identificacion: String(b.cci_rif ?? '').replace(/\D/g, ''),
    nombre: b.xnombre ?? '',
    apellido: b.xapellido ?? '',
    fechaNac: '',
    sexo: '',
    parentesco: String(b.cparentesco ?? ''),
    ...(b.pporcentaje != null ? { pporcen: Number(b.pporcentaje) } : {}),
  };
}

/** Vuelca la respuesta en el store (mismo formato que el OCR/Sis2000 de siempre). */
function aplicarPrecarga(data: RenovacionApiData) {
  const store = useWizardStore.getState();
  const esRcv = String(data.tipo).toUpperCase() === 'RCV';
  if (esRcv) persistProductFromHints({ product: 'rcv' });

  if (data.tomador) {
    store.setTomador(mapProprietaryToPerson(personaToProprietary(data.tomador)));
  }
  const titular = data.titular;
  if (titular && data.tomador && !mismaPersona(titular, data.tomador)) {
    store.setSameInsured(false);
    store.setAsegurado(mapProprietaryToPerson(personaToProprietary(titular)));
  } else {
    store.setSameInsured(true);
  }

  if (esRcv && data.vehiculo) {
    store.setVehicle(mapVehiculo(data.vehiculo));
  }

  if (!esRcv && (data.asegurados?.length || data.beneficiarios?.length)) {
    const asegurados = (data.asegurados ?? []).map(mapAseguradoPersonas);
    const beneficiarios = (data.beneficiarios ?? []).map(mapBeneficiarioPersonas);
    store.setFuneral({
      ...(asegurados.length ? { asegurados } : {}),
      ...(beneficiarios.length ? { beneficiarios } : {}),
      ...(data.poliza_origen?.ifrecuencia ? { frecuencia: String(data.poliza_origen.ifrecuencia) } : {}),
    });
  }
}

/**
 * Consulta la póliza y precarga el Formulario. Elegible → paso 2 (cliente) con identidad bloqueada;
 * no elegible → estado `bloqueada` con el mensaje de nest-api (la pantalla no deja continuar).
 */
export async function iniciarRenovacion(): Promise<void> {
  const cnpoliza = getRenovarParam() || getRenovacion()?.cnpoliza_rel;
  if (!cnpoliza) return;
  const base: RenovacionState = {
    flujo: 'renovacion',
    cnpoliza_rel: cnpoliza,
    itipoEmi: 'NU',
    estado: 'cargando',
  };
  setRenovacion(base);
  try {
    const data = await fetchRenovacion(cnpoliza);
    const resumen: RenovacionState = {
      ...base,
      tipo: data.tipo,
      mensaje: data.mensaje,
      motivo: data.motivo,
      fdesde_sugerida: data.fdesde_sugerida,
      fhasta_sugerida: data.fhasta_sugerida,
      continuidad: data.continuidad,
      forzada_fuera_ventana: data.forzada_fuera_ventana,
      ifrecuencia: data.poliza_origen?.ifrecuencia ?? null,
      xplan_anterior: data.poliza_origen?.xplan ?? data.plan_actual?.xplan ?? null,
      fhasta_anterior: data.poliza_origen?.fhasta ?? null,
      plan_actual: data.plan_actual,
      otros_planes: data.otros_planes,
      advertencias: data.advertencias ?? [],
    };
    if (!data.elegible) {
      setRenovacion({ ...resumen, estado: 'bloqueada' });
      return;
    }
    aplicarPrecarga(data);
    const store = useWizardStore.getState();
    store.setOcrDone(true);
    setRenovacion({ ...resumen, estado: 'listo', precargada: true });
    store.goTo(2);
    void window.__bridge?.save?.();
  } catch (err) {
    const msg = err instanceof Error && err.message ? err.message : 'No se pudo consultar la póliza.';
    setRenovacion({ ...base, estado: 'error', mensaje: msg });
  }
}

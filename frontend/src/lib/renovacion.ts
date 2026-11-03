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
import type { FuneralPerson, ProfesionOcupacionFields, VehicleData } from '../types';

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

/** Misma clave que OCR (mismo origen /ocr y /formulario): sobrevive al salto SSO/Nexus aunque la URL pierda el query. */
const RENOVAR_STORAGE_KEY = 'exelixi_renovar';

function normalizar(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toUpperCase();
  return CNPOLIZA_RE.test(s) ? s : null;
}

/**
 * `?renovar=<cnpoliza>` (o `?flujo=renovacion&cnpoliza=<n>`); si la URL no lo trae, el que dejó OCR en
 * sessionStorage al entrar por el link (OCR lo borra al iniciar un flujo normal).
 */
export function getRenovarParam(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const qs = new URLSearchParams(window.location.search);
    const desdeUrl = normalizar(qs.get('renovar')
      || (qs.get('flujo') === 'renovacion' ? qs.get('cnpoliza') : null));
    if (desdeUrl) {
      try { sessionStorage.setItem(RENOVAR_STORAGE_KEY, desdeUrl); } catch { /* ignore */ }
      return desdeUrl;
    }
    try { return normalizar(sessionStorage.getItem(RENOVAR_STORAGE_KEY)); } catch { return null; }
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

/**
 * Guarda `renovacion` en el store (viaja en la sesión del flujo) y una copia compacta en
 * `metadataCanal.renovacion`: Pagos arma el state de emisión con campos fijos y sí reenvía
 * metadataCanal, así Emisión recibe cnpoliza_rel/fdesde al emitir sin tocar Pagos.
 */
function setRenovacion(next: RenovacionState | null) {
  const store = useWizardStore.getState();
  const meta = { ...((store.metadataCanal as Record<string, unknown> | null) ?? {}) };
  if (next) {
    meta.renovacion = {
      flujo: next.flujo,
      cnpoliza_rel: next.cnpoliza_rel,
      itipoEmi: next.itipoEmi,
      estado: next.estado,
      precargada: Boolean(next.precargada),
      fdesde_sugerida: next.fdesde_sugerida ?? null,
      fhasta_sugerida: next.fhasta_sugerida ?? null,
      fhasta_anterior: next.fhasta_anterior ?? null,
      xplan_anterior: next.xplan_anterior ?? null,
      plan_actual: next.plan_actual
        ? { cplan: next.plan_actual.cplan, xplan: next.plan_actual.xplan, activo: next.plan_actual.activo }
        : null,
    };
  } else {
    delete meta.renovacion;
  }
  useWizardStore.setState({ renovacion: next, metadataCanal: meta } as never);
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

/**
 * Profesión / ocupación / actividad guardadas en Sis2000 (maclient_atr). Solo los códigos que vienen;
 * el formulario descarta los que no estén en el catálogo y el usuario elige los que falten.
 */
export function profesionDesdeApi(p: RenovacionPersonaApi | null | undefined): ProfesionOcupacionFields {
  const code = (v: unknown) => {
    const s = String(v ?? '').trim();
    return s && s !== '0' ? s : undefined;
  };
  const out: ProfesionOcupacionFields = { ocupacionSeparada: true };
  const cprofesion = code(p?.cprofesion);
  const cocupacion = code(p?.cocupacion);
  const cactividad = code(p?.cactividad);
  if (cprofesion) out.cprofesion = cprofesion;
  if (cocupacion) out.cocupacion = cocupacion;
  if (cactividad) out.cactividad = cactividad;
  return out;
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
  // vhcerti.cuso guarda la categoría de uso con la que se emitió (SP RCV: cuso = @ccategoria_uso).
  const uso = Number(v.cuso);
  if (Number.isFinite(uso) && uso > 0) out.ccategoria_uso = uso;
  if (v.ctipo != null && Number.isFinite(Number(v.ctipo))) out.ctipo = Number(v.ctipo);
  if (v.xversion) (out as Record<string, unknown>).xversion = v.xversion;
  if (v.qpuestos != null) (out as Record<string, unknown>).npuestos = Number(v.qpuestos);
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
    store.setTomador({
      ...mapProprietaryToPerson(personaToProprietary(data.tomador)),
      ...profesionDesdeApi(data.tomador),
    });
  }
  const titular = data.titular;
  if (titular && data.tomador && !mismaPersona(titular, data.tomador)) {
    store.setSameInsured(false);
    store.setAsegurado({
      ...mapProprietaryToPerson(personaToProprietary(titular)),
      ...profesionDesdeApi(titular),
    });
  } else {
    store.setSameInsured(true);
  }

  if (esRcv && data.vehiculo) {
    store.setVehicle(mapVehiculo(data.vehiculo));
  }
  // RCV: beneficiario preferencial y conductor habitual si la póliza los tiene.
  if (esRcv && data.beneficiario_preferencial?.cci_rif) {
    store.setHasBeneficiary(true);
    store.setBeneficiario(mapProprietaryToPerson(personaToProprietary(data.beneficiario_preferencial)));
  }
  if (esRcv && data.conductor?.cci_rif) {
    store.setHasDriver(true);
    store.setConductor(mapProprietaryToPerson(personaToProprietary(data.conductor)));
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
  console.info('[renovacion] consultando póliza', cnpoliza);
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
    console.info('[renovacion]', cnpoliza, data.elegible ? 'elegible' : data.motivo);
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
    console.warn('[renovacion] error', cnpoliza, msg);
    setRenovacion({ ...base, estado: 'error', mensaje: msg });
  }
}

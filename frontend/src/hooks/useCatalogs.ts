import { useEffect, useState } from 'react';
import {
  getEstados, getCiudades, getValrepList, getOcupaciones, getProfesiones, getActividades, type CatalogItem,
} from '../lib/api';
import { isExelixiCatalogFlow } from '../lib/exelixi-catalog';
import { EXELIXI_VENEZUELA_ESTADOS } from '../lib/exelixi-local-catalog';

export interface Catalogs {
  estados     : CatalogItem[];
  sexos       : CatalogItem[];
  estadosCivil: CatalogItem[];
  parentescos : CatalogItem[];
  profesiones : CatalogItem[];
  ocupaciones : CatalogItem[];
  actividades : CatalogItem[];
  loading     : boolean;
  error       : string | null;
}

const EMPTY: Catalogs = {
  estados: [], sexos: [], estadosCivil: [], parentescos: [], profesiones: [], ocupaciones: [], actividades: [],
  loading: true, error: null,
};

const LIST_FALLBACKS: Record<string, CatalogItem[]> = {
  SEXO: [
    { code: 'M', label: 'Masculino' },
    { code: 'F', label: 'Femenino' },
  ],
  EDOCIVIL: [
    { code: 'S', label: 'Soltero(a)' },
    { code: 'C', label: 'Casado(a)' },
    { code: 'D', label: 'Divorciado(a)' },
    { code: 'V', label: 'Viudo(a)' },
  ],
  PARENTESCOS: [
    { code: 'T', label: 'TITULAR' },
    { code: 'C', label: 'CONYUGE' },
    { code: 'H', label: 'HIJO(A)' },
  ],
};

/** Catálogos locales — flujo Exélixi genérico (sin valrep La Mundial). */
function exelixiLocalCatalogs(): Catalogs {
  return {
    estados: EXELIXI_VENEZUELA_ESTADOS,
    sexos: LIST_FALLBACKS.SEXO,
    estadosCivil: LIST_FALLBACKS.EDOCIVIL,
    parentescos: LIST_FALLBACKS.PARENTESCOS,
    profesiones: [],
    ocupaciones: [],
    actividades: [],
    loading: false,
    error: null,
  };
}

async function loadList(domain: keyof typeof LIST_FALLBACKS): Promise<CatalogItem[]> {
  try {
    return await getValrepList(domain);
  } catch (err) {
    console.warn(`[useCatalogs] ${domain} falló, usando fallback:`, (err as Error).message);
    return LIST_FALLBACKS[domain] ?? [];
  }
}

/**
 * Carga catálogos valrep en paralelo (solo flujo La Mundial).
 * En Exélixi catálogo genérico usa listas locales — sin llamadas a valrep.
 */
export function useCatalogs(): Catalogs {
  const exelixiFlow = isExelixiCatalogFlow();
  const [cats, setCats] = useState<Catalogs>(() =>
    exelixiFlow ? exelixiLocalCatalogs() : EMPTY,
  );

  useEffect(() => {
    if (exelixiFlow) {
      setCats(exelixiLocalCatalogs());
      return;
    }

    let cancelled = false;

    (async () => {
      const [estadosR, sexosR, edoR, parR, profR, ocupR, actR] = await Promise.allSettled([
        getEstados(),
        loadList('SEXO'),
        loadList('EDOCIVIL'),
        loadList('PARENTESCOS'),
        getProfesiones(),
        getOcupaciones(),
        getActividades(),
      ]);

      if (cancelled) return;

      const estados = estadosR.status === 'fulfilled' ? estadosR.value : [];
      const sexos = sexosR.status === 'fulfilled' ? sexosR.value : LIST_FALLBACKS.SEXO;
      const estadosCivil = edoR.status === 'fulfilled' ? edoR.value : LIST_FALLBACKS.EDOCIVIL;
      const parentescos = parR.status === 'fulfilled' ? parR.value : LIST_FALLBACKS.PARENTESCOS;
      const profesiones = profR.status === 'fulfilled' ? profR.value : [];
      const ocupaciones = ocupR.status === 'fulfilled' ? ocupR.value : [];
      const actividades = actR.status === 'fulfilled' ? actR.value : [];

      const errors = [estadosR, sexosR, edoR, parR, profR, ocupR, actR]
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => r.reason?.message ?? String(r.reason));

      setCats({
        estados,
        sexos,
        estadosCivil,
        parentescos,
        profesiones,
        ocupaciones,
        actividades,
        loading: false,
        error: errors.length ? errors.join('; ') : null,
      });
    })();

    return () => { cancelled = true; };
  }, [exelixiFlow]);

  return cats;
}

export interface CiudadesState {
  ciudades: CatalogItem[];
  loading : boolean;
  error   : string | null;
}

/**
 * Carga las ciudades correspondientes al estado seleccionado (La Mundial).
 * En Exélixi catálogo no consulta valrep.
 */
export function useCiudades(cestado?: number | null, cpais?: number | null): CiudadesState {
  const exelixiFlow = isExelixiCatalogFlow();
  const [state, setState] = useState<CiudadesState>({ ciudades: [], loading: false, error: null });

  useEffect(() => {
    if (exelixiFlow || !cestado) {
      setState({ ciudades: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ ciudades: [], loading: true, error: null });

    getCiudades(cestado, cpais)
      .then((ciudades) => {
        if (!cancelled) setState({ ciudades, loading: false, error: null });
      })
      .catch((err) => {
        console.warn(`[useCiudades] Error cargando ciudades del estado ${cestado}:`, err.message);
        if (!cancelled) setState({ ciudades: [], loading: false, error: err.message });
      });

    return () => { cancelled = true; };
  }, [cestado, cpais, exelixiFlow]);

  return state;
}

/**
 * Estados de un país distinto de Venezuela (ej. 57 Colombia, placa extranjera).
 * Sin cpais o con 58 devuelve lista vacía: Venezuela sigue saliendo de useCatalogs().
 */
export function useEstadosPais(cpais?: number | null): { estados: CatalogItem[]; loading: boolean } {
  const [state, setState] = useState<{ estados: CatalogItem[]; loading: boolean }>({ estados: [], loading: false });

  useEffect(() => {
    if (!cpais || cpais === 58) {
      setState({ estados: [], loading: false });
      return;
    }
    let cancelled = false;
    setState({ estados: [], loading: true });
    getEstados(cpais)
      .then((estados) => {
        if (!cancelled) setState({ estados, loading: false });
      })
      .catch((err) => {
        console.warn(`[useEstadosPais] Error cargando estados del país ${cpais}:`, err.message);
        if (!cancelled) setState({ estados: [], loading: false });
      });
    return () => { cancelled = true; };
  }, [cpais]);

  return state;
}

import { Field } from './ui/FormField';
import { SearchSelect } from './ui/SearchSelect';
import type { CatalogItem } from '../lib/api';
import type { ProfesionOcupacionVisibility } from '../lib/profesion-ocupacion';
import type { ProfesionOcupacionFields as Values } from '../types';

/**
 * Profesión (maprofes), ocupación (maocupac) y actividad económica (maactivi) de una persona.
 * Errores y anclas usan el prefijo de la persona: `${prefix}profesion` y `${prefix}ocupacion`
 * (ver validateProfesionOcupacion).
 */
export function ProfesionOcupacionFields({
  person,
  setPerson,
  prefix,
  catalogs,
  errors,
  visible,
}: {
  person: Values;
  setPerson: (patch: Partial<Values>) => void;
  prefix: string;
  catalogs: {
    profesiones: CatalogItem[];
    ocupaciones: CatalogItem[];
    actividades: CatalogItem[];
    loading: boolean;
  };
  errors: Record<string, string | undefined>;
  visible: ProfesionOcupacionVisibility;
}) {
  const toOptions = (items: CatalogItem[]) => items.map((o) => ({ value: o.code, label: o.label }));
  const ocupacionAnchor = `cli-${prefix}ocupacion`;

  return (
    <>
      {visible.profesion && (
        <Field anchor={`cli-${prefix}profesion`} label="Profesión *" error={errors[`${prefix}profesion`]}>
          <SearchSelect
            value={person.cprofesion ?? ''}
            options={toOptions(catalogs.profesiones)}
            onChange={(code, label) => setPerson({ cprofesion: code, xprofesion: label, ocupacionSeparada: true })}
            placeholder="— Seleccionar —"
            loading={catalogs.loading}
            noOptionsText="Sin profesiones disponibles"
          />
        </Field>
      )}
      {visible.ocupacion && (
        <Field anchor={ocupacionAnchor} label="Ocupación *" error={errors[`${prefix}ocupacion`]}>
          <SearchSelect
            value={person.cocupacion ?? ''}
            options={toOptions(catalogs.ocupaciones)}
            onChange={(code, label) => setPerson({ cocupacion: code, xocupacion: label, ocupacionSeparada: true })}
            placeholder="— Seleccionar —"
            loading={catalogs.loading}
            noOptionsText="Sin ocupaciones disponibles"
          />
        </Field>
      )}
      {visible.actividad && (
        <Field
          anchor={visible.ocupacion ? undefined : ocupacionAnchor}
          label="Actividad económica *"
          error={errors[`${prefix}ocupacion`]}
        >
          <SearchSelect
            value={person.cactividad ?? ''}
            options={toOptions(catalogs.actividades)}
            onChange={(code, label) => setPerson({ cactividad: code, xactividad: label })}
            placeholder="— Seleccionar (si no indicó ocupación) —"
            loading={catalogs.loading}
            noOptionsText="Sin actividades disponibles"
          />
        </Field>
      )}
    </>
  );
}

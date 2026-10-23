import { Field, Input } from './ui/FormField';
import { SearchSelect } from './ui/SearchSelect';
import type { CatalogItem } from '../lib/api';
import { PERSON_FIELD_LIMITS, clipPersonField } from '../lib/field-limits';

interface PersonLike {
  cpais?: number;
  cestado?: number;
  estado?: string;
  cciudad?: number;
  ciudad?: string;
}

interface CiudadesState {
  ciudades: CatalogItem[];
  loading: boolean;
}

interface PersonLocationFieldsProps {
  person: PersonLike;
  setPerson: (patch: Partial<PersonLike>) => void;
  prefix: string;
  errors: Record<string, string | undefined>;
  estados: CatalogItem[];
  ciuState: CiudadesState;
  catalogsLoading: boolean;
  /** Flujo Exélixi: estados locales + ciudad texto libre (sin valrep). */
  exelixiFlow: boolean;
  /** Placa extranjera: muestra el país de la dirección (Venezuela / Colombia). */
  showPais?: boolean;
}

/** Países con estados y ciudades en Sis2000 (mapaises). */
const PAISES_DIRECCION = [
  { value: '58', label: 'Venezuela' },
  { value: '57', label: 'Colombia' },
];

export function PersonLocationFields({
  person,
  setPerson,
  prefix,
  errors,
  estados,
  ciuState,
  catalogsLoading,
  exelixiFlow,
  showPais = false,
}: PersonLocationFieldsProps) {
  const esColombia = showPais && person.cpais === 57;
  return (
    <>
      {showPais && (
        <Field
          anchor={`cli-${prefix}pais`}
          label="País de residencia *"
          hint="Vehículo extranjero: indique dónde reside el cliente"
        >
          <SearchSelect
            value={person.cpais ?? 58}
            options={PAISES_DIRECCION}
            onChange={(code) => {
              const cpais = code ? Number(code) : 58;
              if (cpais === person.cpais) return;
              // Cambia el país: los estados y ciudades son de otro catálogo.
              setPerson({ cpais, estado: '', cestado: undefined, ciudad: '', cciudad: undefined });
            }}
            placeholder="Seleccione país"
          />
        </Field>
      )}
      <Field
        anchor={`cli-${prefix}estado`}
        label={esColombia ? 'Departamento *' : 'Estado *'}
        error={errors[`${prefix}estado`]}
      >
        <SearchSelect
          value={person.cestado}
          options={estados.map((s) => ({ value: String(s.code), label: s.label }))}
          onChange={(code, label) => {
            setPerson({
              estado: label,
              cestado: code ? Number(code) : undefined,
              ciudad: '',
              cciudad: undefined,
            });
          }}
          placeholder={esColombia ? 'Seleccione departamento' : 'Seleccione estado'}
          loading={catalogsLoading}
        />
      </Field>
      <Field
        anchor={`cli-${prefix}ciudad`}
        label="Ciudad *"
        error={errors[`${prefix}ciudad`]}
        hint={
          exelixiFlow
            ? 'Nombre de la ciudad o municipio'
            : person.cestado
              ? 'Escribe para filtrar la ciudad'
              : 'Selecciona primero el estado'
        }
      >
        {exelixiFlow ? (
          <Input
            value={person.ciudad ?? ''}
            onChange={(e) =>
              setPerson({
                ciudad: clipPersonField('ciudad', e.target.value),
                cciudad: undefined,
              })
            }
            placeholder="Ej. Caracas, Valencia, Maracaibo…"
            disabled={!person.cestado}
            maxLength={PERSON_FIELD_LIMITS.ciudad}
          />
        ) : (
          <SearchSelect
            value={person.cciudad}
            options={ciuState.ciudades.map((c) => ({ value: String(c.code), label: c.label }))}
            onChange={(code, label) => {
              setPerson({
                ciudad: label,
                cciudad: code ? Number(code) : undefined,
              });
            }}
            placeholder={person.cestado ? 'Seleccione ciudad' : 'Selecciona primero el estado'}
            disabled={!person.cestado}
            loading={ciuState.loading}
          />
        )}
      </Field>
    </>
  );
}

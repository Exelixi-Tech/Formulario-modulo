import { useWizardStore } from '../store/wizardStore';
import type { FuneralPerson, PersonData, TomadorData } from '../types';

type PersonSource = TomadorData | PersonData | FuneralPerson;

function metricStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

/**
 * Copia al titular (primer asegurado) los datos ya capturados en el paso 2:
 * tomador si es la misma persona, o el asegurado si el pagador es otro.
 * Estatura/peso se toman del formulario del titular (asegurado) aunque el
 * pagador sea el mismo.
 */
export function syncTitularFromTomador(): void {
  const { sameInsured, tomador, asegurado, funeral, setFuneral } = useWizardStore.getState();
  const src: PersonSource = sameInsured !== false ? tomador : asegurado;
  const titular = funeral.asegurados[0];
  if (!titular || !src) return;

  const peso = metricStr(asegurado.peso) || metricStr(src.peso) || metricStr(titular.peso);
  const estatura =
    metricStr(asegurado.estatura) || metricStr(src.estatura) || metricStr(titular.estatura);

  setFuneral({
    asegurados: [
      {
        ...titular,
        tipoDoc: src.tipoDoc || 'V',
        identificacion: src.identificacion,
        nombre: src.nombre,
        apellido: src.apellido,
        fechaNac: src.fechaNac ?? '',
        sexo: src.sexo ?? '',
        parentesco: '1',
        telefono: src.telefono,
        email: src.email,
        estadoCivil: src.estadoCivil,
        estado: src.estado,
        cestado: src.cestado,
        ciudad: src.ciudad,
        cciudad: src.cciudad,
        direccion: src.direccion,
        peso,
        estatura,
      },
      ...funeral.asegurados.slice(1),
    ],
  });
}

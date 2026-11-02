import { AlertTriangle, ArrowDown } from 'lucide-react';

export const TITULAR_SECTION_ANCHOR = 'cli-titular';

type TitularDistintoOcrAlertProps = {
  /** Cédula o RIF del propietario que leyó el OCR en el carnet de circulación. */
  carnetIdentificacion?: string;
  /** Tipo de documento del propietario: J = empresa (RIF). */
  carnetTipoDoc?: string;
};

/**
 * RCV: el OCR encontró el carnet a nombre de otra persona y activó «titular distinto».
 * Se avisa arriba del paso porque la sección del titular queda fuera de la vista.
 */
export function TitularDistintoOcrAlert({ carnetIdentificacion, carnetTipoDoc }: TitularDistintoOcrAlertProps) {
  const esEmpresa = String(carnetTipoDoc ?? '').toUpperCase() === 'J';
  const documento = carnetIdentificacion
    ? esEmpresa ? ` (RIF J-${carnetIdentificacion})` : ` (cédula ${carnetIdentificacion})`
    : '';
  const irATitular = () => {
    document.getElementById(TITULAR_SECTION_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      role="status"
      className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center gap-3"
    >
      <AlertTriangle size={18} className="shrink-0 text-amber-600 hidden sm:block" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          El carnet de circulación está a nombre de {esEmpresa ? 'una empresa' : 'otra persona'}{documento}.
        </p>
        <p className="mt-0.5 text-amber-800">
          {esEmpresa
            ? 'La empresa queda como titular asegurada y el tomador es quien paga. Revisa los datos del titular.'
            : 'Por eso se activó «la persona que pagará es diferente a la asegurada». Revisa los datos del titular; si es el mismo tomador, apaga esa opción.'}
        </p>
      </div>
      <button
        type="button"
        onClick={irATitular}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 shrink-0 w-full sm:w-auto"
      >
        <ArrowDown size={14} />
        Ver titular
      </button>
    </div>
  );
}

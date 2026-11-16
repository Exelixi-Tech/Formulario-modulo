import { ChevronDown, Globe2, Lock, MapPin, Flag, Users } from 'lucide-react';

import { cn } from '../lib/utils';
import { ocrIndicaPlacaExtranjera } from '../lib/placa-tipo';
import type { VehicleData } from '../types';

type TipoPlaca = VehicleData['tipoPlaca'];

type Props = {
  value: TipoPlaca;
  placa: string;
  certOcr?: { tipoPlaca?: string; tipoCarnet?: string; placa?: string } | null;
  onChange: (tipo: TipoPlaca) => void;
  /** Ocultar opción binacional (flujos sin RCV La Mundial). */
  showBinacional?: boolean;
  disabled?: boolean;
  /** RCV Binacional: tripulantes elegidos (1–3). El selector solo se muestra con `onTripulantesChange`. */
  tripulantes?: number;
  onTripulantesChange?: (tripulantes: number) => void;
};

/** RCV Binacional: máximo de tripulantes que se pueden declarar (mínimo y valor por defecto: 1). */
const TRIPULANTES_MAX = 3;

function normalizeTripulantes(value: unknown): number {
  return Math.min(TRIPULANTES_MAX, Math.max(1, Math.trunc(Number(value)) || 1));
}

const ALL_OPTIONS: {
  id: TipoPlaca;
  label: string;
  desc: string;
  Icon: typeof Flag;
}[] = [
  { id: 'nacional', label: 'Nacional', desc: 'Placa venezolana · circulación en el país', Icon: Flag },
  { id: 'extranjera', label: 'Extranjera', desc: 'Vehículo extranjero que ingresa (según OCR)', Icon: Globe2 },
  { id: 'binacional', label: 'Binacional', desc: 'Solo vehículos de carga: salida del vehículo venezolano fuera del país', Icon: MapPin },
];

export function TipoPlacaSelector({
  value,
  placa: _placa,
  certOcr,
  onChange,
  showBinacional = true,
  disabled = false,
  tripulantes,
  onTripulantesChange,
}: Props) {
  const forceExtranjera = ocrIndicaPlacaExtranjera(certOcr);
  const extranjeraBlocked = !forceExtranjera;
  const options = showBinacional
    ? ALL_OPTIONS
    : ALL_OPTIONS.filter((o) => o.id !== 'binacional');

  // forceExtranjera: si el OCR detecta placa/carnet colombiano, bloqueamos la opción nacional.
  // NO auto-cambiamos el store aquí: OcrStep ya fijó tipoPlaca al procesar el certificado.
  // Solo bloqueamos la UI para evitar selección manual incorrecta.


  return (
    <div className="col-span-full">
      <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/50 p-4 sm:p-5 shadow-[0_8px_30px_rgba(79,70,229,0.12)] space-y-3">
        <div>
          <p className="text-sm font-black text-indigo-900 uppercase tracking-wide">
            Tipo de emisión RCV
          </p>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Elige cómo emitir: <strong>Binacional</strong> (solo vehículos de carga) si el vehículo venezolano sale del país;
            <strong> Extranjera</strong> solo si el OCR detectó placa extranjera.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {options.map(({ id, label, desc, Icon }) => {
            const isActive = value === id;
            const isExtranjeraOption = id === 'extranjera';
            const isOptionDisabled =
              disabled
              || (forceExtranjera && id !== 'extranjera')
              || (extranjeraBlocked && isExtranjeraOption);

            return (
              <button
                key={id}
                type="button"
                disabled={isOptionDisabled}
                onClick={() => {
                  if (!isOptionDisabled) onChange(id);
                }}
                className={cn(
                  'relative flex flex-col items-start gap-1.5 rounded-xl border-2 px-4 py-3.5 min-h-[4.5rem] text-left transition-all',
                  isActive
                    ? 'border-indigo-600 bg-white shadow-[0_10px_28px_rgba(79,70,229,0.22)] ring-2 ring-indigo-200'
                    : 'border-slate-200 bg-white/90 hover:border-indigo-400 hover:bg-white',
                  isOptionDisabled && 'opacity-50 cursor-not-allowed hover:border-slate-200 hover:bg-white/90',
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-2 text-base font-bold',
                      isActive ? 'text-indigo-800' : 'text-slate-800',
                    )}
                  >
                    <span
                      className={cn(
                        'w-8 h-8 rounded-lg grid place-items-center shrink-0',
                        isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      <Icon size={16} />
                    </span>
                    {label}
                  </span>
                  {(forceExtranjera && isExtranjeraOption) || (extranjeraBlocked && isExtranjeraOption) ? (
                    <Lock size={14} className="text-slate-400 shrink-0" aria-hidden />
                  ) : null}
                </span>
                <span className="text-[0.7rem] text-slate-500 leading-snug pl-10">
                  {extranjeraBlocked && isExtranjeraOption ? 'Requiere placa extranjera en OCR' : desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* RCV Binacional: tripulantes (puestos de la cobertura de ocupantes) */}
        {showBinacional && value === 'binacional' && onTripulantesChange && (
          <div>
            <label
              htmlFor="rcv-tripulantes"
              className="text-[0.62rem] font-black text-slate-500 uppercase tracking-widest mb-2 inline-flex items-center gap-1.5"
            >
              <Users size={11} className="text-indigo-500" />
              Tripulantes
            </label>
            <div className="relative sm:max-w-xs">
              <select
                id="rcv-tripulantes"
                value={String(normalizeTripulantes(tripulantes))}
                disabled={disabled}
                onChange={(e) => onTripulantesChange(normalizeTripulantes(e.target.value))}
                className="w-full pl-4 pr-10 py-3 rounded-xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-900 appearance-none cursor-pointer hover:border-indigo-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                {Array.from({ length: TRIPULANTES_MAX }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>{n}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
            <p className="mt-1.5 text-[0.7rem] text-slate-500">
              Vehículo binacional: la prima se calcula según el número de tripulantes (máximo {TRIPULANTES_MAX}).
            </p>
          </div>
        )}

        {forceExtranjera && (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <Lock size={14} className="shrink-0 mt-0.5 text-amber-600" />
            <span>
              El OCR detectó placa extranjera. La emisión será <strong>extranjera</strong>.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

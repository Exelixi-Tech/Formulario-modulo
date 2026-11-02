import { Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useRenovacion, iniciarRenovacion } from '../lib/renovacion';

function fechaCorta(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/**
 * "Renovación de la póliza X": banner cuando la precarga está lista y pantalla de bloqueo
 * mientras carga o si la póliza no se puede renovar. Sin renovación no pinta nada.
 */
export function RenovacionAviso() {
  const r = useRenovacion();
  if (!r) return null;

  if (r.estado === 'cargando' || r.estado === 'pendiente' || r.estado === 'bloqueada' || r.estado === 'error') {
    const cargando = r.estado === 'cargando' || r.estado === 'pendiente';
    return (
      <div className="fixed inset-0 z-[9000] grid place-items-center bg-slate-900/60 backdrop-blur-sm px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          {cargando ? (
            <>
              <Loader2 size={36} className="mx-auto mb-4 animate-spin text-indigo-600" />
              <p className="font-bold text-slate-900">Renovación de la póliza {r.cnpoliza_rel}</p>
              <p className="mt-2 text-sm text-slate-500">Cargando los datos de la póliza…</p>
            </>
          ) : (
            <>
              <ShieldAlert size={40} className="mx-auto mb-4 text-amber-500" />
              <p className="font-bold text-slate-900">Renovación de la póliza {r.cnpoliza_rel}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {r.mensaje || 'Esta póliza no se puede renovar en este momento.'}
              </p>
              {r.estado === 'error' && (
                <button
                  type="button"
                  onClick={() => { void iniciarRenovacion(); }}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0F1A5A] px-4 py-2 text-sm font-semibold text-white"
                >
                  <RefreshCw size={14} />
                  Reintentar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  const vence = fechaCorta(r.fhasta_anterior);
  const desde = fechaCorta(r.fdesde_sugerida);
  const hasta = fechaCorta(r.fhasta_sugerida);
  return (
    <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 animate-fade-in">
      <p className="font-bold">Renovación de la póliza {r.cnpoliza_rel}</p>
      <p className="mt-1 text-emerald-800">
        {r.xplan_anterior ? `Plan anterior: ${r.xplan_anterior}. ` : ''}
        {vence ? `Vence el ${vence}. ` : ''}
        {desde && hasta ? `La nueva póliza cubre del ${desde} al ${hasta}. ` : ''}
        Puedes actualizar teléfono, correo y dirección; cédula, placa y serial vienen de la póliza.
      </p>
      {(r.advertencias ?? []).length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-amber-800">
          {(r.advertencias ?? []).map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}
    </div>
  );
}

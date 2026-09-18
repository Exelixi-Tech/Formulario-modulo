import { useState, useEffect, useCallback } from 'react';
import {
  isTokenAuthEnabled,
  setTokenAuthEnabled,
  getActiveToken,
  setActiveToken,
  clearActiveToken,
  decodeTokenPayload,
  createMockJwt,
  TOKEN_PRESETS,
  type TokenPreset,
} from '../lib/token-manager';
import { toast } from '../store/toastStore';
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Copy,
  Check,
  Code2,
  Layers,
  X,
  PlusCircle,
  ExternalLink,
  Cpu,
  Trash2,
} from 'lucide-react';

interface TokenManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToView?: (view: 'validador' | 'wizard' | 'config') => void;
}

export function TokenManagerModal({
  isOpen,
  onClose,
  onNavigateToView,
}: TokenManagerModalProps) {
  const [tokensEnabled, setTokensEnabled] = useState<boolean>(isTokenAuthEnabled());
  const [tokenInput, setTokenInput] = useState<string>('');
  const [decodedInfo, setDecodedInfo] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const syncState = useCallback(() => {
    const enabled = isTokenAuthEnabled();
    const current = getActiveToken() || '';
    setTokensEnabled(enabled);
    setTokenInput(current);
    if (current) {
      setDecodedInfo(decodeTokenPayload(current));
    } else {
      setDecodedInfo(null);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      syncState();
    }
  }, [isOpen, syncState]);

  useEffect(() => {
    const handler = () => syncState();
    window.addEventListener('nexus_token_state_changed', handler);
    return () => window.removeEventListener('nexus_token_state_changed', handler);
  }, [syncState]);

  if (!isOpen) return null;

  const handleToggleTokens = (enabled: boolean) => {
    setTokenAuthEnabled(enabled);
    setTokensEnabled(enabled);
    if (enabled) {
      toast.success(
        'Validación de Tokens Activada',
        'Ahora el módulo requerirá un token JWT firmado de Nexus para acceder.'
      );
    } else {
      toast.info(
        'Modo Sin Tokens Activado',
        'Acceso directo habilitado para pruebas, diseño e inspección sin autenticación obligatoria.'
      );
    }
  };

  const handleApplyToken = () => {
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      toast.error('Token vacío', 'Ingresa una cadena JWT válida o selecciona un preset.');
      return;
    }
    setActiveToken(trimmed);
    const decoded = decodeTokenPayload(trimmed);
    setDecodedInfo(decoded);
    toast.success('Token de Acceso Guardado', 'El token ha sido aplicado a la sesión.');
  };

  const handleApplyPreset = (preset: TokenPreset) => {
    const jwt = createMockJwt(preset.payload);
    setTokenInput(jwt);
    setActiveToken(jwt);
    setDecodedInfo(decodeTokenPayload(jwt));
    toast.success('Preset Aplicado', `${preset.name} cargado correctamente.`);
  };

  const handleGenerateCustomMock = () => {
    const jwt = createMockJwt({
      empresaId: 1,
      submoduloId: 17,
      type: 'tenant_access',
      cproductor: Math.floor(1000 + Math.random() * 9000),
      cusuario: Math.floor(100 + Math.random() * 900),
      canal: 'PRUEBAS_SANDBOX',
      product: 'rcv',
      nombreEmpresa: 'Sandbox Dinámico',
    });
    setTokenInput(jwt);
    setActiveToken(jwt);
    setDecodedInfo(decodeTokenPayload(jwt));
    toast.success('Token Simulado Creado', 'Nuevo JWT de prueba generado y activo.');
  };

  const handleClear = () => {
    clearActiveToken();
    setTokenInput('');
    setDecodedInfo(null);
    toast.info('Token Eliminado', 'Se ha limpiado el token de la sesión.');
  };

  const handleCopy = () => {
    if (!tokenInput) return;
    navigator.clipboard.writeText(tokenInput);
    setCopied(true);
    toast.success('Copiado', 'Token JWT copiado al portapapeles.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl rounded-3xl border border-slate-700 bg-slate-900/95 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-fuchsia-600 grid place-items-center text-white shadow-lg shadow-indigo-500/25">
              <KeyRound size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">
                  Control y Formulario de Tokens Nexus
                </h2>
                <span
                  className={`text-[0.62rem] font-black uppercase px-2 py-0.5 rounded-full border tracking-wider ${
                    tokensEnabled
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {tokensEnabled ? 'Tokens Activados' : 'Sin Tokens · Modo Directo'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Configura el estado de validación, aplica JWTs de prueba o inspecciona los claims.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Section 1: Activation Switcher */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {tokensEnabled ? (
                  <ShieldCheck size={18} className="text-indigo-400" />
                ) : (
                  <ShieldAlert size={18} className="text-emerald-400" />
                )}
                <span className="text-sm font-bold text-white">
                  {tokensEnabled
                    ? 'Validación Obligatoria de Tokens (Nexus SSO)'
                    : 'Modo Directo sin Tokens (Bypass / Pruebas Activo)'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {tokensEnabled
                  ? 'El sistema bloqueará el acceso si no se detecta un JWT válido en URL o almacenamiento.'
                  : 'Permite acceder libremente al Validador Plan-Proveedor y al formulario sin exigir tokens.'}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-semibold text-slate-400">
                {tokensEnabled ? 'Activado' : 'Desactivado'}
              </span>
              <button
                type="button"
                onClick={() => handleToggleTokens(!tokensEnabled)}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  tokensEnabled ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    tokensEnabled ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Section 2: Quick Presets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-indigo-400" />
                Perfiles y Tokens de Prueba Rápidos
              </label>
              <button
                type="button"
                onClick={handleGenerateCustomMock}
                className="text-[0.7rem] font-bold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
              >
                <PlusCircle size={13} />
                Generar token aleatorio
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TOKEN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-800/80 hover:border-indigo-500/50 text-left transition-all group"
                >
                  <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {preset.name}
                  </p>
                  <p className="text-[0.68rem] text-slate-400 mt-1 line-clamp-2">
                    {preset.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Token Input Form */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound size={13} className="text-indigo-400" />
                Token JWT Activo (nexus_token)
              </label>
              {tokenInput && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-[0.7rem] text-slate-400 hover:text-white inline-flex items-center gap-1"
                  >
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    {copied ? '¡Copiado!' : 'Copiar'}
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[0.7rem] text-rose-400 hover:text-rose-300 inline-flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    Limpiar
                  </button>
                </div>
              )}
            </div>

            <textarea
              rows={3}
              value={tokenInput}
              onChange={(e) => {
                setTokenInput(e.target.value);
                setDecodedInfo(decodeTokenPayload(e.target.value));
              }}
              placeholder="Pega aquí tu token JWT (ej. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)"
              className="w-full p-3.5 rounded-xl border border-slate-800 bg-black/60 text-emerald-400 font-mono text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleApplyToken}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95 inline-flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Guardar y Aplicar Token</span>
              </button>
            </div>
          </div>

          {/* Section 4: Live Decoded Token Inspector */}
          {decodedInfo && (
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Code2 size={13} className="text-violet-400" />
                Metadatos y Claims Decodificados (JWT Payload)
              </label>
              <div className="p-4 rounded-xl border border-slate-800 bg-black/80 font-mono text-[0.72rem] text-slate-300 overflow-x-auto max-h-48">
                <pre>{JSON.stringify(decodedInfo, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* Section 5: Direct Navigation to Views */}
          <div className="p-4 rounded-2xl border border-indigo-900/40 bg-indigo-950/20 space-y-2">
            <p className="text-[0.68rem] font-bold text-indigo-300 uppercase tracking-wider">
              Acceso Directo a Vistas del Módulo
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onNavigateToView) onNavigateToView('validador');
                  else window.location.href = '/plan-proveedor';
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-xs font-bold text-white transition-colors inline-flex items-center gap-1.5"
              >
                <Layers size={13} />
                <span>Validador Plan-Proveedor</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onNavigateToView) onNavigateToView('wizard');
                  else window.location.href = '/';
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition-colors inline-flex items-center gap-1.5"
              >
                <Cpu size={13} />
                <span>Formulario Paso a Paso</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onNavigateToView) onNavigateToView('config');
                  else window.location.href = '/config';
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition-colors inline-flex items-center gap-1.5"
              >
                <ExternalLink size={13} />
                <span>Panel Parametrizador</span>
              </button>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-[0.7rem] text-slate-500">
            Formulario Módulo · Configuración Reactiva de Tokens
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}

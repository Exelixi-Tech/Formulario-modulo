import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { verifyNexusAccess, resolveNexusApiUrl, type NexusVerifyResult } from './nexus-core';
import { persistProductFromHints } from '../lib/product';
import { persistCotizadorFromHints } from '../lib/cotizador-flow';
import { isTokenAuthEnabled, setTokenAuthEnabled } from '../lib/token-manager';
import { TokenManagerModal } from '../components/TokenManagerModal';
import { KeyRound, ShieldAlert } from 'lucide-react';

// ─── Context ──────────────────────────────────────────────────────────────────
interface NexusContextValue {
  empresa: NexusVerifyResult['empresa'];
  submodulo: NexusVerifyResult['submodulo'];
}

const NexusContext = createContext<NexusContextValue | null>(null);

export function useNexus(): NexusContextValue {
  const ctx = useContext(NexusContext);
  if (!ctx) throw new Error('useNexus debe usarse dentro de <NexusGuard>');
  return ctx;
}

// ─── Pantalla de bloqueo / loading ───────────────────────────────────────────
function NexusScreen({ type, reason, onRetry }: {
  type: 'loading' | 'blocked';
  reason?: string;
  onRetry?: () => Promise<void>;
}) {
  const [retrying, setRetrying] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await onRetry?.();
    setRetrying(false);
  };

  const handleDisableTokensAndEnter = async () => {
    setTokenAuthEnabled(false);
    await onRetry?.();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0C133A 0%, #1a2460 100%)',
      fontFamily: 'Inter, system-ui, sans-serif', zIndex: 9999,
    }}>
      <div style={{
        background: '#fff', borderRadius: '1.25rem',
        padding: '2.5rem 2rem', maxWidth: 460, width: '90%',
        textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.35)',
      }}>
        {type === 'loading' ? (
          <>
            <div style={{
              width: 44, height: 44,
              border: '3px solid #e5e7eb', borderTopColor: '#ED7423',
              borderRadius: '50%', margin: '0 auto 1.5rem',
              animation: 'nexusSpin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: '0.95rem', color: '#475569' }}>Verificando acceso…</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0C133A', margin: '0 0 0.5rem' }}>
              Acceso Protegido por Token
            </h1>
            <p style={{ fontSize: '0.88rem', color: '#475569', margin: '0 0 1rem', lineHeight: 1.5 }}>
              {reason}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setShowTokenModal(true)}
                style={{
                  padding: '0.65rem 1.25rem',
                  background: '#4f46e5',
                  color: '#fff',
                  border: 'none', borderRadius: '0.6rem',
                  fontSize: '0.88rem', fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                }}
              >
                <KeyRound size={16} />
                <span>Formulario y Gestor de Tokens</span>
              </button>

              <button
                type="button"
                onClick={handleDisableTokensAndEnter}
                style={{
                  padding: '0.65rem 1.25rem',
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0', borderRadius: '0.6rem',
                  fontSize: '0.88rem', fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}
              >
                <ShieldAlert size={16} />
                <span>Desactivar Tokens (Modo Directo)</span>
              </button>

              {onRetry && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={retrying}
                  style={{
                    padding: '0.55rem 1.25rem',
                    background: retrying ? '#f1f5f9' : '#f8fafc',
                    color: retrying ? '#94a3b8' : '#64748b',
                    border: '1px solid #e2e8f0', borderRadius: '0.6rem',
                    fontSize: '0.82rem', fontWeight: 600,
                    cursor: retrying ? 'not-allowed' : 'pointer',
                    marginTop: '0.25rem',
                  }}
                >
                  {retrying ? 'Verificando…' : '🔄 Reintentar Verificación'}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <TokenManagerModal
        isOpen={showTokenModal}
        onClose={() => setShowTokenModal(false)}
        onNavigateToView={(view) => {
          setShowTokenModal(false);
          if (view === 'validador') window.location.href = '/plan-proveedor';
          if (view === 'config') window.location.href = '/config';
          if (view === 'wizard') onRetry?.();
        }}
      />

      <style>{`@keyframes nexusSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── NexusGuard ───────────────────────────────────────────────────────────────
interface NexusGuardProps {
  children: React.ReactNode;
  recheckInterval?: number;
}

type GuardStatus = 'loading' | 'active' | 'blocked';

interface GuardState {
  status: GuardStatus;
  empresa?: NexusVerifyResult['empresa'];
  submodulo?: NexusVerifyResult['submodulo'];
  reason?: string;
}

/** Detecta si venimos de un flujo encadenado (bridge ya validó el token). */
function isChainedFlow(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get('sid') && params.get('nexus_token'));
  } catch { return false; }
}

export function NexusGuard({ children, recheckInterval = 30 }: NexusGuardProps) {
  // Si venimos del bridge (hay sid + nexus_token), mostramos el contenido
  // de inmediato y verificamos en background para no interrumpir la UX.
  const chained = isChainedFlow();
  const [state, setState] = useState<GuardState>({ status: chained ? 'active' : 'loading' });
  const nexusApiUrl = resolveNexusApiUrl(import.meta.env.VITE_NEXUS_API_URL);
  const isMounted = useRef(true);

  const doVerify = useCallback(async () => {
    // Si la validación de tokens está desactivada por el usuario (modo directo / sandbox)
    if (!isTokenAuthEnabled()) {
      setState({
        status: 'active',
        empresa: { id: 1, nombre: 'La Mundial de Seguros (Acceso Directo)', rif: 'J-00000000-0' },
        submodulo: {
          id: 17,
          nombre: 'Formulario RCV',
          url: '/formulario',
          moduloNombre: 'Formulario',
          accessUrl: null,
        },
      });
      return;
    }

    if (!nexusApiUrl) {
      setState({ status: 'blocked', reason: 'VITE_NEXUS_API_URL no está definida en .env' });
      return;
    }
    const result = await verifyNexusAccess(nexusApiUrl);
    if (!isMounted.current) return;
    if (result.active) {
      if (result.submodulo) {
        persistProductFromHints({
          url: result.submodulo.url,
          nombre: result.submodulo.nombre,
          moduloNombre: result.submodulo.moduloNombre,
          product: result.product,
        });
        persistCotizadorFromHints({
          url: result.submodulo.url,
          nombre: result.submodulo.nombre,
          moduloNombre: result.submodulo.moduloNombre,
        });
      }
      setState({ status: 'active', empresa: result.empresa, submodulo: result.submodulo });
    } else {
      setState({ status: 'blocked', reason: result.reason });
    }
  }, [nexusApiUrl]);

  useEffect(() => {
    isMounted.current = true;
    doVerify();
    return () => { isMounted.current = false; };
  }, [doVerify]);

  useEffect(() => {
    const handleStateChanged = () => {
      doVerify();
    };
    window.addEventListener('nexus_token_state_changed', handleStateChanged);
    return () => window.removeEventListener('nexus_token_state_changed', handleStateChanged);
  }, [doVerify]);

  useEffect(() => {
    if (!recheckInterval || recheckInterval <= 0) return;
    const id = setInterval(doVerify, recheckInterval * 1000);
    return () => clearInterval(id);
  }, [doVerify, recheckInterval]);

  useEffect(() => {
    const origFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await origFetch(...args);
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url ?? '';
      if (!url.includes('/api/access/verify') && (res.status === 401 || res.status === 403)) {
        doVerify();
      }
      return res;
    };
    return () => { window.fetch = origFetch; };
  }, [doVerify]);

  if (state.status === 'loading') return <NexusScreen type="loading" />;
  if (state.status === 'blocked') return (
    <NexusScreen type="blocked" reason={state.reason} onRetry={doVerify} />
  );

  return (
    <NexusContext.Provider value={{ empresa: state.empresa, submodulo: state.submodulo }}>
      {children}
    </NexusContext.Provider>
  );
}

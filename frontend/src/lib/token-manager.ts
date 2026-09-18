/**
 * Gestor centralizado de tokens de acceso y modos de validación para el módulo Formulario.
 * Permite activar/desactivar la exigencia de tokens (modo bypass/pruebas) e interactuar con tokens JWT.
 */

import { getNexusToken, persistNexusToken, decodeNexusTokenMetadata } from './nexus-token-client';

const TOKEN_AUTH_ENABLED_KEY = 'nexus_token_auth_enabled';
const STORAGE_KEY = 'nexus_access_token_formulario';

export interface TokenPreset {
  id: string;
  name: string;
  description: string;
  payload: {
    empresaId: number;
    submoduloId: number;
    type: string;
    cproductor?: number;
    cusuario?: number;
    canal?: string;
    product?: string;
    nombreEmpresa?: string;
  };
}

export const TOKEN_PRESETS: TokenPreset[] = [
  {
    id: 'rcv_productor',
    name: 'Productor RCV (Canal Directo)',
    description: 'Empresa 1, Submódulo 17 (Formulario RCV), Productor 1001',
    payload: {
      empresaId: 1,
      submoduloId: 17,
      type: 'tenant_access',
      cproductor: 1001,
      cusuario: 501,
      canal: 'DIRECTO',
      product: 'rcv',
      nombreEmpresa: 'La Mundial de Seguros',
    },
  },
  {
    id: 'funerario_broker',
    name: 'Broker Funerario',
    description: 'Empresa 1, Submódulo 22 (Formulario Funerario), Productor 2002',
    payload: {
      empresaId: 1,
      submoduloId: 22,
      type: 'tenant_access',
      cproductor: 2002,
      cusuario: 602,
      canal: 'BROKER_EXELIXI',
      product: 'funerario',
      nombreEmpresa: 'La Mundial de Seguros',
    },
  },
  {
    id: 'qa_admin',
    name: 'Administrador QA',
    description: 'Acceso total para pruebas y parametrización',
    payload: {
      empresaId: 1,
      submoduloId: 17,
      type: 'tenant_access',
      cproductor: 9999,
      cusuario: 1,
      canal: 'QA_MASTER',
      product: 'rcv',
      nombreEmpresa: 'QA Multi-Tenant Sandbox',
    },
  },
];

/**
 * Crea un token JWT mockup válido para propósitos de testing y desarrollo local.
 */
export function createMockJwt(payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const base64Header = btoa(JSON.stringify(header))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + 3600 * 24, // 24 horas
    metadata: {
      cproductor: payload.cproductor,
      cusuario: payload.cusuario,
      canal: payload.canal,
      product: payload.product,
    },
  };

  const base64Payload = btoa(unescape(encodeURIComponent(JSON.stringify(fullPayload))))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const signature = 'mock_signature_dev_sandbox';
  return `${base64Header}.${base64Payload}.${signature}`;
}

/**
 * Retorna si la validación de tokens está activada.
 * Por defecto, en entornos de prueba o cuando el usuario lo desactiva, retorna false.
 */
export function isTokenAuthEnabled(): boolean {
  try {
    const val = localStorage.getItem(TOKEN_AUTH_ENABLED_KEY);
    if (val === null) {
      // Si no está explícitamente configurado, revisamos si estamos en ruta /plan-proveedor
      const isTestRoute =
        /\/plan-proveedor/i.test(window.location.pathname) ||
        new URLSearchParams(window.location.search).get('view') === 'plan-proveedor';
      return !isTestRoute;
    }
    return val === 'true';
  } catch {
    return false;
  }
}

/**
 * Activa o desactiva la validación obligatoria de tokens en la aplicación.
 */
export function setTokenAuthEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(TOKEN_AUTH_ENABLED_KEY, enabled ? 'true' : 'false');
    notifyTokenStateChanged();
  } catch {
    /* ignore */
  }
}

/**
 * Obtiene el token activo actual (desde sessionStorage o URL).
 */
export function getActiveToken(): string | null {
  return getNexusToken(STORAGE_KEY);
}

/**
 * Guarda y establece el token activo actual.
 */
export function setActiveToken(token: string): void {
  persistNexusToken(STORAGE_KEY, token.trim());
  notifyTokenStateChanged();
}

/**
 * Elimina el token activo.
 */
export function clearActiveToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    const url = new URL(window.location.href);
    url.searchParams.delete('nexus_token');
    window.history.replaceState({}, '', url.toString());
  } catch {
    /* ignore */
  }
  notifyTokenStateChanged();
}

/**
 * Decodifica el token y extrae su información completa.
 */
export function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return decodeNexusTokenMetadata(token);
  }
}

/**
 * Dispara evento global para que los componentes reactivos se actualicen sin recargar.
 */
export function notifyTokenStateChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent('nexus_token_state_changed'));
  } catch {
    /* ignore */
  }
}

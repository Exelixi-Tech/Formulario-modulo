/** Snapshot del wizard en sessionStorage y cross-origin handoff entre módulos. */
export const FLOW_HANDOFF_KEY = 'exelixi_bridge_state';

export function encodeFlowHandoff(state: Record<string, unknown>): string {
  try {
    const json = JSON.stringify(state);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

export function decodeFlowHandoff(raw: string): Record<string, unknown> | null {
  try {
    const norm = raw.replace(/-/g, '+').replace(/_/g, '/');
    const pad = norm.length % 4 === 0 ? '' : '='.repeat(4 - (norm.length % 4));
    const binary = atob(pad ? norm + pad : norm);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function persistFlowHandoff(state: Record<string, unknown>): void {
  try {
    sessionStorage.setItem(FLOW_HANDOFF_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function readFlowHandoff(): Record<string, unknown> | null {
  try {
    if (typeof window !== 'undefined') {
      const fromUrl = new URLSearchParams(window.location.search).get('flow_handoff');
      if (fromUrl) {
        const decoded = decodeFlowHandoff(fromUrl);
        if (decoded) {
          persistFlowHandoff(decoded);
          const url = new URL(window.location.href);
          url.searchParams.delete('flow_handoff');
          window.history.replaceState({}, '', url.toString());
          return decoded;
        }
      }
    }
    const raw = sessionStorage.getItem(FLOW_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}


type CertTomadorOcr = {
  nombre?: string;
  apellido?: string;
  identificacion?: string;
  tipoDoc?: string;
  propietario?: string;
  propietarioNombre?: string;
  propietarioApellido?: string;
  propietarioIdentificacion?: string;
  identificacionPropietario?: string;
  tipoDocPropietario?: string;
};

export function splitColombianOwnerName(full: string): { nombre: string; apellido: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { nombre: '', apellido: '' };
  if (parts.length === 1) return { nombre: '', apellido: parts[0] };
  const mid = Math.floor(parts.length / 2);
  return {
    apellido: parts.slice(0, mid).join(' '),
    nombre: parts.slice(mid).join(' '),
  };
}

/** Alineado con mapVenezuelanOwnerDocType del OCR (carnet INTT). */
export function mapVenezuelanOwnerDocType(raw?: string | null): string | null {
  const u = String(raw ?? '').toUpperCase().replace(/[\s.\-]/g, '').trim();
  if (!u) return null;
  if (u === 'J' || u.includes('NIT')) return 'J';
  if (u === 'E' || u === 'CE' || u === 'EXTRANJ' || u === 'EXTRANJERO') return 'E';
  if (u === 'P' || u === 'PASAPORTE') return 'P';
  return 'V';
}

function inferTipoDocFromIdent(raw?: string | null): string | null {
  const m = String(raw ?? '').trim().toUpperCase().match(/^([VEJGP])[-\s.]*\d/);
  if (!m) return null;
  return m[1] === 'G' ? 'J' : m[1];
}

/** Carnet colombiano en flujo VE → extranjero residente. */
function mapColombianOwnerDocType(raw?: string | null): string | null {
  const u = String(raw ?? '').toUpperCase().replace(/\./g, '').trim();
  if (!u) return null;
  if (u.includes('NIT') || u === 'J') return 'J';
  if (u.includes('CC') || u.includes('CE') || u === 'C.C.' || u === 'C.E.') return 'E';
  return mapVenezuelanOwnerDocType(raw);
}

export function resolveOwnerTipoDoc(cert: CertTomadorOcr): string {
  const fromTipo = mapVenezuelanOwnerDocType(cert.tipoDoc);
  if (fromTipo) return fromTipo;

  if (cert.tipoDocPropietario) {
    const fromProp =
      mapColombianOwnerDocType(cert.tipoDocPropietario)
      ?? mapVenezuelanOwnerDocType(cert.tipoDocPropietario);
    if (fromProp) return fromProp;
  }

  const idRaw =
    cert.identificacion
    || cert.propietarioIdentificacion
    || cert.identificacionPropietario;
  return inferTipoDocFromIdent(idRaw) ?? 'V';
}

export function extractTomadorFromCertificado(cert?: CertTomadorOcr | null): {
  nombre: string;
  apellido: string;
  identificacion: string;
  tipoDoc: string;
} | null {
  if (!cert) return null;

  let nombre = cert.nombre || cert.propietarioNombre || '';
  let apellido = cert.apellido || cert.propietarioApellido || '';

  if (!nombre && !apellido && cert.propietario) {
    const split = splitColombianOwnerName(cert.propietario);
    apellido = split.apellido;
    nombre = split.nombre;
  }

  const identificacion = String(
    cert.identificacion
    || cert.propietarioIdentificacion
    || cert.identificacionPropietario
    || '',
  ).replace(/\D/g, '');

  if (!nombre && !apellido && !identificacion) return null;

  return {
    nombre,
    apellido,
    identificacion,
    tipoDoc: resolveOwnerTipoDoc(cert),
  };
}

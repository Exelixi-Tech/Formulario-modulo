import type { OcrFields } from './exelixi-handoff-types';
import { resolveOwnerTipoDoc } from './carnet-propietario';

/** Clasificación del titular según carnet OCR (no Sis2000 ipersona). */
export function resolveRcvTitularTipoDocFromCert(cert?: OcrFields | null): string {
  if (!cert) return 'V';
  return resolveOwnerTipoDoc(cert);
}

/** Clasificación del tomador según cédula OCR. */
export function resolveRcvTomadorTipoDocFromCedula(cedula?: OcrFields | null): string {
  const raw = String(cedula?.tipoDoc ?? '').trim().toUpperCase();
  if (raw) return raw;
  return 'V';
}

/** Identidad RCV que OCR manda; Sis2000 no debe pisar tipoDoc ni cédula. */
export function rcvIdentityKeepFromOcr(
  prefix: string,
  latest: { tipoDoc?: string; identificacion?: string },
  digits: string,
  documents: {
    cedula?: { ocr?: OcrFields | null };
    certificado?: { ocr?: OcrFields | null };
  },
): { tipoDoc: string; identificacion: string } {
  if (prefix === 'aseg_') {
    return {
      tipoDoc: resolveRcvTitularTipoDocFromCert(documents.certificado?.ocr),
      identificacion: latest.identificacion ?? digits,
    };
  }
  if (prefix === 'tom_') {
    return {
      tipoDoc: resolveRcvTomadorTipoDocFromCedula(documents.cedula?.ocr),
      identificacion: latest.identificacion ?? digits,
    };
  }
  return {
    tipoDoc: latest.tipoDoc ?? 'V',
    identificacion: latest.identificacion ?? digits,
  };
}

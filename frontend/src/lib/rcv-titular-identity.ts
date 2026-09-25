import type { OcrFields } from './exelixi-handoff-types';
import { resolveOwnerTipoDoc } from './carnet-propietario';

function normalizeIdentDigits(raw?: string | null): string {
  return String(raw ?? '').replace(/\D/g, '');
}

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

/** Cédula que vino del OCR para tomador (cedula) o titular (carnet). */
export function resolveRcvOcrIdentDigits(
  prefix: string,
  documents: {
    cedula?: { ocr?: OcrFields | null };
    certificado?: { ocr?: OcrFields | null };
  },
): string {
  if (prefix === 'tom_') {
    return normalizeIdentDigits(documents.cedula?.ocr?.identificacion);
  }
  if (prefix === 'aseg_') {
    const cert = documents.certificado?.ocr;
    return normalizeIdentDigits(
      cert?.propietarioIdentificacion
      ?? cert?.identificacionPropietario
      ?? cert?.identificacion,
    );
  }
  return '';
}

/**
 * Sis2000 al blur solo si el usuario escribió/cambió la cédula.
 * Si el valor es el mismo del OCR y no hubo edición manual → no rebuscar.
 */
export function shouldRunRcvSis2000Lookup(
  identificacion: string,
  ocrIdentDigits: string,
  userEditedIdent: boolean,
): boolean {
  const digits = normalizeIdentDigits(identificacion);
  if (digits.length < 1) return false;
  if (!ocrIdentDigits) return true;
  if (userEditedIdent) return true;
  return digits !== ocrIdentDigits;
}

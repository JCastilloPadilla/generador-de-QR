import QRCode from 'qrcode';

/**
 * Único módulo que conoce la librería `qrcode`. El resto de la app trabaja
 * contra `QrMatrix`, nunca contra la librería directamente.
 *
 * Se usa `QRCode.create()` en vez de `toCanvas()` o `toString()` para quedarnos
 * con la matriz cruda de módulos: así el canvas y el SVG se derivan de la misma
 * fuente de verdad y admiten logo y color, que los renderizadores incluidos en
 * la librería no permiten.
 */

export type EccLevel = 'L' | 'M' | 'Q' | 'H';

export const ECC_LEVELS: readonly EccLevel[] = ['L', 'M', 'Q', 'H'] as const;

/** Porcentaje aproximado del código que cada nivel puede perder y aun así leerse. */
export const ECC_TOLERANCE: Record<EccLevel, number> = { L: 7, M: 15, Q: 25, H: 30 };

export interface QrMatrix {
  /** Ancho y alto en módulos, sin contar la zona silenciosa. */
  readonly size: number;
  /** true = módulo oscuro. */
  get(row: number, col: number): boolean;
  readonly version: number;
  readonly ecc: EccLevel;
}

/** El contenido no cabe en un código QR con el nivel de corrección elegido. */
export class QrCapacityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QrCapacityError';
  }
}

export function buildMatrix(text: string, ecc: EccLevel): QrMatrix {
  if (text.length === 0) {
    throw new QrCapacityError('No hay contenido que codificar.');
  }

  let code: QRCode.QRCode;
  try {
    code = QRCode.create(text, { errorCorrectionLevel: ecc });
  } catch {
    throw new QrCapacityError(
      'El contenido es demasiado largo para un código QR con este nivel de corrección. ' +
        'Acórtalo o baja el nivel.',
    );
  }

  const { modules, version } = code;
  return {
    size: modules.size,
    version,
    ecc,
    get: (row, col) => modules.get(row, col) === 1,
  };
}

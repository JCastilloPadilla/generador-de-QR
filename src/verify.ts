import type { QrMatrix } from './qr-engine';
import { drawToCanvas, type RenderStyle } from './renderer';
import { contrastRatio, relativeLuminance } from './contrast';

/**
 * Comprueba que el código que se acaba de dibujar se puede volver a leer.
 *
 * Se verifica el canvas completo, con formas y logo incluidos, porque es
 * justamente lo que se descarga. Verificar la matriz pelada certificaría algo
 * distinto de lo que el usuario se lleva.
 *
 * Nunca bloquea: muestra la evidencia y la decisión sigue siendo del usuario.
 *
 * El lector pesa bastante más que el resto de la aplicación junta, así que se
 * carga aparte y en cuanto termina la primera pintada. El código aparece al
 * instante y la verificación llega un momento después.
 */

/**
 * Resolución fija de verificación, independiente del tamaño de exportación. La
 * legibilidad depende del patrón, no de a cuántos píxeles se exporte.
 */
const VERIFY_SIZE = 512;

export type VerifyState = 'ok' | 'ilegible' | 'difiere' | 'pendiente';

export interface Verification {
  state: VerifyState;
  /** Lo que devolvió el lector, o null si no encontró ningún código. */
  decoded: string | null;
  /** Explicación de la causa más probable cuando algo va mal. */
  reason: string | null;
}

export interface Verifier {
  (matrix: QrMatrix, style: RenderStyle, expected: string): Promise<Verification>;
}

/**
 * Modo de inversión con el que interrogar al lector.
 *
 * Por defecto jsQR prueba la imagen normal y después la invertida, lo que
 * duplica el coste. Aquí ya se sabe cuál toca: si el frente es más claro que el
 * fondo, el código está invertido.
 *
 * No se usa `onlyInvert` aunque parezca lo más directo: en jsqr 1.4.0 esa opción
 * lanza una excepción en lugar de devolver null cuando no encuentra código.
 * `invertFirst` prueba la invertida primero y cae en la normal, sin ese fallo.
 */
export function inversionMode(
  foreground: string,
  background: string,
): 'dontInvert' | 'invertFirst' {
  return relativeLuminance(foreground) > relativeLuminance(background)
    ? 'invertFirst'
    : 'dontInvert';
}

/**
 * Deduce por qué no se lee. No es una certeza, y el texto lo dice: son las
 * causas que explican casi todos los casos, por orden de probabilidad.
 */
function probableCause(style: RenderStyle): string {
  const ratio = contrastRatio(style.foreground, style.background);
  if (ratio < 3) {
    return `el contraste de ${ratio.toFixed(1)}:1 entre frente y fondo es demasiado bajo`;
  }
  if (style.logo) {
    return 'probablemente el logo tapa demasiado; prueba a quitarlo';
  }
  if (style.shape.body === 'dot') {
    return 'la forma de punto deja poca tinta; prueba con redondeado o fluido';
  }
  if (ratio < 4.5) {
    return `el contraste de ${ratio.toFixed(1)}:1 es justo`;
  }
  return 'revisa el contraste, el logo y la forma de los módulos';
}

type JsQR = typeof import('jsqr').default;

let readerPromise: Promise<JsQR | null> | null = null;

function loadReader(): Promise<JsQR | null> {
  readerPromise ??= import('jsqr')
    .then((module) => module.default)
    .catch(() => null);
  return readerPromise;
}

export function createVerifier(): Verifier {
  const canvas = document.createElement('canvas');

  return async (matrix, style, expected) => {
    const jsQR = await loadReader();
    const unavailable: Verification = { state: 'pendiente', decoded: null, reason: null };
    if (!jsQR) return unavailable;

    drawToCanvas(canvas, matrix, VERIFY_SIZE, style);
    const ctx = canvas.getContext('2d');
    if (!ctx) return unavailable;

    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let result: { data: string } | null;
    try {
      result = jsQR(image.data, image.width, image.height, {
        inversionAttempts: inversionMode(style.foreground, style.background),
      });
    } catch {
      // El lector es una dependencia externa: si falla, se informa de que no se
      // pudo verificar, nunca de que el código no se pudo generar.
      return unavailable;
    }

    if (!result) {
      return { state: 'ilegible', decoded: null, reason: probableCause(style) };
    }
    if (result.data !== expected) {
      return {
        state: 'difiere',
        decoded: result.data,
        reason: 'el código se lee, pero no devuelve el contenido esperado',
      };
    }
    return { state: 'ok', decoded: result.data, reason: null };
  };
}

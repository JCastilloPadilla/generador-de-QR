import { describe, expect, it } from 'vitest';
import { buildMatrix } from '../src/qr-engine';
import { buildGeometry, isFinderModule, BODY_SHAPES, EYE_SHAPES } from '../src/geometry';
import { QUIET_ZONE } from '../src/renderer';

const matrix = buildMatrix('https://ccastillo.dev', 'M');
const cuadrado = { body: 'square', eye: 'square' } as const;

/**
 * Puntos de arranque absolutos del trazado. Solo los comandos `M` llevan
 * coordenadas absolutas; el resto son desplazamientos relativos, así que leer
 * todos los números del trazado no diría nada útil.
 */
function startPoints(path: string): { x: number; y: number }[] {
  const matches = path.matchAll(/M(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g);
  return [...matches].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
}

describe('isFinderModule', () => {
  it('reconoce los tres patrones de localización', () => {
    const n = matrix.size;
    expect(isFinderModule(matrix, 0, 0)).toBe(true);
    expect(isFinderModule(matrix, 6, 6)).toBe(true);
    expect(isFinderModule(matrix, 0, n - 1)).toBe(true);
    expect(isFinderModule(matrix, n - 1, 0)).toBe(true);
  });

  it('no reconoce la cuarta esquina, que no lleva patrón', () => {
    const n = matrix.size;
    expect(isFinderModule(matrix, n - 1, n - 1)).toBe(false);
  });

  it('no reconoce los módulos de datos del centro', () => {
    const centro = Math.floor(matrix.size / 2);
    expect(isFinderModule(matrix, centro, centro)).toBe(false);
  });

  it('marca exactamente 147 módulos: tres cuadrados de 7×7', () => {
    let total = 0;
    for (let r = 0; r < matrix.size; r++) {
      for (let c = 0; c < matrix.size; c++) if (isFinderModule(matrix, r, c)) total++;
    }
    expect(total).toBe(3 * 7 * 7);
  });
});

describe('buildGeometry', () => {
  it('produce cuerpo y ojos no vacíos', () => {
    const g = buildGeometry(matrix, cuadrado);
    expect(g.body.length).toBeGreaterThan(0);
    expect(g.eyes.length).toBeGreaterThan(0);
  });

  /**
   * Sustituye a la antigua comprobación de píxeles del borde: se afirma sobre la
   * geometría, que es donde vive la invariante. El 4 va literal a propósito, para
   * que el test falle si alguien baja la constante.
   */
  it('mantiene todo el trazado dentro de la zona útil, con 4 módulos de margen', () => {
    // El 4 va literal a propósito: el test debe fallar si alguien baja la constante.
    const margen = 4;
    for (const body of BODY_SHAPES) {
      for (const eye of EYE_SHAPES) {
        const g = buildGeometry(matrix, { body: body.id, eye: eye.id });
        for (const p of [...startPoints(g.body), ...startPoints(g.eyes)]) {
          const donde = `${body.id}/${eye.id} en (${p.x}, ${p.y})`;
          expect(p.x, `${donde} se sale por la izquierda`).toBeGreaterThanOrEqual(margen);
          expect(p.y, `${donde} se sale por arriba`).toBeGreaterThanOrEqual(margen);
          expect(p.x, `${donde} se sale por la derecha`).toBeLessThanOrEqual(margen + matrix.size);
          expect(p.y, `${donde} se sale por abajo`).toBeLessThanOrEqual(margen + matrix.size);
        }
      }
    }
  });

  it('desplaza el trazado exactamente por la zona silenciosa', () => {
    expect(QUIET_ZONE).toBe(4);
    const g = buildGeometry(matrix, cuadrado);
    // El módulo (0,0) es oscuro y pertenece al ojo superior izquierdo.
    expect(matrix.get(0, 0)).toBe(true);
    const min = Math.min(...startPoints(g.eyes).map((p) => Math.min(p.x, p.y)));
    expect(min).toBe(QUIET_ZONE);
  });

  it('genera trazado para las cuatro formas de cuerpo', () => {
    for (const body of BODY_SHAPES) {
      const g = buildGeometry(matrix, { body: body.id, eye: 'square' });
      expect(g.body.length, `la forma ${body.id} no dibuja nada`).toBeGreaterThan(0);
    }
  });

  it('genera trazado para las cuatro formas de ojo', () => {
    for (const eye of EYE_SHAPES) {
      const g = buildGeometry(matrix, { body: 'square', eye: eye.id });
      expect(g.eyes.length, `el ojo ${eye.id} no dibuja nada`).toBeGreaterThan(0);
    }
  });

  it('el cuerpo excluye los módulos de los patrones de localización', () => {
    // Con cuerpo cuadrado, cada módulo aporta un subtrazado «M». Deben ser
    // exactamente los módulos oscuros que no son patrón de localización.
    let esperados = 0;
    for (let r = 0; r < matrix.size; r++) {
      for (let c = 0; c < matrix.size; c++) {
        if (matrix.get(r, c) && !isFinderModule(matrix, r, c)) esperados++;
      }
    }
    const g = buildGeometry(matrix, cuadrado);
    expect((g.body.match(/M/g) ?? []).length).toBe(esperados);
  });

  it('la forma fluida funde los módulos contiguos, así que usa arcos', () => {
    const g = buildGeometry(matrix, { body: 'fluid', eye: 'square' });
    expect(g.body).toMatch(/[Aa]/);
  });

  it('el punto y el círculo se dibujan con arcos', () => {
    expect(buildGeometry(matrix, { body: 'dot', eye: 'square' }).body).toMatch(/[Aa]/);
    expect(buildGeometry(matrix, { body: 'square', eye: 'circle' }).eyes).toMatch(/[Aa]/);
  });

  it('el cuadrado no usa arcos: es la forma más segura para escanear', () => {
    const g = buildGeometry(matrix, cuadrado);
    expect(g.body).not.toMatch(/[Aa]/);
    expect(g.eyes).not.toMatch(/[Aa]/);
  });

  it('ofrece cuatro formas de cuerpo y cuatro de ojo, con etiqueta', () => {
    expect(BODY_SHAPES).toHaveLength(4);
    expect(EYE_SHAPES).toHaveLength(4);
    for (const s of [...BODY_SHAPES, ...EYE_SHAPES]) {
      expect(s.label.length).toBeGreaterThan(0);
    }
  });
});

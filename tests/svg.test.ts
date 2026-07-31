import { describe, expect, it } from 'vitest';
import { buildMatrix } from '../src/qr-engine';
import { renderToSvg, QUIET_ZONE } from '../src/renderer';

const style = { foreground: '#000000', background: '#ffffff' };

describe('renderToSvg', () => {
  it('declara un viewBox que incluye las dos zonas silenciosas', () => {
    const matrix = buildMatrix('hola', 'M');
    const svg = renderToSvg(matrix, 512, style);
    const total = matrix.size + QUIET_ZONE * 2;
    expect(svg).toContain(`viewBox="0 0 ${total} ${total}"`);
  });

  it('es un documento SVG independiente con espacio de nombres', () => {
    const svg = renderToSvg(buildMatrix('hola', 'M'), 512, style);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });

  it('usa los colores indicados', () => {
    const svg = renderToSvg(buildMatrix('hola', 'M'), 512, {
      foreground: '#1F3BE0',
      background: '#F6F7F9',
    });
    expect(svg).toContain('#1F3BE0');
    expect(svg).toContain('#F6F7F9');
  });

  it('dibuja un subpath por cada módulo oscuro de la matriz', () => {
    const matrix = buildMatrix('hola', 'M');
    let dark = 0;
    for (let r = 0; r < matrix.size; r++) {
      for (let c = 0; c < matrix.size; c++) if (matrix.get(r, c)) dark++;
    }
    const svg = renderToSvg(matrix, 512, style);
    const path = svg.match(/<path d="([^"]*)"/)?.[1] ?? '';
    expect((path.match(/M/g) ?? []).length).toBe(dark);
  });

  it('incrusta el logo cuando se le pasa un href', () => {
    const svg = renderToSvg(buildMatrix('hola', 'H'), 512, style, 'data:image/png;base64,AAAA');
    expect(svg).toContain('<image');
    expect(svg).toContain('data:image/png;base64,AAAA');
  });

  it('no incluye ningún <image> si no hay logo', () => {
    expect(renderToSvg(buildMatrix('hola', 'M'), 512, style)).not.toContain('<image');
  });
});

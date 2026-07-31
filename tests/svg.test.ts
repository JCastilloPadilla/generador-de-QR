import { describe, expect, it } from 'vitest';
import { buildMatrix } from '../src/qr-engine';
import { renderToSvg, QUIET_ZONE } from '../src/renderer';
import { isFinderModule } from '../src/geometry';

const style = {
  foreground: '#000000',
  background: '#ffffff',
  shape: { body: 'square', eye: 'square' },
} as const;

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
      ...style,
      foreground: '#1F3BE0',
      background: '#F6F7F9',
    });
    expect(svg).toContain('#1F3BE0');
    expect(svg).toContain('#F6F7F9');
  });

  it('permite dar a los ojos un color propio', () => {
    const svg = renderToSvg(buildMatrix('hola', 'M'), 512, {
      ...style,
      foreground: '#15171C',
      eyeColor: '#1F3BE0',
    });
    expect(svg).toContain('fill="#15171C"');
    expect(svg).toContain('fill="#1F3BE0"');
  });

  it('separa el cuerpo de los ojos en dos trazados', () => {
    const svg = renderToSvg(buildMatrix('hola', 'M'), 512, style);
    expect((svg.match(/<path /g) ?? []).length).toBe(2);
    expect(svg).toContain('fill-rule="evenodd"');
  });

  it('dibuja un subpath por cada módulo oscuro que no es patrón de localización', () => {
    const matrix = buildMatrix('hola', 'M');
    let dark = 0;
    for (let r = 0; r < matrix.size; r++) {
      for (let c = 0; c < matrix.size; c++) {
        if (matrix.get(r, c) && !isFinderModule(matrix, r, c)) dark++;
      }
    }
    const svg = renderToSvg(matrix, 512, style);
    const body = svg.match(/<path d="([^"]*)"/)?.[1] ?? '';
    expect((body.match(/M/g) ?? []).length).toBe(dark);
  });

  it('declara crispEdges solo con la forma cuadrada', () => {
    const matrix = buildMatrix('hola', 'M');
    expect(renderToSvg(matrix, 512, style)).toContain('crispEdges');
    expect(
      renderToSvg(matrix, 512, { ...style, shape: { body: 'dot', eye: 'circle' } }),
    ).not.toContain('crispEdges');
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

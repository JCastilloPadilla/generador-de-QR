import { describe, expect, it } from 'vitest';
import { contrastRatio, scanabilityWarning } from '../src/contrast';

describe('contrastRatio', () => {
  it('da 21 para negro sobre blanco', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('da 1 para dos colores iguales', () => {
    expect(contrastRatio('#1F3BE0', '#1F3BE0')).toBeCloseTo(1, 5);
  });

  it('es simétrico', () => {
    expect(contrastRatio('#15171C', '#F6F7F9')).toBeCloseTo(
      contrastRatio('#F6F7F9', '#15171C'),
      5,
    );
  });

  it('acepta hex de tres dígitos', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 1);
  });
});

describe('scanabilityWarning', () => {
  it('no avisa con negro sobre blanco', () => {
    expect(scanabilityWarning('#000000', '#FFFFFF')).toBeNull();
  });

  it('avisa sin alarmar en la banda intermedia', () => {
    // #808080 sobre blanco ronda 3.9:1: por debajo de 4.5 pero por encima de 3.
    const warning = scanabilityWarning('#808080', '#FFFFFF');
    expect(contrastRatio('#808080', '#FFFFFF')).toBeGreaterThan(3);
    expect(contrastRatio('#808080', '#FFFFFF')).toBeLessThan(4.5);
    expect(warning).toContain('bajo');
    expect(warning).not.toContain('no va a escanear');
  });

  it('avisa con más énfasis cuando el contraste es crítico', () => {
    expect(scanabilityWarning('#808080', '#828282')).toContain('no va a escanear');
  });
});

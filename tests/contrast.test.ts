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

  it('avisa cuando el contraste es bajo', () => {
    const warning = scanabilityWarning('#777777', '#BBBBBB');
    expect(warning).toBeTypeOf('string');
    expect(warning).toContain('Contraste');
  });

  it('avisa con más énfasis cuando el contraste es crítico', () => {
    expect(scanabilityWarning('#808080', '#828282')).toContain('no va a escanear');
  });
});

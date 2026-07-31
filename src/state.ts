import type { EccLevel } from './qr-engine';
import type { ShapeStyle } from './geometry';

export interface AppState {
  type: string;
  values: Record<string, string>;
  ecc: EccLevel;
  sizePx: number;
  foreground: string;
  background: string;
  /** null = los ojos usan el color del cuerpo. */
  eyeColor: string | null;
  shape: ShapeStyle;
  logo: HTMLImageElement | null;
}

export interface Store {
  get(): Readonly<AppState>;
  patch(partial: Partial<AppState>): void;
}

export function createStore(initial: AppState, onChange: () => void): Store {
  let state = initial;
  return {
    get: () => state,
    patch(partial) {
      state = { ...state, ...partial };
      onChange();
    },
  };
}

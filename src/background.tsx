import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Warp } from '@paper-design/shaders-react';

/**
 * Fondo animado. Es decoración pura: va detrás de todo, nunca lleva texto
 * encima y no participa en ninguna interacción.
 *
 * Se monta aparte del resto de la aplicación y después de la primera pintada,
 * porque React y el shader pesan varias veces más que el generador entero. El
 * código QR nunca espera a que llegue el adorno.
 */

/** Reacciona a un media query sin quedarse anclado al valor del primer render. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (): void => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** true mientras la pestaña está a la vista. */
function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => !document.hidden);

  useEffect(() => {
    const onChange = (): void => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return visible;
}

function Background() {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const visible = usePageVisible();

  // Con el movimiento reducido el fondo se queda quieto de verdad, no solo más
  // tenue: seguir animando un bucle de WebGL contradice lo que pide el ajuste.
  // En una pestaña oculta se detiene por la misma razón práctica: gasta batería
  // dibujando algo que nadie ve.
  const speed = reducedMotion || !visible ? 0 : 3;

  return (
    <Warp
      width="100%"
      height="100%"
      colors={['#e3e3e3', '#a3a3a3', '#c4c4c4']}
      proportion={0.5}
      softness={1}
      distortion={0.09}
      swirl={0.9}
      swirlIterations={6}
      shape="checks"
      shapeScale={0.25}
      speed={speed}
      scale={2.5}
      rotation={1.35}
    />
  );
}

const host = document.querySelector<HTMLElement>('#shader-background');
if (host) createRoot(host).render(<Background />);

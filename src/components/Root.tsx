import { ReactNode, forwardRef } from 'preact/compat';
import { useEffect, useRef } from 'preact/hooks';
import { HEALDESS_UI_PORTAL_ROOT_ID, ROOT_CLASS } from '../constants';

interface Props {
  children?: ReactNode;
  withFullHeight?: boolean;
}

export default forwardRef<HTMLDivElement, Props>(function Root(
  { children, withFullHeight },
  ref
) {
  // Crear un ref interno como fallback
  const internalRef = useRef<HTMLDivElement>(null);
  
  // Función para manejar la asignación de ref compatible con React/Preact
  const refCallback = (element: HTMLDivElement | null) => {
    // Asignar al ref interno
    if (internalRef.current !== element) {
      internalRef.current = element;
    }
    
    // Manejar el ref externo de manera segura
    if (ref) {
      if (typeof ref === 'function') {
        ref(element);
      } else if (ref && typeof ref === 'object' && 'current' in ref) {
        (ref as any).current = element;
      }
    }
  };

  useEffect(() => {
    /// We need to add a class to the portal root to style the dropdown
    /// that is because we have our css scoped to componenents within element with class hello-csv
    ///
    /// HeadlesUI doesn't seem to provide an API to manipulate Portal root, so we do it this hacky way
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node as HTMLElement).id === HEALDESS_UI_PORTAL_ROOT_ID
          ) {
            (node as HTMLElement).classList.add(ROOT_CLASS);
          }
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: false });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      role="group"
      aria-label="Hello CSV"
      className={`${ROOT_CLASS}`}
      style={{ display: 'contents' }}
    >
      <div
        ref={refCallback}
        className={`min-h-0 w-full overflow-auto bg-white ${withFullHeight ? 'h-full' : ''}`}
      >
        {children}
      </div>
    </div>
  );
});

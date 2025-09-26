import { cva } from 'cva';
import { forwardRef, ReactNode } from 'preact/compat';

interface Props {
  className?: string;
  children?: ReactNode;
  variant?: 'default' | 'muted';
  withPadding?: boolean;
}

const baseClasses = cva('overflow-hidden rounded-md border border-gray-200', {
  variants: {
    variant: {
      default: 'bg-white',
      muted: 'bg-hello-csv-muted',
    },
    withPadding: {
      true: 'px-4 py-5 sm:p-6',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'default',
    withPadding: true,
  },
});

const Card = forwardRef<HTMLDivElement, Props>(
  ({ children, className, variant, withPadding = true }, ref) => {
    const componentClassName = baseClasses({ variant, withPadding });

    // Función para manejar la asignación de ref compatible con React/Preact
    const refCallback = (element: HTMLDivElement | null) => {
      // Manejar el ref externo de manera segura
      if (ref) {
        if (typeof ref === 'function') {
          ref(element);
        } else if (ref && typeof ref === 'object' && 'current' in ref) {
          (ref as any).current = element;
        }
      }
    };

    return (
      <div ref={refCallback} className={`${componentClassName} ${className}`}>
        {children}
      </div>
    );
  }
);

export default Card;

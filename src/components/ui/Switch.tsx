import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './utils';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, disabled, ...props }, ref) => {
    return (
      <label
        className={cn(
          'inline-flex items-center cursor-pointer select-none',
          disabled && 'opacity-50 pointer-events-none'
        )}
      >
        <span className="relative inline-block w-8 h-4">
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            className="sr-only peer"
            {...props}
          />
          {/* Track */}
          <span
            className={cn(
              'absolute inset-0 bg-bg-tertiary rounded-full transition-colors duration-150 border border-border-primary',
              'peer-checked:bg-accent peer-checked:border-accent-hover'
            )}
          />
          {/* Thumb */}
          <span
            className={cn(
              'absolute left-0.5 top-0.5 w-3 h-3 bg-text-primary rounded-full transition-transform duration-150',
              'peer-checked:translate-x-4 peer-checked:bg-text-inverse'
            )}
          />
        </span>
      </label>
    );
  }
);

Switch.displayName = 'Switch';

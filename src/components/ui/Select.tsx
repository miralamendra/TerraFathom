import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options?: { value: string | number; label: string }[];
  variant?: 'default' | 'ghost';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, children, disabled, variant = 'default', ...props }, ref) => {
    return (
      <div className={cn('relative w-full', className)}>
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            'w-full pl-2.5 pr-8 h-8 text-text-primary text-sm rounded-control outline-none transition-all duration-150 appearance-none cursor-pointer',
            variant === 'ghost' 
              ? 'bg-transparent border border-transparent hover:bg-bg-hover text-text-secondary hover:text-text-primary' 
              : 'bg-bg-tertiary border border-border-primary focus:border-border-focus focus:ring-0',
            'disabled:opacity-50 disabled:pointer-events-none'
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-bg-elevated text-text-primary">
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
          <ChevronDown size={14} />
        </span>
      </div>
    );
  }
);

Select.displayName = 'Select';

import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from './utils';

export interface CollapsibleProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;

  const handleToggle = () => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(!isOpen);
    }
    onOpenChange?.(!isOpen);
  };

  return (
    <div className={cn('flex flex-col', className)}>
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between py-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors select-none text-left"
      >
        <span>{title}</span>
        <ChevronRight
          size={14}
          className={cn('text-text-tertiary transition-transform duration-150', {
            'rotate-90': isOpen,
          })}
        />
      </button>
      {isOpen && (
        <div className="pt-2 text-text-secondary text-sm">
          {children}
        </div>
      )}
    </div>
  );
}

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
    <div className={cn('border border-border-primary rounded bg-bg-secondary overflow-hidden', className)}>
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-text-primary hover:bg-bg-hover transition-colors select-none"
      >
        <span>{title}</span>
        <ChevronRight
          size={16}
          className={cn('text-text-secondary transition-transform duration-150', {
            'rotate-95': isOpen,
          })}
        />
      </button>
      {isOpen && (
        <div className="border-t border-border-primary p-3 bg-bg-primary text-text-secondary text-sm">
          {children}
        </div>
      )}
    </div>
  );
}

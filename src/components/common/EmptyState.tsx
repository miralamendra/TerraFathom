import { type ReactNode } from 'react';
import { cn } from '@/components/ui/utils';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-4 select-none',
        className
      )}
    >
      {icon && <div className="text-text-tertiary mb-2">{icon}</div>}
      <h3 className="text-xs font-semibold text-text-primary mb-0.5">{title}</h3>
      <p className="text-[11px] text-text-tertiary max-w-xs leading-normal">{description}</p>
      {action && <div className="flex justify-center mt-3">{action}</div>}
    </div>
  );
}

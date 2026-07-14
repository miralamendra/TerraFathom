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
        'flex flex-col items-center justify-center text-center p-6 border border-dashed border-border-primary rounded-lg bg-bg-secondary select-none',
        className
      )}
    >
      {icon && <div className="text-text-tertiary mb-3">{icon}</div>}
      <h3 className="text-sm font-medium text-text-primary mb-1">{title}</h3>
      <p className="text-xs text-text-secondary max-w-xs leading-normal mb-4">{description}</p>
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  );
}

import { cn } from './utils';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function Divider({ orientation = 'horizontal', className }: DividerProps) {
  return (
    <div
      className={cn(
        'bg-border-primary shrink-0',
        orientation === 'horizontal' ? 'h-[1px] w-full my-2' : 'w-[1px] h-full mx-2 self-stretch',
        className
      )}
      role="separator"
    />
  );
}

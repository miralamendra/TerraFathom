import { type HTMLAttributes } from 'react';
import { cn } from './utils';

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  maxHeight?: string | number;
}

export function ScrollArea({ children, className, maxHeight = '100%', ...props }: ScrollAreaProps) {
  const customStyle = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight;

  return (
    <div
      className={cn(
        'overflow-auto pr-1',
        // Custom Webkit scrollbar styles
        '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5',
        '[&::-webkit-scrollbar-track]:bg-bg-primary [&::-webkit-scrollbar-track]:rounded',
        '[&::-webkit-scrollbar-thumb]:bg-border-primary [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:hover:bg-bg-hover',
        className
      )}
      style={{ maxHeight: customStyle }}
      {...props}
    >
      {children}
    </div>
  );
}

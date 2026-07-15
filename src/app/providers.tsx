import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <>
      {children}
      <Toaster theme="dark" position="top-right" closeButton richColors />
    </>
  );
}
export default Providers;

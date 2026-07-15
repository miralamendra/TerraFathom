import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <>
      {children}
      <Toaster 
        theme="dark" 
        position="top-right" 
        closeButton
        duration={2000}
        toastOptions={{
          style: {
            background: '#171717',
            border: '1px solid #2B2B2B',
            color: '#ECE8E1',
            fontFamily: 'sans-serif',
            fontSize: '12px',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }
        }}
      />
    </>
  );
}
export default Providers;

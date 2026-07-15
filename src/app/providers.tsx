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
        toastOptions={{
          className: "bg-[#171717] border border-[#2B2B2B] text-[#ECE8E1] font-sans text-xs rounded-control shadow-floating",
          descriptionClassName: "text-[#9E9A94]",
        }}
      />
    </>
  );
}
export default Providers;

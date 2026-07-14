import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PrimitiveGallery } from '@/components/ui';
import { Sparkles, Layout } from 'lucide-react';
import { Button } from '@/components/ui';

export function App() {
  const [view, setView] = useState<'app' | 'gallery'>('app');

  return (
    <div className="relative min-h-screen bg-bg-primary text-text-primary">
      {view === 'app' ? <AppShell /> : <PrimitiveGallery />}

      {/* Floating Toggle Button to switch views for review */}
      <div className="fixed bottom-4 left-4 z-50">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setView((v) => (v === 'app' ? 'gallery' : 'app'))}
          className="shadow-lg border-border-primary bg-bg-secondary/90 backdrop-blur-sm gap-2"
        >
          {view === 'app' ? (
            <>
              <Sparkles size={13} className="text-accent" />
              <span>Inspect UI Primitives</span>
            </>
          ) : (
            <>
              <Layout size={13} className="text-accent" />
              <span>Show Platform Layout</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
export default App;

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { LandingPage } from '@/components/layout/LandingPage';

export function App() {
  const [showApp, setShowApp] = useState(() => {
    return localStorage.getItem('terrafathom_show_app') === 'true';
  });

  const handleEnter = () => {
    setShowApp(true);
    localStorage.setItem('terrafathom_show_app', 'true');
  };

  const handleBack = () => {
    setShowApp(false);
    localStorage.setItem('terrafathom_show_app', 'false');
  };

  if (!showApp) {
    return <LandingPage onEnter={handleEnter} />;
  }

  return (
    <div className="relative min-h-screen bg-bg-primary text-text-primary">
      <AppShell onBackToLanding={handleBack} />
    </div>
  );
}
export default App;

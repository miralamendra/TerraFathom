import { useEffect } from 'react';
import { useUIStore } from '@/stores/ui-store';

export function useKeyboard() {
  const toggleLeft = useUIStore((s) => s.toggleLeftPanel);
  const toggleRight = useUIStore((s) => s.toggleRightPanel);
  const toggleBottom = useUIStore((s) => s.toggleBottomDrawer);
  const paletteOpen = useUIStore((s) => s.commandPaletteOpen);
  const setPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isEditable =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      // 1. Toggle Command Palette: Cmd/Ctrl+K (works always, even when typing)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
        return;
      }

      // 2. Escape: closes palette or overlays
      if (e.key === 'Escape') {
        if (paletteOpen) {
          e.preventDefault();
          setPaletteOpen(false);
        }
        return;
      }

      // Ignore rest of shortcuts if the user is typing
      if (isEditable) return;

      // 3. Panel Toggle Shortcuts: 1, 2, 3
      if (e.key === '1') {
        e.preventDefault();
        toggleLeft();
      } else if (e.key === '2') {
        e.preventDefault();
        toggleRight();
      } else if (e.key === '3') {
        e.preventDefault();
        toggleBottom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paletteOpen, setPaletteOpen, toggleLeft, toggleRight, toggleBottom]);
}
export default useKeyboard;

import { useCallback, useRef } from 'react';
import { useUIStore } from '@/stores/ui-store';

export function usePanelResize(panel: 'left' | 'right' | 'bottom') {
  const setLeftWidth = useUIStore((s) => s.setLeftPanelWidth);
  const setRightWidth = useUIStore((s) => s.setRightPanelWidth);
  const setBottomHeight = useUIStore((s) => s.setBottomDrawerHeight);
  const leftWidth = useUIStore((s) => s.leftPanelWidth);
  const rightWidth = useUIStore((s) => s.rightPanelWidth);
  const bottomHeight = useUIStore((s) => s.bottomDrawerHeight);

  const isResizing = useRef(false);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;

      const initialMousePos = panel === 'bottom' ? e.clientY : e.clientX;
      const initialSize =
        panel === 'left'
          ? leftWidth
          : panel === 'right'
          ? rightWidth
          : bottomHeight;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return;

        if (panel === 'left') {
          const delta = moveEvent.clientX - initialMousePos;
          setLeftWidth(initialSize + delta);
        } else if (panel === 'right') {
          const delta = moveEvent.clientX - initialMousePos;
          // When dragging right panel edge, dragging left (negative delta) increases the size
          setRightWidth(initialSize - delta);
        } else if (panel === 'bottom') {
          const delta = moveEvent.clientY - initialMousePos;
          // When dragging bottom panel edge, dragging up (negative delta) increases the height
          setBottomHeight(initialSize - delta);
        }
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      document.body.style.cursor = panel === 'bottom' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [panel, leftWidth, rightWidth, bottomHeight, setLeftWidth, setRightWidth, setBottomHeight]
  );

  return startResize;
}

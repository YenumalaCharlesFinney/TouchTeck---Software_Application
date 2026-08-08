import { useState, useCallback } from 'react';

// Every modal in the app hard-unmounts instantly on close (if (!isOpen) return null),
// which gives the CSS exit animation (.modal-closing) no time to play. This hook plays
// the closing animation first, then invokes the real dismiss callback once it's done.
export function useModalClose(duration = 150) {
  const [isClosing, setIsClosing] = useState(false);

  const triggerClose = useCallback((onClosed: () => void) => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClosed();
    }, duration);
  }, [duration]);

  return { isClosing, triggerClose };
}

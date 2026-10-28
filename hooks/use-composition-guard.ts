import { useRef } from 'react';

export function shouldBlockImeEnter(
  key: string,
  isComposing: boolean,
  keyCode: number,
  endedAt: number,
  now: number,
) {
  return key === 'Enter' && (isComposing || keyCode === 229 || now - endedAt < 500);
}

/** Prevent Enter from submitting while an IME is selecting or has just confirmed text. */
export function useCompositionGuard() {
  const composing = useRef(false);
  const endedAt = useRef(-Infinity);

  return {
    onCompositionStart: () => { composing.current = true; },
    onCompositionEnd: () => {
      composing.current = false;
      endedAt.current = Date.now();
    },
    onKeyDownCapture: (event: React.KeyboardEvent) => {
      if (shouldBlockImeEnter(event.key, composing.current || event.nativeEvent.isComposing, event.nativeEvent.keyCode, endedAt.current, Date.now())) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}

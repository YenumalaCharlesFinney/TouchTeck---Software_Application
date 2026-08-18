import React, { useEffect, useRef } from 'react';

interface HoverScrollTextProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// Single-line text that fades out at the right edge and, only if it's
// actually wider than its box, scrolls left-to-right on hover to reveal
// the rest. Content that already fits never animates.
export default function HoverScrollText({ children, className, style }: HoverScrollTextProps) {
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const overflow = inner.scrollWidth - outer.clientWidth;
    outer.style.setProperty('--scroll-distance', overflow > 0 ? `-${overflow + 8}px` : '0px');
  });

  return (
    <span
      ref={outerRef}
      className={`hscroll-text ${className || ''}`}
      style={{
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        display: 'block',
        minWidth: 0,
        maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
        ...style
      }}
    >
      <span ref={innerRef} className="hscroll-text-inner" style={{ display: 'inline-block' }}>
        {children}
      </span>
    </span>
  );
}

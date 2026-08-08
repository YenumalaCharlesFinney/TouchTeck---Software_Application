import React from 'react';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  showText?: boolean;
  className?: string;
}

export default function AnimatedLogo({ size = 'md', showText = true, className = '' }: AnimatedLogoProps) {
  const heightMap = {
    sm: 'h-8',
    md: 'h-11',
    lg: 'h-14',
    xl: 'h-20',
    hero: 'h-32 sm:h-40'
  };

  // The wordmark has to grow with the mark, otherwise "hero" just looks like a
  // big icon glued to small type.
  const wordmarkMap = {
    sm: 'text-lg sm:text-xl',
    md: 'text-lg sm:text-xl',
    lg: 'text-xl sm:text-2xl',
    xl: 'text-3xl sm:text-4xl',
    hero: 'text-5xl sm:text-6xl'
  };

  const taglineMap = {
    sm: 'text-[10px] tracking-[0.25em]',
    md: 'text-[10px] tracking-[0.25em]',
    lg: 'text-[11px] tracking-[0.26em]',
    xl: 'text-xs tracking-[0.3em]',
    hero: 'text-sm sm:text-base tracking-[0.4em]'
  };

  const hClass = heightMap[size] || heightMap.md;
  const wordClass = wordmarkMap[size] || wordmarkMap.md;
  const tagClass = taglineMap[size] || taglineMap.md;
  const gapClass = size === 'hero' ? 'gap-6' : 'gap-3';
  const dotClass = size === 'hero' ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5';

  return (
    <div className={`flex items-center ${gapClass} select-none ${className}`}>
      {/* Original User TouchTeck Logo Image */}
      <div className="relative flex items-center justify-center">
        <img
          src="./logo.png?v=3"
          alt="TouchTeck Logo"
          className={`${hClass} w-auto object-contain drop-shadow-[0_0_12px_rgba(255,245,0,0.5)] transition-transform hover:scale-105`}
        />
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <div className={`font-black tracking-wider uppercase font-mono ${wordClass}`}>
            <span className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              TOUCH
            </span>
            <span className="text-[#fff500] drop-shadow-[0_0_10px_rgba(255,245,0,0.6)]">
              TECK
            </span>
          </div>
          <div className={`${tagClass} uppercase text-[#fff500]/90 font-semibold font-mono mt-0.5 flex items-center gap-1.5`}>
            <span>FOR OMEGA</span>
            <span className={`inline-block ${dotClass} rounded-full bg-[#fff500] animate-ping`} />
          </div>
        </div>
      )}
    </div>
  );
}

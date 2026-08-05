import React from 'react';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export default function AnimatedLogo({ size = 'md', showText = true, className = '' }: AnimatedLogoProps) {
  const heightMap = {
    sm: 'h-8',
    md: 'h-11',
    lg: 'h-14',
    xl: 'h-20'
  };

  const hClass = heightMap[size] || heightMap.md;

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Original User TouchTeck Logo Image */}
      <div className="relative flex items-center justify-center">
        <img
          src="/logo.png?v=3"
          alt="TouchTeck Logo"
          className={`${hClass} w-auto object-contain drop-shadow-[0_0_12px_rgba(255,245,0,0.5)] transition-transform hover:scale-105`}
        />
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <div className="font-black tracking-wider uppercase font-mono text-lg sm:text-xl">
            <span className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              TOUCH
            </span>
            <span className="text-[#fff500] drop-shadow-[0_0_10px_rgba(255,245,0,0.6)]">
              TECK
            </span>
          </div>
          <div className="text-[10px] tracking-[0.25em] uppercase text-[#fff500]/90 font-semibold font-mono mt-0.5 flex items-center gap-1.5">
            <span>FOR OMEGA</span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#fff500] animate-ping" />
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React from 'react';

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type LogoVariant = 'orange-black' | 'monochrome' | 'inverted';
export type LogoState =
  | 'idle'
  | 'static'
  | 'intro'
  | 'searching'
  | 'researching'
  | 'validating'
  | 'founders'
  | 'verifying'
  | 'complete'
  | 'error';

export interface HuntlystLogoProps {
  size?: LogoSize;
  variant?: LogoVariant;
  state?: LogoState;
  animated?: boolean;
  showWordmark?: boolean;
  showUnderline?: boolean;
  showTagline?: boolean;
  subtitle?: string;
  className?: string;
  wordmarkClassName?: string;
  onClick?: () => void;
}

export default function HuntlystLogo({
  size = 'md',
  variant = 'orange-black',
  state = 'idle',
  animated = false,
  showWordmark = true,
  showUnderline = false,
  showTagline = false,
  subtitle,
  className = '',
  wordmarkClassName = '',
  onClick,
}: HuntlystLogoProps) {
  // Dimensions map
  const dimensions = {
    xs: { icon: 20, font: 'text-base', sub: 'text-[9px]' },
    sm: { icon: 28, font: 'text-xl', sub: 'text-[10px]' },
    md: { icon: 38, font: 'text-2xl sm:text-3xl', sub: 'text-xs' },
    lg: { icon: 56, font: 'text-3xl sm:text-4xl', sub: 'text-sm' },
    xl: { icon: 92, font: 'text-5xl sm:text-6xl', sub: 'text-base' },
    '2xl': { icon: 136, font: 'text-6xl sm:text-7xl', sub: 'text-lg' },
  }[size];

  // Palette colors based on variant
  const colors = {
    'orange-black': {
      primaryInk: '#1E1B18',
      accentOrange: '#FF6B35',
      accentOrangeShade: '#E85A28',
      compassRing: '#FF6B35',
      innerRing: '#FFE7DC',
      paperBg: '#FFFDF9',
      subText: '#766E65',
    },
    monochrome: {
      primaryInk: '#1E1B18',
      accentOrange: '#1E1B18',
      accentOrangeShade: '#3D3833',
      compassRing: '#1E1B18',
      innerRing: '#8C847A',
      paperBg: '#FFFDF9',
      subText: '#766E65',
    },
    inverted: {
      primaryInk: '#FFFDF9',
      accentOrange: '#FF6B35',
      accentOrangeShade: '#FF8D60',
      compassRing: '#FF6B35',
      innerRing: '#4A433E',
      paperBg: '#1E1B18',
      subText: '#D1C8BD',
    },
  }[variant];

  // Derive active animation behavior
  const isIntro = state === 'intro';
  const isSearching = state === 'searching' || state === 'researching';
  const isValidating = state === 'validating';
  const isFounders = state === 'founders';
  const isVerifying = state === 'verifying';
  const isComplete = state === 'complete';
  const isError = state === 'error';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-3 select-none ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Visual Logo Emblem Container */}
      <div
        className="relative shrink-0 flex items-center justify-center"
        style={{ width: dimensions.icon, height: dimensions.icon }}
      >
        {/* Animated outer discovery pulse ring for search/research states */}
        {(isSearching || animated) && (
          <div className="absolute inset-[-20%] rounded-full border-2 border-[#FF6B35] opacity-40 animate-ping pointer-events-none" />
        )}

        <svg
          width="100%"
          height="100%"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`overflow-visible ${
            isValidating
              ? 'animate-pulse'
              : isComplete
              ? 'transition-transform duration-500 scale-105'
              : ''
          }`}
        >
          <defs>
            <linearGradient id={`hl-orange-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF8D60" />
              <stop offset="100%" stopColor={colors.accentOrange} />
            </linearGradient>
            <linearGradient id={`hl-orange-dark-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.accentOrangeShade} />
              <stop offset="100%" stopColor="#C84718" />
            </linearGradient>
          </defs>

          {/* 1. Radiating Directional Ticks (Hand-drawn sunburst marks) */}
          <g
            stroke={colors.accentOrange}
            strokeWidth="3.5"
            strokeLinecap="round"
            className={
              isIntro
                ? 'animate-in fade-in zoom-in-75 duration-1000 ease-out'
                : isSearching
                ? 'animate-pulse'
                : 'transition-opacity duration-700'
            }
            opacity={isError ? 0.4 : 0.9}
          >
            <line x1="100" y1="12" x2="100" y2="24" />
            <line x1="148" y1="28" x2="140" y2="38" />
            <line x1="178" y1="62" x2="166" y2="70" />
            <line x1="178" y1="138" x2="166" y2="130" />
            <line x1="148" y1="172" x2="140" y2="162" />
            <line x1="52" y1="172" x2="60" y2="162" />
            <line x1="22" y1="138" x2="34" y2="130" />
            <line x1="22" y1="62" x2="34" y2="70" />
            <line x1="52" y1="28" x2="60" y2="38" />
          </g>

          {/* 2. Orange Sketched Outer Compass Ring */}
          <circle
            cx="100"
            cy="100"
            r="68"
            stroke={colors.compassRing}
            strokeWidth="4.5"
            strokeDasharray="14 4 28 6"
            strokeLinecap="round"
            fill="none"
            opacity="0.95"
            className={
              isIntro
                ? 'transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]'
                : isSearching
                ? 'animate-[spin_16s_linear_infinite]'
                : 'transition-all duration-700'
            }
            style={{ transformOrigin: '100px 100px' }}
          />

          {/* Inner measurement dotted ring */}
          <circle
            cx="100"
            cy="100"
            r="64"
            stroke={colors.innerRing}
            strokeWidth="1.5"
            strokeDasharray="4 4"
            fill="none"
            opacity="0.75"
          />

          {/* 3. Charcoal Cardinal Diamond Spikes (North, South, West, East) */}
          <g fill={colors.primaryInk} className={isIntro ? 'animate-in fade-in duration-1000 ease-out' : 'transition-opacity duration-700'}>
            {/* North Spike (Taller, prominent) */}
            <polygon points="100,16 94,62 100,56 106,62" />
            {/* South Spike */}
            <polygon points="100,184 105,142 100,147 95,142" />
            {/* West Spike */}
            <polygon points="16,100 58,95 53,100 58,105" />
            {/* East Spike */}
            <polygon points="184,100 142,95 147,100 142,105" />
          </g>

          {/* 4. Central Bold Editorial Serif "H" in Charcoal Ink */}
          <g
            fill={colors.primaryInk}
            className={
              isIntro
                ? 'animate-in zoom-in-95 fade-in duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]'
                : 'transition-all duration-700'
            }
          >
            {/* Left Serif Stem */}
            <path d="M 68 64 L 84 64 L 84 72 L 80 72 L 80 128 L 84 128 L 84 136 L 68 136 L 68 128 L 72 128 L 72 72 L 68 72 Z" />
            {/* Right Serif Stem */}
            <path d="M 116 64 L 132 64 L 132 72 L 128 72 L 128 128 L 132 128 L 132 136 L 116 136 L 116 128 L 120 128 L 120 72 L 116 72 Z" />
            {/* Crossbar */}
            <rect x="76" y="96" width="48" height="9" />
          </g>

          {/* 5. Diagonal Orange Directional Compass Needle Slicing Through the H */}
          <g
            className={`transition-transform duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isSearching
                ? 'animate-[spin_4s_ease-in-out_infinite]'
                : isVerifying
                ? 'animate-[pulse_1.5s_ease-in-out_infinite]'
                : isComplete
                ? 'rotate-0'
                : isError
                ? 'rotate-45'
                : isIntro
                ? 'animate-in zoom-in-75 duration-1000'
                : ''
            }`}
            style={{ transformOrigin: '100px 100px' }}
          >
            {/* Upper-Right Arrow Tip */}
            <polygon
              points="100,100 94,92 142,42 108,100"
              fill={`url(#hl-orange-grad-${size})`}
              stroke={colors.primaryInk}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Lower-Left Arrow Tail */}
            <polygon
              points="100,100 106,108 58,158 92,100"
              fill={`url(#hl-orange-dark-${size})`}
              stroke={colors.primaryInk}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Arrow Highlights / Shading spine */}
            <polygon points="100,100 97,95 142,42" fill="#FFB18E" opacity="0.8" />
            <polygon points="100,100 103,105 58,158" fill="#AF380E" opacity="0.6" />
          </g>

          {/* 6. Center Pivot Rivet Ring */}
          <circle
            cx="100"
            cy="100"
            r="7.5"
            fill={colors.paperBg}
            stroke={colors.primaryInk}
            strokeWidth="2.5"
          />
          <circle cx="100" cy="100" r="3.2" fill={colors.accentOrange} />

          {/* Dynamic contextual signal indicator for special states */}
          {isFounders && (
            <circle cx="160" cy="40" r="8" fill="#FF6B35" className="animate-ping" />
          )}
          {isVerifying && (
            <circle cx="40" cy="160" r="7" fill="#2E7D32" className="animate-ping" />
          )}
          {isError && (
            <path
              d="M 96 90 L 104 110 M 104 90 L 96 110"
              stroke="#C62828"
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}
        </svg>
      </div>

      {/* Optional Wordmark & Subtitles */}
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <div className="flex items-baseline gap-0.5">
            <span
              className={`font-display font-extrabold tracking-tight text-[#1E1B18] ${dimensions.font} ${
                isIntro ? 'animate-in fade-in slide-in-from-bottom-2 duration-500 delay-1000' : ''
              } ${wordmarkClassName}`}
            >
              Huntlyst
            </span>
            <span className="text-[#FF6B35] font-black text-sm select-none">.</span>
          </div>

          {/* Hand-drawn Orange Brush Underline */}
          {showUnderline && (
            <svg
              className={`w-full h-2 mt-0.5 overflow-visible ${
                isIntro ? 'animate-in fade-in duration-700 delay-[1300ms]' : ''
              }`}
              viewBox="0 0 160 8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M 2 4 C 40 6, 110 2, 158 5"
                stroke="#FF6B35"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          )}

          {/* Subtitle / Tagline */}
          {(showTagline || subtitle) && (
            <span
              className={`font-serif italic text-[#766E65] mt-1 ${dimensions.sub} ${
                isIntro ? 'animate-in fade-in duration-500 delay-[1500ms]' : ''
              }`}
            >
              {subtitle || 'Find the companies worth knowing.'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

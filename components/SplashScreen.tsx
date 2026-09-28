'use client';

import React, { useEffect, useState } from 'react';
import HuntlystLogo from './HuntlystLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [step, setStep] = useState<number>(1);
  const [isExiting, setIsExiting] = useState<boolean>(false);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onComplete, 400);
      }, 500);
      return () => clearTimeout(timer);
    }

    // Silky smooth, organic pacing (Total duration ~4.2s with generous breathing room)
    const t2 = setTimeout(() => setStep(2), 400);   // Sketch ticks & top annotations
    const t3 = setTimeout(() => setStep(3), 900);   // Compass ring & sticky notes
    const t4 = setTimeout(() => setStep(4), 1450);  // Central H ink reveal & spikes
    const t5 = setTimeout(() => setStep(5), 1950);  // Orange directional needle sweep
    const t6 = setTimeout(() => setStep(6), 2450);  // Complete logo settle & glow
    const t7 = setTimeout(() => setStep(7), 2800);  // Huntlyst wordmark glide in
    const t8 = setTimeout(() => setStep(8), 3200);  // Orange brush underline draw
    const t9 = setTimeout(() => setStep(9), 3500);  // Taglines & bottom annotations
    const t10 = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onComplete, 950); // Luxury 950ms cross-fade exit
    }, 4400);

    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
      clearTimeout(t7);
      clearTimeout(t8);
      clearTimeout(t9);
      clearTimeout(t10);
    };
  }, [onComplete]);

  const handleSkip = () => {
    setIsExiting(true);
    setTimeout(onComplete, 350);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#FAF6EE] overflow-hidden select-none transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isExiting
          ? 'opacity-0 scale-[0.98] blur-[2px] pointer-events-none'
          : 'opacity-100 scale-100 blur-0'
      }`}
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 50%, rgba(255,253,249,0.98) 0%, rgba(250,246,238,0.95) 50%, rgba(30,27,24,0.14) 100%),
          repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(30,27,24,0.012) 2px, rgba(30,27,24,0.012) 4px)
        `,
      }}
    >
      {/* Dark charcoal vignette edge treatment mirroring reference image */}
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(30,27,24,0.85)_100%)] transition-opacity duration-1000" />

      {/* Subtle background world map routes (faint dots & curves) */}
      <svg
        className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-1000 ease-out ${
          step >= 2 ? 'opacity-30' : 'opacity-0'
        }`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke="#766E65" strokeWidth="1.2" strokeDasharray="5 7" fill="none">
          <path d="M 120 280 Q 320 210, 520 260 T 960 220 T 1380 290" />
          <path d="M 220 540 Q 560 480, 840 560 T 1280 500" />
          <path d="M 400 160 Q 720 320, 1020 180" />
        </g>
        {/* Route hubs */}
        <circle cx="320" cy="210" r="3.5" fill="#FF6B35" opacity="0.7" />
        <circle cx="520" cy="260" r="4" fill="#FF6B35" opacity="0.85" />
        <circle cx="960" cy="220" r="3.5" fill="#FF6B35" opacity="0.7" />
        <circle cx="840" cy="560" r="4" fill="#FF6B35" opacity="0.85" />
      </svg>

      {/* Hand-drawn editorial annotations & sketches mirroring reference image */}
      <div className="absolute inset-0 max-w-6xl mx-auto pointer-events-none hidden md:block">
        {/* Top-left: "Start somewhere" */}
        <div
          className={`absolute top-16 left-16 transition-all duration-1000 ease-out ${
            step >= 2 ? 'opacity-90 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}
        >
          <span className="font-serif italic text-sm text-[#766E65]">Start somewhere</span>
          <svg className="w-10 h-6 text-[#766E65] mt-1" viewBox="0 0 40 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M 4 8 C 18 6, 28 14, 36 20 M 36 20 L 30 18 M 36 20 L 34 14" strokeLinecap="round" />
          </svg>
        </div>

        {/* Sticky note left: "More Founders. Bigger Tomorrows." */}
        <div
          className={`absolute top-44 left-8 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            step >= 3 ? 'opacity-95 translate-y-0 rotate-[-3deg]' : 'opacity-0 translate-y-4 rotate-0'
          }`}
        >
          <div className="relative bg-[#FFF2DE] p-4 rounded-md shadow-md border border-[#E8DAC2] w-40 text-xs font-serif leading-snug text-[#1E1B18]">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-3.5 bg-[#FF6B35] opacity-50 -rotate-1 rounded-sm" />
            <p className="font-bold text-sm">More Founders.</p>
            <p className="italic text-[#766E65] mt-1">Bigger Tomorrows.</p>
          </div>
        </div>

        {/* Lower-left: "Discover Opportunities" */}
        <div
          className={`absolute bottom-36 left-28 transition-all duration-1000 ease-out ${
            step >= 4 ? 'opacity-85 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <span className="font-serif italic text-sm text-[#766E65]">Discover Opportunities</span>
          <svg className="w-12 h-8 text-[#766E65] mt-1" viewBox="0 0 50 30" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M 6 22 C 20 22, 34 16, 44 6 M 44 6 L 38 6 M 44 6 L 44 12" strokeLinecap="round" />
          </svg>
        </div>

        {/* Top-right: "Explore Global Potential" */}
        <div
          className={`absolute top-16 right-24 text-right transition-all duration-1000 ease-out ${
            step >= 2 ? 'opacity-90 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}
        >
          <span className="font-serif italic text-sm text-[#766E65]">Explore Global Potential</span>
          <svg className="w-12 h-6 text-[#766E65] mt-1 ml-auto" viewBox="0 0 50 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M 44 6 C 30 8, 18 16, 6 20 M 6 20 L 12 18 M 6 20 L 8 14" strokeLinecap="round" />
          </svg>
        </div>

        {/* Sticky note right: "Ideas to Impact." */}
        <div
          className={`absolute top-48 right-12 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            step >= 3 ? 'opacity-95 translate-y-0 rotate-[2deg]' : 'opacity-0 translate-y-4 rotate-0'
          }`}
        >
          <div className="relative bg-[#FFF8ED] p-3.5 rounded-md shadow-md border border-[#E8DAC2] w-36 text-xs font-serif text-[#1E1B18]">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-3 bg-[#FF6B35] opacity-50 rotate-1 rounded-sm" />
            <p className="font-bold">Ideas to Impact.</p>
          </div>
        </div>

        {/* Mid-right annotation: "Build What's Next" */}
        <div
          className={`absolute bottom-44 right-32 text-right transition-all duration-1000 ease-out ${
            step >= 5 ? 'opacity-85 translate-x-0' : 'opacity-0 translate-x-3'
          }`}
        >
          <span className="font-serif italic text-sm text-[#766E65]">Build What's Next</span>
        </div>

        {/* Bottom signpost sketch in corner */}
        <div
          className={`absolute bottom-6 right-8 transition-opacity duration-1000 ${
            step >= 6 ? 'opacity-75' : 'opacity-0'
          }`}
        >
          <div className="border border-[#766E65] px-2.5 py-1 text-[9px] font-mono tracking-widest text-[#766E65] bg-[#FAF6EE] rounded shadow-sm">
            EXPLORE • DISCOVER • BUILD
          </div>
        </div>

        {/* Bottom annotation: "Good leads leave evidence." */}
        <div
          className={`absolute bottom-8 left-1/2 -translate-x-1/2 text-center transition-all duration-1000 ease-out ${
            step >= 8 ? 'opacity-90 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <span className="font-serif italic text-xs text-[#766E65]">
            Good leads leave evidence.
          </span>
          <div className="h-0.5 w-full bg-[#FF6B35] opacity-50 mt-1 rounded-full" />
        </div>
      </div>

      {/* Central Interactive Hero Intro Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-xl mx-auto">
        {/* Animated Huntlyst Logo Emblem with Butter-Smooth Timing */}
        <div className="relative mb-6 transition-transform duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]">
          <HuntlystLogo
            size="2xl"
            variant="orange-black"
            state={
              step >= 6
                ? 'complete'
                : step >= 5
                ? 'searching'
                : step >= 3
                ? 'intro'
                : 'idle'
            }
            showWordmark={false}
          />
        </div>

        {/* Wordmark "Huntlyst" */}
        <div
          className={`transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            step >= 7 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
          }`}
        >
          <div className="flex items-baseline justify-center gap-1">
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-extrabold text-[#1E1B18] tracking-tight">
              Huntlyst
            </h1>
            <span className="text-[#FF6B35] font-black text-3xl select-none">.</span>
          </div>

          {/* Orange brush underline */}
          <div
            className={`w-48 sm:w-64 h-2 mx-auto mt-1 transition-all duration-800 ease-out ${
              step >= 8 ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
            }`}
            style={{ transformOrigin: 'left center' }}
          >
            <svg viewBox="0 0 240 8" fill="none" className="w-full h-full">
              <path
                d="M 2 4 C 60 6, 170 2, 238 5"
                stroke="#FF6B35"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Taglines */}
        <div
          className={`mt-4 space-y-1.5 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            step >= 9 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <p className="font-serif italic text-lg sm:text-xl text-[#1E1B18] font-medium tracking-wide">
            Find the companies worth knowing.
          </p>
          <p className="font-mono text-xs sm:text-sm text-[#766E65] tracking-tight">
            Autonomous company discovery &amp; lead intelligence
          </p>
        </div>

        {/* Ambient progress indicator showing smooth transition */}
        <div
          className={`mt-8 transition-opacity duration-700 ease-out ${
            step >= 9 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="w-32 h-1 bg-[#E8DAC2] rounded-full overflow-hidden mx-auto">
            <div className="h-full bg-[#FF6B35] animate-[shimmer_1.4s_infinite] w-full" />
          </div>
        </div>
      </div>

      {/* Skip Intro Button */}
      <button
        type="button"
        onClick={handleSkip}
        className="absolute bottom-6 right-6 z-20 text-xs font-mono font-bold text-[#766E65] hover:text-[#1E1B18] bg-[#FFFDF9]/90 hover:bg-[#FFE7DC] px-3.5 py-1.5 rounded-lg border border-[#E8DAC2] shadow-sm transition-all duration-300 hover:scale-105"
      >
        Skip intro ➔
      </button>
    </div>
  );
}

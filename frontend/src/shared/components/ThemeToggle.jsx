import React from 'react';
import { Palette, Check, Sparkles, BookOpen } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const ThemeToggle = ({ 
  variant = 'compact', 
  className = '',
  showLabel = true 
}) => {
  const { theme, isEarth, toggleTheme, setTheme } = useTheme();

  if (variant === 'cards') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
        {/* Current Theme Card */}
        <div
          onClick={() => setTheme('default')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setTheme('default');
            }
          }}
          className={`cursor-pointer rounded-2xl p-4 sm:p-5 border transition-all duration-200 relative ${
            !isEarth
              ? 'border-blue-500 bg-[#172846]/50 shadow-md ring-2 ring-blue-500/20'
              : 'border-slate-700/80 bg-[#101D35]/60 hover:border-slate-600 hover:bg-[#172846]/30'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0B1730] border border-slate-700 flex items-center justify-center text-blue-400">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>Current Theme</span>
                  {!isEarth && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-400/30">
                      Active
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Deep statutory navy canvas with slate cards &amp; vivid cyan-blue accents
                </p>
              </div>
            </div>
            {!isEarth && (
              <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 stroke-[2.5]" />
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Palette:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-[#0B1730] border border-slate-600" title="Canvas (#0B1730)" />
              <div className="w-5 h-5 rounded-md bg-[#101D35] border border-slate-600" title="Panel (#101D35)" />
              <div className="w-5 h-5 rounded-md bg-[#172846] border border-slate-600" title="Muted (#172846)" />
              <div className="w-5 h-5 rounded-md bg-blue-600 border border-blue-400" title="Primary Blue (#2563EB)" />
              <div className="w-5 h-5 rounded-md bg-emerald-500 border border-emerald-400" title="Disposed Green" />
            </div>
          </div>
        </div>

        {/* Earth Editorial Card */}
        <div
          onClick={() => setTheme('earth')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setTheme('earth');
            }
          }}
          className={`cursor-pointer rounded-2xl p-4 sm:p-5 border transition-all duration-200 relative ${
            isEarth
              ? 'border-[#803D2D] bg-[#EAE2D5]/70 shadow-md ring-2 ring-[#803D2D]/30'
              : 'border-slate-700/80 bg-[#101D35]/60 hover:border-slate-600 hover:bg-[#172846]/30'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F5F0E8] border border-[#DED5C8] flex items-center justify-center text-[#803D2D]">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>Earth Editorial</span>
                  {isEarth && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#803D2D]/15 text-[#803D2D] font-bold border border-[#803D2D]/30">
                      Active
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Warm parchment surfaces, terracotta accents &amp; refined editorial typography
                </p>
              </div>
            </div>
            {isEarth && (
              <div className="w-6 h-6 rounded-full bg-[#803D2D] text-white flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 stroke-[2.5]" />
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Palette:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-[#F5F0E8] border border-[#DED5C8]" title="Warm Parchment (#F5F0E8)" />
              <div className="w-5 h-5 rounded-md bg-[#FFFCF7] border border-[#DED5C8]" title="Soft Paper White (#FFFCF7)" />
              <div className="w-5 h-5 rounded-md bg-[#EAE2D5] border border-[#DED5C8]" title="Muted Surface (#EAE2D5)" />
              <div className="w-5 h-5 rounded-md bg-[#803D2D] border border-[#683123]" title="Terracotta Primary (#803D2D)" />
              <div className="w-5 h-5 rounded-md bg-[#4A6741] border border-[#3A5333]" title="Earth Green (#4A6741)" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Compact Header / Nav Toggle
  return (
    <button
      onClick={toggleTheme}
      type="button"
      role="switch"
      aria-checked={isEarth}
      aria-label={`Current theme: ${isEarth ? 'Earth Editorial' : 'Default'}. Click to toggle.`}
      title={isEarth ? 'Switch to Current Theme (Navy)' : 'Switch to Earth Editorial Theme'}
      className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 select-none ${
        isEarth
          ? 'bg-[#EAE2D5] hover:bg-[#E0D7C8] border-[#DED5C8] text-[#292621] focus-visible:ring-[#803D2D]'
          : 'bg-[#101D35] hover:bg-[#172846] border-slate-700/80 text-slate-300 hover:text-white focus-visible:ring-blue-500'
      } ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`w-4 h-4 rounded-full flex items-center justify-center transition-transform duration-200 ${
            isEarth
              ? 'bg-[#803D2D] text-[#FFFCF7] rotate-12'
              : 'bg-blue-500/20 text-blue-400 group-hover:scale-105'
          }`}
        >
          {isEarth ? (
            <BookOpen className="w-2.5 h-2.5" />
          ) : (
            <Palette className="w-2.5 h-2.5" />
          )}
        </span>
        {showLabel && (
          <span className="font-semibold text-[11px] tracking-tight">
            {isEarth ? 'Earth Editorial' : 'Default Theme'}
          </span>
        )}
      </div>

      {/* Mini Toggle Track */}
      <div
        className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors duration-200 ${
          isEarth ? 'bg-[#803D2D] justify-end' : 'bg-slate-700 justify-start'
        }`}
      >
        <div
          className={`w-3 h-3 rounded-full bg-white shadow-xs transition-transform duration-200`}
        />
      </div>
    </button>
  );
};

export default ThemeToggle;

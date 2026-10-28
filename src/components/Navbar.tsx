import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Shield,
  AlertTriangle,
  Menu,
  X,
  Palette,
  Check,
  RotateCcw
} from 'lucide-react';
import {
  AmbianceThemeId,
  FrontendColorConfig,
  FRONTEND_COLOR_PRESETS
} from './LiveBackground';

interface NavbarProps {
  onTriggerSOS: () => void;
  colorConfig: FrontendColorConfig;
  onSelectPreset: (presetId: Exclude<AmbianceThemeId, 'custom'>) => void;
  onUpdateCustomColors: (partial: Partial<FrontendColorConfig>) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onTriggerSOS,
  colorConfig,
  onSelectPreset,
  onUpdateCustomColors
}) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const colorPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        colorPopoverRef.current &&
        !colorPopoverRef.current.contains(event.target as Node)
      ) {
        setColorMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { path: '/routes', label: 'Route Planner' },
    { path: '/heatmap', label: 'Threat Radar' },
    { path: '/dashboard', label: 'Safe Corridors' },
    { path: '/assistant', label: 'Guardian & AI' }
  ];

  const presetList = Object.values(FRONTEND_COLOR_PRESETS);

  return (
    <header className="sticky top-0 z-50 glass-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Top-Left Brand Lockup */}
          <Link to="/" className="flex items-center gap-3 group focus:outline-none shrink-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center border transition-colors"
              style={{
                backgroundColor: `color-mix(in srgb, ${colorConfig.primary} 16%, transparent)`,
                borderColor: `color-mix(in srgb, ${colorConfig.primary} 45%, transparent)`,
                boxShadow: `0 0 20px color-mix(in srgb, ${colorConfig.primary} 28%, transparent)`
              }}
            >
              <Shield className="w-5 h-5" style={{ color: colorConfig.primary }} />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              SafeCircle <span style={{ color: colorConfig.primary }}>AI</span>
            </span>
          </Link>

          {/* Essential Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-[#FFD43B]'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions: Color Switcher + Route CTA + SOS */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Frontend Color & Theme Switcher Dropdown */}
            <div className="relative" ref={colorPopoverRef}>
              <button
                type="button"
                onClick={() => setColorMenuOpen(prev => !prev)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-xs font-semibold text-white transition-all cursor-pointer"
                title="Change Frontend Theme & Colors"
              >
                <Palette className="w-3.5 h-3.5" style={{ color: colorConfig.secondary }} />
                <span className="hidden lg:inline">Theme Colors</span>
                <span className="flex items-center -space-x-1">
                  <span
                    className="w-3 h-3 rounded-full border border-black/60"
                    style={{ backgroundColor: colorConfig.primary }}
                  />
                  <span
                    className="w-3 h-3 rounded-full border border-black/60"
                    style={{ backgroundColor: colorConfig.secondary }}
                  />
                </span>
              </button>

              {colorMenuOpen && (
                <div className="absolute right-0 mt-2.5 w-80 rounded-2xl bg-[#0D1117]/95 backdrop-blur-2xl border border-white/15 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.85)] z-[999] space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5" style={{ color: colorConfig.primary }} />
                        <span>Frontend Color Studio</span>
                      </div>
                      <p className="text-[11px] text-[#9CA3AF]">
                        Choose a preset theme or customize colors
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectPreset('aurora-prism')}
                      className="text-[10px] font-mono text-[#9CA3AF] hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 cursor-pointer"
                      title="Reset to default theme"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  </div>

                  {/* Preset Palettes Grid */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF]">
                      Curated Theme Presets
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {presetList.map(preset => {
                        const isSelected = colorConfig.themeId === preset.themeId;
                        return (
                          <button
                            key={preset.themeId}
                            type="button"
                            onClick={() =>
                              onSelectPreset(preset.themeId as Exclude<AmbianceThemeId, 'custom'>)
                            }
                            className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-white/10 border-white/40 shadow-sm'
                                : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.07]'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                                  style={{ backgroundColor: preset.primary }}
                                />
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                                  style={{ backgroundColor: preset.secondary }}
                                />
                              </div>
                              <div className="text-[11px] font-semibold text-white truncate">
                                {preset.label}
                              </div>
                            </div>
                            {isSelected && (
                              <Check
                                className="w-3.5 h-3.5 shrink-0"
                                style={{ color: preset.secondary }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Color Pickers */}
                  <div className="pt-2.5 border-t border-white/10 space-y-2.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF]">
                      Custom Color Pickers
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="p-2 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col items-center gap-1.5 cursor-pointer hover:border-white/25">
                        <input
                          type="color"
                          value={colorConfig.primary}
                          onChange={e =>
                            onUpdateCustomColors({
                              themeId: 'custom',
                              label: 'Custom Palette',
                              primary: e.target.value
                            })
                          }
                          className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-[10px] font-medium text-white">Primary</span>
                        <span className="text-[9px] font-mono text-[#9CA3AF] uppercase">
                          {colorConfig.primary}
                        </span>
                      </label>

                      <label className="p-2 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col items-center gap-1.5 cursor-pointer hover:border-white/25">
                        <input
                          type="color"
                          value={colorConfig.secondary}
                          onChange={e =>
                            onUpdateCustomColors({
                              themeId: 'custom',
                              label: 'Custom Palette',
                              secondary: e.target.value
                            })
                          }
                          className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-[10px] font-medium text-white">Highlight</span>
                        <span className="text-[9px] font-mono text-[#9CA3AF] uppercase">
                          {colorConfig.secondary}
                        </span>
                      </label>

                      <label className="p-2 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col items-center gap-1.5 cursor-pointer hover:border-white/25">
                        <input
                          type="color"
                          value={colorConfig.bgBase}
                          onChange={e =>
                            onUpdateCustomColors({
                              themeId: 'custom',
                              label: 'Custom Palette',
                              bgBase: e.target.value
                            })
                          }
                          className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-[10px] font-medium text-white">Surface</span>
                        <span className="text-[9px] font-mono text-[#9CA3AF] uppercase">
                          {colorConfig.bgBase}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>


            <Link
              to="/routes"
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#168BFF] hover:bg-[#168BFF]/90 text-white text-xs font-semibold tracking-wide transition-all shadow-md"
            >
              Find a Safe Route
            </Link>

            <button
              onClick={onTriggerSOS}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#FFD43B] border border-[#EF4444]/40 font-semibold text-xs transition-all cursor-pointer focus:outline-none"
              title="Trigger emergency call and location alert"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />
              <span>SOS</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#07090D]/95 backdrop-blur-2xl border-b border-white/10 px-4 pt-2 pb-5 space-y-2">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-[#168BFF]/15 text-[#FFD43B]'
                    : 'text-[#9CA3AF] hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            to="/routes"
            onClick={() => setMobileMenuOpen(false)}
            className="block w-full text-center px-4 py-2.5 rounded-lg bg-[#168BFF] text-white text-sm font-semibold mt-2"
          >
            Find a Safe Route
          </Link>
        </div>
      )}
    </header>
  );
};

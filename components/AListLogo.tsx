'use client';

interface AListLogoProps {
  variant?: 'default' | 'icon' | 'full' | 'minimal' | 'splash';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  theme?: 'gradient' | 'monochrome' | 'light';
  animated?: boolean;
  tagline?: string;
  className?: string;
}

export function AListLogo({ 
  variant = 'default', 
  size = 'md', 
  theme = 'gradient',
  animated = false,
  tagline = 'YOUR WORLD, CURATED.',
  className = '' 
}: AListLogoProps) {
  const sizes = {
    sm: { container: 'h-6', icon: 'w-6 h-6', text: 'text-sm', letterSpacing: 'tracking-tight' },
    md: { container: 'h-8', icon: 'w-8 h-8', text: 'text-base', letterSpacing: 'tracking-tight' },
    lg: { container: 'h-12', icon: 'w-12 h-12', text: 'text-2xl', letterSpacing: 'tracking-widest' },
    xl: { container: 'h-16', icon: 'w-16 h-16', text: 'text-4xl', letterSpacing: 'tracking-[0.2em]' },
    '2xl': { container: 'h-24', icon: 'w-24 h-24', text: 'text-5xl', letterSpacing: 'tracking-[0.3em]' }
  };

  const themes = {
    gradient: {
      iconBg: 'bg-gradient-to-br from-[#BD00FF] via-[#FF00E5] to-[#00D9FF]',
      textGradient: 'bg-gradient-to-r from-[#BD00FF] via-[#FF00E5] to-[#00D9FF] bg-clip-text text-transparent',
      tagline: 'text-[#E5E4E2]/60'
    },
    monochrome: {
      iconBg: 'bg-[#011410]',
      textGradient: 'text-[#F5F5F7]',
      tagline: 'text-[#E5E4E2]/30'
    },
    light: {
      iconBg: 'bg-gradient-to-br from-[#BD00FF] via-[#FF00E5] to-[#00D9FF]',
      textGradient: 'bg-gradient-to-r from-[#011410] via-[#000504] to-black bg-clip-text text-transparent',
      tagline: 'text-[#E5E4E2]/50'
    }
  };

  const sizeConfig = sizes[size];
  const themeConfig = themes[theme];

  // Splash screen variant
  if (variant === 'splash') {
    return (
      <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
        <div className={`${sizeConfig.icon} rounded-full ${themeConfig.iconBg} flex items-center justify-center shadow-2xl ${animated ? 'animate-pulse' : ''}`}>
          <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 4L4 20H8.5L12 12L15.5 20H20L12 4Z"
              fill="white"
              fillOpacity="0.95"
            />
          </svg>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className={`font-bold ${sizeConfig.text} ${sizeConfig.letterSpacing} ${themeConfig.textGradient}`}>
            A-LIST
          </span>
          <span className={`text-sm ${themeConfig.tagline} tracking-widest uppercase`}>
            {tagline}
          </span>
        </div>
      </div>
    );
  }

  // Minimal variant
  if (variant === 'minimal') {
    return (
      <span className={`font-bold ${sizeConfig.text} ${sizeConfig.letterSpacing} ${themeConfig.textGradient} whitespace-nowrap ${className}`}>
        A-LIST
      </span>
    );
  }

  // Icon only variant
  if (variant === 'icon') {
    return (
      <div className={`${sizeConfig.icon} rounded-full ${themeConfig.iconBg} flex items-center justify-center shadow-lg ${animated ? 'hover:scale-110 transition-transform' : ''} ${className}`}>
        <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 4L4 20H8.5L12 12L15.5 20H20L12 4Z"
            fill="white"
            fillOpacity="0.95"
          />
        </svg>
      </div>
    );
  }

  // Full logo variant with tagline
  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <div className="flex items-center gap-3">
          <div className={`${sizeConfig.icon} rounded-full ${themeConfig.iconBg} flex items-center justify-center shadow-lg`}>
            <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 4L4 20H8.5L12 12L15.5 20H20L12 4Z"
                fill="white"
                fillOpacity="0.95"
              />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className={`font-bold ${sizeConfig.text} ${sizeConfig.letterSpacing} ${themeConfig.textGradient}`}>
              A-LIST
            </span>
          </div>
        </div>
        <span className={`text-xs ${themeConfig.tagline} tracking-wider uppercase`}>{tagline}</span>
      </div>
    );
  }

  // Default variant - icon with text
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`${sizeConfig.icon} rounded-full ${themeConfig.iconBg} flex items-center justify-center shadow-lg ${animated ? 'hover:scale-105 transition-transform' : ''}`}>
        <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 4L4 20H8.5L12 12L15.5 20H20L12 4Z"
            fill="white"
            fillOpacity="0.95"
          />
        </svg>
      </div>
      <span className={`font-bold ${sizeConfig.text} ${sizeConfig.letterSpacing} ${themeConfig.textGradient}`}>
        A-LIST
      </span>
    </div>
  );
}
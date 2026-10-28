import React, { useEffect, useRef } from 'react';

export type AmbianceThemeId =
  | 'aurora-prism'
  | 'crimson-pulse'
  | 'emerald-matrix'
  | 'violet-nova'
  | 'cyber-cyan'
  | 'sunset-amber'
  | 'custom';

export interface FrontendColorConfig {
  themeId: AmbianceThemeId;
  label: string;
  primary: string;
  secondary: string;
  bgBase: string;
  secondaryBg: string;
  cardBg: string;
}

export const FRONTEND_COLOR_PRESETS: Record<Exclude<AmbianceThemeId, 'custom'>, FrontendColorConfig> = {
  'aurora-prism': {
    themeId: 'aurora-prism',
    label: 'Electric Blue & Gold',
    primary: '#168BFF',
    secondary: '#FFD43B',
    bgBase: '#07090D',
    secondaryBg: '#0D1117',
    cardBg: '#121721'
  },
  'crimson-pulse': {
    themeId: 'crimson-pulse',
    label: 'Crimson Night',
    primary: '#E11D48',
    secondary: '#FF334F',
    bgBase: '#09090B',
    secondaryBg: '#111114',
    cardBg: '#18181B'
  },
  'emerald-matrix': {
    themeId: 'emerald-matrix',
    label: 'Emerald Safe',
    primary: '#10B981',
    secondary: '#38BDF8',
    bgBase: '#060C0A',
    secondaryBg: '#0B1512',
    cardBg: '#101F1A'
  },
  'violet-nova': {
    themeId: 'violet-nova',
    label: 'Violet Nova',
    primary: '#8B5CF6',
    secondary: '#F472B6',
    bgBase: '#08060E',
    secondaryBg: '#110D1C',
    cardBg: '#171226'
  },
  'cyber-cyan': {
    themeId: 'cyber-cyan',
    label: 'Cyber Cyan',
    primary: '#06B6D4',
    secondary: '#F59E0B',
    bgBase: '#060A0F',
    secondaryBg: '#0B131C',
    cardBg: '#111C29'
  },
  'sunset-amber': {
    themeId: 'sunset-amber',
    label: 'Solar Gold & Coral',
    primary: '#F59E0B',
    secondary: '#FB7185',
    bgBase: '#0C0907',
    secondaryBg: '#16110D',
    cardBg: '#1F1812'
  }
};

export function applyFrontendThemeToDocument(config: FrontendColorConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--theme-primary', config.primary);
  root.style.setProperty('--theme-secondary', config.secondary);
  root.style.setProperty('--theme-tertiary', config.secondary);
  root.style.setProperty('--theme-bg', config.bgBase);
  root.style.setProperty('--theme-secondary-bg', config.secondaryBg);
  root.style.setProperty('--theme-card-bg', config.cardBg);
}

interface TelemetryNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  colorIndex: number;
  pulsePhase: number;
  pulseSpeed: number;
}

interface LiveBackgroundProps {
  colorConfig?: FrontendColorConfig;
}

export const LiveBackground: React.FC<LiveBackgroundProps> = ({
  colorConfig = FRONTEND_COLOR_PRESETS['aurora-prism']
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const configRef = useRef<FrontendColorConfig>(colorConfig);
  configRef.current = colorConfig;

  useEffect(() => {
    applyFrontendThemeToDocument(colorConfig);
  }, [colorConfig]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const nodeCount = Math.min(32, Math.max(18, Math.floor((width * height) / 55000)));
    const nodes: TelemetryNode[] = Array.from({ length: nodeCount }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      radius: idx % 4 === 0 ? 2.1 : 1.3,
      colorIndex: idx % 3,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.012 + Math.random() * 0.015
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const current = configRef.current;
      const palette = [current.primary, current.secondary, '#FFFFFF'];

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const nodeColor = palette[n.colorIndex % palette.length];
        n.x += n.vx;
        n.y += n.vy;
        n.pulsePhase += n.pulseSpeed;

        if (n.x < 0) n.x = width;
        if (n.x > width) n.x = 0;
        if (n.y < 0) n.y = height;
        if (n.y > height) n.y = 0;

        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const dist = Math.hypot(n.x - m.x, n.y - m.y);
          if (dist < 160) {
            const alpha = (1 - dist / 160) * 0.14;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.strokeStyle = current.primary;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 0.75;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }

        const pulseScale = 1 + Math.sin(n.pulsePhase) * 0.2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * pulseScale, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor;
        ctx.globalAlpha = 0.45;
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden transition-colors duration-500"
      style={{ backgroundColor: colorConfig.bgBase }}
      aria-hidden="true"
    >
      <div className="live-aurora-orb live-aurora-cyan -top-40 -left-24 w-[640px] h-[640px]" />
      <div className="live-aurora-orb live-aurora-amber top-[22%] -right-32 w-[540px] h-[540px]" />
      <div className="live-aurora-orb live-aurora-cyan bottom-[-15%] left-[20%] w-[580px] h-[580px]" />
      <div className="absolute inset-0 live-prism-mesh opacity-75" />
      <div className="absolute inset-0 live-geo-grid opacity-30" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-75" />
    </div>
  );
};

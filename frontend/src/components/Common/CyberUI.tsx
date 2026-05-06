import React from 'react';

interface CyberPanelProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  idTag?: string;
}

export const CyberPanel = ({ children, title, className = "", idTag = "SEC-01" }: CyberPanelProps) => {
  return (
    <div className={`cyber-panel-v2 panel-scanline relative ${className}`}>
      {/* Top ID Tag - Positioned relative to the real top edge */}
      <div className="cyber-tab">{idTag}</div>
      
      {/* Panel Content - Internal Padding is now safe */}
      <div className="relative z-10 h-full flex flex-col p-6 pt-8">
        {title && (
          <h2 className="text-2xl font-black border-b-2 border-[#00f2ff]/20 pb-3 mb-6 flex items-center gap-2 italic uppercase tracking-tighter text-white neon-text-intense">
            {title}
          </h2>
        )}
        <div className="flex-1">
          {children}
        </div>
      </div>

      {/* Subtle Glow Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[#00f2ff]/5 to-transparent rounded-2xl" />
    </div>
  );
};

interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

interface CyberStatBarProps {
  label: string;
  value: number; // 0 to 100
  color?: string;
  level?: number;
}

export const CyberStatBar = ({ label, value, color = "#00f2ff", level }: CyberStatBarProps) => {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <div className="flex justify-between items-end">
        <span className="text-[9px] font-black uppercase tracking-tighter text-white/60">{label}</span>
        <span className="text-[12px] font-black italic text-white neon-text-intense">
          {level ? `LV.${level}` : `${value}%`}
        </span>
      </div>
      <div className="h-3 bg-black/40 border border-white/10 rounded-sm p-[2px] relative overflow-hidden">
        {/* Segmented Background */}
        <div className="absolute inset-0 flex gap-[2px]">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex-1 bg-white/5" />
          ))}
        </div>
        {/* Progress Fill */}
        <div 
          className="h-full relative transition-all duration-500 rounded-sm"
          style={{ 
            width: `${value}%`, 
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}88`
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      </div>
    </div>
  );
};

export const CyberButton = ({ children, className = "", ...props }: CyberButtonProps) => {
  return (
    <button className={`cyber-button-v2 ${className} flex items-center justify-center gap-2`} {...props}>
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
};

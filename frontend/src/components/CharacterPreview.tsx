import React from 'react';

interface CharacterPreviewProps {
  form: {
    body: string;
    hair_style?: string;
    hair_color?: string;
    outfit: string;
    gender: string;
  };
}

export const CharacterPreview = ({ form }: CharacterPreviewProps) => {
  const skinColors: any = { body_light: '#FFE0BD', body_tan: '#E0AC69', body_dark: '#8D5524' };
  const outfitImages: any = {
    agent_dev: 'assets/agent_dev.png',
    agent_design: 'assets/agent_design.png',
    agent_manage: 'assets/agent_manage.png',
    agent_market: 'assets/agent_market.png'
  };

  return (
    <div className="relative w-48 h-48 bg-[#0a1120] border-2 border-[#00f2ff]/30 mx-auto mb-4 flex items-center justify-center shadow-[inset_0_0_20px_rgba(0,242,255,0.1)] group overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#00f2ff_1px,transparent_1px)] [background-size:10px_10px]" />
      
      {/* Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none scanline-effect opacity-30 z-30" />

      <div className="relative w-32 h-32 flex items-center justify-center scale-150">
        {/* Base Body */}
        <div 
          className={`absolute w-12 h-14 border-2 border-black z-0 shadow-sm ${form.gender === 'female' ? 'rounded-3xl' : 'rounded-full'}`} 
          style={{ backgroundColor: skinColors[form.body] || skinColors['body_light'] }}
        />
        
        {/* Outfit Asset Overlay */}
        <img 
          src={outfitImages[form.outfit] || outfitImages['agent_dev']} 
          className="absolute w-20 h-20 object-contain pixelated z-10" 
          alt="outfit"
        />
        
        {/* Procedural Hair Style Overlay */}
        {form.hair_style && form.hair_style !== 'none' && (
          <div className="absolute top-[18px] z-20 flex flex-col items-center">
            {form.hair_style === 'hair_short' && (
              <div className="w-10 h-5 border-2 border-black rounded-t-lg" style={{ backgroundColor: form.hair_color }} />
            )}
            {form.hair_style === 'hair_long' && (
              <div className="relative">
                <div className="w-10 h-5 border-2 border-black rounded-t-lg" style={{ backgroundColor: form.hair_color }} />
                <div className="absolute top-0 -left-1 w-3 h-10 border-2 border-black rounded-b-md" style={{ backgroundColor: form.hair_color }} />
                <div className="absolute top-0 -right-1 w-3 h-10 border-2 border-black rounded-b-md" style={{ backgroundColor: form.hair_color }} />
              </div>
            )}
            {form.hair_style === 'hair_spiky' && (
              <div className="flex gap-1 -mt-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-3 h-5 border-2 border-black origin-bottom rotate-12" style={{ backgroundColor: form.hair_color, transform: `rotate(${(i-2)*25}deg)` }} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Status Label */}
      <div className="absolute bottom-2 right-2 bg-[#00f2ff] text-[#0a1120] text-[8px] px-2 font-black italic uppercase shadow-[0_0_10px_rgba(0,242,255,0.5)]">
        {form.gender} UNIT
      </div>
    </div>
  );
};

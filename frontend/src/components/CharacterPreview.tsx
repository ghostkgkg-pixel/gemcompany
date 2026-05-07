import React from 'react';

interface CharacterPreviewProps {
  form: {
    body: string;      // 몸체 타입 (피부색)
    hair_style?: string; // 헤어 스타일
    hair_color?: string; // 헤어 컬러
    outfit: string;     // 의상 타입
    gender: string;     // 성별
  };
}

/**
 * 에이전트 외형 미리보기 컴포넌트
 * 선택한 속성에 따라 캐릭터의 모습을 실시간으로 렌더링함
 */
export const CharacterPreview = ({ form }: CharacterPreviewProps) => {
  // 피부색 매핑
  const skinColors: any = { body_light: '#FFE0BD', body_tan: '#E0AC69', body_dark: '#8D5524' };
  
  // 의상 에셋 경로 매핑
  const outfitImages: any = {
    agent_dev: 'assets/agent_dev.png',
    agent_design: 'assets/agent_design.png',
    agent_manage: 'assets/agent_manage.png',
    agent_market: 'assets/agent_market.png'
  };

  return (
    <div className="relative w-48 h-48 bg-[#0a1120] border-2 border-[#00f2ff]/30 mx-auto mb-4 flex items-center justify-center shadow-[inset_0_0_20px_rgba(0,242,255,0.1)] group overflow-hidden">
      {/* 배경 그리드 장식 */}
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#00f2ff_1px,transparent_1px)] [background-size:10px_10px]" />
      
      {/* 스캔라인 효과 오버레이 */}
      <div className="absolute inset-0 pointer-events-none scanline-effect opacity-30 z-30" />

      <div className="relative w-32 h-32 flex items-center justify-center scale-150">
        {/* 베이스 바디 (피부색 적용) */}
        <div 
          className={`absolute w-12 h-14 border-2 border-black z-0 shadow-sm ${form.gender === 'female' ? 'rounded-3xl' : 'rounded-full'}`} 
          style={{ backgroundColor: skinColors[form.body] || skinColors['body_light'] }}
        />
        
        {/* 의상 이미지 오버레이 */}
        <img 
          src={outfitImages[form.outfit] || outfitImages['agent_dev']} 
          className="absolute w-20 h-20 object-contain pixelated z-10" 
          alt="outfit"
        />
        
        {/* 절차적 헤어 스타일 렌더링 */}
        {form.hair_style && form.hair_style !== 'none' && (
          <div className="absolute top-[18px] z-20 flex flex-col items-center">
            {/* 숏컷 스타일 */}
            {form.hair_style === 'hair_short' && (
              <div className="w-10 h-5 border-2 border-black rounded-t-lg" style={{ backgroundColor: form.hair_color }} />
            )}
            {/* 롱헤어 스타일 */}
            {form.hair_style === 'hair_long' && (
              <div className="relative">
                <div className="w-10 h-5 border-2 border-black rounded-t-lg" style={{ backgroundColor: form.hair_color }} />
                <div className="absolute top-0 -left-1 w-3 h-10 border-2 border-black rounded-b-md" style={{ backgroundColor: form.hair_color }} />
                <div className="absolute top-0 -right-1 w-3 h-10 border-2 border-black rounded-b-md" style={{ backgroundColor: form.hair_color }} />
              </div>
            )}
            {/* 스파이키(뾰족) 스타일 */}
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
      
      {/* 상태 라벨 */}
      <div className="absolute bottom-2 right-2 bg-[#00f2ff] text-[#0a1120] text-[8px] px-2 font-black italic uppercase shadow-[0_0_10px_rgba(0,242,255,0.5)]">
        {form.gender} UNIT
      </div>
    </div>
  );
};

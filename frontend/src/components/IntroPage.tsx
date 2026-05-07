import React from 'react';
import { Play, Settings, Power, LayoutDashboard } from 'lucide-react';

interface IntroPageProps {
  onStartSimulation: () => void; // 바로 시뮬레이션 시작 핸들러
  onOpenLobby: () => void;      // 로비(커맨드 센터) 이동 핸들러
}

/**
 * 인트로(메인 타이틀) 페이지 컴포넌트
 */
export function IntroPage({ onStartSimulation, onOpenLobby }: IntroPageProps) {
  // 프로그램 종료 핸들러
  const handleExit = () => {
    if (window.confirm("프로그램을 종료하시겠습니까?")) {
      window.close();
    }
  };

  return (
    <div className="w-full h-screen bg-[#0a0f1e] text-[#00f2ff] font-['NeoDunggeunmo'] relative overflow-hidden flex flex-col items-center justify-center scanline-effect">
      
      {/* 배경 그리드 장식 */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(#00f2ff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      {/* 메인 타이틀 영역 */}
      <div className="z-10 flex flex-col items-center mb-16 floating">
        <div className="relative group">
          <h1 className="text-8xl font-black tracking-tighter neon-text italic glitch-hover cursor-default select-none">
            GEM COMPANY
          </h1>
          <div className="absolute -bottom-4 right-0 text-sm font-bold tracking-[0.3em] text-white/50 uppercase">
            AI Office Simulation
          </div>
        </div>
      </div>

      {/* 메뉴 옵션 버튼 목록 */}
      <div className="z-10 flex flex-col gap-4 w-72 stagger-in">
        <button 
          onClick={onStartSimulation}
          className="group relative flex items-center gap-4 px-6 py-4 border-2 border-[#00f2ff] bg-[#00f2ff]/5 hover:bg-[#00f2ff]/20 transition-all duration-300 hover:translate-x-2"
        >
          <div className="absolute left-0 top-0 w-1 h-full bg-[#00f2ff] scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
          <Play size={20} className="group-hover:scale-125 transition-transform" />
          <span className="text-xl font-bold tracking-[0.2em]">출근하기</span>
        </button>

        <button 
          onClick={onOpenLobby}
          className="group relative flex items-center gap-4 px-6 py-4 border-2 border-[#00f2ff]/50 bg-white/5 hover:bg-[#00f2ff]/10 transition-all duration-300 hover:translate-x-2"
        >
          <div className="absolute left-0 top-0 w-1 h-full bg-[#00f2ff] scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
          <LayoutDashboard size={20} className="group-hover:rotate-12 transition-transform" />
          <span className="text-xl font-bold tracking-[0.2em]">커맨드 센터</span>
        </button>

        <button 
          className="group relative flex items-center gap-4 px-6 py-4 border-2 border-white/20 bg-white/5 hover:bg-white/10 transition-all duration-300 hover:translate-x-2 opacity-50 cursor-not-allowed"
        >
          <Settings size={20} />
          <span className="text-xl font-bold tracking-[0.2em]">시스템 설정</span>
        </button>

        <button 
          onClick={handleExit}
          className="group relative flex items-center gap-4 px-6 py-4 border-2 border-red-500/50 bg-red-500/5 hover:bg-red-500/20 transition-all duration-300 hover:translate-x-2"
        >
          <div className="absolute left-0 top-0 w-1 h-full bg-red-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
          <Power size={20} className="group-hover:rotate-90 transition-transform text-red-500" />
          <span className="text-xl font-bold tracking-[0.2em] text-red-500">종료하기</span>
        </button>
      </div>

      {/* 하단 저작권 정보 */}
      <div className="absolute bottom-8 text-[10px] text-white/30 tracking-[0.5em] uppercase font-bold">
        Copyright 2026 Ghostkgkg-Pixel. All Rights Reserved.
      </div>

      {/* 측면 장식 라인 */}
      <div className="absolute top-0 left-12 w-px h-full bg-gradient-to-b from-transparent via-[#00f2ff]/20 to-transparent" />
      <div className="absolute top-0 right-12 w-px h-full bg-gradient-to-b from-transparent via-[#00f2ff]/20 to-transparent" />
    </div>
  );
}

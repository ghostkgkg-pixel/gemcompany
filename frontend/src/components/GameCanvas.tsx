import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { MainScene } from '../game/MainScene';

/**
 * Phaser 게임 캔버스를 렌더링하는 리액트 컴포넌트
 * 리액트의 라이프사이클과 Phaser 게임 엔진 인스턴스를 연결함
 */
export const GameCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    // 컨테이너가 없거나 이미 게임이 생성된 경우 중복 생성 방지
    if (!containerRef.current || gameRef.current) return;

    /** Phaser 게임 설정 */
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.CANVAS, // 캔버스 렌더링 모드
      pixelArt: true,      // 픽셀 아트 스타일 유지
      antialias: false,    // 안티앨리어싱 비활성화 (선명한 픽셀)
      roundPixels: true,   // 픽셀 위치 반올림
      scale: {
        mode: Phaser.Scale.RESIZE, // 브라우저 크기에 맞춰 리사이징
        parent: containerRef.current,
        width: '100%',
        height: '100%',
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      backgroundColor: '#05080f',
      scene: [MainScene], // 메인 씬 등록
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false }
      },
    };

    try {
      // Phaser 게임 인스턴스 생성
      gameRef.current = new Phaser.Game(config);
    } catch (err) {
      console.error("Phaser 초기화 실패:", err);
    }

    // 컴포넌트 언마운트 시 게임 인스턴스 파괴 (리소스 정리)
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-full overflow-hidden">
      {/* Phaser 게임이 삽입될 DOM 요소 */}
      <div
        ref={containerRef}
        id="phaser-game-container"
        tabIndex={0}
        className="w-full h-full bg-[#05080f] outline-none"
      />
    </div>
  );
};

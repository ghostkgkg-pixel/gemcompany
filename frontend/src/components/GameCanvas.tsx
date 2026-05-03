import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { MainScene } from '../game/MainScene';

export const GameCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    // Small delay to ensure DOM is fully ready and painted
    const timer = setTimeout(() => {
      if (!containerRef.current || gameRef.current) return;

      console.log("Initializing Phaser Game...");
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.CANVAS, // Force CANVAS to avoid WebGL context issues in some environments
        scale: {
          mode: Phaser.Scale.RESIZE,
          parent: containerRef.current,
          width: '100%',
          height: '100%'
        },
        backgroundColor: '#ffffff',
        scene: [MainScene],
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
          },
        },
      };

      try {
        gameRef.current = new Phaser.Game(config);
      } catch (err) {
        console.error("Phaser initialization failed:", err);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (gameRef.current) {
        console.log("Destroying Phaser Game...");
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-full">
      <div 
        ref={containerRef} 
        id="phaser-game-container"
        className="w-full h-full bg-white" 
      />
    </div>
  );
};

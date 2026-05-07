import Phaser from 'phaser';
import { IsometricManager } from './IsometricManager';
import { useGameStore } from '../store/useGameStore';

/**
 * 맵의 바닥 타일, 그리드 및 영역 오버레이 렌더링을 담당하는 클래스
 */
export class MapManager {
    constructor(
        private scene: Phaser.Scene,
        private mapLayer: Phaser.GameObjects.Container,
        private iso: IsometricManager
    ) {}

    /**
     * 전체 맵 데이터를 기반으로 화면에 타일 및 그리드를 다시 그림
     */
    render(data: any) {
        this.mapLayer.removeAll(true);
        
        const tw = this.iso.tileWidth;
        const th = this.iso.tileHeight;

        for (let j = 0; j < data.height; j++) {
            for (let i = 0; i < data.width; i++) {
                const pos = this.iso.cartToIso(i, j);
                const zoneType = data.zone_data?.[j]?.[i] || 'none';
                const isBuildMode = useGameStore.getState().buildMode;
                
                if (zoneType === 'void' && !isBuildMode) continue;

                // 에셋이 포함된 프레임을 피하기 위해 기본 바닥(0) 또는 지정된 타일 사용
                let frame = this.getFloorFrame(zoneType);
                const isStrategicZone = ['work', 'meeting', 'break', 'ceo', 'lab'].includes(zoneType);
                
                // 전략 구역은 깨끗한 바닥(0)에 색상을 입히는 방식으로 렌더링 (에셋 잔상 방지)
                if (isStrategicZone) frame = 0;

                if (frame !== -1) {
                    const rx = Math.round(pos.x), ry = Math.round(pos.y);
                    const floorSprite = this.scene.add.sprite(rx, ry, 'floor_sheet', frame)
                        .setDisplaySize(tw, tw)
                        .setOrigin(0.5, 0.25)
                        .setDepth((i + j) * 0.01 - 100);

                    // 전략 구역에 색상 부여
                    if (isStrategicZone) {
                        const zoneColor = this.getZoneColor(zoneType);
                        floorSprite.setTint(zoneColor);
                        // 빌드 모드에서는 구역을 반투명하게, 평소(출근)에는 투명하게 숨김
                        floorSprite.setAlpha(isBuildMode ? 0.6 : 0);
                    } else if (zoneType === 'void') {
                        floorSprite.setAlpha(isBuildMode ? 0.2 : 0);
                    } else {
                        floorSprite.setAlpha(1);
                    }
                    
                    this.mapLayer.add(floorSprite);
                } else if (isBuildMode) {
                    this.renderGridTile(pos, tw, th);
                }
            }
        }
    }

    /**
     * 존 타입에 따른 색상값 반환
     */
    private getZoneColor(type: string): number {
        const colors: Record<string, number> = {
            'work': 0x3b82f6,    // Blue
            'meeting': 0xa855f7, // Purple
            'break': 0xf97316,   // Orange
            'ceo': 0xef4444,     // Red
            'lab': 0x10b981      // Emerald
        };
        return colors[type] ?? 0xffffff;
    }

    /**
     * 존(Zone) 타입에 따른 바닥 시트 프레임 번호 반환
     */
    private getFloorFrame(type: string): number {
        const frames: Record<string, number> = {
            'none': 0, 'work': 1, 'meeting': 2, 'break': 3, 'ceo': 4, 'lab': 5,
            'neon_border': 8, 'grid_dot': 9, 'premium_carpet': 10, 'wood': 11, 'metal': 12
        };
        return frames[type] ?? -1;
    }

    /**
     * 특정 좌표에 장애물이 있는지 확인
     */
    private hasObstacleAt(data: any, x: number, y: number): boolean {
        if (!data.obstacles) return false;
        return data.obstacles.some((o: any) => Math.floor(o.x) === x && Math.floor(o.y) === y);
    }

    /**
     * 빌드 모드 시 빈 공간에 격자(Grid) 표시
     */
    private renderGridTile(pos: {x: number, y: number}, tw: number, th: number) {
        const grid = this.scene.add.graphics();
        grid.lineStyle(1, 0x00f2ff, 0.1);
        grid.strokePoints([
            { x: pos.x, y: pos.y - th / 2 },
            { x: pos.x + tw / 2, y: pos.y },
            { x: pos.x, y: pos.y + th / 2 },
            { x: pos.x - tw / 2, y: pos.y }
        ], true);
        this.mapLayer.add(grid);
    }
}

import Phaser from 'phaser';
import { IsometricManager } from './IsometricManager';
import { useGameStore } from '../store/useGameStore';

/**
 * 맵의 바닥 타일, 그리드 및 영역 오버레이 렌더링을 담당하는 클래스
 */
export class MapManager {
    constructor(
        private scene: Phaser.Scene,
        private floorLayer: Phaser.GameObjects.Container,
        private iso: IsometricManager
    ) {}

    /**
     * 전체 맵 데이터를 기반으로 화면에 타일 및 그리드를 다시 그림
     */
    render(data: any) {
        this.floorLayer.removeAll(true);
        
        const tw = this.iso.tileWidth;
        const th = this.iso.tileHeight;
        const isBuildMode = useGameStore.getState().buildMode;

        for (let j = 0; j < data.height; j++) {
            for (let i = 0; i < data.width; i++) {
                const pos = this.iso.cartToIso(i, j);
                const rx = Math.round(pos.x), ry = Math.round(pos.y);
                
                // 1. 바닥 타일 (Flooring) 렌더링 - 항상 보임
                const floorType = data.floor_data?.[j]?.[i] || 'none';
                if (floorType !== 'void') {
                    const frame = this.getFloorFrame(floorType);
                    if (frame !== -1) {
                        const floorSprite = this.scene.add.sprite(rx, ry, 'floor_sheet', frame)
                            .setDisplaySize(tw, tw)
                            .setOrigin(0.5, 0.25)
                            .setDepth((i + j) * 0.01 - 100);
                        this.floorLayer.add(floorSprite);
                    } else if (isBuildMode) {
                        this.renderGridTile(pos, tw, th);
                    }
                }

                // 2. 구역 오버레이 (Zone) 렌더링 - 에디터 모드에서만 반투명하게 보임
                const zoneType = data.zone_data?.[j]?.[i] || 'none';
                if (zoneType !== 'none' && zoneType !== 'void' && isBuildMode) {
                    const zoneColor = this.getZoneColor(zoneType);
                    const zoneOverlay = this.scene.add.sprite(rx, ry, 'floor_sheet', 0)
                        .setDisplaySize(tw, tw)
                        .setOrigin(0.5, 0.25)
                        .setDepth((i + j) * 0.01 - 99) // 바닥 바로 위에 렌더링
                        .setTint(zoneColor)
                        .setAlpha(0.5);
                    this.floorLayer.add(zoneOverlay);
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
            'none': 0, 
            'neon_border': 8, 'grid_dot': 9, 'premium_carpet': 10, 'wood': 11, 'metal': 12, 'glass': 13
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
        this.floorLayer.add(grid);
    }
}

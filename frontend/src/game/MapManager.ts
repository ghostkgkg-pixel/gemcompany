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
    ) { }

    /**
     * 전체 맵 데이터를 기반으로 화면에 타일 및 그리드를 다시 그림
     */
    render(data: any) {
        this.floorLayer.removeAll(true);

        const tw = this.iso.tileWidth;
        const th = this.iso.tileHeight;
        const isBuildMode = useGameStore.getState().buildMode;

        // 구역 오버레이와 격자를 그릴 전용 Graphics 객체 생성 (통합 드로잉으로 성능 최적화)
        const zoneGraphics = this.scene.add.graphics().setDepth(-99);
        const gridGraphics = this.scene.add.graphics().setDepth(-98);

        for (let j = 0; j < data.height; j++) {
            for (let i = 0; i < data.width; i++) {
                const pos = this.iso.cartToIso(i, j);
                const rx = Math.round(pos.x), ry = Math.round(pos.y);

                // 1. 바닥 타일 (Flooring) 렌더링 - 실제 에셋 사용
                const floorType = data.floor_data?.[j]?.[i] || 'none';
                if (floorType !== 'void') {
                    const frame = this.getFloorFrame(floorType);
                    if (frame !== -1) {
                        const floorSprite = this.scene.add.sprite(rx, ry + 2, 'floor_sheet', frame)
                            .setDisplaySize(tw, th * 1.125)
                            .setOrigin(0.5, 0.5)
                            .setDepth((i + j) * 0.01 - 100);
                        this.floorLayer.add(floorSprite);
                    } else if (isBuildMode) {
                        this.drawGridTile(gridGraphics, pos, tw, th);
                    }
                } else if (isBuildMode) {
                    // 빈 공간(void)에도 빌드 모드라면 격자를 표시
                    this.drawGridTile(gridGraphics, pos, tw, th);
                }

                // 2. 구역 오버레이 (Zone) 렌더링 - 코드로 직접 드로잉 (에셋 미사용)
                const zoneType = data.zone_data?.[j]?.[i] || 'none';
                if (zoneType !== 'none' && zoneType !== 'void' && isBuildMode) {
                    const zoneColor = this.getZoneColor(zoneType);
                    this.drawZoneTile(zoneGraphics, pos, tw, th, zoneColor);
                }
            }
        }

        // 레이어에 Graphics 추가
        this.floorLayer.add([zoneGraphics, gridGraphics]);
    }

    /**
     * 특정 좌표에 구역(Zone) 오버레이를 그림
     */
    private drawZoneTile(g: Phaser.GameObjects.Graphics, pos: { x: number, y: number }, tw: number, th: number, color: number) {
        g.fillStyle(color, 0.5);
        const points = [
            { x: pos.x, y: pos.y - th / 2 },
            { x: pos.x + tw / 2, y: pos.y },
            { x: pos.x, y: pos.y + th / 2 },
            { x: pos.x - tw / 2, y: pos.y }
        ];
        g.fillPoints(points, true);
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
     * 빌드 모드 시 빈 공간에 격자(Grid) 표시
     */
    private drawGridTile(g: Phaser.GameObjects.Graphics, pos: { x: number, y: number }, tw: number, th: number) {
        g.lineStyle(1, 0x00f2ff, 0.15);
        const points = [
            { x: pos.x, y: pos.y - th / 2 },
            { x: pos.x + tw / 2, y: pos.y },
            { x: pos.x, y: pos.y + th / 2 },
            { x: pos.x - tw / 2, y: pos.y }
        ];
        g.strokePoints(points, true);
    }
}


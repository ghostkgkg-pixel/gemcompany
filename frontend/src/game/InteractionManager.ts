import Phaser from 'phaser';
import { IsometricManager } from './IsometricManager';
import { MapService } from '../services/MapService';
import { useGameStore } from '../store/useGameStore';

/**
 * 게임 내 상호작용(입력, 프리뷰, 맵 액션)을 관리하는 클래스
 */
export class InteractionManager {
    private dragStart: { x: number, y: number } | null = null;
    private previewContainer!: Phaser.GameObjects.Container;
    private previewSprite!: Phaser.GameObjects.Sprite;
    private previewRect!: Phaser.GameObjects.Graphics;
    private selectionRect!: Phaser.GameObjects.Graphics;
    private moduleGhostContainer!: Phaser.GameObjects.Container;

    constructor(
        private scene: Phaser.Scene,
        private mapContainer: Phaser.GameObjects.Container,
        private iso: IsometricManager
    ) {
        this.init();
    }

    /**
     * 상호작용에 필요한 레이어 및 그래픽 객체 초기화
     */
    private init() {
        // 프리뷰 컨테이너 설정
        this.previewContainer = this.scene.add.container(0, 0).setAlpha(0.6).setDepth(10000).setVisible(false);
        this.previewSprite = this.scene.add.sprite(0, 0, 'furniture_sheet', 0).setOrigin(0.5, 0.78);
        this.previewRect = this.scene.add.graphics();
        this.previewContainer.add([this.previewRect, this.previewSprite]);
        this.mapContainer.add(this.previewContainer);

        // 모듈 배치 시 유령(Ghost) 효과 컨테이너
        this.moduleGhostContainer = this.scene.add.container(0, 0).setAlpha(0.5).setDepth(10001);
        this.mapContainer.add(this.moduleGhostContainer);

        // 영역 선택 사각형
        this.selectionRect = this.scene.add.graphics().setDepth(11000);
        this.mapContainer.add(this.selectionRect);
    }

    /**
     * 마우스 포인터의 월드 좌표를 기반으로 프리뷰 업데이트
     */
    updatePreview(p: Phaser.Input.Pointer) {
        const { buildMode, selectedTool, selectedModuleInfo, currentMap } = useGameStore.getState();
        if (!buildMode || !currentMap) return;

        // 매 프레임 프리뷰 초기화 (도구 변경 대응)
        this.hidePreviews();

        const cart = this.iso.worldToCart(p.worldX, p.worldY, this.mapContainer.x, this.mapContainer.y);

        // 맵 범위 체크
        const isOut = cart.x < 0 || cart.y < 0 || cart.x >= currentMap.width || cart.y >= currentMap.height;
        if (isOut) {
            return;
        }

        const isoPos = this.iso.cartToIso(cart.x, cart.y);

        // 모듈/이동 스탬프 프리뷰 로직
        if ((selectedTool === 'module_stamp' && selectedModuleInfo) || (selectedTool === 'move_stamp' && useGameStore.getState().moveBuffer)) {
            this.handleModulePreview(selectedTool, selectedModuleInfo, isoPos);
        }
        // 장애물(가구) 프리뷰 로직
        else if (selectedTool.startsWith('obstacle_')) {
            this.handleObstaclePreview(selectedTool, cart, isoPos);
        }
        // 영역 선택(타일, 지우개 등) 프리뷰 로직
        else if (selectedTool.startsWith('zone_') || selectedTool.startsWith('floor_') || selectedTool === 'tile_eraser' || selectedTool === 'move_tool') {
            if (this.dragStart) {
                this.hideSpecificPreviews();
                this.drawSelection(this.dragStart, cart);
            } else {
                this.hidePreviews();
            }
        }
    }

    /**
     * 드래그 시작 좌표 설정
     */
    setDragStart(x: number, y: number) {
        this.dragStart = { x, y };
    }

    /**
     * 드래그 종료 시 맵 액션 실행
     */
    async handleMapAction(end: { x: number, y: number }) {
        if (!this.dragStart) {
            this.selectionRect.clear();
            this.hidePreviews();
            return;
        }

        const start = this.dragStart;
        const { selectedTool, currentMap } = useGameStore.getState();

        try {
            const x1 = Math.floor(Math.min(start.x, end.x)), x2 = Math.floor(Math.max(start.x, end.x));
            const y1 = Math.floor(Math.min(start.y, end.y)), y2 = Math.floor(Math.max(start.y, end.y));

            if (selectedTool === 'module_stamp') {
                const { selectedModule } = useGameStore.getState();
                if (selectedModule) await MapService.mergeMap(selectedModule, start.x, start.y);
            } else if (selectedTool === 'move_stamp') {
                const buffer = useGameStore.getState().moveBuffer;
                if (buffer) {
                    await MapService.mergeMapRawData(buffer, start.x, start.y);
                    useGameStore.getState().setMoveBuffer(null);
                    useGameStore.getState().setSelectedTool('move_tool');
                }
            } else if (selectedTool === 'move_tool') {
                await this.handleMoveTool(x1, y1, x2, y2);
            } else if (selectedTool === 'tile_eraser') {
                await this.handleTileEraser(x1, y1, x2, y2);
            } else if (selectedTool === 'eraser') {
                for (let j = y1; j <= y2; j++) {
                    for (let i = x1; i <= x2; i++) {
                        await MapService.removeObstacle(i, j);
                    }
                }
            } else if (selectedTool === 'assign_seat') {
                const { selectedAgentId } = useGameStore.getState();
                if (selectedAgentId) {
                    await MapService.assignObstacle(start.x, start.y, selectedAgentId);
                } else {
                    alert("좌석을 지정할 에이전트를 먼저 선택하세요.");
                }
            } else if (selectedTool.startsWith('zone_')) {
                const tileType = selectedTool.replace('zone_', '');
                const newMap = JSON.parse(JSON.stringify(currentMap));
                if (!newMap.zone_data) {
                    newMap.zone_data = Array.from({ length: newMap.height }, () => Array(newMap.width).fill('none'));
                }
                for (let j = y1; j <= y2; j++) {
                    for (let i = x1; i <= x2; i++) {
                        if (newMap.zone_data[j] && newMap.zone_data[j][i] !== undefined) {
                            newMap.zone_data[j][i] = tileType;
                        }
                    }
                }
                await MapService.syncMapData(newMap);
            } else if (selectedTool.startsWith('floor_')) {
                const tileType = selectedTool.replace('floor_', '');
                const newMap = JSON.parse(JSON.stringify(currentMap));
                if (!newMap.floor_data) {
                    newMap.floor_data = Array.from({ length: newMap.height }, () => Array(newMap.width).fill('none'));
                }
                for (let j = y1; j <= y2; j++) {
                    for (let i = x1; i <= x2; i++) {
                        if (newMap.floor_data[j] && newMap.floor_data[j][i] !== undefined) {
                            newMap.floor_data[j][i] = tileType;
                        }
                    }
                }
                await MapService.syncMapData(newMap);
            } else if (selectedTool.startsWith('obstacle_')) {
                const { selectedRotation, selectedFlipX } = useGameStore.getState();
                await MapService.placeObstacle(start.x, start.y, selectedTool, selectedRotation, selectedFlipX);
            }

            const updatedMap = await MapService.getCurrentMap();
            useGameStore.getState().setMap(updatedMap);

        } catch (err) {
            console.error('Map action failed:', err);
        } finally {
            this.dragStart = null;
            this.selectionRect.clear();
            this.hidePreviews();
        }
    }

    /**
     * 이동 도구 로직: 영역을 버퍼에 담고 맵에서 지움
     */
    private async handleMoveTool(x1: number, y1: number, x2: number, y2: number) {
        const m = useGameStore.getState().currentMap;
        const newW = x2 - x1 + 1, newH = y2 - y1 + 1;
        const bufferObs = m.obstacles.filter((o: any) => o.x >= x1 && o.x <= x2 && o.y >= y1 && o.y <= y2)
            .map((o: any) => ({ ...o, x: o.x - x1, y: o.y - y1 }));

        const buffer = { id: 'temp', width: newW, height: newH, obstacles: bufferObs, zone_data: [] };
        useGameStore.getState().setMoveBuffer(buffer as any);

        const updatedMap = JSON.parse(JSON.stringify(m));
        updatedMap.obstacles = m.obstacles.filter((o: any) => !(o.x >= x1 && o.x <= x2 && o.y >= y1 && o.y <= y2));
        await MapService.syncMapData(updatedMap);
        useGameStore.getState().setSelectedTool('move_stamp');
    }

    /**
     * 지우개 도구 로직: 타일 및 장애물 제거
     */
    private async handleTileEraser(x1: number, y1: number, x2: number, y2: number) {
        const m = useGameStore.getState().currentMap;
        const newMap = JSON.parse(JSON.stringify(m));

        if (!newMap.zone_data) newMap.zone_data = Array.from({ length: newMap.height }, () => Array(newMap.width).fill('none'));
        if (!newMap.floor_data) newMap.floor_data = Array.from({ length: newMap.height }, () => Array(newMap.width).fill('none'));

        for (let j = y1; j <= y2; j++) {
            for (let i = x1; i <= x2; i++) {
                newMap.zone_data[j][i] = 'none';
                newMap.floor_data[j][i] = 'void'; // 바닥 타일을 구멍(void)으로 만듦
                // 장애물 제거 로직 포함 (타일 삭제 시 해당 위치 장애물도 정리)
                newMap.obstacles = newMap.obstacles.filter((o: any) => !(Math.floor(o.x) === i && Math.floor(o.y) === j));
            }
        }
        await MapService.syncMapData(newMap);
    }

    private hasObstacleAt(data: any, x: number, y: number): boolean {
        if (!data.obstacles) return false;
        return data.obstacles.some((o: any) => Math.floor(o.x) === x && Math.floor(o.y) === y);
    }

    private handleModulePreview(tool: string, info: any, isoPos: { x: number, y: number }) {
        const isMove = tool === 'move_stamp';
        const buffer = isMove ? useGameStore.getState().moveBuffer : null;

        // 정보가 없으면 프리뷰 생략
        if (isMove && !buffer) return;
        if (!isMove && !info) return;

        const targetInfo = isMove ? { width: buffer.width, height: buffer.height } : info;

        this.previewContainer.setVisible(true).setPosition(isoPos.x, isoPos.y + this.iso.tileHeight / 2);
        this.previewSprite.setVisible(false);
        this.previewRect.clear().lineStyle(3, 0x00f2ff, 1).fillStyle(0x00f2ff, 0.15);

        const sw = targetInfo.width, sh = targetInfo.height;
        const ox = -Math.floor(sw / 2), oy = -Math.floor(sh / 2);

        // 고스트 사각형 그리기 (아이소메트릭 좌표 변환)
        const p1 = this.iso.cartToIso(ox, oy);
        const p2 = this.iso.cartToIso(ox + sw, oy);
        const p3 = this.iso.cartToIso(ox + sw, oy + sh);
        const p4 = this.iso.cartToIso(ox, oy + sh);

        const poly = [
            { x: p1.x, y: p1.y - this.iso.tileHeight / 2 },
            { x: p2.x, y: p2.y - this.iso.tileHeight / 2 },
            { x: p3.x, y: p3.y - this.iso.tileHeight / 2 },
            { x: p4.x, y: p4.y - this.iso.tileHeight / 2 }
        ];

        this.previewRect.fillPoints(poly, true).strokePoints(poly, true);
    }

    private handleObstaclePreview(tool: string, cart: { x: number, y: number }, isoPos: { x: number, y: number }) {
        this.moduleGhostContainer.removeAll(true).setVisible(false);
        this.previewContainer.setVisible(true).setPosition(isoPos.x, isoPos.y);
        this.previewSprite.setVisible(true).setY(this.iso.tileHeight / 2);
        this.previewRect.clear().lineStyle(2, 0x00f2ff, 0.8);
        this.previewRect.strokePoints([{ x: 0, y: -this.iso.tileHeight / 2 }, { x: this.iso.tileWidth / 2, y: 0 }, { x: 0, y: this.iso.tileHeight / 2 }, { x: -this.iso.tileWidth / 2, y: 0 }], true);

        if (tool === 'obstacle_wall') {
            const frame = (cart.x === 0 || cart.y === 0) ? 0 : 1;
            this.previewSprite.setTexture('walls_sheet').setFrame(frame).setOrigin(0.5, 0.86).setDisplaySize(this.iso.tileWidth * 1.02, this.iso.tileWidth * 1.45);
        } else {
            let frame = 5; // default chair
            if (tool.includes('plant')) frame = 10; else if (tool.includes('table')) frame = 8; else if (tool.includes('server')) frame = 12;
            this.previewSprite.setTexture('furniture_sheet').setFrame(frame).setOrigin(0.5, 0.78).setDisplaySize(this.iso.tileWidth * 1.3, this.iso.tileWidth * 1.3);
        }
    }

    private drawSelection(start: { x: number, y: number }, end: { x: number, y: number }) {
        this.selectionRect.clear().lineStyle(2, 0x00f2ff, 1).fillStyle(0x00f2ff, 0.2);
        const x1 = Math.min(start.x, end.x), y1 = Math.min(start.y, end.y), x2 = Math.max(start.x, end.x), y2 = Math.max(start.y, end.y);
        const p1 = this.iso.cartToIso(x1, y1), p2 = this.iso.cartToIso(x2 + 1, y1), p3 = this.iso.cartToIso(x2 + 1, y2 + 1), p4 = this.iso.cartToIso(x1, y2 + 1);
        const th2 = this.iso.tileHeight / 2;
        const poly = [
            { x: p1.x, y: p1.y - th2 },
            { x: p2.x, y: p2.y - th2 },
            { x: p3.x, y: p3.y - th2 },
            { x: p4.x, y: p4.y - th2 }
        ];
        this.selectionRect.fillPoints(poly, true).strokePoints(poly, true);
    }

    private hidePreviews() {
        this.previewContainer.setVisible(false);
        this.selectionRect.clear();
        this.moduleGhostContainer.removeAll(true).setVisible(false);
    }

    private hideSpecificPreviews() {
        this.moduleGhostContainer.removeAll(true).setVisible(false);
        this.previewContainer.setVisible(false);
    }

    /**
     * 씬 종료 시 리소스 정리
     */
    destroy() {
        this.previewContainer.destroy();
        this.selectionRect.destroy();
        this.moduleGhostContainer.destroy();
    }
}

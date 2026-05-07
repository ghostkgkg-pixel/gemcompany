import Phaser from 'phaser';
import { useGameStore } from '../store/useGameStore';
import { AssetManager } from './AssetManager';
import { IsometricManager } from './IsometricManager';
import { MapManager } from './MapManager';
import { AgentManager } from './AgentManager';
import { InteractionManager } from './InteractionManager';

/**
 * 게임의 메인 씬 클래스
 * 각종 매니저를 관리하고 전체적인 게임 루프를 조율하는 컨트롤러 역할을 수행함
 */
export class MainScene extends Phaser.Scene {
  constructor() { super('MainScene'); }

  // 도메인별 관리 매니저 선언
  private isometric: IsometricManager = new IsometricManager(160, 80);
  private assets: AssetManager = new AssetManager(this);
  private map!: MapManager;
  private agents!: AgentManager;
  private interaction!: InteractionManager;

  // 레이어 및 상태 변수
  private mapContainer!: Phaser.GameObjects.Container;
  private floorLayer!: Phaser.GameObjects.Container;
  private obstacleLayer!: Phaser.GameObjects.Container;
  private uiLayer!: Phaser.GameObjects.Container;
  private lastObstaclesJson: string = "";
  private unsubscribers: (() => void)[] = [];

  /**
   * 게임 시작 전 에셋 로드 (AssetManager에 위임)
   */
  preload() {
    this.assets.preload();
  }

  /**
   * 씬 초기화 및 객체 생성
   */
  create() {
    // 배경색 및 기본 레이어 설정
    this.cameras.main.setBackgroundColor('#05080f');
    this.floorLayer = this.add.container(0, 0);
    this.obstacleLayer = this.add.container(0, 0);
    this.mapContainer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0);
    this.mapContainer.add([this.floorLayer, this.obstacleLayer, this.uiLayer]);

    // 매니저 인스턴스 생성
    this.map = new MapManager(this, this.floorLayer, this.isometric);
    this.agents = new AgentManager(this, this.isometric);
    this.interaction = new InteractionManager(this, this.mapContainer, this.isometric);

    // 이벤트 구독 설정
    this.setupSubscriptions();
    this.setupInputHandlers();

    // 씬 종료 시 클린업 이벤트 등록
    this.events.once('shutdown', () => this.cleanup());

    // 캔버스 포커스 강제
    this.game.canvas.focus();

    // 초기 맵 데이터 로드
    const { currentMap } = useGameStore.getState();
    if (currentMap) this.syncMap(currentMap);
  }

  /**
   * 씬 종료 시 리소스 및 구독 해제
   */
  private cleanup() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.interaction.destroy();
  }

  /**
   * 전역 상태 변경 이벤트 구독
   */
  private setupSubscriptions() {
    this.unsubscribers.push(
      useGameStore.subscribe((s) => s.agents, (a) => this.agents.syncAgents(a)),
      useGameStore.subscribe((s) => s.currentMap, (m) => m && this.syncMap(m)),
      useGameStore.subscribe((s) => s.buildMode, () => {
        const { currentMap } = useGameStore.getState();
        if (currentMap) this.syncMap(currentMap);
      })
    );
  }

  /**
   * 사용자 입력 이벤트 설정 (InteractionManager에 위임)
   */
  private setupInputHandlers() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button !== 0) return;
      const cart = this.isometric.worldToCart(p.worldX, p.worldY, this.mapContainer.x, this.mapContainer.y);
      this.interaction.setDragStart(cart.x, cart.y);
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.button !== 0) return;
      const cart = this.isometric.worldToCart(p.worldX, p.worldY, this.mapContainer.x, this.mapContainer.y);
      this.interaction.handleMapAction(cart);
    });

    // 카메라 조작 (드래그/휠)
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && (p.button === 1 || p.button === 2)) {
        this.cameras.main.scrollX -= (p.x - p.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (p.y - p.prevPosition.y) / this.cameras.main.zoom;
      }
    });

    // 우클릭 메뉴 비활성화 (Phaser가 이벤트를 점유하도록)
    this.input.mouse?.disableContextMenu();

    this.input.on('wheel', (_p: any, _over: any, _dx: number, dy: number) => {
      console.log('Phaser Wheel event captured:', dy);
      const zoomAmount = dy > 0 ? 0.9 : 1.1;
      const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom * zoomAmount, 0.2, 4);
      this.cameras.main.setZoom(newZoom);
    });

    // 브라우저 네이티브 휠 이벤트 포워딩 (Phaser 이벤트가 안 먹을 때를 대비한 강력한 백업)
    this.game.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      // Phaser 이벤트가 안 먹는 상황이라면 여기서 직접 줌 처리
      const dy = e.deltaY;
      const zoomAmount = dy > 0 ? 0.9 : 1.1;
      const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom * zoomAmount, 0.2, 4);
      this.cameras.main.setZoom(newZoom);
      console.log('Native DOM Wheel event captured & handled:', dy);
    }, { passive: false });
  }

  /**
   * 맵 전체 데이터 동기화 및 렌더링 지시
   */
  private syncMap(data: any) {
    if (!this.sys || !this.sys.game || !this.sys.game.canvas) return;
    const canvasW = this.sys.game.canvas.width, canvasH = this.sys.game.canvas.height;
    
    console.log(`[MainScene] Syncing Map: ${data.name} (${data.width}x${data.height}), Obstacles: ${data.obstacles?.length || 0}`);

    // 맵 렌더링 (MapManager에 위임) - 바닥 레이어만 업데이트
    this.map.render(data);
    
    // 맵 중앙 정렬 계산
    const mapCenter = this.isometric.cartToIso(data.width / 2, data.height / 2);
    this.mapContainer.setPosition(canvasW / 2 - mapCenter.x, canvasH / 2 - mapCenter.y);

    // 장애물(가구) 데이터 변경 체크 (존만 변경 시 가구 재렌더링 방지)
    const currentObsJson = JSON.stringify(data.obstacles || []);
    if (this.lastObstaclesJson === currentObsJson) {
        return; // 가구 데이터가 동일하면 렌더링 스킵
    }
    this.lastObstaclesJson = currentObsJson;
    this.obstacleLayer.removeAll(true);

    // 장애물(가구) 렌더링
    if (data.obstacles && data.obstacles.length > 0) {
        const { agents } = useGameStore.getState();
        data.obstacles.forEach((obs: any) => {
            const iso = this.isometric.cartToIso(obs.x, obs.y);
            const cy = iso.y + this.isometric.tileHeight / 2;
            
            let sprite;
            if (obs.type === 'obstacle_wall') {
                const frame = (obs.x === 0 || obs.y === 0) ? 0 : 1;
                sprite = this.add.sprite(iso.x, cy, 'walls_sheet', frame).setOrigin(0.5, 0.86).setDisplaySize(this.isometric.tileWidth * 1.02, this.isometric.tileWidth * 1.45);
                sprite.setDepth(iso.y + 200);
            } else if (obs.type.startsWith('obstacle_')) {
                let f = -1;
                if (obs.type.includes('chair')) f = 5; 
                else if (obs.type.includes('plant')) f = 10; 
                else if (obs.type.includes('table') || obs.type.includes('desk')) f = 8; 
                else if (obs.type.includes('server')) f = 12;
                
                if (f !== -1) {
                    sprite = this.add.sprite(iso.x, cy, 'furniture_sheet', f).setOrigin(0.5, 0.78).setDisplaySize(this.isometric.tileWidth * 1.3, this.isometric.tileWidth * 1.3);
                    sprite.setFlipX(obs.flip_x || false);
                    sprite.setDepth(iso.y + 60);

                    // 소유자 이름표 표시
                    if (obs.owner_id && agents[obs.owner_id]) {
                        const ownerName = agents[obs.owner_id].name;
                        const label = this.add.text(iso.x, cy - 60, `[ ${ownerName} ]`, { 
                            fontFamily: 'NeoDunggeunmo', fontSize: '12px', color: '#00f2ff' 
                        }).setOrigin(0.5).setDepth(iso.y + 250);
                        this.obstacleLayer.add(label);
                    }
                }
            }
            
            if (sprite) this.obstacleLayer.add(sprite);
        });
    }
  }

  /**
   * 매 프레임 업데이트 (입력 프리뷰 처리)
   */
  update() {
    const p = this.input.activePointer;
    this.interaction.updatePreview(p);
  }
}

import Phaser from 'phaser';
import { useGameStore } from '../store/useGameStore';
import { MapService } from '../services/MapService';

export class MainScene extends Phaser.Scene {
  constructor() { super('MainScene'); }

  private agentSprites: Map<string, { container: Phaser.GameObjects.Container, body: Phaser.GameObjects.Sprite, label: Phaser.GameObjects.Text }> = new Map();
  private unsubscribers: (() => void)[] = [];

  private mapContainer!: Phaser.GameObjects.Container;
  private mapLayer!: Phaser.GameObjects.Container;
  private previewContainer!: Phaser.GameObjects.Container;
  private previewSprite!: Phaser.GameObjects.Sprite;
  private previewRect!: Phaser.GameObjects.Graphics;
  private selectionRect!: Phaser.GameObjects.Graphics;
  private moduleGhostContainer!: Phaser.GameObjects.Container;
  private dragStart: { x: number, y: number } | null = null;

  private tileWidth: number = 160;
  private tileHeight: number = 80;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private uiLayer!: Phaser.GameObjects.Container;

  preload() {
    this.load.spritesheet('floor_sheet', 'assets/floor_sheet.png', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('furniture_sheet', 'assets/furniture_sheet.png', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('agent_sheet', 'assets/agent_sheet.png', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('walls_sheet', 'assets/walls_sheet.png', { frameWidth: 256, frameHeight: 256 });

    this.load.on('complete', () => {
      ['floor_sheet', 'furniture_sheet', 'agent_sheet', 'walls_sheet'].forEach(key => {
        const texture = this.textures.get(key);
        const source = texture.getSourceImage() as HTMLImageElement;
        const canvas = document.createElement('canvas');
        canvas.width = source.width; canvas.height = source.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(source, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const isBlack = data[i] < 20 && data[i + 1] < 20 && data[i + 2] < 20;
            const isWhite = data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240;
            if (isBlack || isWhite) data[i + 3] = 0;
          }
          ctx.putImageData(imageData, 0, 0);
          this.textures.remove(key);
          this.textures.addSpriteSheet(key, canvas, { frameWidth: 256, frameHeight: 256 });
        }
      });
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#05080f');
    this.mapContainer = this.add.container(0, 0);
    this.mapLayer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0);
    this.mapContainer.add(this.mapLayer);
    this.mapContainer.add(this.uiLayer);

    this.previewContainer = this.add.container(0, 0).setAlpha(0.6).setDepth(10000).setVisible(false);
    this.previewSprite = this.add.sprite(0, 0, 'furniture_sheet', 0).setOrigin(0.5, 0.78);
    this.gridGraphics = this.add.graphics();
    this.uiLayer.add(this.gridGraphics);

    // Create a beautiful background gradient for "Floating Island" feel
    const bgGraphics = this.add.graphics();
    bgGraphics.fillGradientStyle(0x0a0f1e, 0x0a0f1e, 0x1a233e, 0x1a233e, 1);
    bgGraphics.fillRect(-2000, -2000, 4000, 4000);
    bgGraphics.setDepth(-100);
    
    // Add some subtle stars or clouds
    for (let i = 0; i < 100; i++) {
      const x = Phaser.Math.Between(-1500, 1500);
      const y = Phaser.Math.Between(-1500, 1500);
      this.add.circle(x, y, Phaser.Math.FloatBetween(0.5, 1.5), 0x00f2ff, Phaser.Math.FloatBetween(0.1, 0.4)).setDepth(-99);
    }

    this.drawGrid();

    this.previewRect = this.add.graphics();
    this.previewContainer.add([this.previewRect, this.previewSprite]);
    this.mapContainer.add(this.previewContainer);

    this.moduleGhostContainer = this.add.container(0, 0).setAlpha(0.5).setDepth(10001);
    this.mapContainer.add(this.moduleGhostContainer);

    this.selectionRect = this.add.graphics().setDepth(11000);
    this.mapContainer.add(this.selectionRect);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button !== 0) return;
      const { buildMode } = useGameStore.getState();
      if (buildMode) this.dragStart = this.worldToCart(p.worldX, p.worldY);
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.button !== 0 || !this.dragStart) return;
      this.handleMapAction(this.dragStart, this.worldToCart(p.worldX, p.worldY));
      this.dragStart = null;
      this.selectionRect.clear();
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && (p.button === 1 || p.button === 2)) {
        this.cameras.main.scrollX -= (p.x - p.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (p.y - p.prevPosition.y) / this.cameras.main.zoom;
        return;
      }
      const { buildMode } = useGameStore.getState();
      if (buildMode) this.updatePreview(p);
    });

    this.setupSubscriptions();
    this.input.mouse?.disableContextMenu();
    this.cameras.main.setZoom(0.6);

    this.input.on('wheel', (pointer: Phaser.Input.Pointer, over: any, deltaX: number, deltaY: number) => {
      if (deltaY === 0) return;
      
      const zoomSensitivity = 0.003;
      const oldZoom = this.cameras.main.zoom;
      const newZoom = Phaser.Math.Clamp(oldZoom - deltaY * zoomSensitivity, 0.2, 5.0);
      
      if (newZoom !== oldZoom) {
        const mouseWorldX = pointer.worldX;
        const mouseWorldY = pointer.worldY;
        
        this.cameras.main.setZoom(newZoom);
        
        const newMouseWorldX = pointer.worldX;
        const newMouseWorldY = pointer.worldY;
        
        this.cameras.main.scrollX -= (newMouseWorldX - mouseWorldX);
        this.cameras.main.scrollY -= (newMouseWorldY - mouseWorldY);
      }
    });

    this.scale.on('resize', () => {
      const { currentMap } = useGameStore.getState();
      if (currentMap) this.syncMap(currentMap);
    });

    const { currentMap } = useGameStore.getState();
    if (currentMap) this.syncMap(currentMap);

    // Keyboard Shortcuts
    this.input.keyboard?.on('keydown-Z', (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        this.performUndo();
      }
    });

    // Cleanup on shutdown or destroy
    this.events.once('shutdown', () => {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    });
    this.events.once('destroy', () => {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    });
  }

  private async performUndo() {
    const { undo } = useGameStore.getState();
    const lastMap = undo();
    if (lastMap) {
      await syncMapData(lastMap);
      this.syncMap(lastMap);
    }
  }

  private setupSubscriptions() {
    this.unsubscribers.push(
      useGameStore.subscribe((s) => s.agents, (a) => this.syncAgents(a)),
      useGameStore.subscribe((s) => s.currentMap, (m) => m && this.syncMap(m)),
      useGameStore.subscribe((s) => s.buildMode, () => this.drawGrid())
    );
  }

  private updatePreview(p: Phaser.Input.Pointer) {
    const { buildMode, selectedTool, selectedModuleInfo, currentMap } = useGameStore.getState();
    if (!this.mapContainer || !buildMode || !currentMap) return;

    const cart = this.worldToCart(p.worldX, p.worldY);
    
    // Bounds Check
    const isOut = cart.x < 0 || cart.y < 0 || cart.x >= currentMap.width || cart.y >= currentMap.height;
    if (isOut) {
      this.previewContainer.setVisible(false);
      this.selectionRect.clear();
      this.moduleGhostContainer.removeAll(true).setVisible(false);
      return;
    }

    const iso = this.cartToIso(cart.x, cart.y);

    if ((selectedTool === 'module_stamp' && selectedModuleInfo) || (selectedTool === 'move_stamp' && useGameStore.getState().moveBuffer)) {
      this.previewContainer.setVisible(true).setPosition(iso.x, iso.y + this.tileHeight / 2);
      this.previewSprite.setVisible(false);
      this.previewRect.clear().lineStyle(3, 0x00f2ff, 1).fillStyle(0x00f2ff, 0.15);
      
      const isMove = selectedTool === 'move_stamp';
      const buffer = isMove ? useGameStore.getState().moveBuffer : null;
      const info = isMove ? { width: buffer.width, height: buffer.height } : selectedModuleInfo;
      
      const sw = info!.width, sh = info!.height;
      const ox = -Math.floor(sw / 2), oy = -Math.floor(sh / 2);
      
      // Update Ghost Container
      this.moduleGhostContainer.setPosition(iso.x, iso.y + this.tileHeight / 2).setVisible(true);
      if (this.moduleGhostContainer.list.length === 0) {
        const obsList = isMove ? buffer.obstacles : [];
        obsList.forEach((obs: any) => {
          const oIso = this.cartToIso(ox + obs.x, oy + obs.y);
          if (obs.type === 'obstacle_wall') {
            const frame = (obs.x === 0 || obs.y === 0) ? 0 : 1;
            const wall = this.add.sprite(oIso.x, oIso.y, 'walls_sheet', frame).setOrigin(0.5, 0.86).setDisplaySize(this.tileWidth * 1.02, this.tileWidth * 1.45).setTint(0x00f2ff);
            this.moduleGhostContainer.add(wall);
          } else {
            let f = 0;
            if (obs.type.includes('chair')) f = 5; else if (obs.type.includes('plant')) f = 10; else if (obs.type.includes('table')) f = 8; else if (obs.type.includes('server')) f = 12;
            const sprite = this.add.sprite(oIso.x, oIso.y, 'furniture_sheet', f).setOrigin(0.5, 0.78).setDisplaySize(this.tileWidth * 1.3, this.tileWidth * 1.3).setFlipX(obs.flip_x || false).setTint(0x00f2ff);
            this.moduleGhostContainer.add(sprite);
          }
        });
      }
      
      const p1 = this.cartToIso(ox, oy);
      const p2 = this.cartToIso(ox + sw, oy);
      const p3 = this.cartToIso(ox + sw, oy + sh);
      const p4 = this.cartToIso(ox, oy + sh);
      
      const poly = [{x: p1.x, y: p1.y - this.tileHeight/2}, {x: p2.x, y: p2.y - this.tileHeight/2}, {x: p3.x, y: p3.y - this.tileHeight/2}, {x: p4.x, y: p4.y - this.tileHeight/2}];
      this.previewRect.fillPoints(poly, true).strokePoints(poly, true);

    } else if (selectedTool.startsWith('obstacle_')) {
      this.moduleGhostContainer.removeAll(true).setVisible(false);
      this.previewContainer.setVisible(true).setPosition(iso.x, iso.y + this.tileHeight / 2);
      this.previewSprite.setVisible(true);
      this.previewRect.clear().lineStyle(2, 0x00f2ff, 0.8);
      this.previewRect.strokePoints([{ x: 0, y: -this.tileHeight / 2 }, { x: this.tileWidth / 2, y: 0 }, { x: 0, y: this.tileHeight / 2 }, { x: -this.tileWidth / 2, y: 0 }], true);

      if (selectedTool === 'obstacle_wall') {
        const frame = (cart.x === 0 || cart.y === 0) ? 0 : 1;
        this.previewSprite.setTexture('walls_sheet').setFrame(frame).setOrigin(0.5, 0.86).setDisplaySize(this.tileWidth * 1.02, this.tileWidth * 1.45);
      } else {
        let frame = 0;
        if (selectedTool.includes('chair')) frame = 5;
        else if (selectedTool.includes('plant')) frame = 10;
        else if (selectedTool.includes('table')) frame = 8;
        else if (selectedTool.includes('server')) frame = 12;
        this.previewSprite.setTexture('furniture_sheet').setFrame(frame).setOrigin(0.5, 0.78).setDisplaySize(this.tileWidth * 1.3, this.tileWidth * 1.3);
      }
    } else if (buildMode && (selectedTool.startsWith('zone_') || selectedTool === 'tile_eraser' || selectedTool === 'move_tool') && this.dragStart) {
      this.moduleGhostContainer.removeAll(true).setVisible(false);
      this.previewContainer.setVisible(false);
      this.drawSelection(this.dragStart, cart);
    } else {
      this.moduleGhostContainer.removeAll(true).setVisible(false);
      this.previewContainer.setVisible(false);
      this.selectionRect.clear();
    }
  }

  private cartToIso(x: number, y: number) {
    return { x: (x - y) * (this.tileWidth / 2), y: (x + y) * (this.tileHeight / 2) };
  }

  private worldToCart(worldX: number, worldY: number) {
    const relX = worldX - this.mapContainer.x;
    const relY = worldY - this.mapContainer.y;
    const cx = Math.floor((relX / (this.tileWidth / 2) + (relY - this.tileHeight / 2) / (this.tileHeight / 2)) / 2);
    const cy = Math.floor(((relY - this.tileHeight / 2) / (this.tileHeight / 2) - relX / (this.tileWidth / 2)) / 2);
    return { x: cx, y: cy };
  }

  private syncMap(data: any) {
    if (!this.sys || !this.sys.game || !this.sys.game.canvas) return;
    this.mapLayer.removeAll(true);
    const canvasW = this.sys.game.canvas.width, canvasH = this.sys.game.canvas.height;
    this.tileWidth = 160; this.tileHeight = 80;
    const mapCenter = this.cartToIso(data.width / 2, data.height / 2);
    this.mapContainer.setPosition(canvasW / 2 - mapCenter.x, canvasH / 2 - mapCenter.y);

    for (let j = 0; j < data.height; j++) {
      for (let i = 0; i < data.width; i++) {
        const iso = this.cartToIso(i, j);
        const z = data.zone_data?.[j]?.[i];
        const hasObs = this.hasObstacleAt(data, i, j);
        const isBuild = useGameStore.getState().buildMode;
        
        // Skip rendering if void and not in build mode
        if (z === 'void' && !isBuild) continue;

        const cx = iso.x, cy = iso.y + this.tileHeight / 2;
        const tw = this.tileWidth, th = this.tileHeight;
        // Render Floor Sprite
        let frame = -1;
        if (z === 'neon_border') frame = 0;
        else if (z === 'grid_dot') frame = 1;
        else if (z === 'premium_carpet') frame = 2;
        else if (z === 'wood') frame = 3;
        else if (z === 'metal') frame = 4;
        else if (z === 'glass') frame = 5;
        else if (z === 'concrete') frame = 6;
        else if (z && z !== 'none' && z !== 'void') frame = 7;

        if (frame !== -1) {
          const floorSprite = this.add.sprite(cx, cy, 'floor_sheet', frame)
            .setDisplaySize(tw * 1.05, th * 2.2)
            .setOrigin(0.5, 0.72)
            .setDepth(iso.y - 100);
          if (z === 'void' && isBuild) floorSprite.setAlpha(0.2);
          else if (z === 'none' && !hasObs && isBuild) floorSprite.setAlpha(0.3);
          this.mapLayer.add(floorSprite);
        } else if (isBuild || z !== 'void') {
           const tile = this.add.graphics().setDepth(iso.y - 101);
           tile.lineStyle(1, 0x00f2ff, 0.1);
           tile.strokePoints([{x: cx, y: cy - th/2}, {x: cx + tw/2, y: cy}, {x: cx, y: cy + th/2}, {x: cx - tw/2, y: cy}], true);
           this.mapLayer.add(tile);
        }

        // Zone overlay (editor only or specific functional zones)
        if (z && z !== 'none' && z !== 'void' && !['neon_border', 'grid_dot', 'premium_carpet'].includes(z)) {
          const zoneColors: Record<string, number> = {
            work: 0x4488ff, meeting: 0x44ff88, break: 0xffcc44, lab: 0xaa44ff, ceo: 0xff4444,
            Reception: 0x00f2ff, "Dev Cluster": 0x3b82f6, "CEO Suite": 0xa855f7
          };
          const zc = zoneColors[z] || 0x4488ff;
          const ov = this.add.graphics().setDepth(iso.y + 0.5);
          ov.fillStyle(zc, 0.25);
          ov.fillPoints([{x: cx, y: cy - th/2}, {x: cx + tw/2, y: cy}, {x: cx, y: cy + th/2}, {x: cx - tw/2, y: cy}], true);
          ov.lineStyle(2, zc, 0.6);
          ov.strokePoints([{x: cx, y: cy - th/2}, {x: cx + tw/2, y: cy}, {x: cx, y: cy + th/2}, {x: cx - tw/2, y: cy}], true);
          this.mapLayer.add(ov);
        }
      }
    }

    if (data.obstacles) {
      const { agents } = useGameStore.getState();
      data.obstacles.forEach((obs: any, idx: number) => {
        const iso = this.cartToIso(obs.x, obs.y);
        const cy = iso.y + this.tileHeight / 2;
        
        if (obs.type === 'obstacle_wall') {
          const frame = (obs.x === 0 || obs.y === 0) ? 0 : 1;
          const wall = this.add.sprite(iso.x, cy, 'walls_sheet', frame).setOrigin(0.5, 0.86).setDisplaySize(this.tileWidth * 1.02, this.tileWidth * 1.45).setDepth(iso.y + 200);
          this.mapLayer.add(wall);
        } else {
          let f = (idx % 12);
          if (obs.type.includes('chair')) f = 5; else if (obs.type.includes('plant')) f = 10; else if (obs.type.includes('table')) f = 8; else if (obs.type.includes('server')) f = 12;
          this.mapLayer.add(this.add.circle(iso.x, cy, this.tileWidth / 4, 0x00f2ff, 0.1).setDepth(iso.y + 0.2));
          this.mapLayer.add(this.add.ellipse(iso.x, cy + 5, this.tileWidth * 0.4, this.tileHeight * 0.4, 0x000000, 0.3).setDepth(iso.y + 0.1));
          this.mapLayer.add(this.add.sprite(iso.x, cy, 'furniture_sheet', f).setOrigin(0.5, 0.78).setDisplaySize(this.tileWidth * 1.3, this.tileWidth * 1.3).setFlipX(obs.flip_x || false).setDepth(iso.y + 60));
          
          // Show Owner Name
          if (obs.owner_id && agents[obs.owner_id]) {
            const ownerName = agents[obs.owner_id].name;
            const tag = this.add.text(iso.x, cy - 60, `[ ${ownerName} ]`, { 
              fontFamily: 'NeoDunggeunmo', 
              fontSize: '12px', 
              color: '#ffffff',
              backgroundColor: '#00f2ff44',
              padding: { x: 4, y: 2 }
            }).setOrigin(0.5, 1).setDepth(iso.y + 300);
            this.mapLayer.add(tag);
          }
        }
      });
    }
    this.syncAgents(useGameStore.getState().agents);
  }

  private hasObstacleAt(d: any, x: number, y: number) { return d.obstacles?.some((o: any) => o.x === x && o.y === y); }

  private syncAgents(agents: Record<string, any>) {
    for (const id in agents) {
      const d = agents[id], iso = this.cartToIso(d.x, d.y);
      if (!this.agentSprites.has(id)) {
        const c = this.add.container(iso.x, iso.y + this.tileHeight / 2);
        const b = this.add.sprite(0, 0, 'agent_sheet', 0).setDisplaySize(this.tileWidth * 1.8, this.tileWidth * 1.8).setOrigin(0.5, 0.85);
        const l = this.add.text(0, 25, d.name, { fontFamily: 'NeoDunggeunmo', fontSize: '14px', color: '#00f2ff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0);
        c.add([b, l]); c.setDepth(iso.y + 100);
        this.agentSprites.set(id, { container: c, body: b, label: l } as any);
      } else {
        const s = this.agentSprites.get(id)!;
        this.tweens.add({ targets: s.container, x: iso.x, y: iso.y + this.tileHeight / 2, duration: 600, ease: 'Power2', onUpdate: () => s.container.setDepth(s.container.y + 100) });
      }
    }
  }

  private drawSelection(start: { x: number, y: number }, end: { x: number, y: number }) {
    this.selectionRect.clear().lineStyle(2, 0x00f2ff, 1).fillStyle(0x00f2ff, 0.2);
    const x1 = Math.min(start.x, end.x), y1 = Math.min(start.y, end.y), x2 = Math.max(start.x, end.x), y2 = Math.max(start.y, end.y);
    const p1 = this.cartToIso(x1, y1), p2 = this.cartToIso(x2 + 1, y1), p3 = this.cartToIso(x2 + 1, y2 + 1), p4 = this.cartToIso(x1, y2 + 1);
    const poly = [{ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y }, { x: p3.x, y: p3.y }, { x: p4.x, y: p4.y }];
    this.selectionRect.fillPoints(poly, true).strokePoints(poly, true);
  }

  private drawGrid() {
    if (!this.gridGraphics) return;
    this.gridGraphics.clear();
    const { buildMode, getPlanLimit } = useGameStore.getState();
    const limit = getPlanLimit();

    if (!buildMode) return;

    this.gridGraphics.lineStyle(1, 0x00f2ff, 0.05);

    const fullSize = 24;
    for (let i = 0; i <= fullSize; i++) {
      const s1 = this.cartToIso(i, 0), e1 = this.cartToIso(i, fullSize);
      this.gridGraphics.lineBetween(s1.x, s1.y, e1.x, e1.y);
      const s2 = this.cartToIso(0, i), e2 = this.cartToIso(fullSize, i);
      this.gridGraphics.lineBetween(s2.x, s2.y, e2.x, e2.y);
    }

    this.gridGraphics.lineStyle(2, 0x00f2ff, 0.4);
    const g1 = this.cartToIso(0, 0), g2 = this.cartToIso(limit, 0), g3 = this.cartToIso(limit, limit), g4 = this.cartToIso(0, limit);
    this.gridGraphics.strokePoints([g1, g2, g3, g4], true);
    this.gridGraphics.fillStyle(0x00f2ff, 0.02).fillPoints([g1, g2, g3, g4], true);
  }

  private async handleMapAction(s: { x: number, y: number }, e: { x: number, y: number }) {
    const { currentMap, selectedTool, selectedModule, pushHistory, getPlanLimit, setShowUpgradeModal } = useGameStore.getState();
    if (!currentMap) return;
    
    const limit = getPlanLimit();
    
    // Boundary check for all building actions
    if (e.x >= limit || e.y >= limit) {
      if (selectedTool !== 'none' && selectedTool !== 'move_tool') {
        setShowUpgradeModal(true);
        return;
      }
    }

    // Save snapshot before action
    pushHistory(currentMap);

    // Clamp coordinates to map bounds to prevent negative or out-of-bounds API calls
    const x1 = Phaser.Math.Clamp(Math.min(s.x, e.x), 0, currentMap.width - 1);
    const y1 = Phaser.Math.Clamp(Math.min(s.y, e.y), 0, currentMap.height - 1);
    const x2 = Phaser.Math.Clamp(Math.max(s.x, e.x), 0, currentMap.width - 1);
    const y2 = Phaser.Math.Clamp(Math.max(s.y, e.y), 0, currentMap.height - 1);

    try {
      if (selectedTool === 'eraser') await MapService.removeObstacle(e.x, e.y);
      else if (selectedTool === 'module_stamp' && selectedModule) {
        const res = await MapService.mergeMap(selectedModule, e.x, e.y);
        if (res.map) useGameStore.getState().setMap(res.map);
      }
      else if (selectedTool === 'move_stamp' && useGameStore.getState().moveBuffer) {
        const res = await MapService.syncMapData(useGameStore.getState().moveBuffer); // Re-sync buffer as map
        if (res.map) useGameStore.getState().setMap(res.map);
        useGameStore.getState().setSelectedTool('move_tool');
        useGameStore.getState().setMoveBuffer(null);
      }
      else if (selectedTool === 'move_tool') {
        const m = currentMap;
        const newW = x2 - x1 + 1, newH = y2 - y1 + 1;
        const bufferZone = Array.from({ length: newH }, (_, y) => Array.from({ length: newW }, (_, x) => m.zone_data[y1 + y][x1 + x]));
        const bufferObs = m.obstacles.filter((o: any) => o.x >= x1 && o.x <= x2 && o.y >= y1 && o.y <= y2)
                                     .map((o: any) => ({ ...o, x: o.x - x1, y: o.y - y1 }));
        
        const buffer = { 
          id: 'temp_move', 
          name: 'MoveBuffer', 
          width: newW, 
          height: newH, 
          zone_data: bufferZone, 
          zones: [], 
          obstacles: bufferObs 
        };
        
        useGameStore.getState().setMoveBuffer(buffer);

        const updatedMap = JSON.parse(JSON.stringify(m));
        for (let j = y1; j <= y2; j++) for (let i = x1; i <= x2; i++) updatedMap.zone_data[j][i] = 'void';
        updatedMap.obstacles = m.obstacles.filter((o: any) => !(o.x >= x1 && o.x <= x2 && o.y >= y1 && o.y <= y2));
        
        await MapService.syncMapData(updatedMap);
        this.syncMap(updatedMap);
        useGameStore.getState().setSelectedTool('move_stamp');
      }
      else if (selectedTool === 'tile_eraser') {
        for (let j = y1; j <= y2; j++) {
          for (let i = x1; i <= x2; i++) {
            await MapService.setZoneTile(i, j, 'void');
            if (this.hasObstacleAt(useGameStore.getState().currentMap, i, j)) await MapService.removeObstacle(i, j);
          }
        }
        const updatedMap = await MapService.getCurrentMap();
        useGameStore.getState().setMap(updatedMap);
      }
      else if (selectedTool === 'assign_seat') {
        const { agents } = useGameStore.getState();
        const agentIds = Object.keys(agents);
        const obs = currentMap.obstacles.find((o: any) => o.x === e.x && o.y === e.y);
        
        if (obs) {
          const currentOwner = obs.owner_id;
          const currentIndex = currentOwner ? agentIds.indexOf(currentOwner) : -1;
          let nextOwner = null;
          
          if (currentIndex < agentIds.length - 1) {
            nextOwner = agentIds[currentIndex + 1];
          }
          
          await MapService.assignObstacle(e.x, e.y, nextOwner);
        }
      }
      else if (selectedTool.startsWith('zone_') || ['neon_border', 'grid_dot', 'premium_carpet', 'wood', 'metal', 'glass', 'concrete'].includes(selectedTool)) {
        const tileType = selectedTool.startsWith('zone_') ? selectedTool.replace('zone_', '') : selectedTool;
        for (let j = y1; j <= y2; j++) for (let i = x1; i <= x2; i++) await MapService.setZoneTile(i, j, tileType);
        const updatedMap = await MapService.getCurrentMap();
        useGameStore.getState().setMap(updatedMap);
      } else if (selectedTool.startsWith('obstacle_')) {
        const { selectedRotation, selectedFlipX } = useGameStore.getState();
        await MapService.placeObstacle(e.x, e.y, selectedTool, selectedRotation, selectedFlipX);
        const updatedMap = await MapService.getCurrentMap();
        useGameStore.getState().setMap(updatedMap);
      }
    } catch (err) {
      console.error('Map action failed:', err);
    }
  }

  update() {
    const p = this.input.activePointer;
    const { buildMode } = useGameStore.getState();
    if (buildMode) this.updatePreview(p); else this.previewContainer.setVisible(false);
  }
}

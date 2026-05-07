import Phaser from 'phaser';
import { useGameStore } from '../store/useGameStore';
import { placeObstacle, removeObstacle, setZoneTile, getMapCurrent, mergeMap } from '../services/api';

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
  private dragStart: { x: number, y: number } | null = null;

  private tileWidth: number = 160;
  private tileHeight: number = 80;

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
    this.mapContainer.add(this.mapLayer);

    this.previewContainer = this.add.container(0, 0).setAlpha(0.6).setDepth(10000).setVisible(false);
    this.previewSprite = this.add.sprite(0, 0, 'furniture_sheet', 0).setOrigin(0.5, 0.78);
    this.previewRect = this.add.graphics();
    this.previewContainer.add([this.previewRect, this.previewSprite]);
    this.mapContainer.add(this.previewContainer);

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
      const zoomSensitivity = 0.001;
      const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom - deltaY * zoomSensitivity, 0.3, 2.0);
      this.cameras.main.setZoom(newZoom);
    });

    this.scale.on('resize', () => {
      const { currentMap } = useGameStore.getState();
      if (currentMap) this.syncMap(currentMap);
    });

    const { currentMap } = useGameStore.getState();
    if (currentMap) this.syncMap(currentMap);
  }

  private setupSubscriptions() {
    this.unsubscribers.push(
      useGameStore.subscribe((s) => s.agents, (a) => this.syncAgents(a)),
      useGameStore.subscribe((s) => s.currentMap, (m) => m && this.syncMap(m))
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
      return;
    }

    const iso = this.cartToIso(cart.x, cart.y);

    if (selectedTool === 'module_stamp' && selectedModuleInfo) {
      this.previewContainer.setVisible(true).setPosition(iso.x, iso.y + this.tileHeight / 2);
      this.previewSprite.setVisible(false);
      this.previewRect.clear().lineStyle(3, 0x00f2ff, 1).fillStyle(0x00f2ff, 0.15);
      
      const sw = selectedModuleInfo.width, sh = selectedModuleInfo.height;
      const ox = -Math.floor(sw / 2), oy = -Math.floor(sh / 2);
      
      // Calculate 4 corners of the module centered on mouse
      const p1 = this.cartToIso(ox, oy);
      const p2 = this.cartToIso(ox + sw, oy);
      const p3 = this.cartToIso(ox + sw, oy + sh);
      const p4 = this.cartToIso(ox, oy + sh);
      
      const poly = [{x: p1.x, y: p1.y - this.tileHeight/2}, {x: p2.x, y: p2.y - this.tileHeight/2}, {x: p3.x, y: p3.y - this.tileHeight/2}, {x: p4.x, y: p4.y - this.tileHeight/2}];
      this.previewRect.fillPoints(poly, true).strokePoints(poly, true);

    } else if (selectedTool.startsWith('obstacle_')) {
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
    } else if (buildMode && (selectedTool.startsWith('zone_') || selectedTool === 'tile_eraser') && this.dragStart) {
      this.previewContainer.setVisible(false);
      this.drawSelection(this.dragStart, cart);
    } else {
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
    if (!this.sys.game.canvas) return;
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
        const thickness = 12;

        const tile = this.add.graphics().setDepth(iso.y);
        let alpha = 1.0;
        if (z === 'void' && isBuild) alpha = 0.1;
        else if (z === 'none' && !hasObs && isBuild) alpha = 0.15;

        // 1. Bottom Glow (Floating Effect)
        if (alpha > 0.5) {
          tile.lineStyle(4, 0x00f2ff, 0.2);
          tile.strokePoints([{x: cx, y: cy + th/2 + thickness + 4}, {x: cx + tw/2, y: cy + thickness + 4}, {x: cx, y: cy - th/2 + thickness + 4}, {x: cx - tw/2, y: cy + thickness + 4}], true);
        }

        // 2. Side Faces (Thickness)
        const sideColor = 0x1a1d25;
        tile.fillStyle(sideColor, alpha);
        // Front-Left Face
        tile.fillPoints([{x: cx - tw/2, y: cy}, {x: cx, y: cy + th/2}, {x: cx, y: cy + th/2 + thickness}, {x: cx - tw/2, y: cy + thickness}], true);
        // Front-Right Face
        tile.fillPoints([{x: cx + tw/2, y: cy}, {x: cx, y: cy + th/2}, {x: cx, y: cy + th/2 + thickness}, {x: cx + tw/2, y: cy + thickness}], true);

        // 3. Top Face
        const topColor = z ? 0x2a2d35 : 0x3a3d45;
        tile.fillStyle(topColor, alpha);
        tile.fillPoints([{x: cx, y: cy - th/2}, {x: cx + tw/2, y: cy}, {x: cx, y: cy + th/2}, {x: cx - tw/2, y: cy}], true);
        
        // 4. Panel details
        tile.lineStyle(1, 0x4a4d55, 0.3 * alpha);
        tile.strokePoints([{x: cx, y: cy - th/2}, {x: cx + tw/2, y: cy}, {x: cx, y: cy + th/2}, {x: cx - tw/2, y: cy}], true);
        this.mapLayer.add(tile);

        // Zone overlay (editor only)
        if (z && isBuild) {
          const zoneColors: Record<string, number> = {
            work: 0x4488ff, meeting: 0x44ff88, break: 0xffcc44, lab: 0xaa44ff, ceo: 0xff4444
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
      data.obstacles.forEach((obs: any, idx: number) => {
        const iso = this.cartToIso(obs.x, obs.y);
        if (obs.type === 'obstacle_wall') {
          const frame = (obs.x === 0 || obs.y === 0) ? 0 : 1;
          const wall = this.add.sprite(iso.x, iso.y + this.tileHeight / 2, 'walls_sheet', frame).setOrigin(0.5, 0.86).setDisplaySize(this.tileWidth * 1.02, this.tileWidth * 1.45).setDepth(iso.y + 200);
          this.mapLayer.add(wall);
        } else {
          let f = (idx % 12);
          if (obs.type.includes('chair')) f = 5; else if (obs.type.includes('plant')) f = 10; else if (obs.type.includes('table')) f = 8; else if (obs.type.includes('server')) f = 12;
          this.mapLayer.add(this.add.circle(iso.x, iso.y + this.tileHeight / 2, this.tileWidth / 4, 0x00f2ff, 0.1).setDepth(iso.y + 0.2));
          this.mapLayer.add(this.add.ellipse(iso.x, iso.y + this.tileHeight / 2 + 5, this.tileWidth * 0.4, this.tileHeight * 0.4, 0x000000, 0.3).setDepth(iso.y + 0.1));
          this.mapLayer.add(this.add.sprite(iso.x, iso.y + this.tileHeight / 2, 'furniture_sheet', f).setOrigin(0.5, 0.78).setDisplaySize(this.tileWidth * 1.3, this.tileWidth * 1.3).setFlipX(obs.flip_x || false).setDepth(iso.y + 60));
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

  private async handleMapAction(s: { x: number, y: number }, e: { x: number, y: number }) {
    const { selectedTool, selectedModule, currentMap } = useGameStore.getState();
    if (!currentMap) return;
    
    // Bounds check
    if (e.x < 0 || e.y < 0 || e.x >= currentMap.width || e.y >= currentMap.height) return;

    const x1 = Math.min(s.x, e.x), y1 = Math.min(s.y, e.y), x2 = Math.max(s.x, e.x), y2 = Math.max(s.y, e.y);
    try {
      if (selectedTool === 'eraser') await removeObstacle(e.x, e.y);
      else if (selectedTool === 'tile_eraser') {
        for (let j = y1; j <= y2; j++) {
          for (let i = x1; i <= x2; i++) {
            await setZoneTile(i, j, 'void');
            if (this.hasObstacleAt(useGameStore.getState().currentMap, i, j)) await removeObstacle(i, j);
          }
        }
      }
      else if (selectedTool === 'module_stamp' && selectedModule) {
        await mergeMap(selectedModule, e.x, e.y);
      }
      else if (selectedTool.startsWith('zone_')) {
        for (let j = y1; j <= y2; j++) for (let i = x1; i <= x2; i++) await setZoneTile(i, j, selectedTool.replace('zone_', ''));
      } else if (selectedTool.startsWith('obstacle_')) {
        const { selectedRotation, selectedFlipX } = useGameStore.getState();
        await placeObstacle(e.x, e.y, selectedTool, selectedRotation, selectedFlipX);
      }
      
      // 즉시 맵 갱신 (실시간 피드백)
      const updatedMap = await getMapCurrent();
      useGameStore.getState().setMap(updatedMap);
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

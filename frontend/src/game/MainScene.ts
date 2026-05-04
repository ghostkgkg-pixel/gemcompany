import Phaser from 'phaser';
import { useGameStore } from '../store/useGameStore';
import { placeObstacle, removeObstacle, setZoneTile } from '../services/api';

export class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
  }

  private agentSprites: Map<string, { container: Phaser.GameObjects.Container, body: Phaser.GameObjects.Sprite, label: Phaser.GameObjects.Text, bubble: Phaser.GameObjects.Text, status: Phaser.GameObjects.Text }> = new Map();

  private unsubscribers: (() => void)[] = [];
  
  private mapContainer!: Phaser.GameObjects.Container;
  private previewContainer!: Phaser.GameObjects.Container;
  private previewSprite!: Phaser.GameObjects.Sprite;
  private previewRect!: Phaser.GameObjects.Rectangle;
  private gridSize: number = 40;
  preload() {
    this.load.image('floor_work', 'assets/floor_work.png');
    this.load.image('floor_meeting', 'assets/floor_meeting.png');
    this.load.image('floor_break', 'assets/floor_break.png');
    this.load.image('obstacle_desk', 'assets/obstacle_desk.png');
    this.load.image('obstacle_table', 'assets/obstacle_table.png');
    this.load.image('obstacle_plant', 'assets/obstacle_plant.png');
    
    this.load.image('agent_dev', 'assets/agent_dev.png');
    this.load.image('agent_design', 'assets/agent_design.png');
    this.load.image('agent_manage', 'assets/agent_manage.png');
    this.load.image('agent_market', 'assets/agent_market.png');

    this.load.image('body_light', 'assets/body_light.png');
    this.load.image('body_tan', 'assets/body_tan.png');
    this.load.image('body_dark', 'assets/body_dark.png');
    this.load.image('hair_black_short', 'assets/hair_black_short.png');
    this.load.image('hair_brown_long', 'assets/hair_brown_long.png');
    
    // Fallback original agent
    this.load.image('agent', 'assets/agent.png');
  }

    create() {
    this.mapContainer = this.add.container(0, 0);

    // Generate Hair Textures Procedurally
    const hairStyles = [
        { key: 'hair_short', draw: (g: Phaser.GameObjects.Graphics) => {
            g.fillStyle(0xffffff);
            g.fillRect(-10, -15, 20, 10); // Top cap
        }},
        { key: 'hair_long', draw: (g: Phaser.GameObjects.Graphics) => {
            g.fillStyle(0xffffff);
            g.fillRect(-10, -15, 20, 10); // Top cap
            g.fillRect(-12, -10, 4, 15); // Left long
            g.fillRect(8, -10, 4, 15); // Right long
        }},
        { key: 'hair_spiky', draw: (g: Phaser.GameObjects.Graphics) => {
            g.fillStyle(0xffffff);
            g.fillTriangle(-10, -10, 0, -20, 10, -10); // Spikes
            g.fillRect(-10, -12, 20, 6);
        }}
    ];

    hairStyles.forEach(style => {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        style.draw(g);
        g.generateTexture(style.key, 32, 32);
    });

    // Base body (just a circle or simple shape for now if no base PNG)
    const bodyG = this.make.graphics({ x: 0, y: 0, add: false });
    bodyG.fillStyle(0xffffff);
    bodyG.fillCircle(16, 16, 12); // Head/Body base
    bodyG.generateTexture('char_base', 32, 32);
    
    // Build Preview Container (Ghost)
    this.previewContainer = this.add.container(0, 0).setAlpha(0.6).setDepth(1000).setVisible(false);
    this.previewSprite = this.add.sprite(0, 0, 'obstacle_desk').setOrigin(0.5, 0.5);
    this.previewRect = this.add.rectangle(0, 0, 40, 40, 0xffffff, 0.5).setOrigin(0.5, 0.5);
    this.previewContainer.add([this.previewRect, this.previewSprite]);

    // INTERACTIVE MAP EDITOR: Click to toggle obstacle
    this.input.on('pointerdown', async (pointer: Phaser.Input.Pointer) => {
        const { currentMap, buildMode, selectedTool } = useGameStore.getState();
        if (!buildMode) return;

        // Adjust pointer coordinates relative to mapContainer
        const mapX = pointer.x - this.mapContainer.x;
        const mapY = pointer.y - this.mapContainer.y;
        
        const x = Math.floor(mapX / this.gridSize);
        const y = Math.floor(mapY / this.gridSize);
        
        if (currentMap && x >= 0 && x < currentMap.width && y >= 0 && y < currentMap.height) {
            console.log(`Placement request: ${x}, ${y}, ${selectedTool}`);
            try {
                if (selectedTool === 'eraser') {
                    await removeObstacle(x, y);
                } else if (selectedTool.startsWith('zone_')) {
                    const zoneType = selectedTool.replace('zone_', '');
                    await setZoneTile(x, y, zoneType);
                } else {
                    const { selectedRotation, selectedFlipX } = useGameStore.getState();
                    await placeObstacle(x, y, selectedTool, selectedRotation, selectedFlipX);
                }
                
                // Optimistic/Force sync: Although subscription handles it, manual sync ensures immediate feedback
                const updatedMap = useGameStore.getState().currentMap;
                if (updatedMap) this.syncMap(updatedMap);
            } catch (error) {
                console.error("Failed to update tile:", error);
            }
        } else {
            console.log(`Click out of bounds or map missing: ${x}, ${y}`);
        }
    });

    // Initial Render
    const { currentMap } = useGameStore.getState();
    if (currentMap) this.syncMap(currentMap);
    
    // Subscribe to store for agent updates safely
    this.unsubscribers.push(
      useGameStore.subscribe(
        (state) => state.agents,
        (agents) => {
          if (this.scene && this.sys && this.sys.game) {
            this.syncAgents(agents);
          }
        }
      )
    );

    // Also subscribe to map updates
    this.unsubscribers.push(
      useGameStore.subscribe(
        (state) => state.currentMap,
        (newMap) => {
          if (newMap && this.scene && this.sys && this.sys.game) {
            this.syncMap(newMap);
          }
        }
      )
    );

    // Cleanup when scene is shut down
    this.events.on('shutdown', () => {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    });
  }

    private syncMap(data: any) {
        if (!this.sys || !this.sys.game || !this.sys.game.canvas) return;
        this.mapContainer.removeAll(true);
        
        // Dynamically calculate grid size to fit the screen while keeping squares
        const canvasW = this.sys.game.canvas.width;
        const canvasH = this.sys.game.canvas.height;
        
        // Calculate the maximum grid size that fits
        const sizeX = Math.floor(canvasW / data.width);
        const sizeY = Math.floor(canvasH / data.height);
        this.gridSize = Math.min(sizeX, sizeY);
        
        // Center the map in the remaining space
        const mapPixelWidth = data.width * this.gridSize;
        const mapPixelHeight = data.height * this.gridSize;
        const offsetX = Math.floor((canvasW - mapPixelWidth) / 2);
        const offsetY = Math.floor((canvasH - mapPixelHeight) / 2);
        
        this.mapContainer.setPosition(offsetX, offsetY);

        // Draw Floor Tiles dynamically based on zones
        for (let i = 0; i < data.width; i++) {
            for (let j = 0; j < data.height; j++) {
                let zoneAlias = 'work';
                
                // Use tile-based zone_data if available, otherwise fallback to rectangles
                if (data.zone_data && data.zone_data[j] && data.zone_data[j][i]) {
                    zoneAlias = data.zone_data[j][i];
                } else if (data.zones) {
                    const zone = data.zones.find((z:any) => i >= z.x1 && i <= z.x2 && j >= z.y1 && j <= z.y2);
                    if (zone) {
                        if (zone.aliases.includes('회의실')) zoneAlias = 'meeting';
                        else if (zone.aliases.includes('휴게실')) zoneAlias = 'break';
                    }
                }
                
                let tileKey = 'floor_work';
                if (zoneAlias === 'meeting') tileKey = 'floor_meeting';
                if (zoneAlias === 'break') tileKey = 'floor_break';
                
                const tile = this.add.image(i * this.gridSize, j * this.gridSize, tileKey)
                    .setOrigin(0, 0)
                    .setDisplaySize(this.gridSize, this.gridSize);
                this.mapContainer.add(tile);
            }
        }

        // Draw Obstacles (Furniture)
        if (data.obstacles && data.obstacles.length > 0) {
            data.obstacles.forEach((obs: any) => {
                // Support both old [x, y] and new {x, y} formats just in case
                const i = typeof obs.x === 'number' ? obs.x : obs[0];
                const j = typeof obs.y === 'number' ? obs.y : obs[1];
                let obsKey = obs.type || 'obstacle_desk';
                
                if (typeof i !== 'number' || typeof j !== 'number') return;

                // Handle Wall separately as a geometric shape
                if (obsKey === 'obstacle_wall') {
                    const wall = this.add.rectangle(i * this.gridSize, j * this.gridSize, this.gridSize, this.gridSize, 0x475569)
                        .setOrigin(0, 0);
                    // Add a simple top border to give it depth
                    const top = this.add.rectangle(i * this.gridSize, j * this.gridSize, this.gridSize, 4, 0x1e293b).setOrigin(0,0);
                    this.mapContainer.add(wall);
                    this.mapContainer.add(top);
                    return;
                }

                // Use manual rotation and flip_x from obstacle data
                const tint = 0xffffff;
                const angle = obs.rotation || 0;
                const flipX = obs.flip_x || false;
                
                // Map variation IDs back to base texture keys
                let baseKey = obs.type || 'obstacle_desk';
                if (baseKey.includes('_2')) baseKey = baseKey.replace('_2', '');
                if (baseKey.includes('_3')) baseKey = baseKey.replace('_3', '');

                const tile = this.add.image(i * this.gridSize + this.gridSize/2, j * this.gridSize + this.gridSize/2, baseKey)
                    .setOrigin(0.5, 0.5)
                    .setDisplaySize(this.gridSize * 1.8, this.gridSize * 1.8)
                    .setTint(tint)
                    .setAngle(angle)
                    .setFlipX(flipX);
                this.mapContainer.add(tile);
            });
        }
        
        // Draw Zone Labels
        data.zones.forEach((zone: any) => {
            const x = zone.x1 * this.gridSize;
            const y = zone.y1 * this.gridSize;
            
            // Restored Label with Pixel Font
            const text = this.add.text(x + 8, y + 8, zone.name, { 
                fontFamily: 'NeoDunggeunmo',
                fontSize: '18px', 
                color: '#ffffff', 
                backgroundColor: 'rgba(0,0,0,0.5)',
                padding: { x: 4, y: 2 }
            });
            text.setStroke('#000000', 2);
            this.mapContainer.add(text);
        });

        // Grid lines at the end
        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0x000000, 0.1); // Thicker grid lines
        for (let i = 0; i <= data.width; i++) {
            graphics.moveTo(i * this.gridSize, 0);
            graphics.lineTo(i * this.gridSize, data.height * this.gridSize);
        }
        for (let j = 0; j <= data.height; j++) {
            graphics.moveTo(0, j * this.gridSize);
            graphics.lineTo(data.width * this.gridSize, j * this.gridSize);
        }
        this.mapContainer.add(graphics);
        
        // Handle window resize dynamically
        this.scale.on('resize', () => {
            if (useGameStore.getState().currentMap) {
                this.syncMap(useGameStore.getState().currentMap);
                this.syncAgents(useGameStore.getState().agents);
            }
        });
    }

  private syncAgents(agents: Record<string, any>) {
    // Keep agent grid size consistent with map
    const gridSize = this.gridSize;

    // Remove agents that are no longer in the store
    for (const [id, spriteData] of this.agentSprites.entries()) {
      if (!agents[id]) {
        spriteData.container.destroy();
        this.agentSprites.delete(id);
      }
    }

    // Add or update agents
    for (const id in agents) {
      const data = agents[id];
      const targetX = data.x * gridSize + gridSize / 2;
      const targetY = data.y * gridSize + gridSize / 2;

      if (!this.agentSprites.has(id)) {
        // Create new agent container
        const container = this.add.container(targetX, targetY);
        
        // Layered Appearance
        const app = data.appearance || {};
        const skinType = app.body || 'body_light';
        const hairType = app.hair_style || 'hair_short';
        const hairColor = app.hair_color || '#4B2C20';
        const outfitType = app.outfit || 'agent_dev';

        const spriteSize = Math.floor(gridSize * 2.5);
        
        // Skin Tones
        let skinTint = 0xffe0bd;
        if (skinType === 'body_tan') skinTint = 0xe0ac69;
        if (skinType === 'body_dark') skinTint = 0x8d5524;

        const bodySprite = this.add.sprite(0, 0, 'char_base').setDisplaySize(spriteSize, spriteSize).setTint(skinTint);
        const outfitSprite = this.add.sprite(0, 0, outfitType).setDisplaySize(spriteSize, spriteSize);
        
        let hairSprite = null;
        if (hairType !== 'none' && this.textures.exists(hairType)) {
            const hColor = parseInt(hairColor.replace('#', '0x'));
            hairSprite = this.add.sprite(0, -5, hairType).setDisplaySize(spriteSize, spriteSize).setTint(hColor);
        }
        
        // Add all to container
        const spriteLayers: Phaser.GameObjects.GameObject[] = [bodySprite, outfitSprite];
        if (hairSprite) spriteLayers.push(hairSprite);

        
        // Name Label
        const label = this.add.text(0, 35, data.name, { 
          fontFamily: 'NeoDunggeunmo',
          fontSize: '12px', 
          color: '#ffffff',
          backgroundColor: '#000000',
          padding: { x: 4, y: 2 }
        }).setOrigin(0.5);

        // Speech Bubble
        const bubble = this.add.text(0, -35, "", {
          fontFamily: 'NeoDunggeunmo',
          fontSize: '14px',
          color: '#000000',
          backgroundColor: '#ffffff',
          padding: { x: 8, y: 6 },
          wordWrap: { width: 150 },
          align: 'center',
        }).setOrigin(0.5, 1).setVisible(false);
        
        // Status Line (Floating above name)
        const status = this.add.text(0, 20, "대기 중...", {
            fontFamily: 'NeoDunggeunmo',
            fontSize: '10px',
            color: '#ffff00',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 2, y: 1 }
        }).setOrigin(0.5).setVisible(false);

        container.add([...spriteLayers, label, bubble, status]);
        this.agentSprites.set(id, { container, body: bodySprite, label, bubble, status } as any);
      } else {
        // Update existing agent
        const spriteData = this.agentSprites.get(id)!;
        
        // Smooth movement
        this.tweens.add({
          targets: spriteData.container,
          x: targetX,
          y: targetY,
          duration: 400, // Faster, snappier movement for retro feel
          ease: 'Linear'
        });

        // Update speech bubble
        if (data.current_speech && data.current_speech.trim() !== "") {
          spriteData.bubble.setText(data.current_speech);
          spriteData.bubble.setVisible(true);
        } else {
          spriteData.bubble.setVisible(false);
        }

        // Update status text
        if (data.current_action && data.current_action.trim() !== "") {
          spriteData.status.setText(data.current_action);
          spriteData.status.setVisible(true);
        } else {
          spriteData.status.setVisible(false);
        }
      }
    }
  }

    // Remove old renderMap to avoid confusion. syncMap is the true path.

  update() {
    const { buildMode, selectedTool, currentMap } = useGameStore.getState();
    const pointer = this.input.activePointer;

    // Use a simpler check for pointer presence
    const isPointerOver = pointer.x > 0 && pointer.y > 0 && pointer.x < this.sys.game.canvas.width && pointer.y < this.sys.game.canvas.height;

    if (buildMode && currentMap && isPointerOver) {
        this.previewContainer.setVisible(true);
        
        // Calculate grid position
        const mapX = pointer.x - this.mapContainer.x;
        const mapY = pointer.y - this.mapContainer.y;
        const x = Math.floor(mapX / this.gridSize);
        const y = Math.floor(mapY / this.gridSize);

        // Snap to grid center for furniture, origin for tiles
        const snapX = x * this.gridSize + this.gridSize / 2;
        const snapY = y * this.gridSize + this.gridSize / 2;
        this.previewContainer.setPosition(this.mapContainer.x + snapX, this.mapContainer.y + snapY);

        // Check if current position is within map bounds
        const isOutOfBounds = x < 0 || x >= currentMap.width || y < 0 || y >= currentMap.height;
        const ghostAlpha = isOutOfBounds ? 0.3 : 0.6;
        const ghostTint = isOutOfBounds ? 0xff0000 : 0xffffff;

        this.previewContainer.setAlpha(ghostAlpha);

        // Update preview appearance based on tool
        if (selectedTool === 'eraser') {
            this.previewSprite.setVisible(false);
            this.previewRect.setVisible(true).setFillStyle(0xff0000, 0.4).setSize(this.gridSize, this.gridSize);
        } else if (selectedTool.startsWith('zone_')) {
            this.previewSprite.setVisible(false);
            this.previewRect.setVisible(true).setSize(this.gridSize, this.gridSize);
            const tint = isOutOfBounds ? 0xff0000 : (selectedTool === 'zone_meeting' ? 0xbbdefb : (selectedTool === 'zone_break' ? 0xc8e6c9 : 0xf5f5f5));
            this.previewRect.setFillStyle(tint, 0.6);
        } else if (selectedTool.startsWith('obstacle_')) {
            if (selectedTool === 'obstacle_wall') {
                this.previewSprite.setVisible(false);
                this.previewRect.setVisible(true).setFillStyle(isOutOfBounds ? 0xff0000 : 0x475569, 0.7).setSize(this.gridSize, this.gridSize);
            } else {
                this.previewRect.setVisible(false);
                this.previewSprite.setVisible(true);
                
                const { selectedRotation, selectedFlipX } = useGameStore.getState();
                
                // Map variation IDs back to base texture keys
                let baseKey = selectedTool;
                if (baseKey.includes('_2')) baseKey = baseKey.replace('_2', '');
                if (baseKey.includes('_3')) baseKey = baseKey.replace('_3', '');
                
                if (this.textures.exists(baseKey)) {
                    this.previewSprite.setTexture(baseKey)
                        .setDisplaySize(this.gridSize * 1.8, this.gridSize * 1.8)
                        .setTint(ghostTint)
                        .setAngle(selectedRotation)
                        .setFlipX(selectedFlipX);
                }
            }
        }
    } else {
        this.previewContainer.setVisible(false);
    }
  }
}

import Phaser from 'phaser';
import { useGameStore } from '../store/useGameStore';
import { placeObstacle, removeObstacle } from '../services/api';

export class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
  }

  private agentSprites: Map<string, { container: Phaser.GameObjects.Container, body: Phaser.GameObjects.Sprite, label: Phaser.GameObjects.Text, bubble: Phaser.GameObjects.Text }> = new Map();

  private unsubscribe: (() => void) | null = null;
  
  private mapContainer!: Phaser.GameObjects.Container;
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
                } else {
                    await placeObstacle(x, y, selectedTool);
                }
            } catch (error) {
                console.error("Failed to update obstacle:", error);
            }
        } else {
            console.log(`Click out of bounds or map missing: ${x}, ${y}`);
        }
    });

    // Initial Render
    const { currentMap } = useGameStore.getState();
    if (currentMap) this.syncMap(currentMap);
    
    // Subscribe to store for agent updates safely
    this.unsubscribe = useGameStore.subscribe(
      (state) => state.agents,
      (agents) => {
        if (this.scene && this.sys) {
           this.syncAgents(agents);
        }
      }
    );

    // Also subscribe to map updates
    useGameStore.subscribe(
      (state) => state.currentMap,
      (newMap) => {
        if (this.scene && this.sys && newMap) {
          this.syncMap(newMap);
        }
      }
    );

    // Cleanup when scene is shut down
    this.events.on('shutdown', () => {
      if (this.unsubscribe) this.unsubscribe();
    });
  }

    private syncMap(data: any) {
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
                if (data.zones) {
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

                // Handle variations by tinting base assets
                let tint = 0xffffff;
                let baseKey = obsKey;
                if (obsKey.includes('_2')) {
                    baseKey = obsKey.replace('_2', '');
                    tint = 0xddddff; // Bluish/Silver
                    if (obsKey.includes('plant')) tint = 0x88ff88; // Lighter green
                } else if (obsKey.includes('_3')) {
                    baseKey = obsKey.replace('_3', '');
                    tint = 0xffe4b5; // Wooden/Warm
                    if (obsKey.includes('plant')) tint = 0x556b2f; // Olive green
                }

                const tile = this.add.image(i * this.gridSize + this.gridSize/2, j * this.gridSize + this.gridSize/2, baseKey)
                    .setOrigin(0.5, 0.5)
                    .setDisplaySize(this.gridSize * 1.8, this.gridSize * 1.8)
                    .setTint(tint);
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
        const bodyPart = app.body || 'body_light';
        const outfitPart = app.outfit || 'agent_dev';
        const hairPart = app.hair || 'none';

        const spriteSize = Math.floor(gridSize * 2.5);

        const bodySprite = this.add.sprite(0, 0, bodyPart).setDisplaySize(spriteSize, spriteSize);
        const outfitSprite = this.add.sprite(0, 0, outfitPart).setDisplaySize(spriteSize, spriteSize);
        const hairSprite = hairPart !== 'none' ? this.add.sprite(0, 0, hairPart).setDisplaySize(spriteSize, spriteSize) : null;
        
        // Add all to container
        const spriteLayers = [bodySprite, outfitSprite];
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
        
        // Add retro border to bubble
        bubble.setStroke('#000000', 3);
        
        container.add([...spriteLayers, label, bubble]);
        this.agentSprites.set(id, { container, body: bodySprite, label, bubble } as any);
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
      }
    }
  }

    // Remove old renderMap to avoid confusion. syncMap is the true path.

  update() {
    // Game loop
  }
}

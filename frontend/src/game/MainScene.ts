import Phaser from 'phaser';
import { useGameStore } from '../store/useGameStore';

export class MainScene extends Phaser.Scene {
  private zones: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super('MainScene');
  }

  private agentSprites: Map<string, { container: Phaser.GameObjects.Container, body: Phaser.GameObjects.Sprite, label: Phaser.GameObjects.Text, bubble: Phaser.GameObjects.Text }> = new Map();

  private unsubscribe: (() => void) | null = null;
  
  private mapContainer!: Phaser.GameObjects.Container;
  private gridSize: number = 40;

  preload() {
    this.load.image('agent', 'assets/agent.png');
  }

    create() {
    this.mapContainer = this.add.container(0, 0);

    // Create a transparent interactive background for reliable click detection
    const interactiveBg = this.add.rectangle(0, 0, 2000, 2000, 0x000000, 0)
        .setOrigin(0, 0)
        .setInteractive();

    // INTERACTIVE MAP EDITOR: Click to toggle obstacle
    interactiveBg.on('pointerdown', async (pointer: Phaser.Input.Pointer) => {
        // Adjust pointer coordinates relative to mapContainer
        const mapX = pointer.x - this.mapContainer.x;
        const mapY = pointer.y - this.mapContainer.y;
        
        const x = Math.floor(mapX / this.gridSize);
        const y = Math.floor(mapY / this.gridSize);
        
        console.log(`Clicked on map cell: ${x}, ${y}`);
        
        const { currentMap } = useGameStore.getState();
        if (currentMap && x >= 0 && x < currentMap.width && y >= 0 && y < currentMap.height) {
            try {
                const { toggleObstacle } = await import('../services/api');
                await toggleObstacle(x, y);
            } catch (error) {
                console.error("Failed to toggle obstacle:", error);
            }
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

        // Draw Zones with colors, borders, and labels
        data.zones.forEach((zone: any) => {
            const width = (zone.x2 - zone.x1 + 1) * this.gridSize;
            const height = (zone.y2 - zone.y1 + 1) * this.gridSize;
            const x = zone.x1 * this.gridSize;
            const y = zone.y1 * this.gridSize;

            const color = Phaser.Display.Color.HexStringToColor(zone.color).color;
            
            // Fill
            const rect = this.add.rectangle(x, y, width, height, color, 0.4)
                .setOrigin(0, 0)
                .setStrokeStyle(3, color, 1.0); // Thicker retro border
            this.mapContainer.add(rect);

            // Restored Label with Pixel Font
            const text = this.add.text(x + 8, y + 8, zone.name, { 
                fontFamily: 'NeoDunggeunmo',
                fontSize: '18px', 
                color: '#000000', 
                backgroundColor: '#ffffff',
                padding: { x: 4, y: 2 }
            });
            text.setStroke('#000000', 2);
            this.mapContainer.add(text);
        });

        // Draw Obstacles (Walls/Furniture) - FORCED VISIBILITY
        if (data.obstacles && data.obstacles.length > 0) {
            data.obstacles.forEach((obs: any) => {
                const x = obs[0] * this.gridSize;
                const y = obs[1] * this.gridSize;
                
                // Solid black block for retro wall
                const rect = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0x374151, 1.0)
                    .setOrigin(0, 0)
                    .setStrokeStyle(2, 0x000000);
                this.mapContainer.add(rect);
            });
        }

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
        
        // Body (Sprite)
        const body = this.add.sprite(0, 0, 'agent');
        const spriteSize = Math.max(24, Math.floor(gridSize * 0.9));
        body.setDisplaySize(spriteSize, spriteSize);
        
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
        
        container.add([body, label, bubble]);
        this.agentSprites.set(id, { container, body, label, bubble });
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

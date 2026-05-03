import Phaser from 'phaser';
import { useGameStore } from '../store/useGameStore';

export class MainScene extends Phaser.Scene {
  private zones: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super('MainScene');
  }

  private agentSprites: Map<string, { container: Phaser.GameObjects.Container, body: Phaser.GameObjects.Sprite, label: Phaser.GameObjects.Text, bubble: Phaser.GameObjects.Text }> = new Map();

  private unsubscribe: (() => void) | null = null;

  preload() {
    this.load.image('agent', 'assets/agent.png');
  }

  create() {
    this.renderMap();
    
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
      () => {
        if (this.scene && this.sys) {
          this.renderMap();
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
    this.gridSize = 40;

    // Draw Zones
    data.zones.forEach((zone: any) => {
        const width = (zone.x2 - zone.x1 + 1) * this.gridSize;
        const height = (zone.y2 - zone.y1 + 1) * this.gridSize;
        const x = zone.x1 * this.gridSize;
        const y = zone.y1 * this.gridSize;

        const rect = this.add.rectangle(x, y, width, height, Phaser.Display.Color.HexStringToColor(zone.color).color, 0.3)
            .setOrigin(0, 0);
        this.mapContainer.add(rect);

        // Add Zone Name
        const text = this.add.text(x + 5, y + 5, zone.name, { fontSize: '12px', color: '#666', fontStyle: 'bold' });
        this.mapContainer.add(text);
    });

    // Draw Obstacles (Walls/Furniture)
    if (data.obstacles) {
        data.obstacles.forEach((obs: [number, number]) => {
            const x = obs[0] * this.gridSize;
            const y = obs[1] * this.gridSize;
            
            // Draw a sleek dark block for obstacles
            const rect = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0x333333, 0.8)
                .setOrigin(0, 0)
                .setStrokeStyle(1, 0x000000);
            this.mapContainer.add(rect);
            
            // Add a subtle "wall" pattern or icon if desired
        });
    }

    // Draw Grid Lines
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x000000, 0.05);
    for (let i = 0; i <= data.width; i++) {
        graphics.moveTo(i * this.gridSize, 0);
        graphics.lineTo(i * this.gridSize, data.height * this.gridSize);
    }
    for (let j = 0; j <= data.height; j++) {
        graphics.moveTo(0, j * this.gridSize);
        graphics.lineTo(data.width * this.gridSize, j * this.gridSize);
    }
    this.mapContainer.add(graphics);
  }

  private syncAgents(agents: Record<string, any>) {
    const gridSize = 40;

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
        body.setDisplaySize(32, 32);
        
        // Name Label
        const label = this.add.text(0, 25, data.name, { 
          fontSize: '10px', 
          color: '#ffffff',
          backgroundColor: '#1e293b',
          padding: { x: 4, y: 2 }
        }).setOrigin(0.5);

        // Speech Bubble
        const bubble = this.add.text(0, -40, "", {
          fontSize: '11px',
          color: '#1e293b',
          backgroundColor: '#ffffff',
          padding: { x: 8, y: 5 },
          wordWrap: { width: 140 },
          align: 'center'
        }).setOrigin(0.5, 1).setVisible(false);
        
        // Add shadow/border to bubble if possible (simplified here)
        
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
          duration: 600,
          ease: 'Cubic.easeOut'
        });

        // Update speech bubble
        if (data.current_speech && data.current_speech.trim() !== "") {
          spriteData.bubble.setText(data.current_speech);
          spriteData.bubble.setVisible(true);
          
          // Auto-hide bubble after 5 seconds if speech doesn't change
          // (In a real app, you might want to handle this via the backend state)
        } else {
          spriteData.bubble.setVisible(false);
        }
      }
    }
  }

  private renderMap() {
    const { currentMap } = useGameStore.getState();
    if (!currentMap) return;

    // Clear existing zones
    this.zones.forEach(z => z.destroy());
    this.zones = [];

    const gridSize = 40; // Pixels per grid unit

    currentMap.zones.forEach((zone: any) => {
      const g = this.add.graphics();
      const color = parseInt(zone.color.replace('#', '0x'), 16);
      g.fillStyle(color, 0.5);
      
      const width = (zone.x2 - zone.x1 + 1) * gridSize;
      const height = (zone.y2 - zone.y1 + 1) * gridSize;
      
      g.fillRect(zone.x1 * gridSize, zone.y1 * gridSize, width, height);
      g.lineStyle(2, color, 1);
      g.strokeRect(zone.x1 * gridSize, zone.y1 * gridSize, width, height);

      this.add.text(
        zone.x1 * gridSize + 5, 
        zone.y1 * gridSize + 5, 
        zone.name, 
        { fontSize: '12px', color: '#000000' }
      );
      
      this.zones.push(g);
    });
  }

  update() {
    // Game loop
  }
}

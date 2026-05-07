import Phaser from 'phaser';
import { IsometricManager } from './IsometricManager';

/**
 * 에이전트(캐릭터)의 생성, 업데이트 및 시각적 표현을 관리하는 클래스
 */
export class AgentManager {
    // 에이전트 ID별 스프라이트 구성을 저장하는 맵
    private agentSprites: Map<string, { 
        container: Phaser.GameObjects.Container, 
        body: Phaser.GameObjects.Sprite, 
        label: Phaser.GameObjects.Text 
    }> = new Map();

    constructor(
        private scene: Phaser.Scene,
        private iso: IsometricManager
    ) {}

    /**
     * 서버로부터 받은 에이전트 데이터를 기반으로 씬의 에이전트 상태를 동기화
     */
    syncAgents(agents: Record<string, any>) {
        for (const id in agents) {
            const data = agents[id];
            const isoPos = this.iso.cartToIso(data.x, data.y);
            const targetY = isoPos.y + this.iso.tileHeight / 2;

            if (!this.agentSprites.has(id)) {
                // 새로운 에이전트 생성
                this.createAgent(id, data, isoPos.x, targetY);
            } else {
                // 기존 에이전트 위치 업데이트 (트윈 애니메이션)
                this.updateAgentPosition(id, isoPos.x, targetY);
            }
        }
        
        // 데이터에 없는 에이전트 삭제 (필요 시 구현)
    }

    /**
     * 새로운 에이전트 컨테이너 및 스프라이트 생성
     */
    private createAgent(id: string, data: any, x: number, y: number) {
        const container = this.scene.add.container(x, y);
        
        // 에이전트 본체 스프라이트
        const body = this.scene.add.sprite(0, 0, 'agent_sheet', 0)
            .setDisplaySize(this.iso.tileWidth * 1.8, this.iso.tileWidth * 1.8)
            .setOrigin(0.5, 0.85);
            
        // 에이전트 이름표
        const label = this.scene.add.text(0, 25, data.name, { 
            fontFamily: 'NeoDunggeunmo', 
            fontSize: '14px', 
            color: '#00f2ff', 
            stroke: '#000', 
            strokeThickness: 3 
        }).setOrigin(0.5, 0);

        container.add([body, label]);
        container.setDepth(y + 100);
        
        this.agentSprites.set(id, { container, body, label });
    }

    /**
     * 에이전트 위치를 부드럽게 이동시키고 깊이(Depth) 조절
     */
    private updateAgentPosition(id: string, x: number, y: number) {
        const agent = this.agentSprites.get(id)!;
        this.scene.tweens.add({
            targets: agent.container,
            x: x,
            y: y,
            duration: 600,
            ease: 'Power2',
            onUpdate: () => {
                agent.container.setDepth(agent.container.y + 100);
            }
        });
    }

    /**
     * 씬 종료 시 리소스 정리
     */
    destroy() {
        this.agentSprites.forEach(a => a.container.destroy());
        this.agentSprites.clear();
    }
}

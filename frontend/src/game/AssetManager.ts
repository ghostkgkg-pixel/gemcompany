import Phaser from 'phaser';

/**
 * 게임 에셋(이미지, 시트 등)의 로딩 및 전처리를 담당하는 클래스
 */
export class AssetManager {
    constructor(private scene: Phaser.Scene) {}

    /**
     * 필요한 모든 스프라이트 시트 프리로드
     */
    preload() {
        this.scene.load.spritesheet('floor_sheet', 'assets/floor_sheet.png', { frameWidth: 128, frameHeight: 128 });
        this.scene.load.spritesheet('furniture_sheet', 'assets/furniture_sheet.png', { frameWidth: 256, frameHeight: 256 });
        this.scene.load.spritesheet('agent_sheet', 'assets/agent_sheet.png', { frameWidth: 256, frameHeight: 256 });
        this.scene.load.spritesheet('walls_sheet', 'assets/walls_sheet.png', { frameWidth: 256, frameHeight: 256 });
    }
}

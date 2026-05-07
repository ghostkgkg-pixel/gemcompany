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
        this.scene.load.spritesheet('floor_sheet', 'assets/floor_sheet.png', { frameWidth: 256, frameHeight: 256 });
        this.scene.load.spritesheet('furniture_sheet', 'assets/furniture_sheet.png', { frameWidth: 256, frameHeight: 256 });
        this.scene.load.spritesheet('agent_sheet', 'assets/agent_sheet.png', { frameWidth: 256, frameHeight: 256 });
        this.scene.load.spritesheet('walls_sheet', 'assets/walls_sheet.png', { frameWidth: 256, frameHeight: 256 });

        // 로드 완료 시 투명도 전처리 실행
        this.scene.load.on('complete', () => this.processTransparency());
    }

    /**
     * 에셋의 배경색(검정/흰색)을 감지하여 투명하게 만드는 픽셀 처리 로직
     */
    private processTransparency() {
        ['floor_sheet', 'furniture_sheet', 'agent_sheet', 'walls_sheet'].forEach(key => {
            const texture = this.scene.textures.get(key);
            if (!texture) return;
            const source = texture.getSourceImage() as HTMLImageElement;
            const canvas = document.createElement('canvas');
            canvas.width = source.width; canvas.height = source.height;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                ctx.drawImage(source, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                // 픽셀 단위로 루프를 돌며 검은색/흰색 배경 제거
                for (let i = 0; i < data.length; i += 4) {
                    const isBlack = data[i] < 20 && data[i + 1] < 20 && data[i + 2] < 20;
                    const isWhite = data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240;
                    if (isBlack || isWhite) data[i + 3] = 0;
                }
                ctx.putImageData(imageData, 0, 0);
                this.scene.textures.remove(key);
                // 전처리된 캔버스를 새로운 스프라이트 시트로 등록
                this.scene.textures.addSpriteSheet(key, canvas, { frameWidth: 256, frameHeight: 256 });
            }
        });
    }
}

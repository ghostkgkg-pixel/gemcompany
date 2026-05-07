/**
 * 등각 투영(Isometric) 좌표 변환 및 기하학적 계산을 담당하는 클래스
 */
export class IsometricManager {
    constructor(private tw: number, private th: number) { }

    /** 타일 크기 업데이트 */
    updateSize(tw: number, th: number) {
        this.tw = tw;
        this.th = th;
    }

    get tileWidth() { return this.tw; }
    get tileHeight() { return this.th; }

    /**
     * 카테시안(2D 그리드) 좌표를 등각 투영(화면) 좌표로 변환
     */
    cartToIso(x: number, y: number) {
        return {
            x: (x - y) * (this.tw / 2),
            y: (x + y) * (this.th / 2)
        };
    }

    /**
     * 월드(화면) 좌표를 카테시안(그리드) 좌표로 역변환
     * @param worldX 마우스 포인트 등의 월드 X 좌표
     * @param worldY 마우스 포인트 등의 월드 Y 좌표
     * @param containerX 맵 컨테이너의 X 오프셋
     * @param containerY 맵 컨테이너의 Y 오프셋
     */
    worldToCart(worldX: number, worldY: number, containerX: number, containerY: number) {
        const relX = worldX - containerX;
        const relY = worldY - containerY;
        const cx = Math.floor((relX / (this.tw / 2) + relY / (this.th / 2)) / 2);
        const cy = Math.floor((relY / (this.th / 2) - relX / (this.tw / 2)) / 2);
        return { x: cx, y: cy };
    }
}

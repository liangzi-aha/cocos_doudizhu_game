/*******************************************************************************
 * 创建: 2024年08月28日
 * 作者: 水煮肉片饭(27185709@qq.com)
 * 描述: 支持Creator3.x版本的圆角矩形，支持合批
*******************************************************************************/
import * as cc from 'cc';
import { DEV, EDITOR, JSB } from 'cc/env';
export enum SizeMode { 'CUSTOM: 自定义尺寸', 'TRIMMED: 原始尺寸裁剪透明像素', 'RAW: 图片原始尺寸' }
const CENTER_IDATA = [0, 9, 11, 0, 11, 1, 2, 8, 10, 2, 4, 8, 3, 5, 7, 3, 7, 6];
const { ccclass, property, menu } = cc._decorator;
@ccclass('Corner')
class Corner {
    @property({ displayName: DEV && '↙ 左下' })
    leftBottom: boolean = true;
    @property({ displayName: DEV && '↘ 右下' })
    rightBottom: boolean = true;
    @property({ displayName: DEV && '↖ 左上' })
    leftTop: boolean = true;
    @property({ displayName: DEV && '↗ 右上' })
    rightTop: boolean = true;
    visible: boolean[] = null;
}
@ccclass
@menu('Public/RoundBox')
export class RoundBox extends cc.UIRenderer {
    @property({ type: cc.SpriteAtlas, readonly: true })
    protected atlas: cc.SpriteAtlas = null;
    @property
    private _spriteFrame: cc.SpriteFrame = null;
    @property({ type: cc.SpriteFrame })
    get spriteFrame() { return this._spriteFrame; }
    set spriteFrame(value: cc.SpriteFrame) {
        this._spriteFrame = value;
        this.updateSpriteFrame();
        this.markForUpdateRenderData();
    }
    @property
    private _sizeMode: SizeMode = SizeMode['TRIMMED: 原始尺寸裁剪透明像素'];
    @property({ type: cc.Enum(SizeMode) })
    get sizeMode() { return this._sizeMode; }
    set sizeMode(value: SizeMode) {
        this._sizeMode = value;
        this.updateSizeMode();
    }
    @property
    private _segment: number = 5;
    @property({ type: cc.CCInteger, displayName: DEV && '线段数量' })
    get segment() { return this._segment; }
    set segment(value: number) {
        this._segment = Math.max(value, 1);
        this.createBuffer();
        this.markForUpdateRenderData();
    }
    @property
    private _radius: number = 100;
    @property({ displayName: DEV && '圆角半径' })
    get radius() { return this._radius; }
    set radius(value: number) {
        this._radius = Math.max(value, 0);
        this.markForUpdateRenderData();
    }
    @property
    private _corner: Corner = new Corner();
    @property({ displayName: DEV && '圆角可见性' })
    private get corner() { return this._corner; }
    private set corner(value: Corner) {
        this._corner = value;
        this.updateCorner();
        this.createBuffer();
        this.markForUpdateRenderData();
    }
    public __preload() {
        super.__preload();
        this._assembler = {
            updateColor: this.updateColor.bind(this),
            updateRenderData: this.onFlushed.bind(this),
            fillBuffers: this.fillBuffer.bind(this),
        };
    }
    public onLoad() {
        super.onLoad();
        this.updateSpriteFrame();
        this.updateCorner();
        this.createBuffer();
        this.node.on(cc.NodeEventType.SIZE_CHANGED, this.onSizeChanged, this);
    }
    public onDestroy() {
        super.onDestroy();
        this.node.off(cc.NodeEventType.SIZE_CHANGED, this.onSizeChanged, this);
    }
    //修改圆角可见性后，更新圆角数据
    private updateCorner() {
        let corner = this._corner;
        corner.visible = [corner.leftBottom, corner.rightBottom, corner.rightTop, corner.leftTop];
    }
    //设置顶点个数和三角形个数
    private createBuffer() {
        this.destroyRenderData();
        let renderData = this._renderData = this.requestRenderData();
        let cornerCnt = 0;
        for (let i = 0, visible = this._corner.visible; i < 4; visible[i++] && ++cornerCnt);
        renderData.dataLength = 12 + (this.segment - 1) * cornerCnt;
        renderData.resize(renderData.dataLength, 3 * (6 + this.segment * cornerCnt));
        this._updateColor();
        this.updateIData();
    }
    //Web平台，将renderData的数据提交给GPU渲染，renderData.data使用世界坐标
    //原生平台并不会执行该函数，引擎另外实现了渲染函数，renderData.data使用本地坐标
    private fillBuffer() {
        let renderData = this._renderData;
        let chunk = renderData.chunk;
        if (this.node.hasChangedFlags || renderData.vertDirty) {
            let vb = chunk.vb;
            let data = renderData.data;
            let m = this.node.worldMatrix;
            let m00 = m.m00, m01 = m.m01, m04 = m.m04, m05 = m.m05, m12 = m.m12, m13 = m.m13;
            for (let i = 0, id = 0, len = vb.length, step = renderData.floatStride; i < len; i += step, ++id) {
                let x = data[id].x, y = data[id].y;
                vb[i] = m00 * x + m04 * y + m12;
                vb[i + 1] = m01 * x + m05 * y + m13;
            }
            renderData.vertDirty = false;
        }
        let vid = chunk.vertexOffset;
        let meshBuffer = chunk.meshBuffer;
        let iData = meshBuffer.iData;
        let ib = chunk.ib;
        for (let i = 0, len = renderData.indexCount, offset = meshBuffer.indexOffset; i < len; iData[offset++] = vid + ib[i++]);
        meshBuffer.indexOffset += renderData.indexCount;
    }
    //如果材质为空，则设置为默认材质
    public updateMaterial() {
        super['updateMaterial']();
        this._customMaterial ??= this.getSharedMaterial(0);
    }
    //修改节点尺寸后，更新顶点数据，并根据sizeMode设置图片宽高
    private onSizeChanged() {
        if (!this._spriteFrame) return;
        let ut = this.node.getComponent(cc.UITransform);
        switch (this._sizeMode) {
            case SizeMode['TRIMMED: 原始尺寸裁剪透明像素']:
                let rect = this._spriteFrame['_rect'];
                if (ut.width === rect.width && ut.height === rect.height) return;
                break;
            case SizeMode['RAW: 图片原始尺寸']:
                let size = this._spriteFrame['_originalSize'];
                if (ut.width === size.width && ut.height === size.height) return;
                break;
        }
        this._sizeMode = SizeMode['CUSTOM: 自定义尺寸'];
    }
    //可以传入cc.SpriteFrame图集帧（支持合批，推荐），或单张图片cc.Texture2D
    private updateSpriteFrame() {
        let frame = this.spriteFrame;
        if (!frame) { this.atlas = null; return; }
        this._renderData && (this._renderData.textureDirty = true);
        this.updateSizeMode();
        if (EDITOR) {
            if (!frame['_atlasUuid']) { this.atlas = null; return; }
            cc.assetManager.loadAny(frame['_atlasUuid'], (err: Error, asset: cc.SpriteAtlas) => {
                if (err) { this.atlas = null; return; }
                this.atlas = asset;
            });
        }
    }
    //根据尺寸模式，修改节点尺寸
    private updateSizeMode() {
        if (!this._spriteFrame) return;
        let ut = this.node.getComponent(cc.UITransform) ?? this.node.addComponent(cc.UITransform);
        switch (this._sizeMode) {
            case SizeMode['TRIMMED: 原始尺寸裁剪透明像素']: ut.setContentSize(this._spriteFrame['_rect'].size); break;
            case SizeMode['RAW: 图片原始尺寸']: ut.setContentSize(this._spriteFrame['_originalSize']); break;
        }
    }
    //更新渲染数据，当调用markForUpdateRenderData时会触发
    private onFlushed() {
        let frame = this._spriteFrame;
        if (!frame) return;
        this.updateVData();
        this._renderData.updateRenderData(this, frame);
    }
    //计算XY、UV坐标
    private updateVData() {
        let renderData = this._renderData;
        let data = renderData.data;
        let ut = this.node._uiProps.uiTransformComp;
        let cw = ut.width, ch = ut.height, ax = ut.anchorX, ay = ut.anchorY;
        let l = -cw * ax;
        let b = -ch * ay;
        let r = cw * (1 - ax);
        let t = ch * (1 - ay);
        let radius = Math.min(this._radius, Math.min(cw, ch) / 2);
        let lo = l + radius;
        let bo = b + radius;
        let ro = r - radius;
        let to = t - radius;
        let corner = this._corner;
        data[0].x = lo; data[0].y = corner.leftBottom ? bo : b;
        data[1].x = l; data[1].y = data[0].y;
        data[2].x = lo; data[2].y = b;
        data[3].x = ro; data[3].y = corner.rightBottom ? bo : b;
        data[4].x = ro; data[4].y = b;
        data[5].x = r; data[5].y = data[3].y;
        data[6].x = ro; data[6].y = corner.rightTop ? to : t;
        data[7].x = r; data[7].y = data[6].y;
        data[8].x = ro; data[8].y = t;
        data[9].x = lo; data[9].y = corner.leftTop ? to : t;
        data[10].x = lo; data[10].y = t;
        data[11].x = l; data[11].y = data[9].y;
        let radian = Math.PI / (this._segment << 1);
        let sin = Math.sin(radian), cos = Math.cos(radian);
        let visible = corner.visible;
        for (let i = 0, offset = 12; i < 4; ++i) {
            if (!visible[i]) continue;
            let id = i * 3;
            let ox = data[id].x;
            let oy = data[id].y;
            let deltX = data[id + 1].x - ox;
            let deltY = data[id + 1].y - oy;
            for (let j = 0, len = this._segment - 1; j < len; ++j) {
                data[offset].x = ox + deltX * cos - deltY * sin;
                data[offset].y = oy + deltY * cos + deltX * sin;
                deltX = data[offset].x - ox;
                deltY = data[offset].y - oy;
                ++offset;
            }
        }
        let vb = renderData.chunk.vb;
        for (let i = 3, len = vb.length, step = renderData.floatStride, id = 0; i < len; i += step, ++id) {
            vb[i] = (data[id].x - l) / cw;
            vb[i + 1] = (data[id].y - b) / ch;
        }
        this.fitUV(vb);
    }
    //自动适配UV，修改顶点uv数据后需主动调用该函数
    private fitUV(vb: Float32Array) {
        if (!this.spriteFrame) return;
        let uv = this.spriteFrame.uv;
        if (this.spriteFrame['_rotated']) {
            var uvL = uv[0], uvB = uv[1], uvW = uv[4] - uvL, uvH = uv[3] - uvB;
            for (let i = 3, len = vb.length, step = this._renderData.floatStride; i < len; i += step) {
                let tmp = vb[i];
                vb[i] = uvL + vb[i + 1] * uvW;
                vb[i + 1] = uvB + tmp * uvH;
            }
        } else {
            var uvL = uv[0], uvB = uv[1], uvW = uv[2] - uvL, uvH = uv[5] - uvB;
            for (let i = 3, len = vb.length, step = this._renderData.floatStride; i < len; i += step) {
                vb[i] = uvL + vb[i] * uvW;
                vb[i + 1] = uvB + vb[i + 1] * uvH;
            }
        }
    }
    //计算顶点颜色
    private updateColor() {
        let renderData = this._renderData;
        let vb = renderData.chunk.vb;
        let color = this.color, r = color.r / 255, g = color.g / 255, b = color.b / 255, a = color.a / 255;
        for (let i = 5, len = vb.length, step = renderData.floatStride; i < len; i += step) {
            vb[i] = r;
            vb[i + 1] = g;
            vb[i + 2] = b;
            vb[i + 3] = a;
        }
    }
    //计算顶点索引
    private updateIData() {
        let iData = this._renderData.chunk['_ib'];
        for (let i = CENTER_IDATA.length - 1; i > -1; iData[i] = CENTER_IDATA[i--]);
        let offset = CENTER_IDATA.length;
        let visible = this._corner.visible;
        let id = 36;
        for (let i = 0; i < 4; ++i) {
            if (!visible[i]) continue;
            let o = 3 * i;
            let a = o + 1;
            let b = id / 3;
            for (let j = 0, len = this._segment - 1; j < len; ++j) {
                iData[offset++] = o;
                iData[offset++] = a;
                iData[offset++] = b;
                a = b++;
                id += 3;
            }
            iData[offset++] = o;
            iData[offset++] = a;
            iData[offset++] = o + 2;
        }
        JSB && this._renderData.chunk.setIndexBuffer(iData);
    }
    protected _render(render: any) {
        render.commitComp(this, this._renderData, this._spriteFrame, this._assembler, null);
    }
    protected _canRender(): boolean {
        return super._canRender() && !!(this._spriteFrame?.texture);
    }
}
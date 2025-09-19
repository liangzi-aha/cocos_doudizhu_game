// UserInfoManager.ts
import { _decorator, Component, Node, Button, EditBox, Sprite, SpriteFrame, assetManager, Texture2D, director, UITransform } from 'cc';
import { loadRemoteImg } from '../../Utils/Tools';
const { ccclass, property } = _decorator;

@ccclass('UserInfoManager')
export class UserInfoManager extends Component {

    @property({
        type: Node,
        displayName: '头像节点'
    })
    private avatarNode: Node = null;

    @property({
        type: Node,
        displayName: '头像btn'
    })
    private avatarBtn: Node = null;

    @property({
        type: EditBox,
        displayName: '昵称输入框'
    })
    private nicknameEditBox: EditBox = null;

    @property({
        type: Node,
        displayName: '保存按钮'
    })
    private saveBtn: Node = null;

    nativeButton = null;

    onLoad() {
        this.nicknameEditBox.node.on(EditBox.EventType.TEXT_CHANGED, this.onNicknameInput, this);
        this.saveBtn.on(Node.EventType.TOUCH_END, this.saveUserInfo, this);

        this.updateSaveButtonState();
    }

    // 点击头像上传
    public onChooseAvatar() {
        console.log("点击事件")
        // 创建微信原生按钮
        // this.createWechatNativeButton();
        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            camera: 'back',
            success(res) {
                console.log(res.tempFiles[0].tempFilePath)
                console.log(res.tempFiles[0].size)
            }
        })
    }

    private onNicknameInput(event: EditBox, editbox: EditBox) {
        const nickname = editbox.string.trim();
        wx.setStorageSync('userNickname', nickname);
        this.updateSaveButtonState();
    }

    private updateSaveButtonState() {
        const hasAvatar = wx.getStorageSync('userAvatar');
        const hasNickname = this.nicknameEditBox.string.trim();
        this.saveBtn.getComponent(Button).interactable = !!(hasAvatar && hasNickname);
    }

    private saveUserInfo() {
        const avatarUrl = wx.getStorageSync('userAvatar');
        const nickname = this.nicknameEditBox.string.trim();

        if (!avatarUrl || !nickname) return;

        const userInfo = { avatarUrl, nickname, timestamp: Date.now() };

        // 保存到本地
        wx.setStorageSync('userInfo', userInfo);

        // 发送到服务器
        this.sendUserInfoToServer(userInfo);

        // 提示成功
        wx.showToast({ title: '保存成功', icon: 'success' });
    }

    private sendUserInfoToServer(info: any) {
        console.log('发送用户信息到服务器：', info);
        // wx.request({
        //     url: 'https://your-server-api.com/save-user-info',
        //     method: 'POST',
        //     data: info,
        //     success: (res) => {
        //         console.log('服务器保存成功:', res);
        //     }
        // });
    }

    // 创建微信原生按钮
    private createWechatNativeButton() {
        console.log("createWechatNativeButton")
        // 获取按钮在屏幕中的位置和大小
        const worldPos = this.avatarBtn.getWorldPosition();

        // ✅ 通过UITransform组件获取尺寸
        const uiTransform = this.avatarBtn.getComponent(UITransform);
        const size = uiTransform.contentSize;

        // 转换为微信坐标系（左上角为原点）
        const canvas = director.getScene().getChildByName('Canvas');
        const canvasTransform = canvas.getComponent(UITransform);
        const screenSize = canvasTransform.contentSize;

        // 考虑Canvas缩放
        const scale = canvas.scale;
        const scaleX = scale.x;
        const scaleY = scale.y;

        const left = (worldPos.x + screenSize.width / 2 - size.width / 2) * scaleX;
        const top = (screenSize.height / 2 - worldPos.y - size.height / 2) * scaleY;

        console.log(left, top, size.width * scaleX, size.height * scaleY)

        // 创建微信原生按钮
        this.nativeButton = wx.createUserInfoButton({
            type: 'text',
            text: '测试',
            style: {
                left: 100,
                top: 100,
                width: size.width * scaleX,
                height: size.height * scaleY,
                backgroundColor: '#ff0000', // 红色背景便于查看位置
                color: '#ffffff',
                fontSize: 14, // 增大字体
                borderRadius: 4,
                opacity: 0.8 // 半透明便于查看下方UI
            }
        });

        // 绑定头像选择事件
        this.nativeButton.onTap((res) => {
            console.log('用户选择的头像:', res.avatarUrl);
            this.updateAvatar(res.avatarUrl);
            this.nativeButton.destroy(); // 选择后销毁按钮
        });
    }

    // 更新头像显示
    private updateAvatar(avatarUrl: string) {
        // 保存头像URL到本地
        wx.setStorageSync('userAvatar', avatarUrl);
        if (avatarUrl) {
            // 使用Cocos的资源管理器加载网络图片
            // 注意：微信小游戏需要在域名配置中添加图片域名白名单
            loadRemoteImg(avatarUrl, this.avatarNode);
        }
    }


    public showChangeUserInfoPop() {
        this.node.active = true;
    }
}
//AudioMgr.ts
import { Node, AudioSource, AudioClip, resources, director, assetManager } from 'cc';
/**
 * @en
 * this is a sington class for audio play, can be easily called from anywhere in you project.
 * @zh
 * 这是一个用于播放音频的单件类，可以很方便地在项目的任何地方调用。
 */
export class AudioMgr {
    private static _inst: AudioMgr;

    public static get inst(): AudioMgr {
        if (this._inst == null) {
            console.log('创建音频管理器');
            this._inst = new AudioMgr();
        }
        return this._inst;
    }

    private _audioSource: AudioSource;
    constructor() {
        //@en create a node as audioMgr
        //@zh 创建一个节点作为 audioMgr
        let audioMgr = new Node();
        audioMgr.name = '__audioMgr__';

        //@en add to the scene.
        //@zh 添加节点到场景
        director.getScene().addChild(audioMgr);

        //@en make it as a persistent node, so it won't be destroied when scene change.
        //@zh 标记为常驻节点，这样场景切换的时候就不会被销毁了
        director.addPersistRootNode(audioMgr);

        //@en add AudioSource componrnt to play audios.
        //@zh 添加 AudioSource 组件，用于播放音频。
        this._audioSource = audioMgr.addComponent(AudioSource);
    }

    public get audioSource() {
        return this._audioSource;
    }

    /**
     * @en
     * play short audio, such as strikes,explosions
     * @zh
     * 播放短音频,比如 打击音效，爆炸音效等
     * @param sound clip or url for the audio
     * @param volume 
     */
    playOneShot(sound: AudioClip | string, volume: number = 1.0, directorName = "") {
        if (sound instanceof AudioClip) {
            this._audioSource.playOneShot(sound, volume);
        }
        else {
            resources.load(sound, (err, clip: AudioClip) => {
                if (err) {
                    console.log(err);
                } else {
                    // 传入 directorName 名称，如果是资源加载完成，且当前场景和传入场景名称一致，则播放音频
                    if (!directorName || (directorName && director.getScene().name == directorName)) {
                        this._audioSource.playOneShot(clip, volume);
                    }
                }
            });
        }
    }

    /**
     * @en
     * play long audio, such as the bg music
     * @zh
     * 播放长音频，比如 背景音乐
     * @param sound clip or url for the sound
     * @param volume 
     */
    play(sound: AudioClip | string, volume: number = 1.0, loop: boolean = false, directorName = "") {
        console.log('播放音乐', sound, sound instanceof AudioClip)
        if (sound instanceof AudioClip) {
            // this._audioSource.stop();
            this._audioSource.loop = loop;
            this._audioSource.clip = sound;
            this.audioSource.volume = volume;
            this._audioSource.play();
        } else if (sound?.startsWith('http')) { // 网络音频资源加载
            assetManager.loadRemote(sound, (err, audioClip: AudioClip) => {
                // play audio clip
                if (err) {
                    console.log("音频加载失败", err);
                } else if (!directorName || (directorName && director.getScene().name == directorName)) { // 传入播放音乐的场景名称的话，如果在音频加载期间切换场景的话，音频加载完毕也不播放
                    this._audioSource.loop = loop;
                    this._audioSource.clip = audioClip;
                    this.audioSource.volume = volume;
                    this._audioSource.play();
                }
            });
        } else {
            // 本地音频资源加载
            resources.load(sound, (err, clip: AudioClip) => {
                if (err) {
                    console.log("音频加载失败", err);
                } else if (!directorName || (directorName && director.getScene().name == directorName)) { // 传入播放音乐的场景名称的话，如果在音频加载期间切换场景的话，音频加载完毕也不播放
                    console.log("播放背景音乐")
                    // this._audioSource.stop();
                    this._audioSource.loop = loop;
                    this._audioSource.clip = clip;
                    this.audioSource.volume = volume;
                    this._audioSource.play();
                }
            });
        }
    }

    /**
     * stop the audio play
     */
    stop() {
        console.log('停止音乐');
        this._audioSource.stop();
        // stop 清空 clip
        AudioMgr.inst.audioSource.clip = null;
    }

    /**
     * pause the audio play
     */
    pause() {
        this._audioSource.pause();
    }

    /**
     * resume the audio play
     */
    resume() {
        this._audioSource.play();
    }
}
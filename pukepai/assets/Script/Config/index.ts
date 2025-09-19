const dev = window.CC_DEBUG || true; //   && false

export const CONFIG = {
    API_BASE_URL: dev
        ? 'http://192.168.31.248:3002'
        : 'https://puke.liangziaha.online/api',
    RESOURCE_BASE_URL: dev
        ? 'http://192.168.31.248:3002/static'
        : 'https://puke.liangziaha.online/static',
    // /ws 在nginx代理判断用的，/ws后面的随便
    SOCKET_BASE_URL: dev
        ? 'ws://192.168.31.248:3002/ws'
        : 'wss://puke.liangziaha.online/ws',
};
import { director, sys } from "cc";
import { CommonUIManager } from "../CommonUIManager";
import { CONFIG } from "../Config/index";
import { stringifyParams } from "../../Utils/Tools";

export let loadingCount = 0;

// 接口响应类型
interface responseType {
    code: number,
    message: string,
    data: any,
    token?: string
}

console.log("CONFIG.API_BASE_URL", CONFIG.API_BASE_URL)

class CustomFetch {

    baseUrl = CONFIG.API_BASE_URL
    requestInterceptors = []
    responseInterceptors = []
    constructor() {
        // 请求拦截器数组
        this.requestInterceptors = [];
        // 响应拦截器数组
        this.responseInterceptors = [];
    }

    // 添加请求拦截器
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    // 添加响应拦截器
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }

    // 封装的 fetch 请求方法
    async request(url, options = {}, errMsgTip) {
        let interceptedOptions: any = { ...options };
        // 执行请求拦截器，requestInterceptors 为数组，是可以添加多个请求拦截器，我这里只使用了一个
        for (const interceptor of this.requestInterceptors) {
            interceptedOptions = await interceptor(interceptedOptions);
        }
        let response;
        try {
            if (window.wx) {
                // 发起请求
                response = await new Promise((resolve, reject) => {
                    wx.request({
                        url: this.baseUrl + url,
                        method: interceptedOptions.method,
                        data: JSON.parse(interceptedOptions.body),
                        header: interceptedOptions.headers,
                        success: (res) => {
                            console.log("wx请求成功", res)
                            resolve(res.data)
                        },
                        fail: reject
                    });
                });
            } else {
                response = await fetch(this.baseUrl + url, interceptedOptions);
            }
        } catch (error) {
            console.error('请求失败:', error);
        }

        // 执行响应拦截器
        for (const interceptor of this.responseInterceptors) {
            response = await interceptor(response, errMsgTip);
        }

        return response;
    }
}

// 使用示例
const customFetch = new CustomFetch();
// 不带加载动画请求
const noLoadingFetch = new CustomFetch();

// 添加请求拦截器，在请求头中添加 token
customFetch.addRequestInterceptor((options) => {
    console.log("请求拦截器", options)
    const token = sys.localStorage.getItem("token");
    const newOptions = {
        ...options,
        headers: {
            ...options.headers,
            token: token // 携带token，服务端进行校验
        }
    };
    // 请求拦截添加loading
    loadingCount++;
    CommonUIManager.inst.showLoading("加载中");
    return newOptions;
});

// 添加响应拦截器，处理响应状态码
customFetch.addResponseInterceptor(async (response, errMsgTip) => {
    loadingCount--;
    console.log("响应拦截器", response)
    if (loadingCount == 0) {
        CommonUIManager.inst.hideLoading();
    }
    let data: any = {};
    if (window.wx) {
        data = response;
    } else {
        data = await response.json();
    }
    console.log("响应拦截器", data)
    if (data.code == 401) {
        CommonUIManager.inst.showToast("令牌过期，请重新登录");
        // 可以在这里实现跳转登录页面等逻辑
        director.loadScene('LoginScene');
        sys.localStorage.removeItem("token");
        sys.localStorage.removeItem("userInfo");
    } else if (data.code != 200 && errMsgTip) {
        CommonUIManager.inst.showToast(data.message || "服务器错误");
    }

    return data;
});


// 添加请求拦截器，在请求头中添加 token
noLoadingFetch.addRequestInterceptor((options) => {
    console.log("请求拦截器", options)
    const token = sys.localStorage.getItem("token");
    const newOptions = {
        ...options,
        headers: {
            ...options.headers,
            token: token // 携带token，服务端进行校验
        }
    };
    return newOptions;
});

// 添加响应拦截器，处理响应状态码
noLoadingFetch.addResponseInterceptor(async (response, errMsgTip) => {
    // console.log("响应拦截器", response)
    let data: any = {};
    if (window.wx) {
        data = response;
    } else {
        data = await response.json();
    }
    console.log("响应拦截器", data)
    if (data.code == 401) {
        CommonUIManager.inst.showToast("令牌过期，请重新登录");
        // 可以在这里实现跳转登录页面等逻辑
        director.loadScene('LoginScene');
        sys.localStorage.removeItem("token");
        sys.localStorage.removeItem("userInfo");
    } else if (data.code != 200 && errMsgTip) {
        CommonUIManager.inst.showToast(data.message || "服务器错误");
    }

    return data;
});

// post 请求
export async function post(url = "", data = {}, errMsgTip = true) {
    const response: responseType = (await customFetch.request(url, {
        method: "POST", // *GET, POST, PUT, DELETE, etc.
        mode: "cors", // no-cors, *cors, same-origin
        cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
        // credentials: "same-origin", // same-origin 同源才携带用户凭证例如cookie
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    }, errMsgTip) as any);

    return response;
}

// get 请求
export async function get(url = "", data = {}, errMsgTip = true) {
    if (Object.keys(data).length > 0) {
        url += '?' + stringifyParams(data);
    }

    const response: responseType = (await customFetch.request(url, {
        method: "GET", // *GET, POST, PUT, DELETE, etc.
        mode: "cors", // no-cors, *cors, same-origin
        cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
        // credentials: "same-origin", // same-origin 同源才携带用户凭证例如cookie
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data), // 方便wx调用
    }, errMsgTip) as any);

    return response;
}

// post 请求
export async function noLoadingPost(url = "", data = {}, errMsgTip = true) {
    const response: responseType = (await noLoadingFetch.request(url, {
        method: "POST", // *GET, POST, PUT, DELETE, etc.
        mode: "cors", // no-cors, *cors, same-origin
        cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
        // credentials: "same-origin", // same-origin 同源才携带用户凭证例如cookie
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    }, errMsgTip) as any);

    return response;
}

// get 请求
export async function noLoadingGet(url = "", data = {}, errMsgTip = true) {
    if (Object.keys(data).length > 0) {
        // 微信小游戏不支持，URLSearchParams
        url += '?' + stringifyParams(data);
    }

    const response: responseType = (await noLoadingFetch.request(url, {
        method: "GET", // *GET, POST, PUT, DELETE, etc.
        mode: "cors", // no-cors, *cors, same-origin
        cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
        // credentials: "same-origin", // same-origin 同源才携带用户凭证例如cookie
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data), // 方便wx调用
    }, errMsgTip) as any);

    return response;
}
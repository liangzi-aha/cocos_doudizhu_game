// 返回成功数据类型
declare interface SuccessInfo {
  code: 200;
  data?: any;
  message?: string;
}

// 401 token失效
declare interface Error401 {
  code: 401;
  error: any;
  message?: string;
}

// 400 服务器处理错误
declare interface Error400 {
  code: 400;
  error: any;
  message: string;
}
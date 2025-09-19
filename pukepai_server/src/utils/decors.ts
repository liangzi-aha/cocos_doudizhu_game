import * as glog from 'glob';
import * as Koa from 'koa';
import * as KoaRouter from 'koa-router';
import * as validate from 'validate.js';
import { create, verify } from './token';
import { RoomObj } from './room';
import pool from '../mysql'

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';
type loadOptions = {
  // 路由文件扩展，默认值是js、ts
  extname?: string
}
interface RouteOptions {
  // 适用于比较特殊，需要单独定制前缀
  prefix?: string;
  // 给当前路由添加一个或多个中间件
  middlewares?: Array<Koa.Middleware>;
}

export const router = new KoaRouter();

// 校验权限的中间件 (类的token校验装饰器)
export const authToken = (target) => {
  target.prototype.authToken = (ctx: Koa.Context, next: Koa.Next) => {
    // 从cookie中获取token
    const token = ctx.headers.token;
    const userInfo: any = verify(token) || {}
    if (!verify(token).success) {
      return ctx.body = {
        code: 401,
        error: '',
        message: 'token无效'
      };
    }

    if (ctx.method === 'GET') {
      ctx.query.userInfo = JSON.stringify(userInfo);
    } else if (ctx.method === 'POST') {
      // 权限校验的接口，把用户信息挂载到body
      if (ctx.request.body) {
        ctx.request.body.userInfo = userInfo.decoded;
      } else {
        ctx.request.body = { userInfo: userInfo.decoded }
      }
    }

    return next()
  };
}


// 函数token校验装饰器
export const authTokenFun = (ctx: Koa.Context, next: Koa.Next) => {
  // 从cookie中获取token
  const token = ctx.headers.token;
  if (!verify(token).success) {
    return ctx.body = {
      code: 401,
      error: '',
      message: 'token无效'
    };
  } else {
    return next()
  }
}

// socket 校验token的装饰器
export const authSocketToken = (data: any = {}) => {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args) {
      const { ws, token, params } = args[0];

      // 从cookie中获取token
      if (!verify(token).success) {
        return ws.send(JSON.stringify({
          type: 'out',
          code: 401,
          message: 'token失效'
        }));
      } else if (data.verifyRoomId && !RoomObj[params.roomId]) { // 是否校验房间ID
        return ws.send(JSON.stringify({
          type: "getRoomInfo",
          code: 400,
          message: '房间不存在'
        }));
      } else {
        // 给参数上面添加token解析出来的用户信息，不信任客户端传入的用户信息，再从数据库查询通过用户id查询获取用户信息。
        // const [userInfoDb]: any = await pool.inst.query(`select id, user_id, user_name, user_account, user_head_img, wx_openid, gold from user where user_id = ?`, [verify(token).decoded.user_id]);
        // args[0].userInfo = userInfoDb[0];
        args[0].userInfo = verify(token).decoded;
        return originalMethod.apply(this, args);
      }
    };
    return descriptor;
  };
}

// 这里的核心是router实例是传进来的，单实例大家都有使用一个实例进行注册路由
const decorate = (method: HttpMethod, path: string, options: RouteOptions, router: KoaRouter) => {
  /**
  * 装饰器
  * @param target 目标这里是一个类，类包含了一个方法
  * @param property 该方法名
  * @param descriptor 描述
  */
  return (target, property, descriptor) => {
    // 注意装饰器是,先执行方法装饰器，后执行类的装饰器，所以写在nextTick（下个钩子中运行）
    process.nextTick(() => {
      const middlewares = options?.middlewares || [];
      const url = options?.prefix ? options?.prefix + path : path;
      // 获取类的装饰器，添加类装饰器上的权限校验
      if (target.prototype.authToken) {
        middlewares.unshift(target.prototype.authToken);
      }
      // 把方法本身添加到中间件中
      middlewares.push(target[property]);
      // 把被装饰的方法添加到路由中
      router[method](url, ...middlewares);
    });
  }
}

export const method = method => (path: string, options?: RouteOptions) => decorate(method, path, options, router)

export const get = method('get');
export const post = method('post');
export const put = method('put');
export const Delete = method('delete');
export const patch = method('patch');

// 动态加载所有的路由装饰器，注册路由
export const loader = (folder: string, options: loadOptions = {}): KoaRouter => {
  const extname = options?.extname || '.{js,ts}';
  // glog递归去获取文件
  const files = glog.sync(`${folder}/**/*${extname}`);
  files.forEach(file => require(file));

  return router;
}

/**
 * 校验参数
 * @param data 需要校验的数据
 * @param validateObj 自定义校验规则（不使用默认的）
 * @returns 
 */
export const validateParams = (data: Object, validateObj: Object = {}) => {
  // 自定义参数
  validate.validators.isEmptyString = function (value, options, key, attributes) {
    return value === '' ? '^你个老der在干嘛，传参不能为空啊？' : null;
  };

  // @ts-ignore
  const constraints = {};
  for (let arg in data) {
    constraints[arg] = validateObj[arg] ? validateObj[arg] : { presence: { message: `^老der参数被你吃了,传啊!` }, isEmptyString: true }
  }

  return validate(data, constraints);
}
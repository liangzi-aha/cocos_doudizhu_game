// 使用 ts-node 需要安装 tsconfig-paths 来正确解析路径别名,tsconfig中的别名
import 'tsconfig-paths/register';
import Koa from 'koa';
import { koaBody } from 'koa-body';
import * as serve from 'koa-static';
import * as timing from 'koa-xtime';
import { loader } from './utils/decors'
import * as path from 'path';
import * as mount from 'koa-mount';
import * as KoaCors from 'koa2-cors';
import WebSocketServer from './router/websocket/webSocket';

const app = new Koa();
// 使用 cors 中间件，允许所有域名跨域访问
app.use(KoaCors());
app.use(timing());
// 使用koa-mount设置静态资源的访问前缀
app.use(
  mount(
    '/static',
    serve(path.resolve(__dirname, '../static/'), {
      // 其他选项...
      setHeaders: (res) => {
        // 在这里设置你的响应头（Accept-Ranges 这表示服务器能够处理字节范围请求，解决播放音乐快进重写请求资源导致从头播放）
        res.setHeader('Accept-Ranges', 'bytes');
      }
    })
  )
);

// 解析post请求体
app.use(koaBody());

// 中间件添加router
const router = loader(path.resolve(__dirname, './router'));
// allowedMethods: 将路由挂载到 Koa 应用（接口）
app.use(router.routes()).use(router.allowedMethods());

// 这里我们监听在 3002 端口
let server = app.listen(3002, () => {
  console.log('server start');
});

// 创建 WebSocket 服务器并将其挂载到 HTTP 服务器上
WebSocketServer.init(server);

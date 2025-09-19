import * as Koa from 'koa';
import { get, post, validateParams } from '../utils/decors';
import pool from '../mysql'
import axios from 'axios';
import { create } from '../utils/token'
import { v4 } from 'uuid'

// 微信小游戏的appid和appsecret
const GameAppID = "GameAppID";
const GameAppSecret = "GameAppSecret";

// 微信
export default class wxApi {
  // code 换取 openid
  @post('/codeGetOpenId')
  public static async codeGetOpenId(ctx: Koa.Context) {
    // 获取参数
    const { code, getRegister }: any = ctx.request.body || {};

    console.log(code)

    const validateRet = validateParams({ code });
    if (validateRet) { return ctx.body = { code: 400, error: validateRet, message: '参数错误' } };

    try {
      // 调用微信 jscode2session 接口
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${GameAppID}&secret=${GameAppSecret}&js_code=${code}&grant_type=authorization_code`;
      const response = await axios.get(url);

      console.log(response.data)

      const { openid, session_key } = response.data;

      let userRows;
      if (getRegister) {
        // 查询数据库，判断用户是否存在，不存在客户端获取用户信息传递给服务端
        [userRows] = await pool.inst.query(`select * from user where wx_openid = ?`, [openid])
      }


      // 返回 openid 和 session_key 给前端（注意：session_key 不能泄露给前端）
      ctx.body = {
        code: 200,
        data: Object.assign({
          openid,
        }, getRegister ? { isRegister: userRows.length > 0 } : {}),
      };
    } catch (error) {
      console.error('调用微信接口失败:', error);
      ctx.body = { code: 400, error, message: '调用微信接口失败' }
    }
  }


  // 微信登录
  @post('/wxLogin')
  public static async wxLogin(ctx: Koa.Context) {
    const { openid, wxUserInfo } = ctx.request.body || {};

    // 查询数据库，判断用户是否存在，不存在 则注册，存在则登录
    const [rows] = await pool.inst.query(`select id, user_id, user_name, user_account, user_head_img, wx_openid, gold from user where wx_openid = ?`, [openid])

    // @ts-ignore
    if (rows.length > 0) {
      wxApi.wxOpenIdLogin(ctx, openid, rows)
    } else {
      // 微信注册账号
      const idWithoutDashes = v4().replace(/-/g, '');
      await pool.inst.query(`insert into user (user_name, user_id,  user_head_img, wx_openid) values (?,?,?,?)`, [wxUserInfo.nickName, idWithoutDashes, wxUserInfo.avatarUrl, openid]);
      wxApi.wxOpenIdLogin(ctx, openid)
    }
  }

  /**
   * 通过wxopenid 查询用户并登录
   * @param ctx 
   * @param openid 
   * @param userRows 传来查询的用户数据，不在进行查询
   */
  public static async wxOpenIdLogin(ctx: Koa.Context, openid, userRows?) {
    var rows: any = userRows
    if (!rows) {
      // 查询数据库，判断用户是否存在，不存在 则注册，存在则登录
      [rows] = await pool.inst.query(`select id, user_id, user_name, user_account, user_head_img, wx_openid, gold from user where wx_openid = ?`, [openid])
    }

    // @ts-ignore
    if (rows.length > 0) {
      // 登录成功签名生成token
      let token = create({ ...rows[0] });
      ctx.cookies.set('token', token, {
        maxAge: 24 * 60 * 60 * 1000, // 有效期为24小时
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 过期时间
        httpOnly: false, // 仅服务器可以访问Cookie
        path: '/', // Cookie的路径
        // domain: 'example.com', // Cookie的域名
        // secure: true, // 仅在HTTPS下传输Cookie
        overwrite: true // 是否覆盖同名Cookie
      });
      ctx.body = {
        code: 200,
        data: rows[0],
        token,
        message: '登录成功'
      }
    }
  }


}
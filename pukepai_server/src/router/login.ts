import * as Koa from 'koa';
import { v4 } from 'uuid'
import { post, validateParams } from '../utils/decors';
import pool from '../mysql'
import { create } from '../utils/token'

/**
 * 游客登录：游客登录采用账号密码登录模式，游客登录时，需要先注册账号，再登录
 * 微信登录：微信登录时，可以直接登录（是否要绑定游客数据）
 */

// 登录注册
export default class Login {
  // 游客登录注册用户
  @post('/registerUser')
  public static async registerUser(ctx: Koa.Context) {
    const { userAccount, userPassword, userHeadImg = "/Image/default_head.png", openId = "" } = ctx.request.body || {};

    const validateRet = validateParams({ userAccount, userPassword });
    if (validateRet) { return ctx.body = { code: 400, error: validateRet, message: '参数错误' } };

    try {
      // 查找账号是否已存在
      const [rows] = await pool.inst.query(`select * from user where user_account = ? `, [userAccount])
      // @ts-ignore
      if (rows?.length > 0) {
        return ctx.body = {
          code: 400,
          error: '',
          message: '账号已存在'
        }
      }

      // 注册
      const idWithoutDashes = v4().replace(/-/g, '');
      const userName = `liang_${idWithoutDashes}`
      await pool.inst.query(`insert into user (user_name, user_id, user_account, user_password, user_head_img, wx_openid) values (?,?,?,?,?,?)`, [userName, idWithoutDashes, userAccount, userPassword, userHeadImg, openId])
      ctx.body = {
        code: 200,
        message: '注册成功'
      };
    } catch (error) {
      ctx.body = {
        code: 400,
        error: error,
        message: '注册失败'
      }
    }
  }

  // 登录
  @post('/login')
  public static async login(ctx: Koa.Context) {
    const { userAccount, userPassword } = ctx.request.body || {};
    const validateRet = validateParams({ userAccount, userPassword });
    if (validateRet) { return ctx.body = { code: 400, error: validateRet, message: '参数错误' } };

    try {
      const [rows] = await pool.inst.query(`select id, user_id, user_name, user_account, user_head_img, wx_openid, gold from user where user_account = ? and user_password = ?`, [userAccount, userPassword])
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
      } else {
        ctx.body = {
          code: 400,
          error: '',
          message: '账号或密码错误'
        }
      }
    } catch (error) {
      ctx.body = {
        code: 400,
        error: error,
        message: '服务器错误'
      }
    }
  }
}
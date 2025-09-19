import * as Koa from 'koa';
import { v4 } from 'uuid'
import { post, validateParams, authToken } from '../utils/decors';
import pool from '../mysql'
import { create } from '../utils/token'

// 获取用户信息校验token
@authToken
export default class User {

  // 获取用户信息
  @post('/getRoomLevel')
  public static async getRoomLevel(ctx: Koa.Context) {
    const body = ctx.request.body || {};

    try {
      const [rows] = await pool.inst.query(`select id, level, base from room_level`)
      // @ts-ignore
      if (rows.length > 0) {
        ctx.body = {
          code: 200,
          data: rows,
          message: '成功'
        }
      } else {
        ctx.body = {
          code: 400,
          error: '',
          message: '获取失败'
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
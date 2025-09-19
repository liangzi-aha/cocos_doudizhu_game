import * as mysql from 'mysql2/promise';

// 单例模式
export default class mysqlPool {

  // 私有静态实例
  private static _inst = null;

  public static get inst(): mysql.Pool {
    if (!this._inst) {
      this._inst = this.createPool();
    }
    return this._inst;
  }
  private static createPool() {
    return mysql.createPool({
      host: process.env.DOCKER_MYSQL || 'localhost',
      user: 'root',
      password: "liangziaha0204", // mysql 密码
      database: 'playing_card',
      port: 3306,
      waitForConnections: true,
      connectionLimit: 10, // 连接池最大连接数量
      maxIdle: 10, // 最大空闲连接数，默认值与‘ connectionLimit ’相同
      idleTimeout: 60000, // 空闲连接超时，单位为毫秒，默认值60000
      queueLimit: 0,
      enableKeepAlive: true, // 启用keeplive
      keepAliveInitialDelay: 0, // keepAlive初始延迟
    });
  }
}

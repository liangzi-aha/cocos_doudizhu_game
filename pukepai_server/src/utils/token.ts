// 封装生成token，解析token方法
import * as jwt from 'jsonwebtoken';
// 配置jsonwebtoken生成token所需的secret，secret为加密密钥，不能泄露给其他人使用。
const secret = '李勇良';

export const create = (obj) => {
  if (obj) {
    // 返回加密的token
    // 设置加密内容 加上 secret（秘密）生产token
    return jwt.sign(obj, secret, { expiresIn: '24h' });
  }
  return null; // 如果 obj 为空，返回 null 或其他适当的值
};

export const verify = (token) => {
  if (token) {
    try {
      // 返回解密的token
      const decoded = jwt.verify(token, secret);
      return {
        success: true,
        decoded
      };
    } catch (err) {
      return { success: false };
    }
  }
  return { success: false }; // 如果 token 为空，返回失败
};
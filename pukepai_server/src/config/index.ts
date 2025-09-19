
// 环境变量详细
const env = {
  'production': {
    'PUBLIC_FILE_BASE_URL': 'https://liangziaha.online'
  },
  'development': {
    'PUBLIC_FILE_BASE_URL': 'http://localhost:3000'
  }
}

export default env[process.env.NODE_ENV || 'development']
# 打包依赖镜像，该镜像包含了nodejs 和 pm2
FROM keymetrics/pm2:18-alpine
# 设置docker容器内项目连接mysql容器的环境变量（容器名称）
ENV DOCKER_MYSQL=mysql_server
# 用于设置容器内的当前工作目录，如果目录不存在的话会去创建
WORKDIR /project/pukepai_server
# 把源代码复制到镜像
COPY . /project/pukepai_server
# 在project目录下执行命令
RUN npm config set registry https://registry.npmmirror.com \
 && npm i && npm run build
# 暴露端口 3002 (http服务和websocket服务共享一个端口)
EXPOSE 3002
CMD ["pm2-runtime","start","pm2.json"]
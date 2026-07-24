# 联网 AI 后端

## 1. 安装

```bash
npm install
```

## 2. 配置密钥

复制 `.env.example` 为 `.env`，设置：

```bash
OPENAI_API_KEY=你的密钥
OPENAI_MODEL=gpt-5
PORT=3000
```

不要把 `.env` 提交到 Git，也不要把 API Key 写入 iOS 项目。

## 3. 启动

```bash
set -a
source .env
set +a
npm start
```

## 4. iPhone App 配置

部署到支持 HTTPS 的服务器后，在 App 的“我的 → 联网 AI”中填写：

```text
https://你的域名/api/health-analysis
```

本地 Mac 测试时，可以临时使用局域网地址，但 iOS 的 App Transport Security 默认要求 HTTPS。生产环境应使用有效 HTTPS 域名。

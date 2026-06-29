# cc-connect 捕获指南

EchoNote V1 使用普通微信 + cc-connect + 本机 Agent 的个人链路。Web 应用本身不直接对接微信平台。

## 链路

```text
普通微信消息 #
-> cc-connect / ilink
-> 本机 Agent
-> POST /api/inlets/agent-capture
-> PostgreSQL
```

## 触发规则

只有消息末尾带 `#` 时，才保存为小记。

示例：

```text
明天早上先处理部署脚本 #
这句话以后可能可以写进文章里 #
```

接口会自动去掉末尾的 `#` 和空白。

## Agent 指令草案

可以给 cc-connect 连接的本机 Agent 使用这段指令：

```text
当允许的微信发送者发来的消息以 # 结尾时，把它视为 EchoNote 小记捕获请求。
去掉末尾 # 和前后空白。
调用 ECHONOTE_CAPTURE_URL，Header 使用 Authorization: Bearer ECHONOTE_CAPTURE_TOKEN。
JSON 请求体为：{ "content": cleanedContent, "rawMessage": originalMessage, "clientCreatedAt": 当前 ISO 时间 }。
请求成功时只回复：已收下
请求失败时只回复：没收好，稍后再试
不以 # 结尾的消息是普通对话，不要保存到 EchoNote。
```

## API

```http
POST /api/inlets/agent-capture
Authorization: Bearer <CAPTURE_TOKEN>
Content-Type: application/json
```

```json
{
  "content": "记录不是整理，是给灵感留门 #",
  "rawMessage": "记录不是整理，是给灵感留门 #",
  "clientCreatedAt": "2026-06-27T12:00:00+08:00"
}
```

## 安全原则

- `CAPTURE_TOKEN` 只能放在本机或服务器环境变量里。
- cc-connect 侧使用 `allow_from` 限制只有你的微信身份能触发。
- 不要把 token 写进 Git、文档、截图或聊天记录。

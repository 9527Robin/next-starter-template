# 🔧 WebSocket错误排查指南

## 常见错误及解决方案

### 1. "WebSocket is closed before the connection is established"

**原因**: WebSocket连接在建立前就被关闭了

**解决方案**:

- 确保服务器正确处理WebSocket升级请求
- 检查是否在发送数据前等待连接建立
- 查看浏览器控制台的具体错误信息

### 2. "Expected Upgrade: websocket" (426错误)

**原因**: 请求没有包含正确的升级头

**解决方案**:

- 确保浏览器支持WebSocket
- 检查代理或负载均衡器是否正确转发WebSocket请求
- 如果在Cloudflare Workers上，确保环保与`wrangler.jsonc`配置正确

### 3. 连接后立即断开

**原因**:

- 事件监听器未正确绑定
- 服务器未正确返回101响应
- WebSocketPair API调用失败

**解决方案**:

- 查看服务器日志中的错误信息
- 确保使用`@ts-ignore`注释处理Cloudflare特定的API
- 验证`WebSocketPair`在全局作用域中可用

### 4. 消息无法发送

**原因**:

- 连接未完全建立
- 连接状态检查失败
- JSON序列化错误

**解决方案**:

```javascript
// 发送前检查连接状态
if (ws.readyState === WebSocket.OPEN) {
  ws.send(JSON.stringify(message));
}
```

## 调试步骤

### 步骤1: 检查浏览器控制台

```bash
# 打开浏览器开发者工具 (F12)
# 查看 Console 标签页的错误信息
# 查看 Network 标签页的 WebSocket 连接状态
```

### 步骤2: 检查服务器日志

```bash
# 运行开发服务器
yarn dev

# 检查是否有错误消息
# 查找 "❌" 标记的错误日志
```

### 步骤3: 使用WebSocket测试工具

使用浏览器插件或命令行工具测试WebSocket连接：

```bash
# 使用 websocat (需要安装)
websocat ws://localhost:3000/api/card-game

# 或使用 curl (如果支持)
curl --include \
     --no-buffer \
     --header "Connection: Upgrade" \
     --header "Upgrade: websocket" \
     --header "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
     --header "Sec-WebSocket-Version: 13" \
     http://localhost:3000/api/card-game
```

### 步骤4: 启用详细日志

在客户端代码中添加更多日志：

```typescript
const ws = new WebSocket(wsUrl);

ws.addEventListener("open", () => {
  console.log("✅ WebSocket opened");
  console.log("Ready state:", ws.readyState);
});

ws.addEventListener("message", (event) => {
  console.log("📨 Message received:", event.data);
});

ws.addEventListener("error", (event) => {
  console.error("❌ WebSocket error:", event);
  console.error("Error code:", event.code);
});

ws.addEventListener("close", (event) => {
  console.log("⚠️ WebSocket closed");
  console.log("Close code:", event.code);
  console.log("Close reason:", event.reason);
});
```

## 环境特定问题

### 本地开发 (Next.js dev)

**可能问题**:

- WebSocketPair可能不可用
- 快速刷新可能断开连接

**解决方案**:

- 使用条件检查: `if (typeof WebSocketPair !== 'undefined')`
- 禁用快速刷新或重新连接逻辑

### Cloudflare Workers部署

**可能问题**:

- Durable Objects需要特殊配置
- 长连接可能有时间限制

**解决方案**:

- 检查`wrangler.jsonc`配置
- 实现心跳/ping-pong机制保活连接
- 使用Durable Objects管理WebSocket连接

## 监控连接状态

查看当前连接情况的代码示例：

```typescript
// 在开发者工具中执行
// 查看连接数和玩家数

fetch("/api/card-game", {
  method: "GET",
  headers: { Upgrade: "websocket" },
}).catch((err) => console.log("Server status check:", err));
```

## 性能优化

如果在多个连接时遇到问题：

1. **批量广播**:
   - 减少消息发送频率
   - 合并多个更新为单个消息

2. **连接池**:
   - 限制最大并发连接数
   - 实现连接超时机制

3. **消息压缩**:
   - 对大型JSON消息进行压缩
   - 使用二进制格式而不是JSON

## 获取帮助

如果问题仍未解决：

1. 检查项目的GitHub Issues
2. 查看Cloudflare Workers文档
3. 检查Next.js WebSocket支持文档
4. 在浏览器控制台中运行诊断脚本

## 诊断脚本

复制以下代码到浏览器控制台以获取诊断信息：

```javascript
console.group("🔍 WebSocket诊断信息");
console.log("协议:", window.location.protocol);
console.log("主机:", window.location.host);
console.log("WebSocket构造函数:", typeof WebSocket);
console.log("WebSocketPair构造函数:", typeof WebSocketPair);
console.group("浏览器支持:");
console.log("Worker support:", typeof Worker !== "undefined");
console.log(
  "SharedArrayBuffer support:",
  typeof SharedArrayBuffer !== "undefined",
);
console.groupEnd();
console.groupEnd();
```

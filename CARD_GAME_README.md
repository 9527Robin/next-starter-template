# 🃏 多人打牌计数器

一个支持WebSocket实时同步的多人打牌计数器应用，使用Next.js构建。

## 功能特性

✨ **实时同步** - 基于WebSocket的多设备实时同步  
👥 **多人游戏** - 支持多个玩家同时参与  
📊 **排行榜** - 实时排行榜显示玩家排名  
🎯 **灵活计分** - 支持+1, +5, +10, -1, -5, -10等快速操作  
🎨 **美观界面** - 渐变背景和玻璃态UI设计  
🔄 **游戏重置** - 一键重置所有玩家分数

## 快速开始

### 安装依赖

```bash
npm install
# 或
yarn install
```

### 开发模式运行

```bash
npm run dev
# 或
yarn dev
```

访问 `http://localhost:3000` 查看应用。

## 使用说明

1. **添加玩家** - 在顶部输入框输入玩家名字，点击"加入游戏"
2. **更新分数** - 点击玩家卡片上的按钮快速加减分数
3. **查看排行** - 玩家按分数从高到低排序，前三名显示奖牌
4. **重置游戏** - 点击"重置游戏"将所有玩家分数恢复为0
5. **移除玩家** - 点击玩家卡片的"移除玩家"按钮删除该玩家

## 技术栈

- **Next.js** - React框架
- **WebSocket** - 实时通信
- **Tailwind CSS** - 样式设计
- **TypeScript** - 类型安全

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   └── card-game/
│   │       └── route.ts          # WebSocket服务器
│   ├── page.tsx                   # 主页面
│   └── globals.css               # 全局样式
├── components/
│   └── CardGameCounter.tsx        # 计数器组件
```

## WebSocket消息格式

### 客户端发送消息

**加入游戏**

```json
{
  "type": "join",
  "playerId": "player-xxx",
  "playerName": "玩家名字"
}
```

**更新分数**

```json
{
  "type": "update-score",
  "playerId": "player-xxx",
  "score": 100
}
```

**重置游戏**

```json
{
  "type": "reset-game"
}
```

**移除玩家**

```json
{
  "type": "remove-player",
  "playerId": "player-xxx"
}
```

### 服务器广播消息

**初始化**

```json
{
  "type": "init",
  "players": [...],
  "roomId": "default-room"
}
```

**玩家加入**

```json
{
  "type": "player-joined",
  "player": {
    "id": "player-xxx",
    "name": "玩家名字",
    "score": 0,
    "timestamp": 1234567890
  }
}
```

**分数更新**

```json
{
  "type": "score-updated",
  "playerId": "player-xxx",
  "score": 100
}
```

**游戏重置**

```json
{
  "type": "game-reset"
}
```

**玩家移除**

```json
{
  "type": "player-removed",
  "playerId": "player-xxx"
}
```

## 部署到Cloudflare Workers

该项目已配置为在Cloudflare Workers上运行：

```bash
npm run deploy
```

## 许可证

MIT

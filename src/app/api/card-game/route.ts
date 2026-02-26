// 存储所有活跃的WebSocket连接
const connections = new Set<WebSocket>();
// 存储游戏状态
let gameState = {
  players: new Map<
    string,
    {
      id: string;
      name: string;
      score: number;
      timestamp: number;
    }
  >(),
  roomId: "default-room",
  lastUpdated: Date.now(),
};

export async function GET(request: Request) {
  const upgrade = request.headers.get("upgrade");

  if (upgrade !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  let webSocketPair: any;

  // 检查是否在Cloudflare Workers环境
  if (typeof WebSocketPair !== "undefined") {
    // @ts-ignore - Cloudflare Workers环境
    webSocketPair = new WebSocketPair();
  } else if (
    typeof globalThis !== "undefined" &&
    "WebSocketPair" in globalThis
  ) {
    // @ts-ignore - 备用检查
    webSocketPair = new globalThis.WebSocketPair();
  } else {
    return new Response("WebSocket not supported in this environment", {
      status: 400,
    });
  }

  const [client, server] = Object.values(webSocketPair) as any[];

  // 将连接添加到Set中
  connections.add(server as unknown as WebSocket);

  // 发送欢迎消息和当前游戏状态
  try {
    const playersArray = Array.from(gameState.players.values());
    (server as any).send(
      JSON.stringify({
        type: "init",
        players: playersArray,
        roomId: gameState.roomId,
      }),
    );
  } catch (error) {
    console.error("❌ Error sending init message:", error);
  }

  // 处理客户端消息
  (server as any).addEventListener("message", (event: any) => {
    try {
      const message = JSON.parse(event.data);
      console.log("📨 Received message:", message.type);

      switch (message.type) {
        case "join":
          gameState.players.set(message.playerId, {
            id: message.playerId,
            name: message.playerName,
            score: 0,
            timestamp: Date.now(),
          });
          console.log("✅ Player joined:", message.playerName);
          broadcastToAll({
            type: "player-joined",
            player: gameState.players.get(message.playerId),
          });
          break;

        case "update-score":
          const player = gameState.players.get(message.playerId);
          if (player) {
            player.score = message.score;
            player.timestamp = Date.now();
            console.log(`📊 Score updated: ${player.name} = ${message.score}`);
            broadcastToAll({
              type: "score-updated",
              playerId: message.playerId,
              score: message.score,
            });
          }
          break;

        case "reset-game":
          gameState.players.forEach((player) => {
            player.score = 0;
          });
          console.log("🔄 Game reset");
          broadcastToAll({
            type: "game-reset",
          });
          break;

        case "remove-player":
          const removedPlayer = gameState.players.get(message.playerId);
          gameState.players.delete(message.playerId);
          console.log("❌ Player removed:", removedPlayer?.name);
          broadcastToAll({
            type: "player-removed",
            playerId: message.playerId,
          });
          break;

        default:
          console.warn("⚠️ Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("❌ WebSocket message error:", error);
    }
  });

  (server as any).addEventListener("close", () => {
    console.log("⚠️ WebSocket closed");
    connections.delete(server as unknown as WebSocket);
  });

  (server as any).addEventListener("error", (event: any) => {
    console.error("❌ WebSocket error:", event);
    connections.delete(server as unknown as WebSocket);
  });

  // @ts-ignore - webSocket来自Cloudflare Workers运行时
  return new Response(null, {
    status: 101,
    webSocket: client as any,
  });
}

function broadcastToAll(message: any) {
  const data = JSON.stringify(message);
  const failedConnections: WebSocket[] = [];

  connections.forEach((ws) => {
    try {
      // 检查连接状态
      if (
        ws.readyState === undefined ||
        ws.readyState === 1 ||
        ws.readyState === WebSocket.OPEN
      ) {
        ws.send(data);
      } else {
        failedConnections.push(ws);
      }
    } catch (error) {
      console.error("Broadcast error:", error);
      failedConnections.push(ws);
    }
  });

  // 清理断开的连接
  failedConnections.forEach((ws) => {
    connections.delete(ws);
  });
}

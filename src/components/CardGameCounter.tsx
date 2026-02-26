"use client";

import { useState, useEffect, useRef } from "react";

interface Player {
  id: string;
  name: string;
  score: number;
  timestamp: number;
}

export default function CardGameCounter() {
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [newPlayerName, setNewPlayerName] = useState("");
  const [playerId] = useState(() => `player-${Date.now()}-${Math.random()}`);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // 连接到WebSocket服务器
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000;
    let usePolling = false; // 标志是否使用polling模式

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const ws = new WebSocket(
          `${protocol}://${window.location.host}/api/card-game`,
        );

        ws.onopen = () => {
          setConnected(true);
          reconnectAttempts = 0;
          usePolling = false;
          console.log("✅ WebSocket connected");
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            switch (message.type) {
              case "init":
                const playerMap = new Map<string, Player>();
                message.players.forEach((player: Player) => {
                  playerMap.set(player.id, player);
                });
                setPlayers(playerMap);
                break;

              case "player-joined":
                setPlayers((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(message.player.id, message.player);
                  return newMap;
                });
                break;

              case "score-updated":
                setPlayers((prev) => {
                  const newMap = new Map(prev);
                  const player = newMap.get(message.playerId);
                  if (player) {
                    player.score = message.score;
                    newMap.set(message.playerId, { ...player });
                  }
                  return newMap;
                });
                break;

              case "game-reset":
                setPlayers((prev) => {
                  const newMap = new Map(prev);
                  newMap.forEach((player) => {
                    player.score = 0;
                  });
                  return newMap;
                });
                break;

              case "player-removed":
                setPlayers((prev) => {
                  const newMap = new Map(prev);
                  newMap.delete(message.playerId);
                  return newMap;
                });
                break;
            }
          } catch (error) {
            console.error("❌ Error parsing WebSocket message:", error);
          }
        };

        ws.onerror = (event) => {
          setConnected(false);
          console.error("❌ WebSocket error:", event);
        };

        ws.onclose = () => {
          setConnected(false);
          console.log("⚠️ WebSocket disconnected");

          // 尝试重新连接
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(
              `Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts}...`,
            );
            reconnectTimeout = setTimeout(() => {
              connectWebSocket();
            }, reconnectDelay);
          } else {
            console.warn(
              "❌ Failed to connect with WebSocket, falling back to polling mode",
            );
            usePolling = true;
            setConnected(true); // 在polling模式中也显示已连接
            startPolling();
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error("❌ Error creating WebSocket:", error);
        setConnected(false);
      }
    };

    const startPolling = () => {
      // 定期轮询获取游戏状态
      const pollInterval = setInterval(() => {
        if (usePolling && wsRef.current === null) {
          fetch("/api/card-game/state")
            .then((res) => res.json() as Promise<any>)
            .then((data) => {
              const playerMap = new Map<string, Player>();
              data.players.forEach((player: Player) => {
                playerMap.set(player.id, player);
              });
              setPlayers(playerMap);
            })
            .catch((err) => console.error("Polling error:", err));
        }
      }, 1000);

      return () => clearInterval(pollInterval);
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      wsRef.current?.close();
    };
  }, []);

  const addPlayer = () => {
    if (!newPlayerName.trim() || !connected) {
      console.warn("⚠️ Cannot add player: not connected or empty name");
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // WebSocket模式
      try {
        wsRef.current.send(
          JSON.stringify({
            type: "join",
            playerId,
            playerName: newPlayerName,
          }),
        );
        setNewPlayerName("");
      } catch (error) {
        console.error("❌ Error sending join message:", error);
      }
    } else {
      // HTTP Polling模式
      fetch("/api/card-game/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "join",
          playerId,
          playerName: newPlayerName,
        }),
      })
        .then((res) => res.json() as Promise<any>)
        .then((data) => {
          if (data.success) {
            const playerMap = new Map<string, Player>();
            data.players.forEach((player: Player) => {
              playerMap.set(player.id, player);
            });
            setPlayers(playerMap);
            setNewPlayerName("");
          }
        })
        .catch((error) => console.error("❌ Error adding player:", error));
    }
  };

  const updateScore = (playerId: string, delta: number) => {
    if (!connected) {
      console.warn("⚠️ Cannot update score: not connected");
      return;
    }

    const player = players.get(playerId);
    if (!player) return;

    const newScore = Math.max(0, player.score + delta);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // WebSocket模式
      try {
        wsRef.current.send(
          JSON.stringify({
            type: "update-score",
            playerId,
            score: newScore,
          }),
        );
      } catch (error) {
        console.error("❌ Error sending score update:", error);
      }
    } else {
      // HTTP Polling模式
      fetch("/api/card-game/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "update-score",
          playerId,
          score: newScore,
        }),
      })
        .then((res) => res.json() as Promise<any>)
        .then((data) => {
          if (data.success) {
            const playerMap = new Map<string, Player>();
            data.players.forEach((player: Player) => {
              playerMap.set(player.id, player);
            });
            setPlayers(playerMap);
          }
        })
        .catch((error) => console.error("❌ Error updating score:", error));
    }
  };

  const resetGame = () => {
    if (!connected) {
      console.warn("⚠️ Cannot reset game: not connected");
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // WebSocket模式
      try {
        wsRef.current.send(
          JSON.stringify({
            type: "reset-game",
          }),
        );
      } catch (error) {
        console.error("❌ Error sending reset message:", error);
      }
    } else {
      // HTTP Polling模式
      fetch("/api/card-game/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reset-game",
        }),
      })
        .then((res) => res.json() as Promise<any>)
        .then((data) => {
          if (data.success) {
            const playerMap = new Map<string, Player>();
            data.players.forEach((player: Player) => {
              playerMap.set(player.id, player);
            });
            setPlayers(playerMap);
          }
        })
        .catch((error) => console.error("❌ Error resetting game:", error));
    }
  };

  const removePlayer = (id: string) => {
    if (!connected) {
      console.warn("⚠️ Cannot remove player: not connected");
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // WebSocket模式
      try {
        wsRef.current.send(
          JSON.stringify({
            type: "remove-player",
            playerId: id,
          }),
        );
      } catch (error) {
        console.error("❌ Error sending remove player message:", error);
      }
    } else {
      // HTTP Polling模式
      fetch("/api/card-game/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "remove-player",
          playerId: id,
        }),
      })
        .then((res) => res.json() as Promise<any>)
        .then((data) => {
          if (data.success) {
            const playerMap = new Map<string, Player>();
            data.players.forEach((player: Player) => {
              playerMap.set(player.id, player);
            });
            setPlayers(playerMap);
          }
        })
        .catch((error) => console.error("❌ Error removing player:", error));
    }
  };

  const sortedPlayers = Array.from(players.values()).sort(
    (a, b) => b.score - a.score,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* 标题和连接状态 */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">🃏 打牌计数器</h1>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-4 h-4 rounded-full ${
                  connected ? "bg-green-500 animate-pulse" : "bg-red-500"
                }`}
              ></div>
              <span className="text-white font-semibold">
                {connected ? "✅ 已连接" : "❌ 未连接"}
              </span>
            </div>
            {!connected && (
              <span className="text-sm text-orange-300">
                正在尝试重新连接...
              </span>
            )}
          </div>
        </div>

        {/* 添加玩家面板 */}
        <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-lg p-6 mb-8 border border-white border-opacity-20">
          <h2 className="text-xl font-bold text-white mb-4">添加玩家</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addPlayer()}
              placeholder="输入玩家名字..."
              className="flex-1 px-4 py-2 rounded-lg bg-white bg-opacity-90 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              disabled={!connected}
            />
            <button
              onClick={addPlayer}
              disabled={!connected || !newPlayerName.trim()}
              className="px-6 py-2 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-400 text-gray-900 font-bold rounded-lg transition-colors"
            >
              加入游戏
            </button>
            <button
              onClick={resetGame}
              disabled={!connected || players.size === 0}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-bold rounded-lg transition-colors"
            >
              重置游戏
            </button>
          </div>
        </div>

        {/* 玩家排行榜 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPlayers.map((player, index) => (
            <div
              key={player.id}
              className="bg-white bg-opacity-10 backdrop-blur-lg rounded-lg p-6 border border-white border-opacity-20 transform transition-transform hover:scale-105"
            >
              {/* 排名 */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">{player.name}</h3>
                <span className="text-3xl font-bold text-yellow-300">
                  {index === 0 && "🥇"}
                  {index === 1 && "🥈"}
                  {index === 2 && "🥉"}
                </span>
              </div>

              {/* 分数显示 */}
              <div className="text-5xl font-bold text-center text-blue-300 mb-6">
                {player.score}
              </div>

              {/* 控制按钮 */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  onClick={() => updateScore(player.id, 1)}
                  className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors"
                >
                  +1
                </button>
                <button
                  onClick={() => updateScore(player.id, 5)}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-colors"
                >
                  +5
                </button>
                <button
                  onClick={() => updateScore(player.id, 10)}
                  className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-lg transition-colors"
                >
                  +10
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  onClick={() => updateScore(player.id, -1)}
                  className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors"
                >
                  -1
                </button>
                <button
                  onClick={() => updateScore(player.id, -5)}
                  className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-colors"
                >
                  -5
                </button>
                <button
                  onClick={() => updateScore(player.id, -10)}
                  className="px-3 py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-lg transition-colors"
                >
                  -10
                </button>
              </div>

              {/* 删除按钮 */}
              <button
                onClick={() => removePlayer(player.id)}
                className="w-full px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
              >
                移除玩家
              </button>
            </div>
          ))}
        </div>

        {/* 空状态提示 */}
        {players.size === 0 && (
          <div className="text-center py-16">
            <p className="text-xl text-gray-300">
              还没有玩家加入，快添加一个开始游戏吧！
            </p>
          </div>
        )}

        {/* 玩家数统计 */}
        {players.size > 0 && (
          <div className="mt-8 text-center text-gray-300">
            <p className="text-lg">
              当前游戏中有{" "}
              <span className="font-bold text-yellow-300">{players.size}</span>{" "}
              位玩家
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

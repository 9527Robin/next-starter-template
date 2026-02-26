import type { NextRequest } from "next/server";

// 共享游戏状态（临时存储在内存中）
export const gameState = {
  players: new Map<
    string,
    {
      id: string;
      name: string;
      score: number;
      timestamp: number;
    }
  >(),
};

export async function GET(request: NextRequest) {
  try {
    const playersArray = Array.from(gameState.players.values());
    return Response.json({
      success: true,
      players: playersArray,
    });
  } catch (error) {
    console.error("❌ Error getting game state:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to get game state",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = (await request.json()) as any;

    switch (data.type) {
      case "join":
        gameState.players.set(data.playerId, {
          id: data.playerId,
          name: data.playerName,
          score: 0,
          timestamp: Date.now(),
        });
        console.log("✅ Player joined:", data.playerName);
        break;

      case "update-score":
        const player = gameState.players.get(data.playerId);
        if (player) {
          player.score = data.score;
          player.timestamp = Date.now();
          console.log(`📊 Score updated: ${player.name} = ${data.score}`);
        }
        break;

      case "reset-game":
        gameState.players.forEach((player) => {
          player.score = 0;
        });
        console.log("🔄 Game reset");
        break;

      case "remove-player":
        const removedPlayer = gameState.players.get(data.playerId);
        gameState.players.delete(data.playerId);
        console.log("❌ Player removed:", removedPlayer?.name);
        break;

      default:
        console.warn("⚠️ Unknown action type:", data.type);
    }

    return Response.json({
      success: true,
      players: Array.from(gameState.players.values()),
    });
  } catch (error) {
    console.error("❌ Error processing action:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to process action",
      },
      { status: 500 },
    );
  }
}

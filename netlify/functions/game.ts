import type { Context } from "@netlify/functions";
import {
  createRoom,
  joinRoom,
  mutateGame,
  startNextRound,
  advanceToVoting,
  advanceToReveal,
  sanitizeStateForClient,
  checkRealAnswerSimilarity
} from "../../lib/gameCore.ts";
import { getGameSession } from "../../lib/storage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json"
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders
  });
}

export default async (req: Request, _context?: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Handle GET requests (polling or initial state check)
  if (req.method === "GET") {
    const action = url.searchParams.get("action") || "get_state";
    const roomCode = url.searchParams.get("roomCode");
    const playerId = url.searchParams.get("playerId") || undefined;

    if (!roomCode) {
      return jsonResponse({ error: "Missing roomCode parameter" }, 400);
    }

    if (action === "get_state") {
      // Check if timer expired and auto-advance phase if needed
      await mutateGame(roomCode, (state) => {
        const now = Date.now();

        // Auto-advance submitting if deadline reached
        if (state.phase === "SUBMITTING" && state.phaseDeadline > 0 && now > state.phaseDeadline) {
          advanceToVoting(state);
        }
        // Auto-advance voting if deadline reached
        else if (state.phase === "VOTING" && state.phaseDeadline > 0 && now > state.phaseDeadline) {
          advanceToReveal(state);
        }

        // Update player heartbeat
        if (playerId) {
          const player = state.players.find(p => p.id === playerId);
          if (player) {
            player.lastSeen = now;
            player.connected = true;
          }
        }

        return { state };
      });

      const session = await getGameSession(roomCode);
      if (!session.data) {
        return jsonResponse({ error: "Room not found" }, 404);
      }

      return jsonResponse({
        state: sanitizeStateForClient(session.data, playerId)
      });
    }

    return jsonResponse({ error: "Unknown GET action" }, 400);
  }

  // Handle POST requests
  if (req.method === "POST") {
    let body: Record<string, any>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON payload" }, 400);
    }

    const { action, roomCode, playerId, playerName, hostName, lieText, optionId } = body;

    if (action === "create_room") {
      try {
        const { playerId: newHostId, roomCode: newCode, state } = await createRoom(
          roomCode || "",
          hostName || "Host"
        );
        return jsonResponse({
          roomCode: newCode,
          playerId: newHostId,
          state: sanitizeStateForClient(state, newHostId)
        });
      } catch (err: any) {
        return jsonResponse({ error: err.message || "Failed to create room" }, 500);
      }
    }

    if (action === "join_room") {
      if (!roomCode || !playerName) {
        return jsonResponse({ error: "Room code and player name are required" }, 400);
      }
      const result = await joinRoom(roomCode, playerName);
      if (!result.success || !result.playerId || !result.state) {
        return jsonResponse({ error: result.error || "Failed to join room" }, 400);
      }
      return jsonResponse({
        roomCode: roomCode.toUpperCase().trim(),
        playerId: result.playerId,
        state: sanitizeStateForClient(result.state, result.playerId)
      });
    }

    if (!roomCode) {
      return jsonResponse({ error: "Missing roomCode" }, 400);
    }

    if (action === "start_game") {
      const result = await mutateGame(roomCode, (state) => {
        if (state.hostId !== playerId) {
          return { state, error: "Only the host can start the game" };
        }
        if (state.players.length < 2) {
          return { state, error: "At least 2 players are required to start" };
        }
        startNextRound(state);
        return { state };
      });

      if (!result.success) {
        return jsonResponse({ error: result.error }, 400);
      }
      return jsonResponse({
        state: sanitizeStateForClient(result.state!, playerId)
      });
    }

    if (action === "submit_lie") {
      if (!lieText || !lieText.trim()) {
        return jsonResponse({ error: "Please enter a believable fake answer" }, 400);
      }

      let rejectedReason: { isRealAnswer?: boolean; message?: string } | null = null;

      const result = await mutateGame(roomCode, (state) => {
        if (state.phase !== "SUBMITTING") {
          return { state, error: "Not in submitting phase" };
        }

        const trimmed = lieText.trim();
        // Check if player submitted the actual real answer
        const isTruth = checkRealAnswerSimilarity(trimmed, [
          state.currentRealAnswer,
          ...state.currentAcceptableAnswers
        ]);

        if (isTruth) {
          rejectedReason = {
            isRealAnswer: true,
            message: "That's actually the real truth! Write a convincing lie to fool your friends."
          };
          return { state, error: "TRUTH_DETECTED" };
        }

        // Record submission
        state.submissions[playerId] = trimmed;

        // Check if all connected players submitted
        const allSubmitted = state.players.every(p => Boolean(state.submissions[p.id]));
        if (allSubmitted) {
          advanceToVoting(state);
        }

        return { state };
      });

      if (rejectedReason) {
        return jsonResponse(rejectedReason, 400);
      }

      if (!result.success) {
        return jsonResponse({ error: result.error }, 400);
      }

      return jsonResponse({
        state: sanitizeStateForClient(result.state!, playerId)
      });
    }

    if (action === "submit_vote") {
      if (!optionId) {
        return jsonResponse({ error: "Missing optionId" }, 400);
      }

      const result = await mutateGame(roomCode, (state) => {
        if (state.phase !== "VOTING") {
          return { state, error: "Not in voting phase" };
        }

        const chosenOpt = state.secretOptions.find(o => o.id === optionId);
        if (!chosenOpt) {
          return { state, error: "Option not found" };
        }

        if (chosenOpt.authorPlayerId === playerId) {
          return { state, error: "You cannot vote for your own lie!" };
        }

        state.votes[playerId] = optionId;

        // Check if all eligible players have voted
        const allVoted = state.players.every(p => Boolean(state.votes[p.id]));
        if (allVoted) {
          advanceToReveal(state);
        }

        return { state };
      });

      if (!result.success) {
        return jsonResponse({ error: result.error }, 400);
      }

      return jsonResponse({
        state: sanitizeStateForClient(result.state!, playerId)
      });
    }

    if (action === "advance_phase") {
      const result = await mutateGame(roomCode, (state) => {
        if (state.hostId !== playerId) {
          return { state, error: "Only the host can advance the round" };
        }

        if (state.phase === "REVEAL") {
          state.phase = "SCORES";
          state.phaseDeadline = 0;
        } else if (state.phase === "SCORES") {
          if (state.round < state.totalRounds) {
            startNextRound(state);
          } else {
            state.phase = "PODIUM";
            state.phaseDeadline = 0;
          }
        }
        return { state };
      });

      if (!result.success) {
        return jsonResponse({ error: result.error }, 400);
      }

      return jsonResponse({
        state: sanitizeStateForClient(result.state!, playerId)
      });
    }

    if (action === "play_again") {
      const result = await mutateGame(roomCode, (state) => {
        if (state.hostId !== playerId) {
          return { state, error: "Only the host can restart the game" };
        }

        state.phase = "LOBBY";
        state.round = 0;
        state.usedQuestionIds = [];
        state.currentQuestionId = null;
        state.submissions = {};
        state.secretOptions = [];
        state.votes = {};
        state.roundResult = null;
        state.phaseDeadline = 0;
        for (const p of state.players) {
          p.score = 0;
        }
        return { state };
      });

      if (!result.success) {
        return jsonResponse({ error: result.error }, 400);
      }

      return jsonResponse({
        state: sanitizeStateForClient(result.state!, playerId)
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
};

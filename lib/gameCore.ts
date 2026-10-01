import type {
  InternalGameState,
  Player,
  PublicGameState,
  RoundResult,
  RevealedOption,
  ClientVotingOption
} from "./types.ts";
import { getRandomQuestions, QUESTIONS } from "./questions.ts";
import { getGameSession, setGameSession } from "./storage.ts";

const AVATARS = ["🐱", "🦊", "🚀", "🎭", "🥑", "⚡", "🔮", "🦄", "👾", "🎪", "🦁", "💎"];

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function normalizeAnswer(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function sanitizeStateForClient(
  state: InternalGameState,
  playerId?: string
): PublicGameState {
  const isVoting = state.phase === "VOTING";
  const isReveal = state.phase === "REVEAL" || state.phase === "SCORES" || state.phase === "PODIUM";

  const clientPlayers: Player[] = state.players.map(p => ({
    id: p.id,
    name: p.name,
    score: p.score,
    isHost: p.isHost,
    avatar: p.avatar,
    connected: p.connected,
    lastSeen: p.lastSeen,
    hasSubmitted: Boolean(state.submissions[p.id]),
    hasVoted: Boolean(state.votes[p.id])
  }));

  let votingOptions: ClientVotingOption[] = [];
  if (isVoting) {
    votingOptions = state.secretOptions.map(opt => ({
      id: opt.id,
      text: opt.text,
      isMyLie: Boolean(playerId && opt.authorPlayerId === playerId)
    }));
  }

  return {
    roomCode: state.roomCode,
    hostId: state.hostId,
    phase: state.phase,
    round: state.round,
    totalRounds: state.totalRounds,
    players: clientPlayers,
    currentQuestion: state.currentQuestionId
      ? {
          id: state.currentQuestionId,
          category: state.currentCategory,
          prompt: state.currentPrompt
        }
      : null,
    votingOptions,
    roundResult: isReveal ? state.roundResult : null,
    phaseDeadline: state.phaseDeadline,
    version: state.version,
    serverTime: Date.now()
  };
}

// Atomically mutate game session with conditional write retries
export async function mutateGame(
  roomCode: string,
  mutator: (state: InternalGameState) => { state: InternalGameState; error?: string },
  maxRetries = 4
): Promise<{ success: boolean; state?: InternalGameState; error?: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const session = await getGameSession(roomCode);
    if (!session.data) {
      return { success: false, error: "Game session not found" };
    }

    const { state: updated, error } = mutator(session.data);
    if (error) {
      return { success: false, error };
    }

    const writeResult = await setGameSession(roomCode, updated, session.etag);
    if (writeResult.success) {
      return { success: true, state: updated };
    }
    // Exponential backoff jitter before retry
    await new Promise(r => setTimeout(r, 20 + Math.random() * 40));
  }
  return { success: false, error: "High concurrency update conflict, please retry." };
}

export async function createRoom(roomCode: string, hostName: string): Promise<{
  playerId: string;
  roomCode: string;
  state: InternalGameState;
}> {
  const code = (roomCode || Math.floor(1000 + Math.random() * 9000).toString()).toUpperCase().trim();
  const hostId = "p_" + generateId();
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];

  const hostPlayer: Player = {
    id: hostId,
    name: hostName.trim() || "Host",
    score: 0,
    isHost: true,
    avatar,
    connected: true,
    lastSeen: Date.now()
  };

  const initialState: InternalGameState = {
    roomCode: code,
    hostId,
    phase: "LOBBY",
    round: 0,
    totalRounds: 3,
    players: [hostPlayer],
    usedQuestionIds: [],
    currentQuestionId: null,
    currentRealAnswer: "",
    currentFunFact: "",
    currentCategory: "",
    currentPrompt: "",
    currentAcceptableAnswers: [],
    currentAiDecoys: [],
    submissions: {},
    secretOptions: [],
    votes: {},
    roundResult: null,
    phaseDeadline: 0,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await setGameSession(code, initialState);
  return { playerId: hostId, roomCode: code, state: initialState };
}

export async function joinRoom(roomCode: string, playerName: string): Promise<{
  success: boolean;
  playerId?: string;
  error?: string;
  state?: InternalGameState;
}> {
  const cleanName = playerName.trim() || "Player";
  let assignedPlayerId = "";

  const result = await mutateGame(roomCode, (state) => {
    // Check if player name already exists and reconnect
    const existing = state.players.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      existing.connected = true;
      existing.lastSeen = Date.now();
      assignedPlayerId = existing.id;
      return { state };
    }

    if (state.phase !== "LOBBY") {
      return { state, error: "Game is already in progress. Please wait for the next game!" };
    }

    if (state.players.length >= 8) {
      return { state, error: "Room is full (max 8 players)." };
    }

    const newId = "p_" + generateId();
    const usedAvatars = new Set(state.players.map(p => p.avatar));
    const availableAvatars = AVATARS.filter(a => !usedAvatars.has(a));
    const avatar = availableAvatars.length > 0
      ? availableAvatars[Math.floor(Math.random() * availableAvatars.length)]
      : AVATARS[Math.floor(Math.random() * AVATARS.length)];

    const newPlayer: Player = {
      id: newId,
      name: cleanName,
      score: 0,
      isHost: false,
      avatar,
      connected: true,
      lastSeen: Date.now()
    };

    state.players.push(newPlayer);
    assignedPlayerId = newId;
    return { state };
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, playerId: assignedPlayerId, state: result.state };
}

export function startNextRound(state: InternalGameState): InternalGameState {
  const nextRoundNumber = state.round + 1;
  const questions = getRandomQuestions(1, state.usedQuestionIds);
  const q = questions[0] || QUESTIONS[0];

  state.phase = "SUBMITTING";
  state.round = nextRoundNumber;
  state.usedQuestionIds.push(q.id);
  state.currentQuestionId = q.id;
  state.currentCategory = q.category;
  state.currentPrompt = q.prompt;
  state.currentRealAnswer = q.realAnswer;
  state.currentAcceptableAnswers = q.acceptableAnswers;
  state.currentAiDecoys = q.aiDecoys;
  state.currentFunFact = q.funFact;
  state.submissions = {};
  state.secretOptions = [];
  state.votes = {};
  state.roundResult = null;
  // 45 seconds for submitting lies
  state.phaseDeadline = Date.now() + 45_000;

  return state;
}

export function advanceToVoting(state: InternalGameState): InternalGameState {
  state.phase = "VOTING";
  // 30 seconds for voting
  state.phaseDeadline = Date.now() + 32_000;

  const rawOptions: {
    id: string;
    text: string;
    isReal: boolean;
    authorPlayerId: string | null;
  }[] = [];

  // Real Answer
  rawOptions.push({
    id: "opt_real",
    text: state.currentRealAnswer,
    isReal: true,
    authorPlayerId: null
  });

  // Player Lies
  for (const player of state.players) {
    const lie = state.submissions[player.id];
    if (lie) {
      rawOptions.push({
        id: "opt_" + player.id,
        text: lie,
        isReal: false,
        authorPlayerId: player.id
      });
    }
  }

  // If 2 players, add 1-2 AI decoys to make guessing thrilling and ensure at least 4 options
  if (rawOptions.length < 4 && state.currentAiDecoys.length > 0) {
    const needed = 4 - rawOptions.length;
    const decoys = shuffleArray(state.currentAiDecoys).slice(0, needed);
    for (let i = 0; i < decoys.length; i++) {
      rawOptions.push({
        id: "opt_decoy_" + i,
        text: decoys[i],
        isReal: false,
        authorPlayerId: null
      });
    }
  }

  state.secretOptions = shuffleArray(rawOptions);
  return state;
}

export function advanceToReveal(state: InternalGameState): InternalGameState {
  state.phase = "REVEAL";
  state.phaseDeadline = Date.now() + 25_000;

  // Calculate scores
  const roundScale = state.round === 1 ? 1000 : state.round === 2 ? 2000 : 3000;
  const foolScale = state.round === 1 ? 500 : state.round === 2 ? 1000 : 1500;

  const realOption = state.secretOptions.find(o => o.isReal);
  const realOptionId = realOption?.id || "opt_real";

  const scoreDeltas: Record<string, {
    truthPoints: number;
    foolingPoints: number;
    totalDelta: number;
    fooledCount: number;
    foundTruth: boolean;
  }> = {};

  // Initialize deltas for all players
  for (const player of state.players) {
    scoreDeltas[player.id] = {
      truthPoints: 0,
      foolingPoints: 0,
      totalDelta: 0,
      fooledCount: 0,
      foundTruth: false
    };
  }

  // Tally votes
  const optionVotes: Record<string, string[]> = {};
  for (const opt of state.secretOptions) {
    optionVotes[opt.id] = [];
  }

  for (const [voterId, chosenOptionId] of Object.entries(state.votes)) {
    if (optionVotes[chosenOptionId]) {
      optionVotes[chosenOptionId].push(voterId);
    }
    // Check if voter picked the truth
    if (chosenOptionId === realOptionId && scoreDeltas[voterId]) {
      scoreDeltas[voterId].truthPoints += roundScale;
      scoreDeltas[voterId].foundTruth = true;
    }
  }

  // Tally fooling points
  for (const opt of state.secretOptions) {
    if (!opt.isReal && opt.authorPlayerId && scoreDeltas[opt.authorPlayerId]) {
      const voters = optionVotes[opt.id] || [];
      const fools = voters.filter(v => v !== opt.authorPlayerId).length;
      scoreDeltas[opt.authorPlayerId].fooledCount += fools;
      scoreDeltas[opt.authorPlayerId].foolingPoints += fools * foolScale;
    }
  }

  // Apply deltas to cumulative player scores
  for (const player of state.players) {
    const delta = scoreDeltas[player.id];
    if (delta) {
      delta.totalDelta = delta.truthPoints + delta.foolingPoints;
      player.score += delta.totalDelta;
    }
  }

  // Build revealed options
  const revealedOptions: RevealedOption[] = state.secretOptions.map(opt => {
    let authorName = "THE TRUTH";
    if (!opt.isReal) {
      if (opt.authorPlayerId) {
        const author = state.players.find(p => p.id === opt.authorPlayerId);
        authorName = author?.name || "Player";
      } else {
        authorName = "AI DECOY";
      }
    }

    const voters = (optionVotes[opt.id] || []).map(vId => {
      const p = state.players.find(x => x.id === vId);
      return {
        playerId: vId,
        playerName: p?.name || "Player",
        avatar: p?.avatar || "👤"
      };
    });

    return {
      id: opt.id,
      text: opt.text,
      isReal: opt.isReal,
      authorPlayerId: opt.authorPlayerId,
      authorName,
      voters
    };
  });

  const roundResult: RoundResult = {
    questionId: state.currentQuestionId || "q1",
    roundNumber: state.round,
    realAnswer: state.currentRealAnswer,
    funFact: state.currentFunFact,
    revealedOptions,
    scoreDeltas
  };

  state.roundResult = roundResult;
  return state;
}

export function checkRealAnswerSimilarity(input: string, acceptable: string[]): boolean {
  const normInput = normalizeAnswer(input);
  if (!normInput) return false;

  for (const ans of acceptable) {
    const normAns = normalizeAnswer(ans);
    if (normInput === normAns) return true;
    // Check if input is a very close match (exact substring of length >= 4)
    if (normAns.length >= 4 && (normInput.includes(normAns) || normAns.includes(normInput))) {
      return true;
    }
  }
  return false;
}

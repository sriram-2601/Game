export type GamePhase =
  | "LOBBY"
  | "SUBMITTING"
  | "VOTING"
  | "REVEAL"
  | "SCORES"
  | "PODIUM";

export interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  avatar: string;
  connected: boolean;
  lastSeen: number;
  hasSubmitted?: boolean;
  hasVoted?: boolean;
}

export interface ClientQuestion {
  id: string;
  category: string;
  prompt: string;
}

export interface ClientVotingOption {
  id: string;
  text: string;
  isMyLie?: boolean;
}

export interface RevealedOption {
  id: string;
  text: string;
  isReal: boolean;
  authorPlayerId: string | null;
  authorName: string;
  voters: {
    playerId: string;
    playerName: string;
    avatar: string;
  }[];
}

export interface RoundResult {
  questionId: string;
  roundNumber: number;
  realAnswer: string;
  funFact: string;
  revealedOptions: RevealedOption[];
  scoreDeltas: Record<string, {
    truthPoints: number;
    foolingPoints: number;
    totalDelta: number;
    fooledCount: number;
    foundTruth: boolean;
  }>;
}

export interface PublicGameState {
  roomCode: string;
  hostId: string;
  phase: GamePhase;
  round: number;
  totalRounds: number;
  players: Player[];
  currentQuestion: ClientQuestion | null;
  votingOptions: ClientVotingOption[];
  roundResult: RoundResult | null;
  phaseDeadline: number;
  version: number;
  serverTime: number;
}

export interface InternalGameState {
  roomCode: string;
  hostId: string;
  phase: GamePhase;
  round: number;
  totalRounds: number;
  players: Player[];
  usedQuestionIds: string[];
  currentQuestionId: string | null;
  currentRealAnswer: string;
  currentFunFact: string;
  currentCategory: string;
  currentPrompt: string;
  currentAcceptableAnswers: string[];
  currentAiDecoys: string[];
  // secret player lie submissions: playerId -> trimmed lie text
  submissions: Record<string, string>;
  // full options with secret metadata
  secretOptions: {
    id: string;
    text: string;
    isReal: boolean;
    authorPlayerId: string | null;
  }[];
  // player votes: playerId -> optionId
  votes: Record<string, string>;
  roundResult: RoundResult | null;
  phaseDeadline: number;
  version: number;
  createdAt: number;
  updatedAt: number;
}

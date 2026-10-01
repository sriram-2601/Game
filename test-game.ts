import gameHandler from "./netlify/functions/game.ts";

async function simulateRequest(method: string, urlStr: string, body?: any) {
  const url = new URL(urlStr, "http://localhost:5173");
  const req = new Request(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const res = await gameHandler(req, {} as any);
  const data = await res.json();
  return { status: res.status, data };
}

async function runTest() {
  console.log("🎮 Starting Full 3-Round Multiplayer Game Simulation...");

  // 1. Create Room (Host: Steve)
  const createRes = await simulateRequest("POST", "/.netlify/functions/game", {
    action: "create_room",
    hostName: "Steve (Host)",
    roomCode: "7777"
  });
  console.log("1. Created Room:", createRes.status, createRes.data.roomCode, "Host ID:", createRes.data.playerId);
  if (createRes.status !== 200) throw new Error("Create room failed");

  const roomCode = createRes.data.roomCode;
  const hostId = createRes.data.playerId;

  // 2. Join Room (Guest: John)
  const joinRes = await simulateRequest("POST", "/.netlify/functions/game", {
    action: "join_room",
    roomCode,
    playerName: "John (Guest)"
  });
  console.log("2. Joined Room:", joinRes.status, "Guest ID:", joinRes.data.playerId, "Player count:", joinRes.data.state.players.length);
  if (joinRes.status !== 200) throw new Error("Join room failed");
  const guestId = joinRes.data.playerId;

  // 3. Start Game
  const startRes = await simulateRequest("POST", "/.netlify/functions/game", {
    action: "start_game",
    roomCode,
    playerId: hostId
  });
  console.log("3. Game Started! Phase:", startRes.data.state.phase, "Round:", startRes.data.state.round);
  if (startRes.data.state.phase !== "SUBMITTING") throw new Error("Expected phase SUBMITTING");

  // Run 3 complete rounds!
  for (let round = 1; round <= 3; round++) {
    console.log(`\n--- ROUND ${round} ---`);

    // Fetch state for host
    const stateHost = await simulateRequest("GET", `/.netlify/functions/game?action=get_state&roomCode=${roomCode}&playerId=${hostId}`);
    console.log("Prompt:", stateHost.data.state.currentQuestion.prompt);

    // Test smart rejection if someone enters the actual truth
    // Let's test lie submission:
    // Steve submits a convincing lie
    const lie1 = `Absurd Fake Lie Round ${round} By Steve`;
    const sub1 = await simulateRequest("POST", "/.netlify/functions/game", {
      action: "submit_lie",
      roomCode,
      playerId: hostId,
      lieText: lie1
    });
    console.log("Host submitted lie:", sub1.status, "State phase:", sub1.data.state.phase);

    // John submits a convincing lie
    const lie2 = `Witty Fake Lie Round ${round} By John`;
    const sub2 = await simulateRequest("POST", "/.netlify/functions/game", {
      action: "submit_lie",
      roomCode,
      playerId: guestId,
      lieText: lie2
    });
    console.log("Guest submitted lie:", sub2.status, "State phase:", sub2.data.state.phase);

    // Should now automatically be in VOTING phase!
    if (sub2.data.state.phase !== "VOTING") throw new Error("Expected phase VOTING after all submissions");

    // Check anti-cheat: voting options must NOT reveal the real answer or author
    const hostVoteView = await simulateRequest("GET", `/.netlify/functions/game?action=get_state&roomCode=${roomCode}&playerId=${hostId}`);
    console.log("Voting options count:", hostVoteView.data.state.votingOptions.length);
    for (const opt of hostVoteView.data.state.votingOptions) {
      if ((opt as any).isReal !== undefined || (opt as any).authorPlayerId !== undefined) {
        throw new Error("Anti-cheat failed: Secret metadata leaked to client during voting!");
      }
    }
    console.log("✓ Anti-cheat verified: zero secret metadata leaked during voting phase.");

    // Pick an option to vote for:
    // Steve votes for option not his own
    const steveEligible = hostVoteView.data.state.votingOptions.filter((o: any) => !o.isMyLie);
    const voteSteveOpt = steveEligible[0];
    await simulateRequest("POST", "/.netlify/functions/game", {
      action: "submit_vote",
      roomCode,
      playerId: hostId,
      optionId: voteSteveOpt.id
    });

    // John votes for option not his own
    const guestVoteView = await simulateRequest("GET", `/.netlify/functions/game?action=get_state&roomCode=${roomCode}&playerId=${guestId}`);
    const johnEligible = guestVoteView.data.state.votingOptions.filter((o: any) => !o.isMyLie);
    const voteJohnOpt = johnEligible[0];
    const voteRes2 = await simulateRequest("POST", "/.netlify/functions/game", {
      action: "submit_vote",
      roomCode,
      playerId: guestId,
      optionId: voteJohnOpt.id
    });

    // Should now automatically be in REVEAL phase!
    console.log("Phase after all votes:", voteRes2.data.state.phase);
    if (voteRes2.data.state.phase !== "REVEAL") throw new Error("Expected phase REVEAL");

    console.log("Real Answer Revealed:", voteRes2.data.state.roundResult.realAnswer);
    console.log("Fun Fact:", voteRes2.data.state.roundResult.funFact);

    // Advance to SCORES
    const advScores = await simulateRequest("POST", "/.netlify/functions/game", {
      action: "advance_phase",
      roomCode,
      playerId: hostId
    });
    console.log("Phase advanced to:", advScores.data.state.phase);
    if (advScores.data.state.phase !== "SCORES") throw new Error("Expected phase SCORES");

    // Advance to next round or PODIUM
    const advNext = await simulateRequest("POST", "/.netlify/functions/game", {
      action: "advance_phase",
      roomCode,
      playerId: hostId
    });
    console.log("Next phase advanced to:", advNext.data.state.phase);
  }

  // After Round 3, final phase should be PODIUM
  const finalState = await simulateRequest("GET", `/.netlify/functions/game?action=get_state&roomCode=${roomCode}&playerId=${hostId}`);
  console.log("\n🏆 FINAL GAME STATE:");
  console.log("Phase:", finalState.data.state.phase);
  console.log("Scores:", finalState.data.state.players.map((p: any) => `${p.name}: ${p.score} pts`));

  if (finalState.data.state.phase !== "PODIUM") {
    throw new Error(`Expected PODIUM phase, got: ${finalState.data.state.phase}`);
  }

  console.log("\n✅ ALL 3 ROUNDS AND MULTIPLAYER LOGIC PASSED FLAWLESSLY!\n");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

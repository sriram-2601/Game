import { sound } from "./audio";
import { triggerConfetti } from "./confetti";
import type { PublicGameState } from "../lib/types.ts";

// App Local Storage Keys
const STORAGE_ROOM = "hs_room_code";
const STORAGE_PLAYER = "hs_player_id";
const STORAGE_NAME = "hs_player_name";

class GameClient {
  private roomCode: string = "";
  private playerId: string = "";
  private playerName: string = "";
  private state: PublicGameState | null = null;
  private activeTab: "host" | "join" = "host";
  private pollInterval: number | null = null;
  private localLieDraft: string = "";
  private selectedVoteOptionId: string | null = null;
  private isSubmitting: boolean = false;
  private lastTickedSecond: number = -1;
  private lastPhase: string = "";
  private soundMuted: boolean = false;

  constructor() {
    this.initFromUrlAndStorage();
    this.setupWindowEvents();
    this.render();
  }

  private initFromUrlAndStorage() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoom = urlParams.get("room");

    if (urlRoom) {
      this.roomCode = urlRoom.toUpperCase().trim();
      this.activeTab = "join";
    } else {
      this.roomCode = sessionStorage.getItem(STORAGE_ROOM) || "";
    }

    this.playerId = sessionStorage.getItem(STORAGE_PLAYER) || "";
    this.playerName = sessionStorage.getItem(STORAGE_NAME) || "";

    if (this.roomCode && this.playerId) {
      this.startPolling();
    }
  }

  private setupWindowEvents() {
    window.addEventListener("beforeunload", () => {
      // Keep session
    });
  }

  private setSession(roomCode: string, playerId: string, playerName: string) {
    this.roomCode = roomCode.toUpperCase().trim();
    this.playerId = playerId;
    this.playerName = playerName;

    sessionStorage.setItem(STORAGE_ROOM, this.roomCode);
    sessionStorage.setItem(STORAGE_PLAYER, this.playerId);
    sessionStorage.setItem(STORAGE_NAME, this.playerName);

    // Update URL query string cleanly
    const url = new URL(window.location.href);
    url.searchParams.set("room", this.roomCode);
    window.history.replaceState({}, "", url.toString());
  }

  private clearSession() {
    this.stopPolling();
    this.roomCode = "";
    this.playerId = "";
    this.state = null;
    this.selectedVoteOptionId = null;
    this.localLieDraft = "";

    sessionStorage.removeItem(STORAGE_ROOM);
    sessionStorage.removeItem(STORAGE_PLAYER);

    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState({}, "", url.toString());

    this.render();
  }

  private showToast(message: string, type: "info" | "warning" | "error" = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    if (type === "warning" || type === "error") {
      sound.playBuzzer();
    }

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  private startPolling() {
    this.stopPolling();
    this.fetchState();
    this.pollInterval = window.setInterval(() => {
      this.fetchState();
    }, 1200);
  }

  private stopPolling() {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async fetchState() {
    if (!this.roomCode) return;

    try {
      const url = `/.netlify/functions/game?action=get_state&roomCode=${encodeURIComponent(
        this.roomCode
      )}${this.playerId ? `&playerId=${encodeURIComponent(this.playerId)}` : ""}`;

      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) {
          this.clearSession();
          this.showToast("Room no longer exists or expired.", "warning");
          return;
        }
        return;
      }

      const data = await res.json();
      if (data.state) {
        this.updateState(data.state);
      }
    } catch (err) {
      console.warn("Polling error:", err);
    }
  }

  private async apiCall(payload: Record<string, any>): Promise<any> {
    const res = await fetch("/.netlify/functions/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomCode: this.roomCode,
        playerId: this.playerId,
        ...payload
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw data;
    }
    return data;
  }

  private updateState(newState: PublicGameState) {
    const phaseChanged = this.lastPhase !== newState.phase;
    this.lastPhase = newState.phase;
    this.state = newState;

    if (phaseChanged) {
      if (newState.phase === "SUBMITTING") {
        this.localLieDraft = "";
        this.selectedVoteOptionId = null;
      }
      if (newState.phase === "REVEAL") {
        sound.playReveal();
      }
      if (newState.phase === "PODIUM") {
        sound.playVictory();
        triggerConfetti(5000);
      }
    }

    this.render();
  }

  // --- Actions ---

  public async handleCreateRoom(name: string, customCode: string) {
    if (!name.trim()) {
      this.showToast("Please enter your name", "warning");
      return;
    }

    this.isSubmitting = true;
    this.render();

    try {
      sound.playPop();
      const res = await this.apiCall({
        action: "create_room",
        hostName: name.trim(),
        roomCode: customCode.trim() || undefined
      });

      this.setSession(res.roomCode, res.playerId, name.trim());
      this.updateState(res.state);
      this.startPolling();
      this.showToast(`Room created! Code: ${res.roomCode}`, "info");
    } catch (err: any) {
      this.showToast(err.error || "Failed to create room", "error");
    } finally {
      this.isSubmitting = false;
      this.render();
    }
  }

  public async handleJoinRoom(code: string, name: string) {
    if (!code.trim() || !name.trim()) {
      this.showToast("Please enter room code and your name", "warning");
      return;
    }

    this.isSubmitting = true;
    this.render();

    try {
      sound.playPop();
      const res = await this.apiCall({
        action: "join_room",
        roomCode: code.trim(),
        playerName: name.trim()
      });

      this.setSession(res.roomCode, res.playerId, name.trim());
      this.updateState(res.state);
      this.startPolling();
      this.showToast(`Joined room ${res.roomCode}!`, "info");
    } catch (err: any) {
      this.showToast(err.error || "Failed to join room", "error");
    } finally {
      this.isSubmitting = false;
      this.render();
    }
  }

  public async handleStartGame() {
    if (!this.state || this.state.hostId !== this.playerId) return;

    this.isSubmitting = true;
    this.render();

    try {
      sound.playPop();
      const res = await this.apiCall({ action: "start_game" });
      this.updateState(res.state);
    } catch (err: any) {
      this.showToast(err.error || "Failed to start game", "error");
    } finally {
      this.isSubmitting = false;
      this.render();
    }
  }

  public async handleSubmitLie(lie: string) {
    if (!lie.trim()) {
      this.showToast("Please enter a believable fake answer", "warning");
      return;
    }

    this.isSubmitting = true;
    this.render();

    try {
      sound.playSubmit();
      const res = await this.apiCall({
        action: "submit_lie",
        lieText: lie.trim()
      });
      this.updateState(res.state);
      this.showToast("Lie submitted! Wait for others...", "info");
    } catch (err: any) {
      if (err.isRealAnswer) {
        this.showToast(err.message, "warning");
      } else {
        this.showToast(err.error || "Submission failed", "error");
      }
    } finally {
      this.isSubmitting = false;
      this.render();
    }
  }

  public async handleSubmitVote(optionId: string) {
    if (!optionId) return;

    this.selectedVoteOptionId = optionId;
    this.isSubmitting = true;
    this.render();

    try {
      sound.playSubmit();
      const res = await this.apiCall({
        action: "submit_vote",
        optionId
      });
      this.updateState(res.state);
      this.showToast("Vote recorded!", "info");
    } catch (err: any) {
      this.showToast(err.error || "Vote failed", "error");
      this.selectedVoteOptionId = null;
    } finally {
      this.isSubmitting = false;
      this.render();
    }
  }

  public async handleAdvancePhase() {
    if (!this.state || this.state.hostId !== this.playerId) return;

    this.isSubmitting = true;
    this.render();

    try {
      sound.playPop();
      const res = await this.apiCall({ action: "advance_phase" });
      this.updateState(res.state);
    } catch (err: any) {
      this.showToast(err.error || "Failed to advance", "error");
    } finally {
      this.isSubmitting = false;
      this.render();
    }
  }

  public async handlePlayAgain() {
    if (!this.state || this.state.hostId !== this.playerId) return;

    this.isSubmitting = true;
    this.render();

    try {
      sound.playPop();
      const res = await this.apiCall({ action: "play_again" });
      this.updateState(res.state);
    } catch (err: any) {
      this.showToast(err.error || "Failed to restart", "error");
    } finally {
      this.isSubmitting = false;
      this.render();
    }
  }

  // --- Rendering Functions ---

  public render() {
    const root = document.getElementById("app");
    if (!root) return;

    // Header nav is present when inside a game room
    const isInsideGame = Boolean(this.roomCode && this.state);

    let html = "";
    if (isInsideGame) {
      html += this.renderTopNav();
    }

    if (!isInsideGame) {
      html += this.renderLanding();
    } else if (this.state) {
      switch (this.state.phase) {
        case "LOBBY":
          html += this.renderLobby();
          break;
        case "SUBMITTING":
          html += this.renderSubmitting();
          break;
        case "VOTING":
          html += this.renderVoting();
          break;
        case "REVEAL":
          html += this.renderReveal();
          break;
        case "SCORES":
          html += this.renderScores();
          break;
        case "PODIUM":
          html += this.renderPodium();
          break;
      }
    }

    root.innerHTML = html;
    this.attachDomEvents();
  }

  private renderTopNav(): string {
    return `
      <header class="top-nav">
        <a href="#" class="nav-brand" id="nav-brand-btn">
          <div class="nav-brand-title">Hallucination <span>Station</span></div>
        </a>
        <div class="nav-controls">
          <div class="room-badge">ROOM ${this.roomCode}</div>
          <button class="btn-icon" id="sound-toggle-btn" title="Toggle Sound">
            ${this.soundMuted ? "🔇 Muted" : "🔊 Sound"}
          </button>
          <button class="btn-icon" id="leave-room-btn">
            🚪 Leave
          </button>
        </div>
      </header>
    `;
  }

  private renderLanding(): string {
    const defaultCode = Math.floor(1000 + Math.random() * 9000).toString();

    return `
      <div class="hero-layout">
        <!-- Left Hero Column -->
        <div class="hero-info">
          <div class="hero-tag">A Game of Confident Nonsense</div>
          <h1 class="hero-title">
            Hallucination
            <span class="italic-text">Station</span>
          </h1>
          <p class="hero-subtitle">
            Score the most points in three rounds.
          </p>
          <p class="hero-desc">
            Invent believable fake answers that fool your friends. Then identify the one real answer. Real-time multiplayer on any device with no logins or downloads.
          </p>

          <div class="feature-steps">
            <div class="step-item">
              <span class="step-num">01</span>
              <span class="step-text">Read the strange question</span>
            </div>
            <div class="step-item">
              <span class="step-num">02</span>
              <span class="step-text">Write a convincing fake</span>
            </div>
            <div class="step-item">
              <span class="step-num">03</span>
              <span class="step-text">Vote for the real answer</span>
            </div>
          </div>
          <span class="game-meta-badge">2–8 players • 3 rounds • approximately 5 minutes</span>
        </div>

        <!-- Right Entry Card Column -->
        <div class="entry-card">
          <div class="tab-switcher">
            <button class="tab-btn ${this.activeTab === "host" ? "active" : ""}" id="tab-host-btn">
              <span>Start a new game</span>
              <span class="tab-sub">I'll invite the group</span>
            </button>
            <button class="tab-btn ${this.activeTab === "join" ? "active" : ""}" id="tab-join-btn">
              <span>Join a friend</span>
              <span class="tab-sub">I have their code</span>
            </button>
          </div>

          ${
            this.activeTab === "host"
              ? `
            <div class="form-header">
              <div class="form-category">HOST A GAME</div>
              <h2 class="form-title">Create a room for your group</h2>
              <p class="form-desc">Choose a room code, then share it with the other players.</p>
            </div>
            <form id="host-form">
              <div class="input-group">
                <label class="input-label" for="host-name-input">Your Name</label>
                <input
                  id="host-name-input"
                  class="text-input"
                  type="text"
                  maxlength="16"
                  placeholder="e.g. Steve (Host)"
                  value="${this.playerName || "Host"}"
                  required
                />
              </div>
              <div class="input-group">
                <label class="input-label" for="room-code-input">Choose a Room Code</label>
                <input
                  id="room-code-input"
                  class="text-input room-code-input"
                  type="text"
                  maxlength="6"
                  placeholder="${defaultCode}"
                  value="${this.roomCode || defaultCode}"
                  required
                />
              </div>
              <button class="btn-primary" type="submit" ${this.isSubmitting ? "disabled" : ""}>
                ${this.isSubmitting ? "Creating room..." : "Create my game →"}
              </button>
            </form>
          `
              : `
            <div class="form-header">
              <div class="form-category">JOIN A GAME</div>
              <h2 class="form-title">Enter your friend's room</h2>
              <p class="form-desc">Use the room code the host shared with you.</p>
            </div>
            <form id="join-form">
              <div class="input-group">
                <label class="input-label" for="join-name-input">Your Name</label>
                <input
                  id="join-name-input"
                  class="text-input"
                  type="text"
                  maxlength="16"
                  placeholder="e.g. John (Guest)"
                  value="${this.playerName || ""}"
                  required
                />
              </div>
              <div class="input-group">
                <label class="input-label" for="join-code-input">Enter the Host's Room Code</label>
                <input
                  id="join-code-input"
                  class="text-input room-code-input"
                  type="text"
                  maxlength="6"
                  placeholder="e.g. 6738"
                  value="${this.roomCode || ""}"
                  required
                />
              </div>
              <button class="btn-primary" type="submit" ${this.isSubmitting ? "disabled" : ""}>
                ${this.isSubmitting ? "Joining room..." : "Join the game →"}
              </button>
            </form>
          `
          }
        </div>
      </div>
    `;
  }

  private renderLobby(): string {
    if (!this.state) return "";
    const isHost = this.state.hostId === this.playerId;
    const canStart = this.state.players.length >= 2;

    return `
      <div class="lobby-container">
        <div class="room-code-display-card">
          <div class="code-title">Room Code for Friends to Join</div>
          <div class="room-code-huge">${this.state.roomCode}</div>
          <div class="room-actions">
            <button class="btn-secondary" id="copy-link-btn">📋 Copy Invite Link</button>
            <button class="btn-secondary" id="share-code-btn">📲 Share Code</button>
          </div>
        </div>

        <div class="players-section">
          <div class="section-header">
            <div class="section-title">
              Connected Players
              <span class="player-count-badge">${this.state.players.length} / 8</span>
            </div>
            ${
              isHost
                ? `<span style="font-size: 0.85rem; color: var(--accent-lime);">You are the Host</span>`
                : `<span style="font-size: 0.85rem; color: var(--text-muted);">Waiting for Host</span>`
            }
          </div>

          <div class="players-grid">
            ${this.state.players
              .map(
                (p) => `
              <div class="player-chip ${p.id === this.playerId ? "is-me" : ""}">
                <div class="player-avatar">${p.avatar}</div>
                <div class="player-info">
                  <span class="player-name">${p.name} ${p.isHost ? "👑" : ""}</span>
                  <span class="player-status-tag">${p.id === this.playerId ? "You" : "Ready"}</span>
                </div>
              </div>
            `
              )
              .join("")}
          </div>

          <div style="margin-top: 32px; display: flex; flex-direction: column; gap: 12px; align-items: center;">
            ${
              isHost
                ? `
              <button
                class="btn-primary"
                id="start-game-btn"
                style="max-width: 320px;"
                ${!canStart || this.isSubmitting ? "disabled" : ""}
              >
                ${
                  !canStart
                    ? "Waiting for 2nd player to join..."
                    : this.isSubmitting
                    ? "Starting..."
                    : "Start Game →"
                }
              </button>
              ${
                !canStart
                  ? `<p style="font-size: 0.85rem; color: var(--text-muted);">
                      Open another browser tab or Incognito window with code <strong>${this.state.roomCode}</strong> to test!
                    </p>`
                  : ""
              }
            `
                : `
              <div style="display: flex; align-items: center; gap: 10px; color: var(--text-muted); font-size: 0.95rem;">
                <div class="spinner" style="width: 24px; height: 24px; border-width: 2px;"></div>
                Host will start the game once everyone joins...
              </div>
            `
            }
          </div>
        </div>
      </div>
    `;
  }

  private renderTimer(deadline: number, totalDuration: number): {
    badge: string;
    track: string;
  } {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const percent = Math.min(100, Math.max(0, (remaining / totalDuration) * 100));
    const isUrgent = remaining <= 8 && remaining > 0;

    if (isUrgent && remaining !== this.lastTickedSecond) {
      this.lastTickedSecond = remaining;
      sound.playTick();
    }

    return {
      badge: `<div class="timer-badge ${isUrgent ? "urgent" : ""}">⏱ ${remaining}s</div>`,
      track: `
        <div class="timer-bar-track">
          <div class="timer-bar-fill ${isUrgent ? "urgent" : ""}" style="width: ${percent}%;"></div>
        </div>
      `
    };
  }

  private renderSubmitting(): string {
    if (!this.state || !this.state.currentQuestion) return "";
    const me = this.state.players.find((p) => p.id === this.playerId);
    const hasSubmitted = Boolean(me?.hasSubmitted);
    const timer = this.renderTimer(this.state.phaseDeadline, 45);

    const promptWithBlank = this.state.currentQuestion.prompt.replace(
      /________/g,
      `<span class="question-blank">___________</span>`
    );

    const roundPoints =
      this.state.round === 1 ? "1,000" : this.state.round === 2 ? "2,000" : "3,000";
    const foolPoints =
      this.state.round === 1 ? "500" : this.state.round === 2 ? "1,000" : "1,500";

    return `
      <div style="max-width: 760px; margin: 0 auto; width: 100%;">
        <div class="game-header">
          <div class="game-header-top">
            <div class="round-badge">
              ROUND ${this.state.round} OF ${this.state.totalRounds} • +${roundPoints} PTS FOR TRUTH • +${foolPoints} PER FOOL
            </div>
            ${timer.badge}
          </div>
          ${timer.track}
        </div>

        <div class="question-card">
          <div class="question-category">${this.state.currentQuestion.category}</div>
          <div class="question-prompt">${promptWithBlank}</div>
        </div>

        <div class="submitting-section">
          ${
            !hasSubmitted
              ? `
            <div class="submission-input-box">
              <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 6px;">Invent your convincing lie</h3>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 18px;">
                Make it sound believable so other players vote for it!
              </p>
              <form id="submit-lie-form">
                <div class="input-group">
                  <input
                    id="lie-input"
                    class="text-input"
                    type="text"
                    maxlength="50"
                    placeholder="Type your fake answer here..."
                    value="${this.localLieDraft}"
                    required
                    autofocus
                  />
                </div>
                <button class="btn-primary" type="submit" ${this.isSubmitting ? "disabled" : ""}>
                  ${this.isSubmitting ? "Submitting..." : "Lock In My Lie →"}
                </button>
              </form>
            </div>
          `
              : `
            <div class="waiting-box">
              <div class="spinner"></div>
              <h3 style="font-size: 1.2rem; font-weight: 800;">Lie submitted!</h3>
              <p style="color: var(--text-muted); font-size: 0.9rem;">
                Waiting for the other players to finish inventing their lies...
              </p>
            </div>
          `
          }

          <div style="text-align: center; margin-top: 10px;">
            <div style="font-size: 0.8rem; font-family: var(--font-mono); color: var(--text-muted); text-transform: uppercase;">
              Submissions (${this.state.players.filter((p) => p.hasSubmitted).length} / ${
      this.state.players.length
    })
            </div>
            <div class="submission-status-list">
              ${this.state.players
                .map(
                  (p) => `
                <div class="submission-pill ${p.hasSubmitted ? "done" : ""}">
                  <span>${p.avatar}</span>
                  <span>${p.name}</span>
                  <span>${p.hasSubmitted ? "✓" : "..."}</span>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderVoting(): string {
    if (!this.state || !this.state.currentQuestion) return "";
    const me = this.state.players.find((p) => p.id === this.playerId);
    const hasVoted = Boolean(me?.hasVoted);
    const timer = this.renderTimer(this.state.phaseDeadline, 32);

    return `
      <div style="max-width: 820px; margin: 0 auto; width: 100%;">
        <div class="game-header">
          <div class="game-header-top">
            <div class="round-badge">
              ROUND ${this.state.round} • SPOT THE REAL TRUTH
            </div>
            ${timer.badge}
          </div>
          ${timer.track}
        </div>

        <div class="question-card" style="padding: 24px;">
          <div class="question-category">${this.state.currentQuestion.category}</div>
          <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-main);">
            ${this.state.currentQuestion.prompt}
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 16px;">
          <h2 style="font-size: 1.4rem; font-weight: 800;">Which one is the REAL truth?</h2>
          <p style="font-size: 0.9rem; color: var(--text-muted);">
            Vote for the answer you believe is real. You cannot vote for your own lie!
          </p>
        </div>

        ${
          !hasVoted
            ? `
          <div class="voting-grid">
            ${this.state.votingOptions
              .map((opt) => {
                const isSelected = this.selectedVoteOptionId === opt.id;
                return `
                <button
                  class="vote-card ${opt.isMyLie ? "is-my-lie" : ""} ${
                  isSelected ? "selected" : ""
                }"
                  data-option-id="${opt.id}"
                  ${opt.isMyLie || this.isSubmitting ? "disabled" : ""}
                >
                  <span style="font-size: 1.15rem;">${opt.text}</span>
                  ${
                    opt.isMyLie
                      ? `<span class="my-lie-tag">⚠️ Your Lie (Can't vote)</span>`
                      : isSelected
                      ? `<span class="my-lie-tag" style="color: var(--accent-lime);">Selected ✓</span>`
                      : ""
                  }
                </button>
              `;
              })
              .join("")}
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <button
              class="btn-primary"
              id="confirm-vote-btn"
              style="max-width: 300px; margin: 0 auto;"
              ${!this.selectedVoteOptionId || this.isSubmitting ? "disabled" : ""}
            >
              ${this.isSubmitting ? "Submitting..." : "Lock In My Vote →"}
            </button>
          </div>
        `
            : `
          <div class="waiting-box">
            <div class="spinner"></div>
            <h3 style="font-size: 1.25rem; font-weight: 800;">Vote Locked In!</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Waiting for other players to pick an answer...
            </p>
          </div>
        `
        }

        <div style="text-align: center; margin-top: 20px;">
          <div style="font-size: 0.8rem; font-family: var(--font-mono); color: var(--text-muted); text-transform: uppercase;">
            Votes Cast (${this.state.players.filter((p) => p.hasVoted).length} / ${
      this.state.players.length
    })
          </div>
          <div class="submission-status-list">
            ${this.state.players
              .map(
                (p) => `
              <div class="submission-pill ${p.hasVoted ? "done" : ""}">
                <span>${p.avatar}</span>
                <span>${p.name}</span>
                <span>${p.hasVoted ? "✓" : "..."}</span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  private renderReveal(): string {
    if (!this.state || !this.state.roundResult) return "";
    const res = this.state.roundResult;
    const isHost = this.state.hostId === this.playerId;

    return `
      <div style="max-width: 780px; margin: 0 auto; width: 100%;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div class="round-badge">ROUND ${this.state.round} • THE BIG REVEAL</div>
          <h2 style="font-size: 2rem; font-weight: 900; margin-top: 4px;">
            Who Fooled Who?
          </h2>
        </div>

        <div class="reveal-container">
          ${res.revealedOptions
            .map((opt) => {
              const votersCount = opt.voters.length;
              return `
              <div class="reveal-card ${opt.isReal ? "is-truth" : ""}">
                <div class="reveal-header">
                  <div class="reveal-answer-text">
                    ${opt.text}
                  </div>
                  <span class="author-badge ${opt.isReal ? "truth" : ""}">
                    ${opt.isReal ? "★ THE TRUTH" : `Lie by: ${opt.authorName}`}
                  </span>
                </div>

                <div class="fooled-section">
                  <span class="fooled-label">
                    ${opt.isReal ? "Discovered by:" : "Fooled:"}
                  </span>
                  ${
                    votersCount > 0
                      ? `
                    <div class="voters-pills">
                      ${opt.voters
                        .map(
                          (v) => `
                        <div class="voter-chip">
                          <span>${v.avatar}</span>
                          <span>${v.playerName}</span>
                        </div>
                      `
                        )
                        .join("")}
                    </div>
                  `
                      : `<span style="font-size: 0.85rem; color: var(--text-dim);">Nobody fell for this!</span>`
                  }
                </div>
              </div>
            `;
            })
            .join("")}

          <div class="fun-fact-box">
            <div class="fun-fact-title">✦ Did You Know? The Real Backstory</div>
            <div class="fun-fact-text">${res.funFact}</div>
          </div>

          <div style="text-align: center; margin-top: 24px;">
            ${
              isHost
                ? `
              <button class="btn-primary" id="advance-phase-btn" style="max-width: 320px; margin: 0 auto;">
                ${this.isSubmitting ? "Loading..." : "See Round Scores →"}
              </button>
            `
                : `
              <p style="color: var(--text-muted); font-size: 0.95rem;">
                Waiting for the host to continue to scores...
              </p>
            `
            }
          </div>
        </div>
      </div>
    `;
  }

  private renderScores(): string {
    if (!this.state) return "";
    const isHost = this.state.hostId === this.playerId;
    const sortedPlayers = [...this.state.players].sort((a, b) => b.score - a.score);
    const isFinalRound = this.state.round >= this.state.totalRounds;

    return `
      <div class="scores-container">
        <div style="text-align: center; margin-bottom: 8px;">
          <div class="round-badge">
            ${isFinalRound ? "FINAL ROUND COMPLETE" : `ROUND ${this.state.round} STANDINGS`}
          </div>
          <h2 style="font-size: 2rem; font-weight: 900; margin-top: 4px;">
            Current Leaderboard
          </h2>
        </div>

        <div class="scores-list">
          ${sortedPlayers
            .map((player, idx) => {
              const delta =
                this.state?.roundResult?.scoreDeltas[player.id]?.totalDelta || 0;
              return `
              <div class="score-row ${idx === 0 ? "rank-1" : ""}">
                <div class="score-player-left">
                  <span class="score-rank">${idx === 0 ? "👑" : `#${idx + 1}`}</span>
                  <span style="font-size: 1.5rem;">${player.avatar}</span>
                  <span class="score-player-name">${player.name} ${
                player.id === this.playerId ? "(You)" : ""
              }</span>
                </div>
                <div class="score-right">
                  ${
                    delta > 0
                      ? `<span class="score-delta-badge">+${delta.toLocaleString()}</span>`
                      : ""
                  }
                  <span class="score-total">${player.score.toLocaleString()} pts</span>
                </div>
              </div>
            `;
            })
            .join("")}
        </div>

        <div style="text-align: center; margin-top: 24px;">
          ${
            isHost
              ? `
            <button class="btn-primary" id="advance-phase-btn" style="max-width: 320px; margin: 0 auto;">
              ${
                isFinalRound
                  ? "View Final Winners Podium 🏆"
                  : `Start Round ${this.state.round + 1} →`
              }
            </button>
          `
              : `
            <p style="color: var(--text-muted); font-size: 0.95rem;">
              Waiting for host to proceed to ${
                isFinalRound ? "the final podium" : `Round ${this.state.round + 1}`
              }...
            </p>
          `
          }
        </div>
      </div>
    `;
  }

  private renderPodium(): string {
    if (!this.state) return "";
    const isHost = this.state.hostId === this.playerId;
    const sorted = [...this.state.players].sort((a, b) => b.score - a.score);

    const first = sorted[0];
    const second = sorted[1] || null;
    const third = sorted[2] || null;

    return `
      <div class="podium-container">
        <div>
          <div class="round-badge">CONTEST COMPLETE</div>
          <h1 class="podium-title">
            Hall of <span>Nonsense</span>
          </h1>
          <p style="color: var(--text-muted); margin-top: 6px;">
            The greatest master of confident bluffing and deception!
          </p>
        </div>

        <div class="podium-stage">
          ${
            second
              ? `
            <div class="podium-col second">
              <div class="podium-user">
                <span class="podium-medal">🥈</span>
                <span style="font-size: 2rem;">${second.avatar}</span>
                <span class="podium-name">${second.name}</span>
                <span class="podium-score">${second.score.toLocaleString()} pts</span>
              </div>
              <div class="podium-bar">2</div>
            </div>
          `
              : ""
          }

          ${
            first
              ? `
            <div class="podium-col first">
              <div class="podium-user">
                <span class="podium-medal">👑</span>
                <span style="font-size: 2.5rem;">${first.avatar}</span>
                <span class="podium-name" style="font-size: 1.15rem; color: var(--accent-gold);">${first.name}</span>
                <span class="podium-score" style="font-weight: 800; color: var(--text-main);">${first.score.toLocaleString()} pts</span>
              </div>
              <div class="podium-bar">1</div>
            </div>
          `
              : ""
          }

          ${
            third
              ? `
            <div class="podium-col third">
              <div class="podium-user">
                <span class="podium-medal">🥉</span>
                <span style="font-size: 1.8rem;">${third.avatar}</span>
                <span class="podium-name">${third.name}</span>
                <span class="podium-score">${third.score.toLocaleString()} pts</span>
              </div>
              <div class="podium-bar">3</div>
            </div>
          `
              : ""
          }
        </div>

        <div style="display: flex; justify-content: center; gap: 14px; margin-top: 24px;">
          ${
            isHost
              ? `
            <button class="btn-primary" id="play-again-btn" style="max-width: 240px;">
              🔄 Play Again
            </button>
          `
              : ""
          }
          <button class="btn-secondary" id="leave-room-btn" style="max-width: 200px;">
            Exit to Home
          </button>
        </div>
      </div>
    `;
  }

  // --- DOM Event Listeners ---

  private attachDomEvents() {
    // Navigation / Header
    document.getElementById("nav-brand-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (confirm("Return to main screen? Your current game session will be left.")) {
        this.clearSession();
      }
    });

    document.getElementById("sound-toggle-btn")?.addEventListener("click", () => {
      this.soundMuted = !this.soundMuted;
      sound.enabled = !this.soundMuted;
      this.render();
    });

    document.getElementById("leave-room-btn")?.addEventListener("click", () => {
      if (confirm("Leave this room?")) {
        this.clearSession();
      }
    });

    // Landing Tabs
    document.getElementById("tab-host-btn")?.addEventListener("click", () => {
      sound.playPop();
      this.activeTab = "host";
      this.render();
    });

    document.getElementById("tab-join-btn")?.addEventListener("click", () => {
      sound.playPop();
      this.activeTab = "join";
      this.render();
    });

    // Host Form
    document.getElementById("host-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const nameInput = document.getElementById("host-name-input") as HTMLInputElement;
      const codeInput = document.getElementById("room-code-input") as HTMLInputElement;
      if (nameInput) {
        this.handleCreateRoom(nameInput.value, codeInput?.value || "");
      }
    });

    // Join Form
    document.getElementById("join-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const codeInput = document.getElementById("join-code-input") as HTMLInputElement;
      const nameInput = document.getElementById("join-name-input") as HTMLInputElement;
      if (codeInput && nameInput) {
        this.handleJoinRoom(codeInput.value, nameInput.value);
      }
    });

    // Lobby Buttons
    document.getElementById("copy-link-btn")?.addEventListener("click", () => {
      sound.playPop();
      const inviteUrl = `${window.location.origin}/?room=${this.roomCode}`;
      navigator.clipboard.writeText(inviteUrl).then(() => {
        this.showToast("Invite link copied to clipboard!", "info");
      });
    });

    document.getElementById("share-code-btn")?.addEventListener("click", () => {
      sound.playPop();
      if (navigator.share) {
        navigator.share({
          title: "Join my Hallucination Station game!",
          text: `Join my game room with code ${this.roomCode}!`,
          url: `${window.location.origin}/?room=${this.roomCode}`
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(this.roomCode).then(() => {
          this.showToast(`Room code ${this.roomCode} copied!`, "info");
        });
      }
    });

    document.getElementById("start-game-btn")?.addEventListener("click", () => {
      this.handleStartGame();
    });

    // Submitting Form
    document.getElementById("submit-lie-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const lieInput = document.getElementById("lie-input") as HTMLInputElement;
      if (lieInput) {
        this.handleSubmitLie(lieInput.value);
      }
    });

    // Keep draft updated
    document.getElementById("lie-input")?.addEventListener("input", (e) => {
      this.localLieDraft = (e.target as HTMLInputElement).value;
    });

    // Voting Cards
    document.querySelectorAll(".vote-card").forEach((card) => {
      card.addEventListener("click", () => {
        const optionId = card.getAttribute("data-option-id");
        if (optionId && !card.hasAttribute("disabled")) {
          sound.playPop();
          this.selectedVoteOptionId = optionId;
          this.render();
        }
      });
    });

    document.getElementById("confirm-vote-btn")?.addEventListener("click", () => {
      if (this.selectedVoteOptionId) {
        this.handleSubmitVote(this.selectedVoteOptionId);
      }
    });

    // Phase Advancement (Reveal -> Scores -> Next Round / Podium)
    document.getElementById("advance-phase-btn")?.addEventListener("click", () => {
      this.handleAdvancePhase();
    });

    // Play Again
    document.getElementById("play-again-btn")?.addEventListener("click", () => {
      this.handlePlayAgain();
    });
  }
}

// Start client on DOM load
window.addEventListener("DOMContentLoaded", () => {
  new GameClient();
});

# ✦ Hallucination Station: A Game of Confident Nonsense
*Handshake AI Skills Studio × OpenAI Multiplayer Game Challenge Entry*

[![Netlify Status](https://api.netlify.com/api/v1/badges/deploy-status)](https://app.netlify.com)

---

## 🎮 Project Summary
**Hallucination Station** is a real-time multiplayer party game for **2–8 players** joining from their phones or laptops via a simple 4-character room code. No downloads, accounts, or logins required.

Real life is stranger than fiction: each round presents an unbelievable, bizarre real-world fact with a missing word or phrase. Players write convincing fake answers to fool their friends, then vote to pick out the real truth from the lineup of lies.

---

## 🏆 Handshake × OpenAI Submission Details
* **Project Title**: Hallucination Station — A Game of Confident Nonsense
* **Project Cover Image**: `cover.jpg` (bundled in root and `public/cover.jpg`)
* **Project Description**:
  > Real life is stranger than fiction! Hallucination Station is a fast-paced real-time party bluffing game where 2–8 players connect across separate phones or laptops with a 4-digit room code. Every round serves up an astonishing, verified historical or scientific anomaly with a missing blank. Players invent believable lies to deceive their friends, then vote on the lineup. Featuring full real-time state synchronization, smart real-answer detection, anti-cheat sanitized state payloads, dynamic countdown timers, procedural Web Audio sound synthesis, interactive reveals, and a victory podium with confetti!
* **Multiplayer Room Code**: Supports 2 to 8 players across any browser or mobile device.
* **Rules & Scoring**:
  * **Round 1 (Warmup)**: +1,000 pts for spotting truth, +500 pts per player fooled.
  * **Round 2 (High Stakes)**: +2,000 pts for spotting truth, +1,000 pts per player fooled.
  * **Round 3 (Grand Finale)**: +3,000 pts for spotting truth, +1,500 pts per player fooled.
  * Smart Real-Truth Trap: Players who accidentally type the exact real answer receive a private alert to invent a lie instead of spoiling the round.
  * Anti-cheat Security: Answer authors and truth flags are completely stripped from client payloads during the voting phase to prevent inspection cheats.

---

## 🚀 How to Deploy on Netlify in 30 Seconds
1. Open **[Netlify Drop](https://app.netlify.com/drop)**.
2. Drag and drop **`netlify-ready-game.zip`**.
3. Netlify will build the production assets and deploy the strongly consistent Netlify Function at `/.netlify/functions/game` with Netlify Blobs automatically.
4. Click **"Make Public"** and copy your live URL!

---

## 💻 Running Locally
```bash
npm install
npm run dev
```
Open `http://localhost:5173/` in your browser. Open a second Incognito tab to test multiplayer with room code!

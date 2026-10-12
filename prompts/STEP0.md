# Step 0 — one person, 10 minutes, before anyone codes

1. Create a private GitHub repo `navigator`; add all 5 teammates as collaborators.
2. Unzip this starter kit into the repo root, then:
   git add . && git commit -m "Step 0: shared context, contracts, prompts (v2)" && git push -u origin main
3. Everyone:
   git clone <repo-url> && cd navigator
   git checkout -b <branch>   # p1-core | p2-frustration | p3-ai | p4-dashboard | p5-plan
4. P1, P2 (Sahaj), P3, P5: cp .env.example backend/.env and paste the Foundry "Azure OpenAI endpoint" + "API key"
   (Foundry portal home page). Never commit backend/.env. Share the key in person or by DM, never in the repo or group chat.
5. Open Claude Code in the repo root (`claude`); it auto-loads CLAUDE.md.
   Paste your prompt from prompts/ as your first message:
   P1 -> P1-core.md | P2 -> P2-frustration-sahaj.md | P3 -> P3-ai.md | P4 -> P4-dashboard.md | P5 -> P5-plan-demo.md
6. Checkpoint at 1:30: merge to main in order P1 -> P2 -> P3 -> P4 -> P5, then everyone pulls main.

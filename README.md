# Maneuver-2026

**FRC 2026 REBUILT Scouting Application**

Maneuver-2026 is a comprehensive scouting application built for the 2026 FRC game season: **REBUILT**. Built on the maneuver-core framework, it provides offline-first PWA capabilities, field-centric data collection, match validation, and advanced analytics—all optimized for the unique challenges of the 2026 game.

## 🔗 Related Repositories

| Repository | Description | Status |
|------------|-------------|--------|
| **maneuver-core** | Framework template | [GitHub](https://github.com/ShinyShips/maneuver-core) |
| **Maneuver-2025** | 2025 Reefscape implementation | [Live App](https://github.com/ShinyShips/Maneuver-2025) |
| **Maneuver-2026** | 2026 REBUILT implementation (this repo) | Active Development |

## 🎯 About This App

Maneuver-2026 is specifically designed for the 2026 FRC game **REBUILT**, featuring:

- **Fuel-Based Scoring**: Track fuel collection, scoring, and passing throughout the match
- **Tower Climbing**: Support for autonomous Level 1 climbing and endgame Level 1/2/3 climbing
- **Field-Centric Interface**: Scoring screens mirror the actual game field with zones (Alliance, Neutral, Opponent)
- **Trench/Bump Navigation**: Track robot capabilities for going under trenches vs. over bumps

## 💡 Design Philosophy

Maneuver is **not** just another scouting app with basic counters and text inputs. The official Maneuver branches are designed with a focus on creating the **best possible UI/UX for scouting**.

### What sets Maneuver apart:

- **Field-Centric Interfaces** — Scoring screens mirror the game field, making data collection intuitive and fast
- **Contextual Actions** — UI elements adapt to game phases (auto/teleop/endgame) rather than showing everything at once
- **Visual Feedback** — Animations, color coding, and haptic responses confirm every action
- **Scout-First Design** — Optimized for the chaos of competition: large touch targets, minimal scrolling, one-handed operation
- **Data Visualization** — Statistics presented through charts, heat maps, and comparisons—not just tables of numbers

> **For teams forking this template:** We encourage you to maintain this commitment to quality UX. Your scouts will thank you, and your data quality will improve.

## 🏗️ Repository Structure

```
Maneuver-2026/
├── src/
│   ├── core/                    # 📦 Framework (from maneuver-core)
│   │   ├── components/          # Reusable UI components
│   │   ├── contexts/            # React contexts (Game, Theme, etc.)
│   │   ├── db/                  # Dexie database setup
│   │   ├── hooks/               # Custom React hooks
│   │   ├── layouts/             # Page layouts
│   │   ├── lib/                 # Utilities and helpers
│   │   ├── pages/               # Application pages/routes
│   │   └── types/               # TypeScript type definitions
│   │
│   ├── game-template/           # 🎮 2026 REBUILT Implementation
│   │   ├── components/          # Game-specific UI (field maps, scoring)
│   │   │   ├── auto-path/       # Autonomous path tracking
│   │   │   ├── field-map/       # Interactive field canvas
│   │   │   ├── teleop-path/     # Teleop path tracking
│   │   │   ├── scoring/         # Fuel scoring components
│   │   │   ├── endgame/         # Climb selection
│   │   │   └── pit-scouting/    # 2026-specific pit questions
│   │   ├── contexts/            # Scoring & path contexts
│   │   ├── gamification/        # Achievements system
│   │   ├── GAME_2026.md         # Complete game rules reference
│   │   ├── game-schema.ts       # Single source of truth for 2026 config
│   │   ├── scoring.ts           # Point calculations for fuel/climbing
│   │   ├── transformation.ts    # Data transformation logic
│   │   └── ...config files
│   │
│   ├── App.tsx                  # Main application entry
│   └── main.tsx                 # React DOM render
│
├── docs/                        # 📚 Documentation
└── public/                      # Static assets
```

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/core/` | Year-agnostic framework code (from maneuver-core) |
| `src/game-template/` | 2026 REBUILT game implementation — **customize for your team's needs** |
| `docs/` | Comprehensive documentation for framework features |

## ✨ Features
### 2026 REBUILT Game-Specific
- **Fuel Tracking**: Score, pass, and steal fuel with field-accurate positioning
- **Autonomous Path Tracking**: Record robot movements and scoring actions with canvas drawing
- **Teleop Role Analysis**: Track Active vs Inactive shift strategies (Cycler, Clean Up, Passer, Thief, Defense)
- **Tower Climbing**: Auto Level 1 (15pts) and Endgame Level 1/2/3 (10/20/30pts)
- **Trench/Bump Navigation**: Track field traversal capabilities

### Core Framework Features
- **Offline-First PWA**: Works without internet, installs like a native app
- **Match Scouting**: Pre-match setup, auto, teleop, endgame screens
- **Pit Scouting**: Robot specifications and 2026-specific capabilities
- **Data Transfer**: QR codes (fountain codes), JSON import/export, and WiFi transfer using WebRTC
- **Match Validation**: Compare scouted data against TBA official results
- **Team Statistics**: Averages, totals, performance analysis for 2026 metrics
- **Match Strategy**: Pre-match planning with field annotations
- **Pick Lists**: Alliance selection with drag-and-drop ordering
- **Scout Gamification**: Achievements, leaderboards, and profile tracking
- **Dark/Light Themes**: Full theme support
- **Responsive Design**: Works on tablets and phones

## 🚀 Quick Start

### Using This App

```bash
# Clone the repository
git clone https://github.com/ShinyShips/Maneuver-2026.git
cd Maneuver-2026

# Install dependencies
npm install

# Create .env from example
cp .env.example .env
# Edit .env and add your TBA API key

# Start development server
npm run dev

# Build for production
npm run build
```

### For Your Team

If you want to customize this for your team:

1. **Fork** this repository to your organization
2. **Customize** strategy configs in `src/game-template/` for your team's preferences
3. **Modify** pick list criteria in `pick-list-config.ts`
4. **Adjust** achievements in `gamification/achievements.ts`
5. **Deploy** to Netlify/Vercel using your fork

### Receiving Framework Updates

To pull bug fixes and framework enhancements from maneuver-core:

```bash
# Add maneuver-core as upstream remote
git remote add upstream https://github.com/ShinyShips/maneuver-core.git

# Fetch and merge updates (resolve conflicts favoring YOUR game-template/)
git fetch upstream
git merge upstream/main
```
git fetch upstream
git merge upstream/main --allow-unrelated-histories
# Resolve conflicts: keep YOUR version for game-template/, keep UPSTREAM for core/

# Future updates are simple
git fetch upstream
git merge upstream/main
```

> **Tip**: When resolving conflicts, game-specific files in `src/game-template/` should keep your version, while framework files in `src/core/` should typically use the upstream version.

### Environment Setup

Copy `.env.example` to `.env` and add your API keys:

```env
# The Blue Alliance API Key
# Get your key at: https://www.thebluealliance.com/account
VITE_TBA_API_KEY=your_tba_api_key_here

# Nexus Stats API Key (optional, for additional match data)
# Get your key at: https://frc.nexus/
VITE_NEXUS_API_KEY=your_nexus_api_key_here
```

## 📚 Documentation

### Getting Started
- [docs/README.md](docs/README.md) - Documentation index

### Architecture
| Topic | Link |
|-------|------|
| Framework Design | [docs/FRAMEWORK_DESIGN.md](docs/FRAMEWORK_DESIGN.md) |
| Architecture Strategy | [docs/ARCHITECTURE_STRATEGY.md](docs/ARCHITECTURE_STRATEGY.md) |
| Game Components | [docs/GAME_COMPONENTS.md](docs/GAME_COMPONENTS.md) |

### Feature Guides
| Feature | Link |
|---------|------|
| Database | [docs/DATABASE.md](docs/DATABASE.md) |
| PWA Setup | [docs/PWA.md](docs/PWA.md) |
| QR Data Transfer | [docs/QR_DATA_TRANSFER.md](docs/QR_DATA_TRANSFER.md) |
| JSON Transfer | [docs/JSON_DATA_TRANSFER.md](docs/JSON_DATA_TRANSFER.md) |
| Peer Transfer (WebRTC) | [docs/PEER_TRANSFER.md](docs/PEER_TRANSFER.md) |
| Data Transformation | [docs/DATA_TRANSFORMATION.md](docs/DATA_TRANSFORMATION.md) |

### Page Documentation
| Page | Link |
|------|------|
| Scouting Workflow | [docs/SCOUTING_WORKFLOW.md](docs/SCOUTING_WORKFLOW.md) |
| Strategy Overview | [docs/STRATEGY_OVERVIEW.md](docs/STRATEGY_OVERVIEW.md) |
| Match Strategy | [docs/MATCH_STRATEGY.md](docs/MATCH_STRATEGY.md) |
| Match Validation | [docs/MATCH_VALIDATION.md](docs/MATCH_VALIDATION.md) |
| Team Stats | [docs/TEAM_STATS.md](docs/TEAM_STATS.md) |
| Pick Lists | [docs/PICK_LISTS.md](docs/PICK_LISTS.md) |
| Pit Scouting | [docs/PIT_SCOUTING.md](docs/PIT_SCOUTING.md) |
| Scout Management | [docs/SCOUT_MANAGEMENT.md](docs/SCOUT_MANAGEMENT.md) |
| Achievements | [docs/ACHIEVEMENTS.md](docs/ACHIEVEMENTS.md) |

### Developer Guides
| Topic | Link |
|-------|------|
| React Contexts | [docs/CONTEXTS_GUIDE.md](docs/CONTEXTS_GUIDE.md) |
| Hooks Reference | [docs/HOOKS_REFERENCE.md](docs/HOOKS_REFERENCE.md) |
| Utility Hooks | [docs/UTILITY_HOOKS.md](docs/UTILITY_HOOKS.md) |
| Navigation | [docs/NAVIGATION_SETUP.md](docs/NAVIGATION_SETUP.md) |

## 🎮 Customizing for Your Game Year

The `game-schema.ts` file is the **single source of truth** for your game configuration:

```typescript
// src/game-template/game-schema.ts
export const gameSchema = {
  year2026 REBUILT Game Configuration

The `game-schema.ts` file defines all 2026-specific game elements:

```typescript
// src/game-template/game-schema.ts
export const actions = {
  fuelScored: { label: "Fuel Scored", points: { auto: 1, teleop: 1 } },
  autoClimb: { label: "Auto Climb L1", points: { auto: 15, teleop: 0 } },
  climbL1: { label: "Climb Level 1", points: { auto: 0, teleop: 10 } },
  climbL2: { label: "Climb Level 2", points: { auto: 0, teleop: 20 } },
  climbL3: { label: "Climb Level 3", points: { auto: 0, teleop: 30 } },
  // ...
};

export const zones = {
  allianceZone: { label: "Alliance Zone", actions: ['score', 'pass'] },
  neutralZone: { label: "Neutral Zone", actions: ['pass'] },
  opponentZone: { label: "Opponent Zone", actions: ['defense'] },
};
```

### Key 2026 Configurations

| File | Purpose |
|------|---------|
| `game-schema.ts` | Actions, zones, workflow, constants |
| `scoring.ts` | Point calculations for fuel, climbing, penalties |
| `strategy-config.ts` | Team statistics columns and aggregations |
| `pick-list-config.ts` | Alliance selection criteria |
| `match-strategy-config.ts` | Pre-match field annotations |
| `GAME_2026.md` | Complete game rules reference |

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Dexie.js (IndexedDB) |
| PWA | Vite PWA plugin |
| Data Transfer | QR fountain codes + JSON |
| API | The Blue Alliance (TBA) |
| Deployment | Netlify / Vercel |

## 🤝 Contributing

Contributions to improve the 2026 implementation are welcome! Please:

1. Test changes thoroughly with the 2026 game rules
2. Keep framework changes in `src/core/` generic (consider contributing to maneuver-core)
3. Document any new 2026-specific features
4. Run `npm run build` to verify no type errors

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Credits

Developed by **Andy Nguyen (ShinyShips) - FRC Team 3314 Alumni and Strategy Mentor** for the FRC community.

Built on the **maneuver-core** framework.

Special thanks to:
- [The Blue Alliance](https://www.thebluealliance.com/) for their excellent API
- [VScout](https://github.com/VihaanChhabria/VScout) by VihaanChhabria for initial inspiration
- All the open-source libraries that make this possible

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/ShinyShips/Maneuver-2026/issues)
- **Framework Issues**: [maneuver-core Issues](https://github.com/ShinyShips/maneuver-core/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ShinyShips/Maneuver-2026/discussions)

---
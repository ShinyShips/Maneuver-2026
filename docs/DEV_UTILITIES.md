# Dev Utilities Page

## Overview

The Dev Utilities page provides development and testing tools for the application. It includes test data generation, database management, and debugging features to help developers and testers work efficiently.

## Features

### 1. Full Demo Event Generator

Generate a complete realistic event for comprehensive testing.

```typescript
import { generateDemoEvent } from '@/core/lib/demoDataGenerator';
import { generate2026GameData } from '@/game-template/demoDataGenerator2026';

// Generate full event with 30 teams, 60 qual matches, playoffs
const result = await generateDemoEvent({
    eventKey: 'demo2026',
    clearExisting: true,
    gameDataGenerator: generate2026GameData,
    includePlayoffs: true,
});
```

**What it generates:**
- **30 teams** with realistic skill distributions (elite, strong, average, developing)
- **60 qualification matches** with balanced team scheduling
- **Full playoff bracket:**
  - Quarterfinals (4 matchups, 2 matches each)
  - Semifinals (2 matchups, 2 matches each)
  - Finals (3 matches)
- **~360 scouting entries** with realistic scoring patterns based on team skill

**Team Skill Profiles:**
- Elite teams (10%): Consistent high performers
- Strong teams (25%): Above-average performance
- Average teams (40%): Mid-tier performance
- Developing teams (25%): Learning and improving

**Realistic Data:**
- Scoring patterns match team skill levels
- Playoff matches show increased intensity
- Comments reflect team performance
- Timestamps spread across event timeline

### 2. Random Data Generation (Legacy)

Generate random scouting data for quick testing.

```typescript
import { generateRandomScoutingData } from '@/core/lib/testDataGenerator';

// Generate 50 random entries for testing
const testEntries = generateRandomScoutingData(50);
```

Options:
- **Count**: Number of entries to generate
- Uses random scoring values
- Random team numbers and match assignments

### 3. Database Operations

Quick access to database management:

| Action | Description |
|--------|-------------|
| **Clear Scouting Data** | Remove all match scouting entries |
| **Clear Pit Scouting** | Remove all pit scouting entries |
| **Clear Scout Profiles** | Remove gamification data |
| **Clear All Data** | Full database reset |

### 4. Data Inspection

View current database state:
- Total entries count by type
- Last updated timestamps
- Scout list with entry counts

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      DevUtilitiesPage                               │
└─────────────────────────────────────────────────────────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Demo Event       │  │ Database         │  │ Data Inspection  │
│ Generator        │  │ Operations       │  │ Panels           │
│                  │  │                  │  │                  │
│ - Full events    │  │ - Clear methods  │  │ - Entry counts   │
│ - Skill profiles │  │ - Backup/restore │  │ - Statistics     │
│ - Playoffs       │  │                  │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

## Demo Event Generator

**Locations:**
- Core: `src/core/lib/demoDataGenerator.ts` (game-agnostic framework)
- 2026: `src/game-template/demoDataGenerator2026.ts` (2026 game-specific generator)

### Game-Agnostic Architecture

The demo event generator follows framework design principles:

```typescript
// Core framework provides scheduling and structure
export type GameDataGenerator = (
    profile: TeamSkillProfile,
    matchKey: string
) => Record<string, unknown>;

// Game implementation provides realistic scoring
const generate2026GameData: GameDataGenerator = (profile, matchKey) => {
    // Generate 2026 FUEL game data based on team skill
    // Returns data in format expected by game transformation
};
```

### Team Skill Profiles

Each team is assigned a skill profile that affects performance:

```typescript
interface TeamSkillProfile {
    teamNumber: number;
    skillLevel: 'elite' | 'strong' | 'average' | 'developing';
    autoAccuracy: number;      // 0-1, auto scoring success rate
    teleopAccuracy: number;     // 0-1, teleop scoring success rate  
    endgameSuccess: number;     // 0-1, endgame completion rate
    consistency: number;        // 0-1, performance variance (1 = consistent)
}
```

**Distribution:**
- Elite (10%): autoAccuracy 0.85-1.0, teleopAccuracy 0.80-1.0
- Strong (25%): autoAccuracy 0.65-0.85, teleopAccuracy 0.65-0.85
- Average (40%): autoAccuracy 0.40-0.70, teleopAccuracy 0.45-0.75
- Developing (25%): autoAccuracy 0.20-0.50, teleopAccuracy 0.25-0.60

### Match Scheduling

**Qualification Matches (60):**
- Randomly distributed across 30 teams
- Each team plays ~12 matches
- Balanced alliance assignment

**Playoff Bracket:**
- Top 8 teams advance based on skill rankings
- Quarterfinals: 4 matchups, 2 matches each (1v8, 2v7, 3v6, 4v5)
- Semifinals: 2 matchups, 2 matches each
- Finals: 3 matches

### 2026 Game Data Generation

The 2026 generator creates realistic FUEL game data:

**Auto Phase (profile-based):**
- Elite: 4-6 fuel scored
- Strong: 2-4 fuel scored
- Average: 1-3 fuel scored
- Developing: 0-2 fuel scored

**Teleop Phase:**
- Elite: 12-18 fuel scored
- Strong: 8-14 fuel scored
- Average: 5-10 fuel scored
- Developing: 2-6 fuel scored
- 20% boost in playoff matches (teams push harder)

**Endgame (TOWER climbing):**
- Elite: 70% Level 3, 20% Level 2, 10% Level 1
- Strong: 10% Level 3, 70% Level 2, 20% Level 1
- Average/Developing: Level 1 most common

**Variance:**
- Consistency factor adds realistic match-to-match variation
- Lower consistency = higher variance in performance

### Usage Examples

```typescript
// Generate full demo event
const result = await generateDemoEvent({
    eventKey: 'demo2026',
    clearExisting: true,
    gameDataGenerator: generate2026GameData,
    includePlayoffs: true,
});

console.log(result.stats);
// {
//   teamsGenerated: 30,
//   qualMatches: 60,
//   playoffMatches: 19,
//   entriesGenerated: 474
// }

// Generate without playoffs (quals only)
const qualsOnly = await generateDemoEvent({
    eventKey: 'practice2026',
    includePlayoffs: false,
    gameDataGenerator: generate2026GameData,
});
```

### Extending for Other Games

To create demo data for a different game year:

```typescript
// src/game-template/demoDataGenerator2027.ts
import type { GameDataGenerator } from '@/core/lib/demoDataGenerator';
import { gameDataTransformation } from './transformation';

export const generate2027GameData: GameDataGenerator = (profile, matchKey) => {
    // 1. Generate raw actions based on profile
    const actions = generateActions(profile);
    
    // 2. Transform to database format
    return gameDataTransformation.transformActionsToCounters(actions);
};

// Then use in DevUtilitiesPage
import { generate2027GameData } from '@/game-template/demoDataGenerator2027';

await generateDemoEvent({
    gameDataGenerator: generate2027GameData,
    // ...other options
});
```

## Database Utility Functions

**Location:** `src/core/db/database.ts`

```typescript
// Clear specific data types
await clearAllScoutingData();
await clearAllPitScoutingData();
await clearGamificationData();

// Get statistics
const stats = await getDBStats();
// { scoutingEntries: 150, pitScoutingEntries: 32, scouts: 6 }
```

## Security Considerations

> **Warning:** The Dev Utilities page should be protected in production builds or removed entirely. It provides destructive database operations.

Options:
1. **Environment-based hiding**: Only show in development mode
2. **Password protection**: Require confirmation for destructive actions
3. **Build exclusion**: Remove from production bundle

## Best Practices

**DO:**
- ✅ Use for testing new features
- ✅ Generate test data before demos
- ✅ Clear test data before real events
- ✅ Verify data generation matches expected schema

**DON'T:**
- ❌ Use in production with real data
- ❌ Clear data without confirmation
- ❌ Generate test data during competitions
- ❌ Share dev utilities access broadly

---

**Last Updated:** January 2026
**Related Docs:**
- `docs/DATABASE.md` - Database operations
- `src/core/lib/testDataGenerator.ts` - Test data generation

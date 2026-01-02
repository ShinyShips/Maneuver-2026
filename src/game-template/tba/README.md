# Game-Specific TBA Integration

This folder contains **2025 REEFSCAPE-specific** TBA (The Blue Alliance) integration code as a reference implementation.

## ⚠️ Important: Year-Specific Code

These files are **NOT year-agnostic** and should be **copied and modified** for your game year:

- `tbaMatchData2025.ts` - 2025 REEFSCAPE score breakdown types and parsing

## Purpose

TBA integration requires understanding your game's scoring system to:
1. Parse TBA score breakdowns
2. Compare scouted data with official results
3. Validate match data for quality assurance

**Each game year has different:**
- Scoring elements (coral/algae vs rings/cubes, etc.)
- Point values
- TBA API response structure
- Validation rules

## How to Use This for Your Game

### Step 1: Copy the Template

```bash
# For 2026 game
cp src/game-template/tba/tbaMatchData2025.ts src/game-2026/tba/tbaMatchData2026.ts
```

### Step 2: Update Type Definitions

Modify `TBAScoreBreakdown` interface to match your game's TBA API response:

```typescript
// Example for 2026 game
export interface TBAScoreBreakdown2026 {
  // Total Points
  totalPoints: number;
  autoPoints: number;
  teleopPoints: number;
  
  // YOUR GAME'S SCORING ELEMENTS
  autoRingsScored: number;
  teleopCubesPlaced: number;
  // ... etc
}
```

### Step 3: Implement Parsing Logic

Update functions to extract your game's data from TBA response:

```typescript
export function parseMatchData2026(match: TBAMatch): ParsedTBAData {
  const breakdown = match.score_breakdown_2026; // Year-specific field
  
  // Extract YOUR game's data
  return {
    red: {
      totalPoints: breakdown.red.totalPoints,
      autoRingsScored: breakdown.red.autoRingsScored,
      // ... map TBA fields to your structure
    },
    blue: { /* ... */ }
  };
}
```

### Step 4: Integrate with Validation

Use your TBA types in validation rules (see `game-template/validation.ts`):

```typescript
// In your validation implementation
import { parseMatchData2026 } from './tba/tbaMatchData2026';

export const validationRules: ValidationRules = {
  validateMatch: async (scoutedEntry, tbaData) => {
    const parsed = parseMatchData2026(tbaData);
    // Compare scouted vs TBA data
  }
};
```

## 2025 REEFSCAPE Example

The included `tbaMatchData2025.ts` shows:

✅ **Complete TBA type definitions** for coral/algae scoring  
✅ **Alliance data structure** matching TBA API  
✅ **Parsing functions** to extract game elements  
✅ **Error handling** for missing/invalid data  

This is a **working reference** from the 2025 implementation.

## Core Framework vs Game Implementation

### ❌ Do NOT modify core framework
- `src/core/components/tba/` - Generic TBA components
- `src/core/hooks/` - Generic validation hooks
- `src/core/db/` - Database layer

### ✅ DO modify for your game
- `src/game-YYYY/tba/` - Your game's TBA types
- `src/game-YYYY/validation.ts` - Your validation rules
- `src/game-YYYY/scoring.ts` - Your scoring calculations

## Finding TBA API Structure

To find your game's TBA API response structure:

1. **Find a completed event** for your game year
2. **Call TBA API** for a match:
   ```
   GET /event/{event_key}/matches
   ```
3. **Inspect `score_breakdown_YYYY`** field in response
4. **Document the structure** in your types
5. **Test with real data** early in the season

## Resources

- [TBA API Documentation](https://www.thebluealliance.com/apidocs)
- [maneuver-core Framework Design](../../../docs/FRAMEWORK_DESIGN.md)
- [Game Integration Guide](../../../docs/INTEGRATION_GUIDE.md)

## Questions?

If you're implementing a new game year and need help:
1. Check the 2025 example in this folder
2. Review completed maneuver-YYYY implementations
3. Reference the framework documentation

---

**Remember:** TBA integration is **inherently game-specific**. Don't try to make it generic - embrace the year-specific nature and create clear, maintainable code for your game.

# Game-Specific Components Guide

This guide explains how to customize the scouting app for your specific FRC game year without modifying the core framework.

## Overview

The maneuver-core framework uses a **slot-based architecture** where game-specific components are imported from `game-template/components/` into core pages. This allows teams to:

- ✅ Customize game-specific UI without touching core code
- ✅ Easily update for new game years
- ✅ Maintain framework updates without merge conflicts
- ✅ Keep clear separation between framework and game logic
- ✅ Skip entire pages via workflow configuration

## Workflow Configuration

Teams can enable/disable scouting pages by editing `workflowConfig` in `game-schema.ts`:

```typescript
export const workflowConfig: WorkflowConfig = {
  pages: {
    autoStart: true,      // Skip starting position selection
    autoScoring: true,    // Auto period scoring
    teleopScoring: true,  // Teleop period scoring
    endgame: true,        // Skip endgame (teleop becomes submit)
  },
};
```

Any page can be the "submit" page—the last enabled page shows "Submit Match Data" automatically.

> [!NOTE]
> See [SCOUTING_WORKFLOW.md](./SCOUTING_WORKFLOW.md) for full workflow configuration details.

## Game-Specific Component Locations

All game-specific components live in `src/game-template/components/`, organized by page:

```
src/game-template/components/
├── index.ts                      # Export all game components
├── auto-start/
│   ├── index.ts                  # Auto start exports
│   └── FieldSelector.tsx         # Starting position selector
├── pit-scouting/
│   ├── index.ts                  # Pit scouting exports
│   └── GameQuestions.tsx         # Game-specific pit questions
└── [other-pages]/                # Add more page-specific directories
    └── [YourComponents].tsx
```

## Core Pages That Use Game Components

### 1. AutoStartPage (`src/core/pages/AutoStartPage.tsx`)

**Component Slot:** `<AutoStartFieldSelector>`

**Purpose:** Allows scouts to select where the robot starts autonomous mode.

**Props Interface:**

```typescript
interface AutoStartFieldSelectorProps {
  startPosition: (boolean | null)[];      // Array of position states
  setStartPosition: ((value: boolean | null) => void)[];  // Setter functions
  alliance?: string;                       // 'red' or 'blue'
}
```

**Data Storage:**
The selected position is stored as an array in the scouting entry:

```typescript
startPoses: [false, true, false, false, false]
// Position 1 (index 1) is selected
```

**Unified Configuration (Single Source of Truth):**

Starting positions are configured in `analysis.ts` via `getStartPositionConfig()`:

```typescript
// src/game-template/analysis.ts
getStartPositionConfig(): StartPositionConfig {
    return {
        positionCount: 5,                    // Number of positions
        positionLabels: ['Pos 0', 'Pos 1', 'Pos 2', 'Pos 3', 'Pos 4'],
        fieldImageRed: fieldMapImage,        // Import your red field image
        fieldImageBlue: fieldMapBlueImage,   // Import your blue field image
        zones: [                             // Clickable zones (640x480 base)
            { x: 0, y: 50, width: 128, height: 100, position: 0 },
            { x: 128, y: 50, width: 128, height: 100, position: 1 },
            { x: 256, y: 50, width: 128, height: 100, position: 2 },
            { x: 384, y: 50, width: 128, height: 100, position: 3 },
            { x: 512, y: 50, width: 128, height: 100, position: 4 },
        ],
    };
}
```

**Shared Components:**
- `InteractiveFieldMap.tsx` - Clickable field map for scouting workflow
- `AutoStartPositionMap.tsx` - Field visualization with stats for team stats page

Both components use the same zones from `getStartPositionConfig()` ensuring consistency.

**Customization Steps:**
1. Add your field images to `src/game-template/assets/`
2. Import them in `analysis.ts`
3. Update `getStartPositionConfig()` with your zones and images
4. The `FieldSelector.tsx` automatically uses the shared configuration

### 2. PitScoutingPage (`src/core/pages/PitScoutingPage.tsx`)

**Component Slot:** `children` prop (optional)

**Purpose:** Allows teams to add game-specific questions to pit scouting.

**Props Access:**

```typescript
interface PitScoutingPageProps {
  children?: React.ReactNode;
}

// Access form state via custom hook
const { formState, setGameData } = usePitScoutingForm();
```

**How It's Used:**

```typescript
// In your App.tsx or routing
import { GameSpecificQuestions } from "@/game-template/components";

<Route 
  path="/pit-scouting" 
  element={
    <PitScoutingPage>
      <GameSpecificQuestions />
    </PitScoutingPage>
  } 
/>
```

**Customization Example:**

For **2025 Reefscape**, you might ask about coral/algae capabilities:

```typescript
// game-template/components/pit-scouting/GameQuestions.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Label } from "@/core/components/ui/label";

interface GameSpecificQuestionsProps {
  gameData?: Record<string, unknown>;
  onGameDataChange: (data: Record<string, unknown>) => void;
}

export function GameSpecificPitQuestions({ gameData = {}, onGameDataChange }: GameSpecificQuestionsProps) {
  const handleChange = (key: string, value: unknown) => {
    onGameDataChange({ ...gameData, [key]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reefscape Capabilities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="canScoreCoral"
            checked={gameData.canScoreCoral as boolean}
            onCheckedChange={(checked) => handleChange('canScoreCoral', checked)}
          />
          <Label htmlFor="canScoreCoral">Can score coral</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="canScoreAlgae"
            checked={gameData.canScoreAlgae as boolean}
            onCheckedChange={(checked) => handleChange('canScoreAlgae', checked)}
          />
          <Label htmlFor="canScoreAlgae">Can score algae</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="canClimb"
            checked={gameData.canClimb as boolean}
            onCheckedChange={(checked) => handleChange('canClimb', checked)}
          />
          <Label htmlFor="canClimb">Can climb at endgame</Label>
        </div>
      </CardContent>
    </Card>
  );
}

## Adding New Game-Specific Components

If you need to add more game-specific slots to core pages:

### Step 1: Create the Component

```typescript
// src/game-template/components/[page-name]/MyCustomComponent.tsx
interface MyCustomComponentProps {
  // Define your props
  data: any;
  onChange: (data: any) => void;
}

export function MyCustomComponent({ data, onChange }: MyCustomComponentProps) {
  return (
    <Card>
      {/* Your game-specific UI */}
    </Card>
  );
}
```

### Step 2: Export from Page Index

```typescript
// src/game-template/components/[page-name]/index.ts
export { MyCustomComponent } from './MyCustomComponent';
```

### Step 3: Export from Main Index

```typescript
// src/game-template/components/index.ts
export { MyCustomComponent } from './[page-name]';
```

### Step 4: Use in Core Page

```typescript
// src/core/pages/SomePage.tsx
import { MyCustomComponent } from "@/game-template/components";

function SomePage() {
  return (
    <div>
      {/* Core UI */}
      <MyCustomComponent data={data} onChange={handleChange} />
      {/* More core UI */}
    </div>
  );
}
```

## Best Practices

### ✅ DO

- Keep all game-specific logic in `game-template/components/`
- Use TypeScript interfaces for type safety
- Document your component props with JSDoc comments
- Provide example implementations in comments
- Use core UI components (Card, Button, etc.) for consistency
- Test with multiple screen sizes (mobile, tablet, desktop)

### ❌ DON'T

- Modify core pages directly for game-specific features
- Hardcode game-specific values in core components
- Break the component interface (props must match what core pages expect)
- Forget to export new components from `index.ts`

## Migration Between Years

When creating a new year's app (e.g., maneuver-2026):

1. **Copy the template:**

   ```bash
   cp -r src/game-template src/game-2026
   ```

2. **Update components:**
   - Modify `auto-start/FieldSelector.tsx` for new field
   - Update `pit-scouting/GameQuestions.tsx` for new game pieces
   - Add any new page-specific directories as needed

3. **Update imports:**

   ```typescript
   // Change from:
   import { AutoStartFieldSelector } from "@/game-template/components";
   
   // To:
   import { AutoStartFieldSelector } from "@/game-2026/components";
   ```

4. **Update routing:**

   ```typescript
   // Update children in routes
   <Route 
     path="/pit-scouting" 
     element={
       <PitScoutingPage>
         <GameSpecificQuestions />
       </PitScoutingPage>
     } 
   />
   ```

## Testing Your Components

1. **Visual Testing:**
   - Test on mobile (portrait/landscape)
   - Test on tablet
   - Test on desktop (small/large screens)
   - Test both light and dark mode

2. **Functional Testing:**
   - Verify data is saved correctly
   - Check edge cases (no selection, multiple selections if allowed)
   - Test with different alliances (red/blue)
   - Verify form validation works

3. **Integration Testing:**
   - Ensure data flows to database correctly
   - Check QR code export includes your data
   - Verify data appears in team analysis views

## Need Help?

- See `docs/FRAMEWORK_DESIGN.md` for interface specifications
- Check `docs/INTEGRATION_GUIDE.md` for complete implementation examples
- Review existing components in `src/core/components/` for UI patterns
- Look at `src/game-template/` for starter templates

---

**Remember:** The goal is to customize the game-specific parts without touching the core framework. This keeps your app maintainable and upgradeable! 🎯

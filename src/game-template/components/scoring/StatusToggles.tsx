/**
 * Game-Specific Status Toggles Component - 2026
 * 
 * Automatically renders toggles from game-schema.ts configuration.
 * Groups toggles by their 'group' property for better organization.
 */

import { Button } from "@/core/components/ui/button";
import { toggles } from "@/game-template/game-schema";

interface StatusTogglesProps {
  phase: 'auto' | 'teleop' | 'endgame';
  status: any;
  onStatusUpdate: (updates: Partial<any>) => void;
}

export function StatusToggles({
  phase,
  status,
  onStatusUpdate,
}: StatusTogglesProps) {
  const phaseToggles = toggles[phase];
  if (!phaseToggles) return null;

  // Group toggles by their group property
  // Filter out toggles marked with excludeFromUI: true
  const grouped = new Map<string, Array<{ key: string; config: any }>>();
  
  Object.entries(phaseToggles).forEach(([key, config]) => {
    // Skip toggles that should be excluded from UI
    if ((config as any).excludeFromUI) return;
    
    const group = (config as any).group || 'default';
    if (!grouped.has(group)) {
      grouped.set(group, []);
    }
    grouped.get(group)!.push({ key, config });
  });

  // Group display names
  const groupTitles: Record<string, string> = {
    climb: 'Tower Climb',
    status: 'Status',
    roleActive: 'Active Phase Role(s)',
    roleInactive: 'Inactive Phase Role(s)',
    passingZone: 'Passing Zones',
    accuracy: 'Shooting Accuracy',
    default: 'Status',
  };

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([groupName, items]) => {
        // Check if this is a mutually exclusive group (climb, accuracy)
        // roleActive and roleInactive are multi-select, not mutually exclusive
        const isMutuallyExclusive = ['climb', 'accuracy'].includes(groupName);
        
        return (
          <div key={groupName}>
            <h3 className="font-medium text-sm mb-3">{groupTitles[groupName] || groupName}</h3>
            <div className="grid grid-cols-1 gap-2">
              {items.map(({ key, config }) => {
                const isActive = status?.[key];
                
                return (
                  <Button
                    key={key}
                    onClick={() => {
                      if (isMutuallyExclusive) {
                        // Clear all options in this group, then set the selected one
                        const updates: Record<string, boolean> = {};
                        items.forEach(item => {
                          updates[item.key] = false;
                        });
                        updates[key] = true;
                        onStatusUpdate(updates);
                      } else {
                        // Independent toggle
                        onStatusUpdate({ [key]: !status?.[key] });
                      }
                    }}
                    variant={isActive ? "default" : "outline"}
                    className="h-auto py-2 flex flex-col items-center"
                    style={isActive ? {
                      backgroundColor: '#3b82f6',
                      color: 'white'
                    } : undefined}
                  >
                    <div className="font-medium">
                      {isActive ? "✓ " : ""}{config.label}
                    </div>
                    {config.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {config.description}
                      </div>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

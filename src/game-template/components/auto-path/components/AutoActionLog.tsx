/**
 * AutoActionLog Component
 * 
 * Displays action history in a sidebar sheet with timestamps.
 * Extracted from AutoPathTracker for better organization.
 */

import { Badge } from '@/core/components/ui/badge';
import { Button } from '@/core/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/core/components/ui/sheet';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import { List, History as HistoryIcon } from 'lucide-react';
import type { PathWaypoint } from '../../field-map';
import { actions as schemaActions } from '@/game-template/game-schema';

// =============================================================================
// TYPES
// =============================================================================

export interface AutoActionLogProps {
    actions: PathWaypoint[];
    totalScore: number;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function getActionDisplay(action: PathWaypoint): { label: string; points: number } {
    // Find matching action in schema
    const schemaAction = Object.entries(schemaActions).find(([key, def]) => {
        if (def.pathType !== action.type) return false;
        
        // For climb, match autoClimb
        if (action.type === 'climb' && action.action === 'climb-success') {
            return key === 'autoClimb';
        }
        
        // For collect, match by pathAction
        if (action.type === 'collect' && 'pathAction' in def && def.pathAction) {
            return def.pathAction === action.action;
        }
        
        // For other actions, just match by pathType
        return true;
    });
    
    if (schemaAction) {
        const [, def] = schemaAction;
        return {
            label: def.label,
            points: def.points.auto || 0
        };
    }
    
    // Fallback
    return {
        label: action.type.charAt(0).toUpperCase() + action.type.slice(1),
        points: 0
    };
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AutoActionLog({ actions, totalScore, open, onOpenChange }: AutoActionLogProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-800">
                    <List className="h-4 w-4" />
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px] z-[110]">
                <SheetHeader className="pb-4">
                    <SheetTitle className="flex items-center justify-between w-full pr-6">
                        <div className="flex items-center gap-2">
                            <HistoryIcon className="h-5 w-5" />
                            <span>History</span>
                        </div>
                        <Badge variant="outline" className="text-xs font-mono">
                            Score: {totalScore}
                        </Badge>
                    </SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-100px)] pr-4">
                    <div className="space-y-3">
                        {actions.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No actions recorded yet.</p>
                        ) : (
                            [...actions].reverse().map((action, idx) => {
                                const display = getActionDisplay(action);
                                return (
                                    <div key={action.id} className="flex flex-col gap-1 p-3 rounded-lg bg-accent/50 border border-border">
                                        <div className="flex items-center justify-between">
                                            <Badge variant="outline" className="text-[10px] font-mono">
                                                #{actions.length - idx}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-sm text-foreground">
                                                {display.label}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {action.amountLabel && (
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        {action.amountLabel}
                                                    </Badge>
                                                )}
                                                {display.points > 0 && (
                                                    <Badge variant="default" className="text-xs">
                                                        +{display.points}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        {action.action && (
                                            <div className="text-xs text-muted-foreground italic">
                                                {action.action}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}

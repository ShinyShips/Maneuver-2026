/**
 * PendingWaypointPopup - Shared popup for fuel/climb selection
 * 
 * Used by both Auto and Teleop phases:
 * - Auto: Simple success/fail climb selection
 * - Teleop: Level selection (L1/L2/L3) + success/fail
 */

import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { Check, X, Undo2 } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import type { PathWaypoint, ClimbLevel, ClimbResult } from './types';
import { getFuelOptions, CLIMB_LEVELS } from './constants';
import { useEffect, useRef } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface PendingWaypointPopupProps {
    pendingWaypoint: PathWaypoint;
    accumulatedFuel: number;
    fuelHistory: number[];
    isFieldRotated: boolean;
    alliance: 'red' | 'blue'; // Alliance determines popup position
    robotCapacity?: number; // Fuel capacity from pit scouting

    // Fuel callbacks
    onFuelSelect: (value: number, label: string) => void;
    onFuelUndo: () => void;

    // Climb callbacks
    climbResult: ClimbResult | null;
    onClimbResultSelect: (result: ClimbResult) => void;

    // Teleop climb level (optional - only Teleop uses this)
    climbWithLevels?: boolean;
    climbLevel?: ClimbLevel;
    onClimbLevelSelect?: (level: ClimbLevel) => void;

    // Actions
    onConfirm: () => void;
    onCancel: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PendingWaypointPopup({
    pendingWaypoint,
    accumulatedFuel,
    fuelHistory,
    isFieldRotated,
    alliance,
    robotCapacity,
    onFuelSelect,
    onFuelUndo,
    climbResult,
    onClimbResultSelect,
    climbWithLevels = false,
    climbLevel,
    onClimbLevelSelect,
    onConfirm,
    onCancel,
}: PendingWaypointPopupProps) {
    const isClimb = pendingWaypoint.type === 'climb';
    const fuelOptions = getFuelOptions(robotCapacity);
    
    // Prevent immediate clicks after popup appears
    const justOpenedRef = useRef(true);
    
    useEffect(() => {
        justOpenedRef.current = true;
        const timer = setTimeout(() => {
            justOpenedRef.current = false;
        }, 150); // Small delay to prevent the initial click from triggering buttons
        
        return () => clearTimeout(timer);
    }, []);

    // Determine if confirm is enabled
    const canConfirm = isClimb
        ? (climbWithLevels ? climbLevel !== undefined && climbResult !== null : climbResult !== null)
        : accumulatedFuel > 0;

    return (
        <div className={cn(
            "absolute inset-0 z-40 flex items-center pointer-events-none p-2",
            "justify-center",
            alliance === 'blue' ? "md:justify-end" : "md:justify-start"
        )}>
            <Card className={cn(
                "w-full max-w-sm h-fit max-h-[95%] pointer-events-auto shadow-xl flex flex-col border-border/50 bg-background/98 backdrop-blur-sm overflow-hidden gap-2",
                isFieldRotated && "rotate-180"
            )}>
                {/* Header */}
                <CardHeader className="pb-1 shrink-0">
                    <div className="flex items-center justify-center gap-3">
                        <Badge variant="outline" className={cn(
                            "font-bold px-2 py-0.5 shrink-0",
                            pendingWaypoint.type === 'score' ? "text-green-500 border-green-500/50" :
                                pendingWaypoint.type === 'climb' ? "text-blue-500 border-blue-500/50" :
                                    "text-purple-500 border-purple-500/50"
                        )}>
                            {pendingWaypoint.type.toUpperCase()}
                        </Badge>
                        <CardTitle className="text-lg font-bold tracking-tight">
                            {isClimb
                                ? (climbWithLevels
                                    ? (climbLevel ? `${climbLevel} - Select Outcome` : 'Select Level')
                                    : 'Climb Outcome')
                                : (accumulatedFuel > 0 ? `Total: +${accumulatedFuel}` : 'Select Amount')}
                        </CardTitle>
                    </div>
                </CardHeader>

                {/* Content */}
                <CardContent className="overflow-y-auto px-2 shrink min-h-0">
                    {isClimb ? (
                        climbWithLevels && !climbLevel ? (
                            // Teleop: Level selection first
                            <div className="grid grid-cols-3 gap-3 p-2">
                                {CLIMB_LEVELS.map((level) => (
                                    <Button
                                        key={level}
                                        variant="outline"
                                        onClick={() => onClimbLevelSelect?.(level)}
                                        className="h-16 flex flex-col gap-1 items-center justify-center border-2 transition-all rounded-xl hover:bg-blue-500/20 hover:border-blue-400"
                                    >
                                        <span className="font-bold text-lg">{level}</span>
                                    </Button>
                                ))}
                            </div>
                        ) : (
                            // Success/Fail selection (both phases)
                            <div className="grid grid-cols-2 gap-4 p-2">
                                <Button
                                    variant={climbResult === 'success' ? 'default' : 'outline'}
                                    onClick={() => onClimbResultSelect('success')}
                                    className={cn(
                                        "h-20 flex flex-col gap-1 items-center justify-center border-2 transition-all rounded-xl",
                                        climbResult === 'success' && "bg-blue-600 hover:bg-blue-700 border-blue-400 text-white shadow-lg"
                                    )}
                                >
                                    <Check className="h-6 w-6 font-bold" />
                                    <span className="font-bold text-sm">SUCCESS</span>
                                </Button>
                                <Button
                                    variant={climbResult === 'fail' ? 'default' : 'outline'}
                                    onClick={() => onClimbResultSelect('fail')}
                                    className={cn(
                                        "h-20 flex flex-col gap-1 items-center justify-center border-2 transition-all rounded-xl",
                                        climbResult === 'fail' && "bg-red-600 hover:bg-red-700 border-red-400 text-white shadow-lg"
                                    )}
                                >
                                    <X className="h-6 w-6 font-bold" />
                                    <span className="font-bold text-sm">FAIL</span>
                                </Button>
                            </div>
                        )
                    ) : (
                        // Fuel selection
                        <div className="grid grid-cols-4 gap-2 px-1">
                            {fuelOptions.map((opt) => (
                                <Button
                                    key={opt.label}
                                    variant="outline"
                                    size="lg"
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        if (!justOpenedRef.current) {
                                            onFuelSelect(opt.value, opt.label);
                                        }
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className="h-10 w-full text-xs md:text-sm rounded-lg font-bold transition-all"
                                >
                                    {opt.label.includes('/') || opt.label === 'Full' ? opt.label : `+${opt.label}`}
                                </Button>
                            ))}
                        </div>
                    )}
                </CardContent>

                {/* Footer */}
                <CardFooter className="flex flex-row items-center justify-between gap-3 border-t shrink-0 !pt-2">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-full border-2"
                        onClick={onCancel}
                    >
                        <X className="h-6 w-6 text-muted-foreground" />
                    </Button>

                    <div className="flex flex-row gap-3">
                        {!isClimb && (
                            <Button
                                variant="secondary"
                                size="icon"
                                className="h-12 w-12 rounded-full border-2"
                                onClick={(e) => { e.stopPropagation(); onFuelUndo(); }}
                                disabled={fuelHistory.length === 0}
                            >
                                <Undo2 className="h-6 w-6" />
                            </Button>
                        )}

                        <Button
                            size="icon"
                            onClick={onConfirm}
                            disabled={!canConfirm}
                            className="h-12 w-12 rounded-full border-2 bg-green-600 hover:bg-green-500"
                        >
                            <Check className="h-6 w-6" />
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

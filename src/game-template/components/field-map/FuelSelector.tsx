/**
 * FuelSelector Component
 * 
 * Cumulative additive fuel selection picker with precise undo.
 * Shows options like +1, +3, +8, 1/4, 1/2, 3/4, Full.
 */

import { Button } from '@/core/components/ui/button';
import { cn } from '@/core/lib/utils';
import { Check, X, Undo2 } from 'lucide-react';
import { getFuelOptions } from './constants';

// =============================================================================
// PROPS
// =============================================================================

export interface FuelSelectorProps {
    onSelect: (amount: number, label: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
    onUndo?: () => void;
    accumulatedFuel: number;
    canUndo?: boolean;
    isLarge?: boolean;
    type?: 'score' | 'pass' | 'collect';
    className?: string;
    robotCapacity?: number; // Fuel capacity from pit scouting
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FuelSelector({
    onSelect,
    onConfirm,
    onCancel,
    onUndo,
    accumulatedFuel,
    canUndo = false,
    isLarge = false,
    type = 'score',
    className,
    robotCapacity,
}: FuelSelectorProps) {
    const fuelOptions = getFuelOptions(robotCapacity);
    
    const getTypeColor = () => {
        switch (type) {
            case 'score': return 'text-green-400';
            case 'pass': return 'text-purple-400';
            case 'collect': return 'text-yellow-400';
            default: return 'text-green-400';
        }
    };

    return (
        <div className={cn("flex flex-col gap-2", className)}>
            {/* Options Grid */}
            <div className={cn(
                "grid gap-1.5 items-center justify-center p-1 w-full",
                isLarge ? "grid-cols-4 gap-2 px-1" : "flex flex-wrap gap-1"
            )}>
                {fuelOptions.map((opt) => (
                    <Button
                        key={opt.label}
                        variant="outline"
                        size={isLarge ? "lg" : "sm"}
                        onClick={(e) => { e.stopPropagation(); onSelect(opt.value, opt.label); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={cn(
                            "font-bold transition-all",
                            isLarge && "h-10 w-full text-xs md:text-sm rounded-lg",
                        )}
                    >
                        {opt.label.includes('/') || opt.label === 'Full' ? opt.label : `+${opt.label}`}
                    </Button>
                ))}
            </div>

            {/* Accumulated Display */}
            <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-slate-400">Amount:</span>
                <span className={cn("font-bold text-lg", getTypeColor())}>
                    {accumulatedFuel}
                </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onCancel(); }}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                </Button>

                {onUndo && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onUndo(); }}
                        disabled={!canUndo}
                        className="text-slate-400 hover:text-slate-300 hover:bg-slate-500/10 disabled:opacity-30"
                    >
                        <Undo2 className="h-4 w-4 mr-1" />
                        Undo
                    </Button>
                )}

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                    disabled={accumulatedFuel === 0}
                    className="text-green-400 hover:text-green-300 hover:bg-green-500/10 disabled:opacity-30"
                >
                    <Check className="h-4 w-4 mr-1" />
                    Confirm
                </Button>
            </div>
        </div>
    );
}

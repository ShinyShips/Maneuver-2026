/**
 * ClimbSelector Component
 * 
 * Selector for climb level (L1/L2/L3) and result (success/fail).
 */

import { Button } from '@/core/components/ui/button';
import { cn } from '@/core/lib/utils';
import { Check, X, ArrowUpNarrowWide } from 'lucide-react';
import type { ClimbLevel, ClimbResult, ClimbSelectorProps } from './types';
import { CLIMB_LEVELS } from './constants';

// =============================================================================
// COMPONENT
// =============================================================================

export function ClimbSelector({
    onSelect,
    onCancel,
    selectedLevel,
    selectedResult = 'success',
}: ClimbSelectorProps) {
    const handleLevelSelect = (level: ClimbLevel) => {
        onSelect(level, selectedResult);
    };

    const handleResultToggle = (result: ClimbResult) => {
        if (selectedLevel) {
            onSelect(selectedLevel, result);
        }
    };

    return (
        <div className="flex flex-col items-center gap-3 p-4 bg-slate-900/95 rounded-xl border border-slate-700 shadow-xl">
            <div className="flex items-center gap-2 text-purple-400">
                <ArrowUpNarrowWide className="h-5 w-5" />
                <span className="font-bold">Climb</span>
            </div>

            {/* Level Selection */}
            <div className="flex gap-2">
                {CLIMB_LEVELS.map((level) => (
                    <Button
                        key={level}
                        variant={selectedLevel === level ? "default" : "outline"}
                        size="lg"
                        onClick={(e) => { e.stopPropagation(); handleLevelSelect(level); }}
                        className={cn(
                            "font-bold min-w-[60px]",
                            selectedLevel === level && "bg-purple-600 hover:bg-purple-500"
                        )}
                    >
                        {level}
                    </Button>
                ))}
            </div>

            {/* Result Selection (only if level selected) */}
            {selectedLevel && (
                <div className="flex gap-2">
                    <Button
                        variant={selectedResult === 'success' ? "default" : "outline"}
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleResultToggle('success'); }}
                        className={cn(
                            "font-bold",
                            selectedResult === 'success' && "bg-green-600 hover:bg-green-500"
                        )}
                    >
                        <Check className="h-4 w-4 mr-1" />
                        Success
                    </Button>
                    <Button
                        variant={selectedResult === 'fail' ? "default" : "outline"}
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleResultToggle('fail'); }}
                        className={cn(
                            "font-bold",
                            selectedResult === 'fail' && "bg-red-600 hover:bg-red-500"
                        )}
                    >
                        <X className="h-4 w-4 mr-1" />
                        Fail
                    </Button>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-2 mt-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onCancel(); }}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                </Button>

                {selectedLevel && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onSelect(selectedLevel, selectedResult); }}
                        className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                    >
                        <Check className="h-4 w-4 mr-1" />
                        Confirm
                    </Button>
                )}
            </div>
        </div>
    );
}

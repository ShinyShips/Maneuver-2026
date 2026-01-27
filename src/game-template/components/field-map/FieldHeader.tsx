/**
 * FieldHeader - Shared header component for Auto and Teleop field maps
 * 
 * Provides consistent header UI with:
 * - Back/proceed navigation
 * - Match info (number, type, team)
 * - Zone badge  
 * - Stat badges
 * - Action controls (undo, rotate, fullscreen)
 */

import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/core/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/core/components/ui/dropdown-menu';
import { Maximize2, Minimize2, Undo2, ChevronLeft, ArrowRight, RotateCw, AlertTriangle, UserX, MoreVertical, List } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import type { ZoneType } from './types';
import { useState } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface FieldHeaderStat {
    label: string;
    value: number;
    color: 'green' | 'purple' | 'slate' | 'yellow';
}

export interface FieldHeaderProps {
    phase: 'auto' | 'teleop';

    // Stats to display (phase-specific)
    stats: FieldHeaderStat[];

    // Current zone for badge display
    currentZone?: ZoneType | null;

    // Fullscreen state
    isFullscreen: boolean;
    onFullscreenToggle: () => void;

    // Optional action log slot (phase-specific component)
    actionLogSlot?: React.ReactNode;
    
    // Optional action log trigger (for kebab menu)
    onActionLogOpen?: () => void;

    // From context (optional overrides)
    matchNumber?: string | number;
    matchType?: 'qm' | 'sf' | 'f';
    teamNumber?: string | number;
    alliance?: 'red' | 'blue';
    isFieldRotated?: boolean;
    canUndo?: boolean;
    onUndo?: () => void;
    onBack?: () => void;
    onProceed?: () => void;
    toggleFieldOrientation?: () => void;
    
    // Broken down tracking
    isBrokenDown?: boolean;
    onBrokenDownToggle?: () => void;
    
    // No show handling (auto only)
    onNoShow?: () => void;
}

// =============================================================================
// HELPER
// =============================================================================

function formatMatchLabel(matchNumber: string | number, matchType?: 'qm' | 'sf' | 'f'): string {
    const num = matchNumber.toString();
    if (!matchType || matchType === 'qm') return `qm${num}`;
    if (matchType === 'sf') return `sf${num}m1`;
    if (matchType === 'f') return `f1m${num}`;
    return num;
}

function getZoneLabel(zone: ZoneType): string {
    switch (zone) {
        case 'allianceZone': return 'Alliance';
        case 'neutralZone': return 'Neutral';
        case 'opponentZone': return 'Opponent';
    }
}

function getZoneClassName(zone: ZoneType, alliance: 'red' | 'blue'): string {
    switch (zone) {
        case 'allianceZone':
            return alliance === 'red' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300';
        case 'neutralZone':
            return 'bg-yellow-500/20 text-yellow-300';
        case 'opponentZone':
            return alliance === 'red' ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-300';
    }
}

function getStatColorClass(color: FieldHeaderStat['color']): string {
    switch (color) {
        case 'green': return 'bg-green-600/20 text-green-400 border-green-500/30';
        case 'purple': return 'bg-purple-600/20 text-purple-400 border-purple-500/30';
        case 'yellow': return 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30';
        case 'slate': return 'bg-slate-800/50 text-slate-300 border-slate-700/50';
    }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FieldHeader({
    phase,
    stats,
    currentZone,
    onActionLogOpen,
    isFullscreen,
    onFullscreenToggle,
    actionLogSlot,
    matchNumber,
    matchType,
    teamNumber,
    alliance = 'blue',
    isFieldRotated = false,
    canUndo = false,
    onUndo,
    onBack,
    onProceed,
    toggleFieldOrientation,
    isBrokenDown = false,
    onBrokenDownToggle,
    onNoShow,
}: FieldHeaderProps) {
    const phaseLabel = phase === 'auto' ? 'Autonomous' : 'Teleop';
    const proceedLabel = phase === 'auto' ? 'Teleop' : 'Post Match';
    
    const [showNoShowDialog, setShowNoShowDialog] = useState(false);

    return (
        <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Back button + Phase Label (fullscreen only) */}
                {isFullscreen && (
                    <div className="flex items-center gap-1.5 shrink-0">
                        {onBack && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onBack}
                                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                        )}
                        <span className="text-sm mr-2 font-bold text-slate-200">
                            {phaseLabel}
                        </span>
                    </div>
                )}

                {/* Match Info */}
                {(matchNumber || teamNumber) && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded-md border border-slate-700/50 shrink-0">
                        {matchNumber && (
                            <span className="text-[10px] md:text-xs font-bold text-slate-400">
                                {formatMatchLabel(matchNumber, matchType)}
                            </span>
                        )}
                        {matchNumber && teamNumber && <div className="w-[1px] h-3 bg-slate-800/50" />}
                        {teamNumber && (
                            <span className="text-[10px] md:text-xs font-bold text-slate-400">
                                {teamNumber}
                            </span>
                        )}
                    </div>
                )}

                {/* Zone Badge */}
                {currentZone && (
                    <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] md:text-xs font-medium shrink-0",
                        getZoneClassName(currentZone, alliance)
                    )}>
                        {getZoneLabel(currentZone)}
                    </span>
                )}

                {/* Stat Badges */}
                <div className="flex items-center gap-1 sm:gap-2 ml-auto">
                    {stats.map((stat, i) => (
                        <Badge
                            key={i}
                            variant="secondary"
                            className={cn(
                                "text-[10px] md:text-xs px-1.5 py-0",
                                getStatColorClass(stat.color)
                            )}
                        >
                            {stat.label}: {stat.value}
                        </Badge>
                    ))}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 pl-4">
                {/* Broken Down Button - Always visible */}
                {onBrokenDownToggle && (
                    <Button
                        variant={isBrokenDown ? "destructive" : "outline"}
                        size="sm"
                        onClick={onBrokenDownToggle}
                        className={cn(
                            "h-8 px-2 md:px-3 text-[10px] md:text-xs font-bold gap-1",
                            isBrokenDown && "animate-pulse"
                        )}
                        title={isBrokenDown ? "Robot is broken down - tap to resume" : "Mark robot as broken down"}
                    >
                        <AlertTriangle className="h-3 w-3 md:h-4 md:w-4" />
                        <span className="hidden sm:inline">Broken?</span>
                    </Button>
                )}

                {/* Undo - Always visible on mobile/tablet */}
                {onUndo && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onUndo}
                        disabled={!canUndo}
                        className={cn("h-8 w-8 hover:bg-slate-800 lg:hidden", canUndo && "text-red-400 animate-in fade-in zoom-in duration-300")}
                    >
                        <Undo2 className="h-4 w-4" />
                    </Button>
                )}

                {/* Kebab Menu (mobile and tablet, until lg) */}
                <div className="lg:hidden">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-slate-800"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 z-[150]">
                            {/* Action Log */}
                            {onActionLogOpen && (
                                <>
                                    <DropdownMenuItem onClick={onActionLogOpen}>
                                        <List className="h-4 w-4 mr-2" />
                                        Action History
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}

                            {/* No Show (auto only) */}
                            {phase === 'auto' && onNoShow && (
                                <>
                                    <DropdownMenuItem
                                        onClick={() => setShowNoShowDialog(true)}
                                        className="text-orange-400"
                                    >
                                        <UserX className="h-4 w-4 mr-2" />
                                        No Show
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            
                            {/* Rotate Field */}
                            {toggleFieldOrientation && (
                                <DropdownMenuItem
                                    onClick={toggleFieldOrientation}
                                    className={cn(isFieldRotated && "text-blue-400")}
                                >
                                    <RotateCw className={cn("h-4 w-4 mr-2 transition-transform", isFieldRotated && "rotate-180")} />
                                    {isFieldRotated ? "Reset Rotation" : "Rotate 180°"}
                                </DropdownMenuItem>
                            )}
                            
                            {/* Fullscreen Toggle */}
                            <DropdownMenuItem onClick={onFullscreenToggle}>
                                {isFullscreen ? (
                                    <>
                                        <Minimize2 className="h-4 w-4 mr-2" />
                                        Exit Fullscreen
                                    </>
                                ) : (
                                    <>
                                        <Maximize2 className="h-4 w-4 mr-2" />
                                        Enter Fullscreen
                                    </>
                                )}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Desktop Action Buttons (lg and up) */}
                <div className="hidden lg:flex lg:items-center lg:gap-1">
                    {/* No Show Button (auto only) */}
                    {phase === 'auto' && onNoShow && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowNoShowDialog(true)}
                            className="h-8 px-2 lg:px-3 text-[10px] lg:text-xs font-bold gap-1 text-orange-400 hover:text-orange-300 border-orange-500/30"
                            title="Robot did not show up for this match"
                        >
                            <UserX className="h-3 w-3 lg:h-4 lg:w-4" />
                            <span>No Show</span>
                        </Button>
                    )}

                    {/* Undo */}
                    {onUndo && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onUndo}
                            disabled={!canUndo}
                            className={cn("h-8 w-8 hover:bg-slate-800", canUndo && "text-red-400 animate-in fade-in zoom-in duration-300")}
                        >
                            <Undo2 className="h-4 w-4" />
                        </Button>
                    )}

                    {/* Action Log Slot (phase-specific) */}
                    {actionLogSlot}

                    {/* Rotate Field */}
                    {toggleFieldOrientation && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleFieldOrientation}
                            className={cn("h-8 w-8 hover:bg-slate-800", isFieldRotated && "text-blue-400")}
                            title={isFieldRotated ? "Reset field orientation" : "Rotate field 180°"}
                        >
                            <RotateCw className={cn("h-4 w-4 transition-transform", isFieldRotated && "rotate-180")} />
                        </Button>
                    )}

                    {/* Fullscreen Toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onFullscreenToggle}
                        className="h-8 w-8 hover:bg-slate-800"
                    >
                        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                </div>

                {/* Proceed (fullscreen only) - Always visible when applicable */}
                {isFullscreen && onProceed && (
                    <Button
                        onClick={onProceed}
                        className={cn(
                            "h-8 px-3 ml-1 text-[11px] font-bold tracking-tight gap-1",
                            phase === 'teleop' && "bg-green-600 hover:bg-green-500"
                        )}
                    >
                        <span className="hidden sm:inline">{proceedLabel}</span>
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* No Show Confirmation Dialog */}
            <Dialog open={showNoShowDialog} onOpenChange={setShowNoShowDialog}>
                <DialogContent className="z-[150]">
                    <DialogHeader>
                        <DialogTitle>Confirm No Show</DialogTitle>
                        <DialogDescription>
                            Are you sure team {teamNumber} did not show up for match {formatMatchLabel(matchNumber || '', matchType)}?
                            <br /><br />
                            This will immediately submit the match data with a no-show flag.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            className='p-4'
                            onClick={() => setShowNoShowDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            className='p-4'
                            onClick={() => {
                                setShowNoShowDialog(false);
                                if (onNoShow) onNoShow();
                            }}
                        >
                            Confirm No Show
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

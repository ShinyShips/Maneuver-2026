/**
 * FieldButton Component
 * 
 * A positioned button that overlays the field map at its actual location.
 * Supports stuck state for traversal buttons.
 */

import { Target, TrainFrontTunnel, Triangle, ArrowUpNarrowWide, Fuel, Warehouse, Inbox, TriangleAlert, HandCoins, Shield, Grab } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import type { FieldButtonProps } from './types';

// =============================================================================
// ICON MAPPING
// =============================================================================

const ICON_MAP: Record<string, { icon: React.ElementType; className: string }> = {
    'HUB_ICON': { icon: Target, className: 'text-green-500' },
    'TRENCH_ICON': { icon: TrainFrontTunnel, className: 'text-amber-400' },
    'BUMP_ICON': { icon: Triangle, className: 'fill-slate-400 text-slate-400' },
    'CLIMB_ICON': { icon: ArrowUpNarrowWide, className: 'text-purple-400' },
    'COLLECT_ICON': { icon: Fuel, className: 'text-yellow-400' },
    'DEPOT_ICON': { icon: Warehouse, className: 'text-emerald-400' },
    'OUTPOST_ICON': { icon: Inbox, className: 'text-orange-400' },
    'FOUL_ICON': { icon: TriangleAlert, className: 'text-red-500' },
    'PASS_ICON': { icon: HandCoins, className: 'text-purple-400' },
    'DEFENSE_ICON': { icon: Shield, className: 'text-cyan-400' },
    'STEAL_ICON': { icon: Grab, className: 'text-rose-400' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function FieldButton({
    elementKey,
    element,
    isVisible,
    isDisabled = false,
    isStuck = false,
    isPotentialStuck = false,
    isSelected = false,
    count,
    onClick,
    alliance,
    isFieldRotated = false,
    containerWidth,
    overrideX,
}: FieldButtonProps) {
    const logicalX = overrideX !== undefined ? overrideX : element.x;
    const logicalY = element.y;

    // Visual X and Y depend on alliance mirroring
    // For red alliance, both X and Y are mirrored since the field is symmetric
    const visualX = alliance === 'red' ? (1 - logicalX) : logicalX;
    const visualY = alliance === 'red' ? (1 - logicalY) : logicalY;

    const x = visualX * 100;
    const y = visualY * 100;

    // Proportional scaling based on container width
    const baseSize = containerWidth * 0.055;
    const buttonSize = Math.max(28, Math.min(baseSize, 55));
    const fontSize = buttonSize * 0.45;
    const labelSize = buttonSize * 0.2;

    const width = buttonSize * (element.scaleWidth || 1);
    const height = buttonSize * (element.scaleHeight || 1);

    const isButtonEnabled = (isVisible || isStuck || isPotentialStuck) && !isDisabled;

    const iconConfig = ICON_MAP[element.label];
    const IconComponent = iconConfig?.icon;

    return (
        <button
            key={elementKey}
            onClick={() => onClick(elementKey)}
            className={cn(
                "absolute transform -translate-x-1/2 -translate-y-1/2 rounded-xl",
                "flex flex-col items-center justify-center",
                "transition-all duration-200",
                "border shadow-lg",
                isButtonEnabled
                    ? (isStuck
                        ? "bg-red-600 border-red-400 animate-pulse hover:bg-red-500 scale-110 z-10"
                        : isPotentialStuck
                            ? "bg-amber-600 border-amber-400 hover:bg-amber-500 animate-in fade-in zoom-in duration-300"
                            : "bg-slate-800/90 border-slate-500 hover:bg-slate-700 hover:scale-105 hover:border-white")
                    : "bg-slate-900/50 border-slate-700/50 opacity-30 cursor-not-allowed",
            )}
            style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${width}px`,
                height: `${height}px`,
            }}
            disabled={!isButtonEnabled}
        >
            {/* Counter-rotate content when field is rotated */}
            <div className={cn("flex flex-col items-center justify-center", isFieldRotated && "rotate-180")}>
                {isStuck ? (
                    <>
                        <TriangleAlert style={{ width: `${fontSize}px`, height: `${fontSize}px` }} className="text-white mb-0.5" />
                        <span style={{ fontSize: `${labelSize}px` }} className="font-bold text-white uppercase leading-none">STUCK!</span>
                    </>
                ) : isPotentialStuck ? (
                    <>
                        <TriangleAlert style={{ width: `${fontSize}px`, height: `${fontSize}px` }} className="text-white mb-0.5" />
                        <span style={{ fontSize: `${labelSize}px` }} className="font-bold text-white uppercase leading-none">STUCK?</span>
                    </>
                ) : (
                    <>
                        {isSelected && (
                            <div className="absolute inset-0 border-2 border-blue-400 rounded-xl animate-pulse" />
                        )}
                        {count !== undefined && count > 0 && (
                            <div 
                                className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full font-bold flex items-center justify-center shadow-lg"
                                style={{ 
                                    width: `${buttonSize * 0.35}px`, 
                                    height: `${buttonSize * 0.35}px`,
                                    fontSize: `${buttonSize * 0.2}px`
                                }}
                            >
                                {count}
                            </div>
                        )}
                        {IconComponent ? (
                            <IconComponent
                                style={{ width: `${fontSize}px`, height: `${fontSize}px` }}
                                className={iconConfig.className}
                            />
                        ) : (
                            <span style={{ fontSize: `${fontSize}px` }}>{element.label}</span>
                        )}
                        <span
                            className="text-slate-300 font-medium leading-none mt-0.5"
                            style={{ fontSize: `${labelSize}px` }}
                        >
                            {element.name}
                        </span>
                    </>
                )}
            </div>
        </button>
    );
}


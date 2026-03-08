/**
 * ShootingTimer - Button component for tracking shooting time during scouting
 * 
 * Features:
 * - Start/stop timer with visual feedback
 * - Displays cumulative shooting time
 * - Animated when active
 * - Parent manages persistence via onTimeChange callback
 * - Can be controlled programmatically via ref
 */

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/core/components/ui/button';
import { Target } from 'lucide-react';
import { cn } from '@/core/lib/utils';

interface ShootingTimerProps {
    /** Callback when shooting time changes (in milliseconds) */
    onTimeChange?: (totalTime: number) => void;
    
    /** Optional initial time in milliseconds */
    initialTime?: number;
    
    /** Optional class name */
    className?: string;
}

export interface ShootingTimerRef {
    /** Programmatically start the timer */
    start: () => void;
    /** Programmatically stop the timer */
    stop: () => void;
    /** Check if timer is currently running */
    isRunning: () => boolean;
}

/**
 * Format milliseconds to MM:SS display
 */
function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export const ShootingTimer = forwardRef<ShootingTimerRef, ShootingTimerProps>(
    ({ onTimeChange, initialTime = 0, className }, ref) => {
        // Timer state
        const [isActive, setIsActive] = useState(false);
        const [startTime, setStartTime] = useState<number | null>(null);
        const [totalTime, setTotalTime] = useState(initialTime);
        const [displayTime, setDisplayTime] = useState(initialTime);

        // Expose methods to parent via ref
        useImperativeHandle(ref, () => ({
            start: () => {
                if (!isActive) {
                    setIsActive(true);
                    setStartTime(Date.now());
                }
            },
            stop: () => {
                if (isActive && startTime) {
                    const elapsed = Date.now() - startTime;
                    const newTotal = totalTime + elapsed;
                    setTotalTime(newTotal);
                    setDisplayTime(newTotal);
                    setIsActive(false);
                    setStartTime(null);
                }
            },
            isRunning: () => isActive,
        }), [isActive, startTime, totalTime]);

        // Update display time while timer is running
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;

        if (isActive && startTime) {
            interval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                setDisplayTime(totalTime + elapsed);
            }, 100); // Update 10 times per second for smooth display
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isActive, startTime, totalTime]);

    // Notify parent when total time changes
    useEffect(() => {
        onTimeChange?.(totalTime);
    }, [totalTime, onTimeChange]);

    const handleToggle = () => {
        if (isActive) {
            // Stop - accumulate the time
            if (startTime) {
                const elapsed = Date.now() - startTime;
                const newTotal = totalTime + elapsed;
                setTotalTime(newTotal);
                setDisplayTime(newTotal);
            }
            setIsActive(false);
            setStartTime(null);
        } else {
            // Start - begin tracking
            setIsActive(true);
            setStartTime(Date.now());
        }
    };

    const hasTime = displayTime > 0;

    return (
        <Button
            variant={isActive ? "default" : hasTime ? "secondary" : "outline"}
            size="sm"
            onClick={handleToggle}
            className={cn(
                "h-8 px-2 md:px-3 text-[10px] md:text-xs font-bold gap-1.5 min-w-[80px] md:min-w-[100px]",
                isActive && "animate-pulse bg-green-600 hover:bg-green-700 text-white",
                hasTime && !isActive && "bg-green-600/20 text-green-400 border-green-500/30",
                className
            )}
            title={isActive ? "Stop shooting timer" : "Start shooting timer"}
        >
            <Target className={cn(
                "h-3 w-3 md:h-4 md:w-4",
                isActive && "animate-pulse"
            )} />
            <span className="font-mono tabular-nums">
                {formatTime(displayTime)}
            </span>
        </Button>
    );
});

ShootingTimer.displayName = 'ShootingTimer';

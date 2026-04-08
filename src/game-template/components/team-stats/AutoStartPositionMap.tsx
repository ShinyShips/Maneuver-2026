/**
 * Auto Start Position Map Component
 * 
 * Visualizes robot starting positions on the field image with color-coded zones
 * showing percentages and average auto points per position.
 * 
 * CONFIGURABLE: Zone positions are defined in StartPositionConfig.zones
 * to support different game years with different starting position layouts.
 */

import { useRef, useEffect, useMemo } from 'react';
import type { StartPositionConfig } from '@/types/team-stats-display';
import type { MatchResult } from '@/game-template/analysis';

interface AutoStartPositionMapProps {
    /** Starting position percentages (e.g., { position0: 25, position1: 50, ... }) */
    startPositions?: Record<string, number>;
    /** Match results with auto points for calculating average per position */
    matchResults?: MatchResult[];
    /** Start position configuration with zones and field image */
    config: StartPositionConfig;
    /** Optional: Highlight a single position (for displaying one match's start position) */
    highlightedPosition?: number;
    /** Optional: Alliance for field image selection (default: red) */
    alliance?: 'red' | 'blue';
}

/**
 * Auto Start Position Map
 * 
 * Renders a canvas overlay on the field image showing starting position zones.
 * 
 * Modes:
 * - Stats mode: Pass startPositions and matchResults to show percentages and avg points
 * - Single position mode: Pass highlightedPosition to highlight just one zone
 * 
 * SINGLE SOURCE OF TRUTH: Zones are defined in analysis.ts via getStartPositionConfig()
 */
export function AutoStartPositionMap({
    startPositions = {},
    matchResults = [],
    config,
    highlightedPosition,
    alliance = 'red'
}: AutoStartPositionMapProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Zones come from config (single source of truth in analysis.ts)
    const zones = useMemo(() => config.zones ?? [], [config.zones]);

    // Select field image based on alliance
    const fieldImage = useMemo(() => {
        if (alliance === 'blue' && config.fieldImageBlue) {
            return config.fieldImageBlue;
        }
        return config.fieldImageRed;
    }, [alliance, config.fieldImageRed, config.fieldImageBlue]);

    // Determine if we're in single position mode
    const isSinglePositionMode = highlightedPosition !== undefined && highlightedPosition >= 0;

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !fieldImage) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const drawPositionOverlays = (
            context: CanvasRenderingContext2D,
            canvasWidth: number,
            canvasHeight: number
        ) => {
            // Use 640x480 base for scaling (same as 2025 implementation)
            const scaleX = canvasWidth / 640;
            const scaleY = canvasHeight / 480;

            // Add semi-transparent overlay to darken unused areas
            context.fillStyle = 'rgba(0, 0, 0, 0.3)';
            context.fillRect(0, 0, canvasWidth, canvasHeight);

            zones.forEach((zone) => {
                const scaledX = zone.x * scaleX;
                const scaledY = zone.y * scaleY;
                const scaledWidth = zone.width * scaleX;
                const scaledHeight = zone.height * scaleY;

                // SINGLE POSITION MODE: Only highlight the selected position
                if (isSinglePositionMode) {
                    const isHighlighted = zone.position === highlightedPosition;

                    // Clear the overlay in highlighted zone
                    if (isHighlighted) {
                        context.globalCompositeOperation = 'destination-out';
                        context.fillStyle = 'rgba(0, 0, 0, 0.3)';
                        context.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
                        context.globalCompositeOperation = 'source-over';

                        // Draw bright green background for highlighted position
                        context.fillStyle = 'rgba(34, 197, 94, 0.85)';
                        context.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);

                        // Draw border
                        context.strokeStyle = '#16a34a';
                        context.lineWidth = 4;
                        context.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

                        // Draw label
                        context.fillStyle = '#ffffff';
                        context.font = `bold ${Math.max(16 * Math.min(scaleX, scaleY), 12)}px Arial`;
                        context.textAlign = 'center';
                        context.textBaseline = 'middle';
                        context.shadowColor = '#000000';
                        context.shadowBlur = 3;
                        context.shadowOffsetX = 1;
                        context.shadowOffsetY = 1;

                        const label = zone.label ?? `Pos ${zone.position}`;
                        context.fillText(label, scaledX + scaledWidth / 2, scaledY + scaledHeight / 2);

                        // Reset shadow
                        context.shadowColor = 'transparent';
                        context.shadowBlur = 0;
                    }
                    return;
                }

                // STATS MODE: Show percentages and average points
                const percentage = startPositions[`position${zone.position}`] || 0;

                const positionMatches = matchResults.filter((match) => match.startPosition === zone.position);

                const avgAutoPoints = positionMatches.length > 0
                    ? Math.round(
                        (positionMatches.reduce((sum, match) => sum + match.autoPoints, 0) /
                            positionMatches.length) * 10
                    ) / 10
                    : 0;

                // Clear the overlay in this zone (make it brighter)
                context.globalCompositeOperation = 'destination-out';
                context.fillStyle = 'rgba(0, 0, 0, 0.3)';
                context.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
                context.globalCompositeOperation = 'source-over';

                // Draw background based on usage percentage
                const intensity = Math.min(percentage / 100, 1);
                const alpha = Math.max(0.4, intensity * 0.9);

                // Color based on usage frequency
                let color;
                if (percentage === 0) {
                    color = `rgba(156, 163, 175, ${alpha})`; // Gray for unused
                } else if (percentage < 20) {
                    color = `rgba(239, 68, 68, ${alpha})`; // Red for low usage
                } else if (percentage < 40) {
                    color = `rgba(245, 158, 11, ${alpha})`; // Orange for medium-low usage
                } else if (percentage < 60) {
                    color = `rgba(234, 179, 8, ${alpha})`; // Yellow for medium usage
                } else if (percentage < 80) {
                    color = `rgba(59, 130, 246, ${alpha})`; // Blue for high usage
                } else {
                    color = `rgba(34, 197, 94, ${alpha})`; // Green for very high usage
                }

                context.fillStyle = color;
                context.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);

                // Draw border
                context.strokeStyle = percentage > 0 ? '#374151' : '#9ca3af';
                context.lineWidth = percentage > 0 ? 3 : 2;
                context.setLineDash(percentage > 0 ? [] : [5, 5]);
                context.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
                context.setLineDash([]); // Reset dash

                // Draw position label (use zone.label if provided, otherwise position number)
                context.fillStyle = '#ffffff';
                context.font = `bold ${Math.max(18 * Math.min(scaleX, scaleY), 14)}px Arial`;
                context.textAlign = 'center';
                context.textBaseline = 'top';

                // Add shadow for text readability
                context.shadowColor = '#000000';
                context.shadowBlur = 3;
                context.shadowOffsetX = 1;
                context.shadowOffsetY = 1;

                const label = zone.label ?? `${zone.position}`;
                context.fillText(
                    label,
                    scaledX + scaledWidth / 2,
                    scaledY + 8
                );

                // Draw percentage in the center
                context.font = `bold ${Math.max(22 * Math.min(scaleX, scaleY), 18)}px Arial`;
                context.textBaseline = 'middle';
                context.fillText(
                    `${percentage}%`,
                    scaledX + scaledWidth / 2,
                    scaledY + scaledHeight / 2
                );

                // Draw average AUTO points at the bottom if available
                if (positionMatches.length > 0) {
                    context.font = `${Math.max(14 * Math.min(scaleX, scaleY), 12)}px Arial`;
                    context.textBaseline = 'bottom';
                    context.fillText(
                        `${avgAutoPoints} auto pts`,
                        scaledX + scaledWidth / 2,
                        scaledY + scaledHeight - 8
                    );
                }

                // Reset shadow
                context.shadowColor = 'transparent';
                context.shadowBlur = 0;
                context.shadowOffsetX = 0;
                context.shadowOffsetY = 0;
            });
        };

        const img = new Image();
        img.onload = () => {
            // Calculate container size
            const containerRect = container.getBoundingClientRect();
            const containerWidth = containerRect.width;
            const containerHeight = containerRect.height;

            // Calculate aspect ratio preserving dimensions
            const imgAspectRatio = img.width / img.height;
            const containerAspectRatio = containerWidth / containerHeight;

            let canvasWidth, canvasHeight;

            if (imgAspectRatio > containerAspectRatio) {
                canvasWidth = containerWidth;
                canvasHeight = containerWidth / imgAspectRatio;
            } else {
                canvasHeight = containerHeight;
                canvasWidth = containerHeight * imgAspectRatio;
            }

            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            canvas.style.width = `${canvasWidth}px`;
            canvas.style.height = `${canvasHeight}px`;

            ctx.clearRect(0, 0, canvasWidth, canvasHeight);

            // Draw the field image
            ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

            // Draw position overlays
            drawPositionOverlays(ctx, canvasWidth, canvasHeight);
        };

        img.src = fieldImage;
    }, [startPositions, matchResults, fieldImage, zones, highlightedPosition, isSinglePositionMode]);

    // Fallback if no field image
    if (!fieldImage) {
        return (
            <div className="h-96 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">No field image configured</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full h-96 flex items-center justify-center">
            <canvas
                ref={canvasRef}
                className="max-w-full max-h-full border rounded-lg"
            />
        </div>
    );
}

export default AutoStartPositionMap;

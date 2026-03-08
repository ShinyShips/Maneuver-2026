/**
 * Canvas Utilities
 * 
 * Shared functions for drawing overlays and managing layered rendering.
 */

import { CANVAS_CONSTANTS } from "./canvasConstants";

/**
 * Draws team numbers on the canvas based on alliance positions.
 */
export const drawTeamNumbers = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    selectedTeams: (number | null)[]
) => {
    if (!selectedTeams || selectedTeams.length !== 6) return;

    const {
        TEAM_LABEL_FONT_SIZE_RATIO,
        BLUE_ALLIANCE_X_POSITION,
        RED_ALLIANCE_X_POSITION,
        TEAM_POSITION_TOP_Y,
        TEAM_POSITION_MIDDLE_Y,
        TEAM_POSITION_BOTTOM_Y
    } = CANVAS_CONSTANTS;

    const fontSize = Math.floor(width * TEAM_LABEL_FONT_SIZE_RATIO);
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Blue alliance (left) - positions 3, 4, 5
    const blueX = width * BLUE_ALLIANCE_X_POSITION;
    const blueTeams = [
        { team: selectedTeams[3], y: height * TEAM_POSITION_TOP_Y },
        { team: selectedTeams[4], y: height * TEAM_POSITION_MIDDLE_Y },
        { team: selectedTeams[5], y: height * TEAM_POSITION_BOTTOM_Y },
    ];

    blueTeams.forEach(({ team, y }) => {
        if (team !== null && team !== undefined && team !== 0) {
            const teamStr = team.toString();
            ctx.save();
            ctx.translate(blueX, y);
            ctx.rotate(Math.PI / 2);
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.strokeText(teamStr, 0, 0);
            ctx.fillText(teamStr, 0, 0);
            ctx.restore();
        }
    });

    // Red alliance (right) - positions 0, 1, 2
    const redX = width * RED_ALLIANCE_X_POSITION;
    const redTeams = [
        { team: selectedTeams[0], y: height * TEAM_POSITION_BOTTOM_Y },
        { team: selectedTeams[1], y: height * TEAM_POSITION_MIDDLE_Y },
        { team: selectedTeams[2], y: height * TEAM_POSITION_TOP_Y },
    ];

    redTeams.forEach(({ team, y }) => {
        if (team !== null && team !== undefined && team !== 0) {
            const teamStr = team.toString();
            ctx.save();
            ctx.translate(redX, y);
            ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.strokeText(teamStr, 0, 0);
            ctx.fillText(teamStr, 0, 0);
            ctx.restore();
        }
    });
};

/**
 * Restores ONLY the background image for a specific area.
 * Used during active erasing to avoid clipped text artifacts.
 */
export const restoreBackgroundOnly = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    backgroundImage: HTMLImageElement,
    clipRect: { x: number; y: number; w: number; h: number }
) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
    ctx.clip();
    ctx.drawImage(backgroundImage, 0, 0, width, height);
    ctx.restore();
};

/**
 * Redraws all overlays on the full canvas.
 * Call this once after erasing is complete to restore team numbers.
 */
export const redrawOverlays = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    selectedTeams: (number | null)[]
) => {
    drawTeamNumbers(ctx, width, height, selectedTeams);
};

/**
 * Restores the background and standard overlays for a specific area.
 * This is used by the eraser to avoid "punching holes" in overlays.
 */
export const restoreBackgroundWithOverlays = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    backgroundImage: HTMLImageElement,
    selectedTeams: (number | null)[],
    clipRect?: { x: number; y: number; w: number; h: number }
) => {
    ctx.save();

    if (clipRect) {
        ctx.beginPath();
        ctx.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
        ctx.clip();
    }

    // Draw background
    ctx.drawImage(backgroundImage, 0, 0, width, height);

    ctx.restore();

    // Draw overlays on full canvas (no clipping) to avoid artifacts
    drawTeamNumbers(ctx, width, height, selectedTeams);
};

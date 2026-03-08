/**
 * Strategy Canvas Utility Functions
 * 
 * Utilities for managing field strategy canvases including:
 * - Clearing all strategy drawings
 * - Saving composite images of all game phases
 */

export const clearAllStrategies = (setActiveTab: (tab: string) => void, activeTab: string) => {
    // Clear all localStorage data for the three stages
    localStorage.removeItem('fieldStrategy_autonomous');
    localStorage.removeItem('fieldStrategy_teleop');
    localStorage.removeItem('fieldStrategy_endgame');

    // Force refresh of all canvases by changing the activeTab and back
    const currentTab = activeTab;
    setActiveTab('');
    setTimeout(() => {
        setActiveTab(currentTab);
    }, 50);
};

export const saveAllStrategyCanvases = (matchNumber: string | number, selectedTeams: (number | null)[], fieldImagePath?: string) => {
    // Add a small delay to ensure all canvases are rendered
    setTimeout(() => {
        // Try to get from localStorage first since it's more reliable
        const autonomousData = localStorage.getItem('fieldStrategy_autonomous');
        const teleopData = localStorage.getItem('fieldStrategy_teleop');
        const endgameData = localStorage.getItem('fieldStrategy_endgame');

        if (!autonomousData || !teleopData || !endgameData) {
            alert('Please draw on all three strategy tabs (Autonomous, Teleop, and Endgame) before saving');
            return;
        }

        // Create a new canvas to composite all three images
        const compositeCanvas = document.createElement('canvas');
        const ctx = compositeCanvas.getContext('2d');
        if (!ctx) return;

        // Load all three drawing images
        const autonomousDrawingImg = new Image();
        const teleopDrawingImg = new Image();
        const endgameDrawingImg = new Image();

        // Load the field background image
        const fieldImg = new Image();

        let loadedCount = 0;
        const totalImages = fieldImagePath ? 4 : 3; // Include field image if path provided

        const compositeFieldWithDrawing = (fieldImage: HTMLImageElement, drawingImage: HTMLImageElement, width: number, height: number): HTMLCanvasElement => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) return tempCanvas;

            // Draw field background first
            tempCtx.drawImage(fieldImage, 0, 0, width, height);
            // Draw the user's drawings on top
            tempCtx.drawImage(drawingImage, 0, 0, width, height);

            return tempCanvas;
        };

        const onImageLoad = () => {
            loadedCount++;
            if (loadedCount === totalImages) {
                // All images loaded, now composite them
                // Use field image natural size as the target resolution, or fallback to drawing size (but ideally larger)
                // If field image is available, use its high-res dimensions. Otherwise, scale up if too small?
                // For now, let's trust the field image if it exists.

                let targetWidth = autonomousDrawingImg.width;
                let targetHeight = autonomousDrawingImg.height;

                if (fieldImagePath && fieldImg.complete && fieldImg.naturalWidth > 0) {
                    targetWidth = fieldImg.naturalWidth;
                    targetHeight = fieldImg.naturalHeight;
                }

                // Set composite canvas size (3x height for stacking + extra space for match number)
                // Scale fonts relative to width
                const scaleFactor = targetWidth / 1000; // Base scale on 1000px width
                const topMargin = matchNumber ? Math.round(60 * scaleFactor) : Math.round(40 * scaleFactor);

                compositeCanvas.width = targetWidth;
                compositeCanvas.height = targetHeight * 3 + topMargin;

                // Clear canvas with white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

                // Add match number at the very top if provided
                if (matchNumber) {
                    ctx.fillStyle = '#000000';
                    ctx.textAlign = 'center';
                    // Scale font based on resolution
                    const fontSize = Math.round(20 * scaleFactor);
                    ctx.font = `bold ${fontSize}px Arial`;
                    ctx.fillText(`Match ${matchNumber}`, targetWidth / 2, Math.round(30 * scaleFactor));
                }

                // Draw title labels for each section
                ctx.fillStyle = '#000000';
                const labelFontSize = Math.round(24 * scaleFactor);
                ctx.font = `bold ${labelFontSize}px Arial`;
                ctx.textAlign = 'center';

                // Helper to draw section
                const drawSection = (label: string, drawingImg: HTMLImageElement, yOffset: number) => {
                    const labelY = yOffset + Math.round(30 * scaleFactor);
                    const imgY = yOffset + Math.round(40 * scaleFactor);
                    const drawHeight = targetHeight - Math.round(40 * scaleFactor);

                    ctx.fillText(label, targetWidth / 2, labelY);

                    if (fieldImagePath && fieldImg.complete && fieldImg.naturalWidth > 0) {
                        const composite = compositeFieldWithDrawing(fieldImg, drawingImg, targetWidth, drawHeight);
                        ctx.drawImage(composite, 0, imgY);
                    } else {
                        // Scale drawing to target size
                        ctx.drawImage(drawingImg, 0, imgY, targetWidth, drawHeight);
                    }
                };

                // Draw Autonomous section
                drawSection('AUTONOMOUS', autonomousDrawingImg, topMargin);

                // Draw Teleop section
                drawSection('TELEOP', teleopDrawingImg, topMargin + targetHeight);

                // Draw Endgame section
                drawSection('ENDGAME', endgameDrawingImg, topMargin + (targetHeight * 2));

                // Add team information at the top
                const teamFontSize = Math.round(16 * scaleFactor);
                ctx.font = `bold ${teamFontSize}px Arial`;
                const blueTeams = selectedTeams.slice(3, 6).filter(Boolean).map(t => t?.toString()); // Blue teams (originally index 3-5)
                const redTeams = selectedTeams.slice(0, 3).filter(Boolean).map(t => t?.toString());  // Red teams (originally index 0-2)

                if (blueTeams.length > 0 || redTeams.length > 0) {
                    const teamInfoY = matchNumber ? Math.round(50 * scaleFactor) : Math.round(20 * scaleFactor);

                    // Blue alliance on left side
                    ctx.fillStyle = '#0000ff';
                    ctx.textAlign = 'left';
                    ctx.fillText(`Blue: ${blueTeams.join(', ')}`, Math.round(10 * scaleFactor), teamInfoY);

                    // Red alliance on right side
                    ctx.fillStyle = '#ff0000';
                    ctx.textAlign = 'right';
                    ctx.fillText(`Red: ${redTeams.join(', ')}`, targetWidth - Math.round(10 * scaleFactor), teamInfoY);
                }

                // Download the composite image
                const dataURL = compositeCanvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = dataURL;
                const filename = matchNumber
                    ? `match-${matchNumber}-strategy-${new Date().toISOString().slice(0, 10)}.png`
                    : `match-strategy-complete-${new Date().toISOString().slice(0, 10)}.png`;
                link.download = filename;
                link.click();
            }
        };

        // Set up image load handlers
        autonomousDrawingImg.onload = onImageLoad;
        teleopDrawingImg.onload = onImageLoad;
        endgameDrawingImg.onload = onImageLoad;

        if (fieldImagePath) {
            fieldImg.onload = onImageLoad;
            fieldImg.onerror = () => {
                // If field image fails to load, still proceed without it
                loadedCount++;
                onImageLoad();
            };
            fieldImg.src = fieldImagePath;
        }

        // Load the drawing images
        autonomousDrawingImg.src = autonomousData;
        teleopDrawingImg.src = teleopData;
        endgameDrawingImg.src = endgameData;

    }, 100); // Small delay to ensure DOM is ready
};

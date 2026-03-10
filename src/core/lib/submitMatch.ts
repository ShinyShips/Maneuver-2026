/**
 * submitMatch - Shared match submission logic
 * 
 * This utility can be called from any page that needs to submit match data.
 * It handles data transformation, database saving, and cleanup.
 */

import { db } from '@/core/db/database';
import { isSubstantiveComment } from '@/core/lib/commentValidation';
import { clearScoutingLocalStorage } from '@/core/lib/utils';
import { toast } from 'sonner';
import type { DataTransformation } from '@/types';

interface MatchInputs {
    eventKey: string;
    matchNumber: string;
    matchType: 'qm' | 'sf' | 'f';
    selectTeam: string;
    alliance: 'red' | 'blue';
    scoutName: string;
    startPosition?: boolean[];
}

interface SubmitOptions {
    /** Match inputs from navigation state */
    inputs: MatchInputs;
    /** Game-specific data transformation */
    transformation: DataTransformation;
    /** Optional comment */
    comment?: string;
    /** Flag for no-show submission (robot did not appear for match) */
    noShow?: boolean;
    /** Callback on successful submission */
    onSuccess?: () => void;
    /** Callback on error */
    onError?: (error: Error) => void;
}

/**
 * Get action array from localStorage
 */
function getActionsFromLocalStorage(phase: string): unknown[] {
    const saved = localStorage.getItem(`${phase}StateStack`);
    return saved ? JSON.parse(saved) : [];
}

/**
 * Get robot status from localStorage
 */
function getRobotStatusFromLocalStorage(phase: string): Record<string, unknown> {
    const saved = localStorage.getItem(`${phase}RobotStatus`);
    return saved ? JSON.parse(saved) : {};
}

/**
 * Build match key from match type and number
 */
function buildMatchKey(matchType: string, matchNumber: string): { matchKey: string; numericMatch: number } {
    const numericMatch = parseInt(matchNumber) || 0;

    if (matchType === 'sf') {
        // Semifinal: user enters "1" → becomes "sf1m1"
        return { matchKey: `sf${matchNumber}m1`, numericMatch };
    } else if (matchType === 'f') {
        // Final: user enters "2" → becomes "f1m2"
        return { matchKey: `f1m${matchNumber}`, numericMatch };
    } else {
        // Qualification match: qm24
        return { matchKey: `qm${matchNumber}`, numericMatch };
    }
}

/**
 * Submit match data to database
 * 
 * This function:
 * 1. Retrieves all action/status data from localStorage
 * 2. Transforms actions to counter fields using game transformation
 * 3. Saves the entry to IndexedDB
 * 4. Clears localStorage and increments match number
 * 
 * @param options.noShow - If true, submits a minimal entry with noShow flag and skips data collection
 */
export async function submitMatchData({
    inputs,
    transformation,
    comment = '',
    noShow = false,
    onSuccess,
    onError,
}: SubmitOptions): Promise<boolean> {
    const maybeRecordCommentAchievement = async (existingComment?: unknown) => {
        const hasScoutName = typeof inputs.scoutName === 'string' && inputs.scoutName.trim().length > 0;
        const hasSubstantiveComment = typeof comment === 'string' && isSubstantiveComment(comment);
        const existingWasSubstantive = typeof existingComment === 'string' && isSubstantiveComment(existingComment);

        if (!hasScoutName || !hasSubstantiveComment || existingWasSubstantive) {
            return;
        }

        const { recordMatchCommentForAchievements } = await import('@/core/lib/scoutGamificationUtils');
        await recordMatchCommentForAchievements(inputs.scoutName, comment);
    };

    try {
        // Build match key
        const { matchKey, numericMatch } = buildMatchKey(
            inputs.matchType || 'qm',
            inputs.matchNumber
        );
        const entryId = `${inputs.eventKey}::${matchKey}::${inputs.selectTeam}::${inputs.alliance}`;
        const existingEntry = await db.scoutingData.get(entryId);

        // For no-show, skip data collection and submit minimal entry
        if (noShow) {
            const entry: Record<string, unknown> = {
                id: entryId,
                scoutName: inputs.scoutName || '',
                teamNumber: parseInt(inputs.selectTeam) || 0,
                matchNumber: numericMatch,
                eventKey: inputs.eventKey,
                matchKey: matchKey,
                allianceColor: inputs.alliance,
                timestamp: Date.now(),
                noShow: true,
                comments: comment || 'No Show - Robot did not appear for this match',
                gameData: {
                    auto: { startPosition: inputs.startPosition },
                    teleop: {},
                    endgame: {},
                },
            };

            await db.scoutingData.put(entry as never);

            try {
                await maybeRecordCommentAchievement(existingEntry?.comments);
            } catch (gamificationError) {
                console.warn('Failed to process comment achievement tracking:', gamificationError);
            }

            toast.success('No-show match submitted');
            clearScoutingLocalStorage();
            
            if (onSuccess) {
                onSuccess();
            }
            return true;
        }

        // Get all phase data from localStorage
        const autoActions = getActionsFromLocalStorage('auto');
        const teleopActions = getActionsFromLocalStorage('teleop');
        const autoRobotStatus = getRobotStatusFromLocalStorage('auto');
        const teleopRobotStatus = getRobotStatusFromLocalStorage('teleop');
        const endgameRobotStatus = getRobotStatusFromLocalStorage('endgame');

        // Transform action arrays to counter fields using game-specific transformation
        const transformedGameData = transformation.transformActionsToCounters({
            autoActions,
            teleopActions,
            autoRobotStatus,
            teleopRobotStatus,
            endgameRobotStatus,
            startPosition: inputs.startPosition,
        });

        // Create the scouting entry
        const scoutingEntry: Record<string, unknown> = {
            id: entryId,
            scoutName: inputs.scoutName || '',
            teamNumber: parseInt(inputs.selectTeam) || 0,
            matchNumber: numericMatch,
            eventKey: inputs.eventKey,
            matchKey: matchKey,
            allianceColor: inputs.alliance,
            timestamp: Date.now(),
            gameData: transformedGameData,
            comments: comment,
        };

        // Save to database
        await db.scoutingData.put(scoutingEntry as never);

        try {
            await maybeRecordCommentAchievement(existingEntry?.comments);
        } catch (gamificationError) {
            console.warn('Failed to process comment achievement tracking:', gamificationError);
        }

        // Clear action stacks and robot status
        clearScoutingLocalStorage();

        // Update match counter
        const currentMatchNumber = localStorage.getItem('currentMatchNumber') || '1';
        const nextMatchNumber = (parseInt(currentMatchNumber) + 1).toString();
        localStorage.setItem('currentMatchNumber', nextMatchNumber);

        toast.success('Match data saved successfully!');
        onSuccess?.();
        return true;
    } catch (error) {
        console.error('Error saving match data:', error);
        toast.error('Error saving match data');
        onError?.(error as Error);
        return false;
    }
}

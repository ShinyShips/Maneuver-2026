/**
 * Match Strategy Page - Year-Agnostic
 * 
 * Main page for match strategy planning with:
 * - Field drawing on 3 phases (Autonomous, Teleop, Endgame)
 * - Team selection (6 teams: 3 red, 3 blue)
 * - Team stats display (config-driven via match-strategy-config.ts)
 * - Match number lookup
 * - Alliance selection
 * 
 * Year-agnostic design using:
 * - Centralized calculations (useAllTeamStats)
 * - Configurable field image (via props)
 * - Config-driven stats display (via props)
 */

import { useState } from "react";
import { MatchHeader } from "@/core/components/MatchStrategy/MatchHeader";
import { FieldStrategy } from "@/core/components/MatchStrategy/FieldStrategy";
import { TeamAnalysis } from "@/core/components/MatchStrategy/TeamAnalysis";
import { clearAllStrategies, saveAllStrategyCanvases } from "@/core/lib/strategyCanvasUtils";
import { useMatchStrategy } from "@/core/hooks/useMatchStrategy";
import defaultFieldImage from "@/game-template/assets/2026-field.png";

// ============================================================================
// PROPS & CONFIGURATION
// ============================================================================

interface MatchStrategyPageProps {
    /**
     * Optional: Field image to use for strategy drawing
     * Defaults to 2026-field.png
     */
    fieldImage?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

const MatchStrategyPage = (props: MatchStrategyPageProps) => {
    const fieldImage = props.fieldImage ?? defaultFieldImage;
    
    const [activeTab, setActiveTab] = useState("autonomous");
    const [activeStatsTab, setActiveStatsTab] = useState("overall");

    const {
        selectedTeams,
        availableTeams,
        matchNumber,
        isLookingUpMatch,
        confirmedAlliances,
        selectedBlueAlliance,
        selectedRedAlliance,
        getTeamStats,
        handleTeamChange,
        applyAllianceToRed,
        applyAllianceToBlue,
        setMatchNumber
    } = useMatchStrategy();

    const handleClearAll = () => clearAllStrategies(setActiveTab, activeTab);
    const handleSaveAll = () => saveAllStrategyCanvases(matchNumber, selectedTeams, fieldImage);

    return (
        <div className="min-h-screen w-full flex flex-col items-center px-4 pt-12 pb-24">
            <div className="w-full max-w-7xl">
                <h1 className="text-2xl font-bold">Match Strategy</h1>
            </div>
            <div className="flex flex-col items-center gap-4 max-w-7xl w-full">
                <MatchHeader
                    matchNumber={matchNumber}
                    isLookingUpMatch={isLookingUpMatch}
                    onMatchNumberChange={setMatchNumber}
                    onClearAll={handleClearAll}
                    onSaveAll={handleSaveAll}
                />

                <div className="flex flex-col gap-8 w-full pb-6">
                    <FieldStrategy
                        fieldImagePath={fieldImage}
                        activeTab={activeTab}
                        selectedTeams={selectedTeams}
                        onTabChange={setActiveTab}
                    />

                    <TeamAnalysis
                        selectedTeams={selectedTeams}
                        availableTeams={availableTeams}
                        activeStatsTab={activeStatsTab}
                        confirmedAlliances={confirmedAlliances}
                        selectedBlueAlliance={selectedBlueAlliance}
                        selectedRedAlliance={selectedRedAlliance}
                        getTeamStats={getTeamStats}
                        onTeamChange={handleTeamChange}
                        onStatsTabChange={setActiveStatsTab}
                        onBlueAllianceChange={applyAllianceToBlue}
                        onRedAllianceChange={applyAllianceToRed}
                    />
                </div>
            </div>
        </div>
    );
};

export default MatchStrategyPage;

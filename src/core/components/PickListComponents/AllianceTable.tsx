/**
 * Alliance Table Component
 * 
 * Table showing all alliances with team selectors.
 * Matches 2025 styling.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Plus, Check, RotateCcw } from "lucide-react";
import { AllianceRow } from "./AllianceRow";
import type { Alliance } from "@/core/lib/allianceTypes";
import type { TeamStats } from "@/core/types/team-stats";

interface AllianceTableProps {
    alliances: Alliance[];
    availableTeams: TeamStats[];
    selectedTeams: number[];
    onUpdateTeam: (allianceId: number, position: 'captain' | 'pick1' | 'pick2' | 'pick3', teamNumber: number | null) => void;
    onRemoveTeam: (allianceId: number, position: 'captain' | 'pick1' | 'pick2' | 'pick3') => void;
    onRemoveAlliance: (allianceId: number) => void;
    onAddAlliance: () => void;
    onConfirmAlliances: () => void;
    onClearAlliances: () => void;
}

export const AllianceTable = ({
    alliances,
    availableTeams,
    selectedTeams,
    onUpdateTeam,
    onRemoveTeam,
    onRemoveAlliance,
    onAddAlliance,
    onConfirmAlliances,
    onClearAlliances
}: AllianceTableProps) => {
    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle>Alliance Selection</CardTitle>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button onClick={onConfirmAlliances} size="sm" variant="default">
                            <Check className="h-4 w-4 mr-2" />
                            Confirm Alliances
                        </Button>
                        <Button onClick={onClearAlliances} size="sm" variant="outline">
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Clear Alliances
                        </Button>
                        <Button onClick={onAddAlliance} size="sm" variant="outline">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Alliance
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div
                    className="overflow-x-auto"
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                >
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold min-w-[100px]">Alliance</th>
                                <th className="text-left p-3 font-semibold min-w-[120px]">
                                    <div className="flex items-center gap-2">
                                        Captain
                                    </div>
                                </th>
                                <th className="text-left p-3 font-semibold min-w-[120px]">
                                    <div className="flex items-center gap-2">
                                        Pick 1
                                    </div>
                                </th>
                                <th className="text-left p-3 font-semibold min-w-[120px]">
                                    <div className="flex items-center gap-2">
                                        Pick 2
                                    </div>
                                </th>
                                <th className="text-left p-3 font-semibold min-w-[120px]">
                                    <div className="flex items-center gap-2">
                                        Pick 3
                                    </div>
                                </th>
                                <th className="text-left p-3 font-semibold min-w-[80px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {alliances.map((alliance) => (
                                <AllianceRow
                                    key={alliance.id}
                                    alliance={alliance}
                                    availableTeams={availableTeams}
                                    selectedTeams={selectedTeams}
                                    onUpdateTeam={onUpdateTeam}
                                    onRemoveTeam={onRemoveTeam}
                                    onRemoveAlliance={onRemoveAlliance}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

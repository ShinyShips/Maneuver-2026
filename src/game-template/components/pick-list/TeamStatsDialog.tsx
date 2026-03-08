/**
 * Team Stats Dialog Component
 * 
 * Detailed stats modal triggered by the eye icon button.
 * This is year-specific - customize the tabs and stats per game.
 */

import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/core/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/components/animate-ui/radix/tabs";
import { Eye } from "lucide-react";
import type { TeamStats } from '@/core/types/team-stats';

interface TeamStatsDialogProps {
    teamNumber: string | number;
    teamStats?: TeamStats;
    variant?: "default" | "outline" | "ghost";
    size?: "default" | "sm" | "lg";
    className?: string;
}

/**
 * Detailed stats dialog for a team.
 * Customize the tabs and content for each game year.
 */
export function TeamStatsDialog({
    teamNumber,
    teamStats,
    variant = "outline",
    size = "sm",
    className = ""
}: TeamStatsDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("overall");

    if (!teamStats) {
        return (
            <Button variant={variant} size={size} className={className} disabled>
                <Eye className="w-3 h-3" />
            </Button>
        );
    }

    const auto = teamStats.auto;
    const teleop = teamStats.teleop;
    const endgame = teamStats.endgame;
    const overall = teamStats.overall;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant={variant} size={size} className={className}>
                    <Eye className="w-3 h-3" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] h-[min(600px,90vh)] flex flex-col p-6">
                <DialogHeader className="shrink-0 px-0">
                    <DialogTitle>Team {teamNumber} Detailed Stats</DialogTitle>
                </DialogHeader>

                <div
                    className="flex-1 min-h-0"
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                >
                    <Tabs value={activeTab} onValueChange={setActiveTab} enableSwipe className="w-full h-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-4 shrink-0">
                            <TabsTrigger value="overall">Overall</TabsTrigger>
                            <TabsTrigger value="auto">Auto</TabsTrigger>
                            <TabsTrigger value="teleop">Teleop</TabsTrigger>
                            <TabsTrigger value="endgame">Endgame</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto px-0 mt-4">
                            <TabsContent value="overall" className="space-y-4 h-full mt-0">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="font-semibold mb-3">Scoring Summary</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span>Avg Total Points:</span>
                                                <span className="font-bold text-blue-600">{overall?.avgTotalPoints || 0}</span>
                                            </div>
                                            {/* Dynamically render action averages from overall stats */}
                                            {overall && Object.entries(overall as Record<string, unknown>)
                                                .filter(([key]) => key.startsWith('avg') && key !== 'avgTotalPoints' && key !== 'avgGamePiece1' && key !== 'avgGamePiece2')
                                                .map(([key, value]) => (
                                                    <div key={key} className="flex justify-between">
                                                        <span>{key.replace('avg', 'Avg ').replace(/([A-Z])/g, ' $1').trim()}:</span>
                                                        <span className="font-bold">{typeof value === 'number' ? value : 0}</span>
                                                    </div>
                                                ))
                                            }
                                            <div className="flex justify-between pt-2 border-t">
                                                <span className="font-semibold">Matches Played:</span>
                                                <span className="font-bold text-orange-600">{teamStats.matchCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-3">Performance Rates</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span>Climb Rate:</span>
                                                <span className="font-bold text-purple-600">{endgame?.climbRate || 0}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Mobility Rate:</span>
                                                <span className="font-bold text-blue-600">{auto?.mobilityRate || 0}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="auto" className="space-y-4 h-full mt-0">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="font-semibold mb-3">Auto Scoring</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span>Avg Points:</span>
                                                <span className="font-bold text-blue-600">{auto?.avgPoints || 0}</span>
                                            </div>
                                            {/* Dynamically render action averages */}
                                            {auto && Object.entries(auto as Record<string, unknown>)
                                                .filter(([key]) => key.startsWith('avg') && key !== 'avgPoints' && key !== 'avgGamePiece1' && key !== 'avgGamePiece2')
                                                .map(([key, value]) => (
                                                    <div key={key} className="flex justify-between">
                                                        <span>{key.replace('avg', 'Avg ').replace(/([A-Z])/g, ' $1').trim()}:</span>
                                                        <span className="font-bold">{typeof value === 'number' ? value : 0}</span>
                                                    </div>
                                                ))
                                            }
                                            <div className="flex justify-between pt-2 border-t">
                                                <span>Mobility Rate:</span>
                                                <span className="font-bold text-green-600">{auto?.mobilityRate || 0}%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-3">Starting Positions</h4>
                                        <div className="space-y-2">
                                            {auto?.startPositions?.map(pos => (
                                                <div key={pos.position} className="flex justify-between">
                                                    <span>{pos.position}:</span>
                                                    <span className="font-bold">{pos.percentage}%</span>
                                                </div>
                                            ))}
                                            {(!auto?.startPositions || auto.startPositions.length === 0) && (
                                                <div className="text-muted-foreground">No position data</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="teleop" className="space-y-4 h-full mt-0">
                                <div>
                                    <h4 className="font-semibold mb-3">Teleop Scoring</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span>Avg Points:</span>
                                            <span className="font-bold text-purple-600">{teleop?.avgPoints || 0}</span>
                                        </div>
                                        {/* Dynamically render action averages */}
                                        {teleop && Object.entries(teleop as Record<string, unknown>)
                                            .filter(([key]) => key.startsWith('avg') && key !== 'avgPoints' && key !== 'avgGamePiece1' && key !== 'avgGamePiece2')
                                            .map(([key, value]) => (
                                                <div key={key} className="flex justify-between">
                                                    <span>{key.replace('avg', 'Avg ').replace(/([A-Z])/g, ' $1').trim()}:</span>
                                                    <span className="font-bold">{typeof value === 'number' ? value : 0}</span>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="endgame" className="space-y-4 h-full mt-0">
                                <div>
                                    <h4 className="font-semibold mb-3">Endgame Performance</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span>Avg Points:</span>
                                            <span className="font-bold text-blue-600">{endgame?.avgPoints || 0}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Climb Rate:</span>
                                            <span className="font-bold text-purple-600">{endgame?.climbRate || 0}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Park Rate:</span>
                                            <span className="font-bold text-gray-600">{endgame?.parkRate || 0}%</span>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}

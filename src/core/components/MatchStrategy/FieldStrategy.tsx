/**
 * Field Strategy Component
 * 
 * Wrapper for FieldCanvas with phase tabs (Autonomous, Teleop, Endgame).
 * Needs fieldImagePath prop to be passed through to FieldCanvas.
 */

import { Card, CardContent } from "@/core/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/components/animate-ui/radix/tabs";
import FieldCanvas from "./FieldCanvas";

interface FieldStrategyProps {
    fieldImagePath: string;  // Path to field image
    activeTab: string;
    selectedTeams?: (number | null)[];  // Optional: team numbers to display on canvas
    onTabChange: (value: string) => void;
}

export const FieldStrategy = ({
    fieldImagePath,
    activeTab,
    selectedTeams = [],
    onTabChange
}: FieldStrategyProps) => {
    return (
        <Card className="w-full">
            <CardContent className="h-[500px] p-4">
                <Tabs value={activeTab} onValueChange={onTabChange} className="w-full h-full flex flex-col" enableSwipe={true}>
                    <TabsList className="grid w-full grid-cols-3 mb-4 shrink-0">
                        <TabsTrigger value="autonomous">Autonomous</TabsTrigger>
                        <TabsTrigger value="teleop">Teleop</TabsTrigger>
                        <TabsTrigger value="endgame">Endgame</TabsTrigger>
                    </TabsList>

                    <div className="flex-1 flex flex-col shrink-0" data-stage={activeTab}>
                        <TabsContent value="autonomous" className="h-full mt-0" data-stage="autonomous">
                            <FieldCanvas
                                key="autonomous"
                                fieldImagePath={fieldImagePath}
                                stageId="autonomous"
                                selectedTeams={selectedTeams}
                                onStageChange={onTabChange}
                            />
                        </TabsContent>

                        <TabsContent value="teleop" className="h-full mt-0" data-stage="teleop">
                            <FieldCanvas
                                key="teleop"
                                fieldImagePath={fieldImagePath}
                                stageId="teleop"
                                selectedTeams={selectedTeams}
                                onStageChange={onTabChange}
                            />
                        </TabsContent>

                        <TabsContent value="endgame" className="h-full mt-0" data-stage="endgame">
                            <FieldCanvas
                                key="endgame"
                                fieldImagePath={fieldImagePath}
                                stageId="endgame"
                                selectedTeams={selectedTeams}
                                onStageChange={onTabChange}
                            />
                        </TabsContent>
                    </div>
                </Tabs>
            </CardContent>
        </Card>
    );
};

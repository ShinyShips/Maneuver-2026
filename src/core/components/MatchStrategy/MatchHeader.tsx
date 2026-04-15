import { Button } from "@/core/components/ui/button";
import { GenericSelector } from "@/core/components/ui/generic-selector";
import { Input } from "@/core/components/ui/input";
import { matchStrategyDisplayModes, type MatchStrategyDisplayMode } from "@/game-template/match-strategy-config";

interface MatchHeaderProps {
    selectedEvent: string;
    selectedAutoPathEvents: string[];
    availableEvents: string[];
    matchNumber: string;
    isLookingUpMatch: boolean;
    displayMode: MatchStrategyDisplayMode;
    availableDisplayModes: MatchStrategyDisplayMode[];
    onEventChange: (value: string) => void;
    onAutoPathEventsChange: (values: string[]) => void;
    onMatchNumberChange: (value: string) => void;
    onDisplayModeChange: (value: MatchStrategyDisplayMode) => void;
    onClearAll: () => void;
    onSaveAll: () => void;
}

export const MatchHeader = ({
    selectedEvent,
    selectedAutoPathEvents,
    availableEvents,
    matchNumber,
    isLookingUpMatch,
    displayMode,
    availableDisplayModes,
    onEventChange,
    onAutoPathEventsChange,
    onMatchNumberChange,
    onDisplayModeChange,
    onClearAll,
    onSaveAll
}: MatchHeaderProps) => {
    const hasMatchData = localStorage.getItem("matchData");
    const displayModeLabels = Object.fromEntries(
        matchStrategyDisplayModes.map((mode) => [mode.id, mode.label])
    ) as Record<MatchStrategyDisplayMode, string>;

    return (
        <div className="flex w-full flex-col gap-3 pt-4">
            <div className="flex w-full flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
                {availableEvents.length > 0 && (
                    <div className="flex items-center gap-2 md:w-auto">
                        <label className="font-semibold whitespace-nowrap">Event:</label>
                        <div className="w-[min(18rem,calc(100vw-8rem))] min-w-0 flex-1 sm:min-w-35 sm:max-w-62.5">
                            <GenericSelector
                                label="Select Event"
                                value={selectedEvent}
                                availableOptions={availableEvents}
                                onValueChange={onEventChange}
                                placeholder="Select event"
                                className="bg-background border-muted-foreground/20"
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-2 md:w-auto">
                    <label htmlFor="match-number" className="font-semibold whitespace-nowrap">
                        Match #:
                    </label>
                    <div className="relative">
                        <Input
                            id="match-number"
                            type="text"
                            placeholder="Optional"
                            value={matchNumber}
                            onChange={(e) => onMatchNumberChange(e.target.value)}
                            className="w-24"
                        />
                        {isLookingUpMatch && (
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                            </div>
                        )}
                    </div>
                    {matchNumber && !isLookingUpMatch && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Auto-fills from match data
                        </span>
                    )}
                    {!hasMatchData && (
                        <span className="text-xs text-orange-500 whitespace-nowrap hidden md:inline">
                            Load match data first
                        </span>
                    )}
                </div>
            </div>

            <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex w-full flex-col gap-2 md:min-w-0 md:flex-1 md:flex-row md:flex-wrap md:items-center">
                    {availableEvents.length > 0 && (
                        <div className="flex items-center gap-2 md:w-auto">
                            <label className="font-semibold whitespace-nowrap">Auto Paths:</label>
                            <div className="w-[min(18rem,calc(100vw-8rem))] min-w-0 flex-1 sm:min-w-40 sm:max-w-72">
                                <GenericSelector
                                    label="Auto Path Source Events"
                                    multiSelect={true}
                                    values={selectedAutoPathEvents}
                                    availableOptions={["all", ...availableEvents]}
                                    onValuesChange={onAutoPathEventsChange}
                                    placeholder="All events"
                                    displayFormat={(value) => value === "all" ? "All Events" : value}
                                    className="bg-background border-muted-foreground/20"
                                />
                            </div>
                        </div>
                    )}

                    {availableDisplayModes.length > 0 && (
                        <div className="flex items-center gap-2 md:w-auto">
                            <label className="font-semibold whitespace-nowrap">Mode:</label>
                            <div className="w-[min(14rem,calc(100vw-8rem))] min-w-0 flex-1 sm:min-w-32 sm:max-w-48">
                                <GenericSelector
                                    label="Display Mode"
                                    value={displayMode}
                                    availableOptions={availableDisplayModes}
                                    onValueChange={(value) => onDisplayModeChange(value as MatchStrategyDisplayMode)}
                                    displayFormat={(value) => displayModeLabels[value as MatchStrategyDisplayMode] ?? value}
                                    className="bg-background border-muted-foreground/20"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 md:w-auto md:shrink-0 md:justify-end">
                    <Button
                        onClick={onClearAll}
                        variant="outline"
                        className="flex-1 md:flex-none px-3 py-2"
                    >
                        Clear All
                    </Button>
                    <Button
                        onClick={onSaveAll}
                        variant="outline"
                        className="flex-1 md:flex-none px-3 py-2"
                    >
                        Save All
                    </Button>
                </div>
            </div>
        </div>
    );
};

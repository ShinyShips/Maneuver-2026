import { Button } from "@/core/components/ui/button";
import { GenericSelector } from "@/core/components/ui/generic-selector";
import { X } from "lucide-react";
import { AggregationType } from "@/core/types/strategy";

interface StrategyHeaderProps {
    filteredTeamCount: number;
    totalTeamCount: number;
    activeFilterCount: number;
    selectedEvents: string[];
    onEventChange: (events: string[]) => void;
    availableEvents: string[];
    aggregationType: AggregationType;
    onAggregationTypeChange: (type: AggregationType) => void;
    onClearAllFilters: () => void;
    isSettingsOpen: boolean;
    onSettingsOpenChange: (open: boolean) => void;
    chartType: "bar" | "scatter" | "box" | "stacked";
    onChartTypeChange: (type: "bar" | "scatter" | "box" | "stacked") => void;
}

export const StrategyHeader = ({
    filteredTeamCount,
    totalTeamCount,
    activeFilterCount,
    selectedEvents,
    onEventChange,
    availableEvents,
    aggregationType,
    onAggregationTypeChange,
    onClearAllFilters,
    chartType,
}: StrategyHeaderProps) => {
    const handleAggregationTypeChange = (value: string) => {
        onAggregationTypeChange(value as AggregationType);
    };

    return (
        <div className="flex flex-col md:flex-row justify-between">
            <div>
                <h1 className="text-2xl font-bold pb-2">Strategy Overview</h1>
                <p className="text-muted-foreground pb-8 md:pb-0">
                    Team performance analysis with {filteredTeamCount} teams
                    {activeFilterCount > 0 && (
                        <span className="ml-2">
                            (filtered from {totalTeamCount})
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClearAllFilters}
                                className="ml-2 h-auto p-1 text-xs"
                            >
                                <X className="h-3 w-3 mr-1" />
                                Clear filters
                            </Button>
                        </span>
                    )}
                </p>
            </div>

            <div className="flex gap-2 pb-4 items-center">
                {/* Event Filter */}
                <GenericSelector
                    label="Select Event"
                    multiSelect={true}
                    values={selectedEvents}
                    availableOptions={["all", ...availableEvents]}
                    onValuesChange={onEventChange}
                    placeholder="All Events"
                    displayFormat={(val: string) => val === "all" ? "All Events" : val}
                    className="w-48"
                />

                {/* Aggregation Type */}
                <div className="relative">
                    <GenericSelector
                        label="Select Aggregation Type"
                        value={aggregationType}
                        availableOptions={["average", "median", "max", "min", "p75", "p25", "sum"]}
                        onValueChange={chartType === "box" ? () => { } : handleAggregationTypeChange}
                        placeholder="Aggregation type"
                        displayFormat={(val: string) => {
                            switch (val) {
                                case "average": return "Average";
                                case "median": return "Median";
                                case "max": return "Max";
                                case "min": return "Min";
                                case "p75": return "75th %";
                                case "p25": return "25th %";
                                case "sum": return "Sum";
                                default: return val;
                            }
                        }}
                        className={`w-32 ${chartType === "box" ? "opacity-50 pointer-events-none" : ""}`}
                    />
                </div>
            </div>
        </div>
    );
};

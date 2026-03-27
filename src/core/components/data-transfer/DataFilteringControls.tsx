/**
 * Data Filtering Components
 * UI components for filtering large scouting datasets before transfer
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Badge } from "@/core/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/core/components/ui/alert";
import { GenericSelector } from "@/core/components/ui/generic-selector";
import { Label } from "@/core/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/core/components/ui/select";
import { Checkbox } from "@/core/components/ui/checkbox";
import {
    AlertTriangle,
    CheckCircle,
    AlertCircle,
    Clock,
    QrCode
} from "lucide-react";
import {
    type DataFilters,
    type FilteredDataStats,
    type ScoutingDataCollection,
    extractEventKeys,
    extractMatchOptions,
    extractMatchCount,
    extractTeamNumbers,
    extractMatchRange,
    extractScoutNames,
    formatTransferMatchLabel,
    applyFilters,
    calculateFilterStats,
    validateFilters,
    getLastExportedMatch
} from "@/core/lib/dataFiltering";

interface DataFilteringControlsProps {
    data?: ScoutingDataCollection;
    filters: DataFilters;
    onFiltersChange: (filters: DataFilters) => void;
    onApplyFilters: () => void;
    useCompression?: boolean;
    filteredData?: ScoutingDataCollection | null;
    hideQRStats?: boolean;
    hideApplyButton?: boolean;
    showMatchRange?: boolean;
    showEventFilter?: boolean;
    showTeamFilter?: boolean;
    showScoutFilter?: boolean;
    availableEvents?: string[];
    availableTeams?: string[];
    availableScouts?: string[];
    summaryOverride?: string;
}

export const DataFilteringControls: React.FC<DataFilteringControlsProps> = ({
    data,
    filters,
    onFiltersChange,
    onApplyFilters,
    useCompression = true,
    filteredData,
    hideQRStats = false,
    hideApplyButton = false,
    showMatchRange = true,
    showEventFilter = true,
    showTeamFilter = true,
    showScoutFilter = false,
    availableEvents,
    availableTeams,
    availableScouts,
    summaryOverride
}) => {
    const matchRangeBaseData = useMemo(() => {
        if (!data) return null;
        return applyFilters(data, {
            ...filters,
            matchRange: {
                type: 'preset',
                preset: 'all'
            }
        });
    }, [data, filters]);
    const events = availableEvents ?? (data ? extractEventKeys(data) : []);
    const teams = availableTeams ?? (data ? extractTeamNumbers(data) : []);
    const scouts = availableScouts ?? (showScoutFilter ? extractScoutNames([]) : []);
    const matchRange = matchRangeBaseData ? extractMatchRange(matchRangeBaseData) : { min: 1, max: 1 };
    const availableMatchOptions = matchRangeBaseData ? extractMatchOptions(matchRangeBaseData) : [];
    const previewFilteredData = useMemo(() => {
        if (!data) return null;
        return applyFilters(data, filters);
    }, [data, filters]);

    const currentData = filteredData || previewFilteredData || data;
    const currentMatchCount = showMatchRange && currentData ? extractMatchCount(currentData) : 0;
    const currentMatchOptions = showMatchRange && currentData ? extractMatchOptions(currentData) : [];
    const currentRangeLabel = currentMatchOptions.length === 0
        ? 'No matches'
        : currentMatchOptions.length === 1
            ? currentMatchOptions[0]?.label ?? '1 match'
            : `${currentMatchOptions[0]?.label ?? 'First'} - ${currentMatchOptions[currentMatchOptions.length - 1]?.label ?? 'Last'}`;
    const stats = data && currentData ? calculateFilterStats(data, currentData, useCompression) : null;
    const filterValidation = validateFilters(filters);

    const handleMatchRangeChange = (type: 'preset' | 'custom', value?: string) => {
        const newFilters: DataFilters = {
            ...filters,
            matchRange: {
                ...filters.matchRange,
                type
            }
        };

        if (type === 'preset') {
            newFilters.matchRange.preset = value as 'last10' | 'last15' | 'last30' | 'all' | 'fromLastExport';
            delete newFilters.matchRange.customStart;
            delete newFilters.matchRange.customEnd;
            delete newFilters.matchRange.customStartKey;
            delete newFilters.matchRange.customEndKey;
        } else if (availableMatchOptions.length > 0) {
            newFilters.matchRange.customStart = 1;
            newFilters.matchRange.customEnd = availableMatchOptions.length;
            newFilters.matchRange.customStartKey = availableMatchOptions[0]?.key;
            newFilters.matchRange.customEndKey = availableMatchOptions[availableMatchOptions.length - 1]?.key;
        }

        onFiltersChange(newFilters);
    };

    const handleCustomRangeKeyChange = (field: 'start' | 'end', value: string) => {
        const selectedOption = availableMatchOptions.find(option => option.key === value);
        if (!selectedOption) return;

        const newFilters: DataFilters = {
            ...filters,
            matchRange: {
                ...filters.matchRange,
                customStart: field === 'start' ? selectedOption.index : filters.matchRange.customStart,
                customEnd: field === 'end' ? selectedOption.index : filters.matchRange.customEnd,
                customStartKey: field === 'start' ? selectedOption.key : filters.matchRange.customStartKey,
                customEndKey: field === 'end' ? selectedOption.key : filters.matchRange.customEndKey,
            }
        };

        onFiltersChange(newFilters);
    };

    const handleEventSelectionChange = (eventKey: string, selected: boolean) => {
        const selectedEvents = selected
            ? [...filters.events.selectedEvents, eventKey]
            : filters.events.selectedEvents.filter(event => event !== eventKey);

        onFiltersChange({
            ...filters,
            events: {
                selectedEvents,
                includeAll: selectedEvents.length === 0
            }
        });
    };

    const handleSelectAllEvents = (selectAll: boolean) => {
        onFiltersChange({
            ...filters,
            events: {
                selectedEvents: [],
                includeAll: selectAll
            }
        });
    };

    const handleTeamSelectionChange = (teamNumber: string, selected: boolean) => {
        const selectedTeams = selected
            ? [...filters.teams.selectedTeams, teamNumber]
            : filters.teams.selectedTeams.filter(t => t !== teamNumber);

        onFiltersChange({
            ...filters,
            teams: {
                selectedTeams,
                includeAll: selectedTeams.length === 0
            }
        });
    };

    const handleSelectAllTeams = (selectAll: boolean) => {
        onFiltersChange({
            ...filters,
            teams: {
                selectedTeams: [],
                includeAll: selectAll
            }
        });
    };

    const handleScoutSelectionChange = (scoutName: string, selected: boolean) => {
        const selectedScouts = selected
            ? [...filters.scouts.selectedScouts, scoutName]
            : filters.scouts.selectedScouts.filter(scout => scout !== scoutName);

        onFiltersChange({
            ...filters,
            scouts: {
                selectedScouts,
                includeAll: selectedScouts.length === 0
            }
        });
    };

    const handleSelectAllScouts = (selectAll: boolean) => {
        onFiltersChange({
            ...filters,
            scouts: {
                selectedScouts: [],
                includeAll: selectAll
            }
        });
    };

    return (
        <div className="space-y-2">
            {showMatchRange && <Label className="flex flex-col text-base font-medium items-start">Match Range Filter</Label>}

            {showMatchRange && <div className="space-y-2">
                {!hideQRStats && stats && currentData && (
                    <Label className="flex flex-col text-green-400 text-sm items-start gap-0">
                        Current dataset: ~{stats.estimatedQRCodes} QR codes from {currentData.entries.length} entries
                        {filteredData && data && (
                            <span className="text-muted-foreground"> Original: {data.entries.length} entries</span>
                        )}
                    </Label>
                )}
                <div className="space-y-2">
                    {currentData && (
                        <Label className="flex flex-col text-green-400 text-sm items-start gap-0">
                            {hideQRStats ? 'Available data:' : 'Data range:'} {currentRangeLabel} ({currentMatchCount} {currentMatchCount === 1 ? 'match' : 'matches'}, {currentData.entries.length} entries)
                            {filteredData && (
                                <span className="text-muted-foreground">Original: Match {matchRange.min} - {matchRange.max}</span>
                            )}
                        </Label>
                    )}

                    {!showMatchRange && summaryOverride && (
                        <Label className="flex flex-col text-green-400 text-sm items-start gap-0">
                            {summaryOverride}
                        </Label>
                    )}

                    <Select
                        value={filters.matchRange.type === 'preset' ? filters.matchRange.preset : 'custom'}
                        onValueChange={(value) => {
                            if (value === 'custom') {
                                handleMatchRangeChange('custom');
                            } else {
                                handleMatchRangeChange('preset', value);
                            }
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select match range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All matches</SelectItem>
                            <SelectItem value="last10">Last 10 matches</SelectItem>
                            <SelectItem value="last15">Last 15 matches</SelectItem>
                            <SelectItem value="last30">Last 30 matches</SelectItem>
                            <SelectItem value="fromLastExport">From last exported match</SelectItem>
                            <SelectItem value="custom">Custom range</SelectItem>
                        </SelectContent>
                    </Select>

                    {filters.matchRange.type === 'preset' && filters.matchRange.preset === 'fromLastExport' && (
                        <div className="text-xs text-muted-foreground">
                            {(() => {
                                const lastExported = getLastExportedMatch();
                                return lastExported
                                    ? `Will include matches from position ${lastExported + 1} onwards`
                                    : 'No previous export found - will include all matches';
                            })()}
                        </div>
                    )}

                    {filters.matchRange.type === 'custom' && (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Label className="text-sm shrink-0">From:</Label>
                                    <div className="min-w-0 flex-1">
                                        <GenericSelector
                                            label="Select first match"
                                            value={filters.matchRange.customStartKey || availableMatchOptions[0]?.key || ''}
                                            availableOptions={availableMatchOptions.map(option => option.key)}
                                            onValueChange={(value) => handleCustomRangeKeyChange('start', value)}
                                            placeholder="Select first match"
                                            displayFormat={(value) => availableMatchOptions.find(option => option.key === value)?.label || value}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Label className="text-sm shrink-0">To:</Label>
                                    <div className="min-w-0 flex-1">
                                        <GenericSelector
                                            label="Select last match"
                                            value={filters.matchRange.customEndKey || availableMatchOptions[availableMatchOptions.length - 1]?.key || ''}
                                            availableOptions={availableMatchOptions.map(option => option.key)}
                                            onValueChange={(value) => handleCustomRangeKeyChange('end', value)}
                                            placeholder="Select last match"
                                            displayFormat={(value) => availableMatchOptions.find(option => option.key === value)?.label || value}
                                        />
                                    </div>
                                </div>
                            </div>
                            {(filters.matchRange.customStartKey || filters.matchRange.customEndKey) && (
                                <div className="text-xs text-muted-foreground">
                                    Selected range: {formatTransferMatchLabel(filters.matchRange.customStartKey || availableMatchOptions[0]?.key || '')}
                                    {' - '}
                                    {formatTransferMatchLabel(filters.matchRange.customEndKey || availableMatchOptions[availableMatchOptions.length - 1]?.key || '')}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>}

            {!showMatchRange && summaryOverride && (
                <div className="space-y-2">
                    <Label className="flex flex-col text-green-400 text-sm items-start gap-0">
                        {summaryOverride}
                    </Label>
                </div>
            )}

            {showEventFilter && <div className="space-y-3">
                <Label className="text-base font-medium">Event Filter</Label>

                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="select-all-events"
                        checked={filters.events.includeAll}
                        onCheckedChange={handleSelectAllEvents}
                    />
                    <Label htmlFor="select-all-events" className="text-sm">
                        Include all events ({events.length} events)
                    </Label>
                </div>

                {!filters.events.includeAll && (
                    <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">
                            Select specific events ({filters.events.selectedEvents.length} selected):
                        </Label>
                        <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                            {events.map(eventKey => (
                                <div key={eventKey} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`event-${eventKey}`}
                                        checked={filters.events.selectedEvents.includes(eventKey)}
                                        onCheckedChange={(checked) =>
                                            handleEventSelectionChange(eventKey, checked as boolean)
                                        }
                                    />
                                    <Label htmlFor={`event-${eventKey}`} className="text-sm break-all">
                                        {eventKey}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>}

            {showTeamFilter && <div className="space-y-3">
                <Label className="text-base font-medium">Team Filter</Label>

                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="select-all-teams"
                        checked={filters.teams.includeAll}
                        onCheckedChange={handleSelectAllTeams}
                    />
                    <Label htmlFor="select-all-teams" className="text-sm">
                        Include all teams ({teams.length} teams)
                    </Label>
                </div>

                {!filters.teams.includeAll && (
                    <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">
                            Select specific teams ({filters.teams.selectedTeams.length} selected):
                        </Label>
                        <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                            {teams.map(team => (
                                <div key={team} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`team-${team}`}
                                        checked={filters.teams.selectedTeams.includes(team)}
                                        onCheckedChange={(checked) =>
                                            handleTeamSelectionChange(team, checked as boolean)
                                        }
                                    />
                                    <Label htmlFor={`team-${team}`} className="text-sm">
                                        {team}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>}

            {showScoutFilter && <div className="space-y-3">
                <Label className="text-base font-medium">Scout Filter</Label>

                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="select-all-scouts"
                        checked={filters.scouts.includeAll}
                        onCheckedChange={handleSelectAllScouts}
                    />
                    <Label htmlFor="select-all-scouts" className="text-sm">
                        Include all scouts ({scouts.length} scouts)
                    </Label>
                </div>

                {!filters.scouts.includeAll && (
                    <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">
                            Select specific scouts ({filters.scouts.selectedScouts.length} selected):
                        </Label>
                        <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                            {scouts.map(scout => (
                                <div key={scout} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`scout-${scout}`}
                                        checked={filters.scouts.selectedScouts.includes(scout)}
                                        onCheckedChange={(checked) =>
                                            handleScoutSelectionChange(scout, checked as boolean)
                                        }
                                    />
                                    <Label htmlFor={`scout-${scout}`} className="text-sm break-all">
                                        {scout}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>}

            {!filterValidation.valid && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Invalid Filter Configuration</AlertTitle>
                    <AlertDescription>{filterValidation.error}</AlertDescription>
                </Alert>
            )}

            {!hideApplyButton && (
                <Button
                    onClick={onApplyFilters}
                    disabled={!filterValidation.valid}
                    className="w-full mt-4"
                >
                    {filteredData ? 'Update Filter' : 'Apply Filters'}
                </Button>
            )}
        </div>
    );
};

interface FilteredDataStatsProps {
    stats: FilteredDataStats;
    originalCount: number;
}

export const FilteredDataStatsDisplay: React.FC<FilteredDataStatsProps> = ({
    stats,
    originalCount
}) => {
    const getWarningIcon = () => {
        switch (stats.warningLevel) {
            case 'safe':
                return <CheckCircle className="h-5 w-5 text-green-600" />;
            case 'warning':
                return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
            case 'danger':
                return <AlertCircle className="h-5 w-5 text-red-600" />;
        }
    };

    const getWarningMessage = () => {
        switch (stats.warningLevel) {
            case 'safe':
                return 'Excellent for real-time scanning';
            case 'warning':
                return 'Manageable but consider additional filtering';
            case 'danger':
                return 'Too many codes for practical real-time scanning';
        }
    };

    const getWarningVariant = (): "default" | "destructive" => {
        switch (stats.warningLevel) {
            case 'safe':
                return 'default';
            case 'warning':
                return 'default';
            case 'danger':
                return 'destructive';
        }
    };

    return (
        <Card className="mb-4">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <QrCode className="h-5 w-5" />
                        Filtered Data Preview
                    </span>
                    {getWarningIcon()}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold">{stats.filteredEntries}</div>
                        <div className="text-sm text-muted-foreground">
                            Entries (from {originalCount})
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold">{stats.estimatedQRCodes}</div>
                        <div className="text-sm text-muted-foreground">
                            QR Codes
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">
                        Estimated scan time: {stats.scanTimeEstimate}
                    </span>
                </div>

                {stats.compressionReduction && (
                    <div className="text-center">
                        <Badge variant="outline" className="text-xs">
                            🗜️ {stats.compressionReduction}
                        </Badge>
                    </div>
                )}

                <Alert variant={getWarningVariant()}>
                    {getWarningIcon()}
                    <AlertTitle>
                        {stats.warningLevel === 'safe' && 'Ready for Transfer'}
                        {stats.warningLevel === 'warning' && 'Caution Recommended'}
                        {stats.warningLevel === 'danger' && 'Additional Filtering Recommended'}
                    </AlertTitle>
                    <AlertDescription>
                        {getWarningMessage()}
                        {stats.warningLevel === 'danger' && (
                            <div className="mt-2 text-sm">
                                Consider selecting specific events, selecting specific teams, or using "Last 15 matches" to reduce the QR code count.
                            </div>
                        )}
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
};

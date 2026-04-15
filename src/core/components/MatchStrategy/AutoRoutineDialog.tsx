import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/core/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/components/animate-ui/radix/tabs";
import { AutoFieldMap, type PathWaypoint } from "@/game-template/components/auto-path/AutoFieldMap";
import { Eraser, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { AutoRoutineSelection, AutoRoutineSource, AutoRoutineWaypoint, StartPositionLabel, StrategyAutoRoutine } from "@/core/hooks/useMatchStrategy";

const START_POSITION_LABELS = ['Left Trench', 'Left Bump', 'Hub', 'Right Bump', 'Right Trench'] as const;
const PIT_START_TO_FIELD_KEY: Record<StartPositionLabel, 'trench1' | 'bump1' | 'hub' | 'bump2' | 'trench2'> = {
    'Left Trench': 'trench1',
    'Left Bump': 'bump1',
    Hub: 'hub',
    'Right Bump': 'bump2',
    'Right Trench': 'trench2',
};

interface AutoRoutineDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teamNumber: number | null;
    selectedSelection: AutoRoutineSelection | null;
    scoutedRoutines: StrategyAutoRoutine[];
    reportedRoutines: StrategyAutoRoutine[];
    onSelectRoutine: (selection: AutoRoutineSelection | null) => void;
    onAddReportedRoutine: (startLabel: StartPositionLabel, name: string, actions: AutoRoutineWaypoint[]) => Promise<AutoRoutineSelection | null>;
    onUpdateReportedRoutine: (routineId: string, name: string, actions: AutoRoutineWaypoint[]) => Promise<boolean>;
    onDeleteReportedRoutine: (routineId: string) => Promise<boolean>;
}

function groupByStartPosition(routines: StrategyAutoRoutine[]) {
    return START_POSITION_LABELS.reduce<Record<string, StrategyAutoRoutine[]>>((acc, startLabel) => {
        acc[startLabel] = routines
            .filter((routine) => routine.startLabel === startLabel)
            .sort((a, b) => a.label.localeCompare(b.label));
        return acc;
    }, {});
}

function RoutineSourceTab({
    source,
    routines,
    selectedSelection,
    emptyMessage,
    onSelectRoutine,
}: {
    source: AutoRoutineSource;
    routines: StrategyAutoRoutine[];
    selectedSelection: AutoRoutineSelection | null;
    emptyMessage: string;
    onSelectRoutine: (selection: AutoRoutineSelection) => void;
}) {
    const grouped = useMemo(() => groupByStartPosition(routines), [routines]);

    if (routines.length === 0) {
        return (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="max-h-[60vh] overflow-y-auto pr-3 touch-pan-y overscroll-contain">
            <div className="space-y-4 pb-1">
                {START_POSITION_LABELS.map((startLabel) => {
                    const startRoutines = grouped[startLabel] ?? [];
                    if (startRoutines.length === 0) return null;

                    return (
                        <div key={startLabel} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">{startLabel}</p>
                                <Badge variant="secondary">{startRoutines.length}</Badge>
                            </div>

                            <div className="space-y-2">
                                {startRoutines.map((routine) => {
                                    const isSelected = selectedSelection?.source === source
                                        && selectedSelection.routineId === routine.id;

                                    return (
                                        <button
                                            key={routine.id}
                                            type="button"
                                            className={`w-full rounded-md border p-3 text-left transition-colors ${isSelected
                                                ? 'border-primary bg-primary/10'
                                                : 'hover:bg-muted/40'
                                                }`}
                                            onClick={() => onSelectRoutine({ source, routineId: routine.id })}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-medium">{routine.label}</p>
                                                <div className="flex items-center gap-1">
                                                    {routine.eventKey ? (
                                                        <Badge variant="secondary">{routine.eventKey}</Badge>
                                                    ) : null}
                                                    {routine.matchNumber ? (
                                                        <Badge variant="outline">Match {routine.matchNumber}</Badge>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {routine.actions.length} actions
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function ReportedRoutineTab({
    routines,
    selectedSelection,
    onSelectRoutine,
    onAddAuto,
    onEditAuto,
    onDeleteAuto,
}: {
    routines: StrategyAutoRoutine[];
    selectedSelection: AutoRoutineSelection | null;
    onSelectRoutine: (selection: AutoRoutineSelection) => void;
    onAddAuto: (startLabel: StartPositionLabel) => void;
    onEditAuto: (routine: StrategyAutoRoutine) => void;
    onDeleteAuto: (routine: StrategyAutoRoutine) => void;
}) {
    const grouped = useMemo(() => groupByStartPosition(routines), [routines]);

    return (
        <div className="max-h-[60vh] overflow-y-auto pr-3 touch-pan-y overscroll-contain">
            <div className="space-y-4 pb-1">
                {START_POSITION_LABELS.map((startLabel) => {
                    const startRoutines = grouped[startLabel] ?? [];

                    return (
                        <div key={startLabel} className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">{startLabel}</p>
                                    <Badge variant="secondary">{startRoutines.length}</Badge>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => onAddAuto(startLabel)}>
                                    <Plus className="mr-1 h-4 w-4" />
                                    Add Auto
                                </Button>
                            </div>

                            {startRoutines.length > 0 ? (
                                <div className="space-y-2">
                                    {startRoutines.map((routine) => {
                                        const isSelected = selectedSelection?.source === 'reported'
                                            && selectedSelection.routineId === routine.id;

                                        return (
                                            <div
                                                key={routine.id}
                                                role="button"
                                                tabIndex={0}
                                                className={`w-full rounded-md border p-3 text-left transition-colors cursor-pointer ${isSelected
                                                    ? 'border-primary bg-primary/10'
                                                    : 'hover:bg-muted/40'
                                                    }`}
                                                onClick={() => onSelectRoutine({ source: 'reported', routineId: routine.id })}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        onSelectRoutine({ source: 'reported', routineId: routine.id });
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm font-medium">{routine.label}</p>
                                                    <div className="flex items-center gap-1">
                                                        {routine.eventKey ? (
                                                            <Badge variant="secondary">{routine.eventKey}</Badge>
                                                        ) : null}
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                onEditAuto(routine);
                                                            }}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                onDeleteAuto(routine);
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {routine.actions.length} actions
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">No reported autos recorded for this location.</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export const AutoRoutineDialog = ({
    open,
    onOpenChange,
    teamNumber,
    selectedSelection,
    scoutedRoutines,
    reportedRoutines,
    onSelectRoutine,
    onAddReportedRoutine,
    onUpdateReportedRoutine,
    onDeleteReportedRoutine,
}: AutoRoutineDialogProps) => {
    const [activeTab, setActiveTab] = useState<AutoRoutineSource>('scouted');
    const [recordingStart, setRecordingStart] = useState<StartPositionLabel | null>(null);
    const [recordingActions, setRecordingActions] = useState<AutoRoutineWaypoint[]>([]);
    const [recordingName, setRecordingName] = useState('');
    const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
    const [isSavingRoutine, setIsSavingRoutine] = useState(false);
    const descriptionId = recordingStart === null
        ? 'auto-routine-dialog-description'
        : 'auto-routine-recorder-description';

    useEffect(() => {
        if (!open) return;

        if (scoutedRoutines.length > 0) {
            setActiveTab('scouted');
            return;
        }

        setActiveTab('reported');
    }, [open, scoutedRoutines.length]);

    const handleSelectRoutine = (selection: AutoRoutineSelection) => {
        onSelectRoutine(selection);
        onOpenChange(false);
    };

    const handleClearSelection = () => {
        onSelectRoutine(null);
        onOpenChange(false);
    };

    const openRecorderForCreate = (startLabel: StartPositionLabel) => {
        const nextIndex = ((reportedRoutines.filter((routine) => routine.startLabel === startLabel).length) || 0) + 1;
        setRecordingStart(startLabel);
        setRecordingActions([]);
        setRecordingName(`${startLabel} Auto ${nextIndex}`);
        setEditingRoutineId(null);
    };

    const openRecorderForEdit = (routine: StrategyAutoRoutine) => {
        setRecordingStart(routine.startLabel);
        setRecordingActions(routine.actions);
        setRecordingName(routine.label);
        setEditingRoutineId(routine.id);
    };

    const closeRecorder = () => {
        setRecordingStart(null);
        setRecordingActions([]);
        setRecordingName('');
        setEditingRoutineId(null);
        setIsSavingRoutine(false);
    };

    const handleSaveRoutine = async () => {
        if (!recordingStart || recordingActions.length === 0) return;

        setIsSavingRoutine(true);
        try {
            if (editingRoutineId) {
                const updated = await onUpdateReportedRoutine(editingRoutineId, recordingName, recordingActions);
                if (!updated) {
                    toast.error('Unable to update reported auto.');
                    return;
                }
                onSelectRoutine({ source: 'reported', routineId: editingRoutineId });
                toast.success('Reported auto updated.');
            } else {
                const selection = await onAddReportedRoutine(recordingStart, recordingName, recordingActions);
                if (!selection) {
                    toast.error('Unable to save reported auto.');
                    return;
                }
                onSelectRoutine(selection);
                toast.success('Reported auto saved.');
            }

            closeRecorder();
            setActiveTab('reported');
        } finally {
            setIsSavingRoutine(false);
        }
    };

    const handleDeleteRoutine = async (routine: StrategyAutoRoutine) => {
        const confirmed = window.confirm(`Delete reported auto "${routine.label}"?`);
        if (!confirmed) return;

        const deleted = await onDeleteReportedRoutine(routine.id);
        if (!deleted) {
            toast.error('Unable to delete reported auto.');
            return;
        }

        if (selectedSelection?.source === 'reported' && selectedSelection.routineId === routine.id) {
            onSelectRoutine(null);
        }

        toast.success('Reported auto deleted.');
    };

    const handleDialogOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && recordingStart !== null) {
            closeRecorder();
            return;
        }

        onOpenChange(nextOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogContent
                aria-describedby={descriptionId}
                className={recordingStart !== null
                    ? "w-screen h-screen max-w-none max-h-none rounded-none border-0 p-4 sm:p-6 flex flex-col overflow-hidden"
                    : "w-[calc(100vw-1.5rem)] max-w-2xl max-h-[90vh] overflow-hidden p-4 sm:p-6 flex flex-col"
                }
            >
                {recordingStart === null ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Auto Routines{teamNumber ? ` • Team ${teamNumber}` : ''}</DialogTitle>
                            <DialogDescription id="auto-routine-dialog-description">
                                Scouted autos are shown first when available. Reported autos are grouped by starting location.
                            </DialogDescription>
                        </DialogHeader>

                        {selectedSelection ? (
                            <div className="flex justify-end pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleClearSelection}
                                >
                                    Clear Selected Auto
                                </Button>
                            </div>
                        ) : null}

                        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AutoRoutineSource)} className="w-full" enableSwipe={true}>
                            <TabsList className="grid w-full grid-cols-2 shrink-0">
                                <TabsTrigger value="scouted">Scouted Autos</TabsTrigger>
                                <TabsTrigger value="reported">Reported Autos</TabsTrigger>
                            </TabsList>

                            <TabsContent value="scouted" className="mt-4">
                                <RoutineSourceTab
                                    source="scouted"
                                    routines={scoutedRoutines}
                                    selectedSelection={selectedSelection}
                                    emptyMessage="No scouted autonomous routines found for this team."
                                    onSelectRoutine={handleSelectRoutine}
                                />
                            </TabsContent>

                            <TabsContent value="reported" className="mt-4">
                                <ReportedRoutineTab
                                    routines={reportedRoutines}
                                    selectedSelection={selectedSelection}
                                    onSelectRoutine={handleSelectRoutine}
                                    onAddAuto={openRecorderForCreate}
                                    onEditAuto={openRecorderForEdit}
                                    onDeleteAuto={handleDeleteRoutine}
                                />
                            </TabsContent>
                        </Tabs>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>{editingRoutineId ? 'Edit Reported Auto' : 'Record Reported Auto'}</DialogTitle>
                            <DialogDescription id="auto-routine-recorder-description">
                                Use the field map to build the reported auto path for {recordingStart}. Then save it with a name.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
                            <div className="w-full">
                                <AutoFieldMap
                                    actions={recordingActions as PathWaypoint[]}
                                    onAddAction={(action) => setRecordingActions((prev) => [...prev, action as AutoRoutineWaypoint])}
                                    onUndo={() => setRecordingActions((prev) => prev.slice(0, -1))}
                                    canUndo={recordingActions.length > 0}
                                    teamNumber={teamNumber ? String(teamNumber) : 'strategy'}
                                    matchNumber="strategy"
                                    enableNoShow={false}
                                    recordingMode={true}
                                    preferredStartKey={recordingStart ? PIT_START_TO_FIELD_KEY[recordingStart] : undefined}
                                    headerInputSlot={
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="strategy-reported-auto-name"
                                                value={recordingName}
                                                onChange={(event) => setRecordingName(event.target.value)}
                                                placeholder={recordingStart ? `${recordingStart} Auto` : 'Reported Auto'}
                                                className="h-8 w-52 sm:w-72"
                                                aria-label="Auto name"
                                            />
                                        </div>
                                    }
                                    recordingActionSlot={
                                        <div className="flex items-center gap-1">
                                            <Button
                                                className="h-8 w-8 md:w-auto md:px-2"
                                                type="button"
                                                variant="outline"
                                                onClick={closeRecorder}
                                                aria-label="Cancel"
                                            >
                                                <X className="h-4 w-4" />
                                                <span className="hidden md:inline md:ml-1">Cancel</span>
                                            </Button>
                                            <Button
                                                className="h-8 w-8 md:w-auto md:px-2"
                                                type="button"
                                                variant="secondary"
                                                onClick={() => setRecordingActions([])}
                                                disabled={recordingActions.length === 0}
                                                aria-label="Clear Path"
                                            >
                                                <Eraser className="h-4 w-4" />
                                                <span className="hidden md:inline md:ml-1">Clear Path</span>
                                            </Button>
                                            <Button
                                                className="h-8 w-8 md:w-auto md:px-2"
                                                type="button"
                                                onClick={handleSaveRoutine}
                                                disabled={recordingActions.length === 0 || isSavingRoutine}
                                                aria-label="Save Reported Auto"
                                            >
                                                <Save className="h-4 w-4" />
                                                <span className="hidden md:inline md:ml-1">Save</span>
                                            </Button>
                                        </div>
                                    }
                                />
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

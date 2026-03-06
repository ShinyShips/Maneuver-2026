import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  AUTO_START_LOCATION_OPTIONS,
  SHOT_GRID_CELL_LABELS,
  SHOT_GRID_COLS,
  SHOT_GRID_ROW_WEIGHTS,
  SHOT_GRID_SHOOTABLE_ROWS,
} from '@/core/lib/experiment/constants';
import fieldMapImage from '@/game-template/assets/2026-field.png';
import type {
  AutoStartLocationValue,
  NormalizedExperimentMetrics,
  PhaseMetrics,
} from '@/core/lib/experiment/types';

interface ExperimentMetricsEditorProps {
  metrics: NormalizedExperimentMetrics;
  onChange: (next: NormalizedExperimentMetrics) => void;
}

type EditableScalarMetricKey = Exclude<
  keyof PhaseMetrics,
  'shotGridCounts' | 'passGridCounts' | 'collectGridCounts' | 'autoStartLocation' | 'climbActions' | 'climbResult' | 'climbLocation'
>;

const metricFields: Array<{ key: EditableScalarMetricKey; label: string }> = [
  { key: 'fuelCollected', label: 'Fuel collected' },
  { key: 'zoneAllianceActions', label: 'Alliance-zone actions' },
  { key: 'zoneNeutralActions', label: 'Neutral-zone actions' },
  { key: 'zoneOpponentActions', label: 'Opponent-zone actions' },
];

const autoExcludedFieldKeys = new Set<EditableScalarMetricKey>([
  'defenseActions',
  'fuelCollected',
  'zoneAllianceActions',
  'zoneNeutralActions',
  'zoneOpponentActions',
]);

const teleopExcludedFieldKeys = new Set<EditableScalarMetricKey>([
  'collectActions',
  'foulActions',
  'fuelCollected',
  'zoneAllianceActions',
  'zoneNeutralActions',
  'zoneOpponentActions',
]);

const toSafeNumber = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, parsed);
};

const PhaseEditor = ({
  phase,
  values,
  onUpdate,
}: {
  phase: 'auto' | 'teleop';
  values: PhaseMetrics;
  onUpdate: (next: PhaseMetrics) => void;
}) => {
  const normalizedShotGridCounts = SHOT_GRID_CELL_LABELS.map((_, index) => values.shotGridCounts?.[index] ?? 0);
  const normalizedCollectGridCounts = SHOT_GRID_CELL_LABELS.map((_, index) => values.collectGridCounts?.[index] ?? 0);
  const allShotCells = SHOT_GRID_CELL_LABELS.map((label, index) => ({ index, label }));
  const shootableShotCells = SHOT_GRID_CELL_LABELS.flatMap((label, index) => {
    const row = Math.floor(index / SHOT_GRID_COLS);
    if (!SHOT_GRID_SHOOTABLE_ROWS.includes(row as (typeof SHOT_GRID_SHOOTABLE_ROWS)[number])) return [];
    return [{ index, label }];
  });
  const [selectedShotCellIndex, setSelectedShotCellIndex] = useState<number>(shootableShotCells[0]?.index ?? 0);
  const [shotFuelInput, setShotFuelInput] = useState<string>('1');
  const [selectedCollectCellIndex, setSelectedCollectCellIndex] = useState<number>(allShotCells[0]?.index ?? 0);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
  const [isFieldFlipped, setIsFieldFlipped] = useState(false);

  const visibleMetricFields = metricFields.filter((field) => {
    if (phase === 'auto') return !autoExcludedFieldKeys.has(field.key);
    return !teleopExcludedFieldKeys.has(field.key);
  });

  const getDraftKey = (fieldKey: EditableScalarMetricKey) => `${phase}-${fieldKey}`;
  const getShotFuelAmount = () => Math.max(1, toSafeNumber(shotFuelInput === '' ? '1' : shotFuelInput));

  return (
    <Card>
    <CardHeader>
      <CardTitle className="text-lg capitalize">{phase}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-2 mb-4">
        {phase === 'auto' && (
          <div className="space-y-1">
            <Label htmlFor={`${phase}-auto-start-location`}>Auto start location</Label>
            <Select
              value={values.autoStartLocation}
              onValueChange={(value) => {
                onUpdate({
                  ...values,
                  autoStartLocation: value as AutoStartLocationValue,
                });
              }}
            >
              <SelectTrigger id={`${phase}-auto-start-location`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTO_START_LOCATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Label>Shot location grid (increment by cell)</Label>
        <div>
          <Button
            type="button"
            className="p-2"
            variant="outline"
            onClick={() => setIsFieldFlipped((previous) => !previous)}
          >
            {isFieldFlipped ? 'Reset Field Orientation' : 'Flip Field 180°'}
          </Button>
        </div>
        <div className="relative w-full max-w-4xl aspect-25/12 rounded-md border overflow-hidden">
          <div className={`absolute inset-0 ${isFieldFlipped ? 'rotate-180' : ''}`}>
            <img
              src={fieldMapImage}
              alt="Field map with shot grid overlay"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${SHOT_GRID_COLS}, minmax(0, 1fr))`,
                gridTemplateRows: SHOT_GRID_ROW_WEIGHTS.map((weight) => `${weight}fr`).join(' '),
              }}
            >
              {SHOT_GRID_CELL_LABELS.map((cellLabel, index) => {
                const shotCount = normalizedShotGridCounts[index] ?? 0;
                const collectCount = normalizedCollectGridCounts[index] ?? 0;
                const row = Math.floor(index / SHOT_GRID_COLS);
                const isShootable = SHOT_GRID_SHOOTABLE_ROWS.includes(row as (typeof SHOT_GRID_SHOOTABLE_ROWS)[number]);

                return (
                  <div
                    key={`${phase}-shot-cell-${cellLabel}`}
                    className={`relative border border-white/50 ${isShootable ? 'bg-black/10' : 'bg-black/35'}`}
                  >
                    <div className={`absolute top-1 left-1 text-[10px] font-semibold px-1 rounded bg-black/60 text-white ${isFieldFlipped ? 'rotate-180' : ''}`}>
                      {cellLabel}
                    </div>
                    {(shotCount > 0 || collectCount > 0) && (
                      <div className={`absolute bottom-1 left-1 rounded bg-black/65 px-1 py-0.5 text-[10px] text-white ${isFieldFlipped ? 'rotate-180' : ''}`}>
                        S:{shotCount} C:{collectCount}
                      </div>
                    )}
                    {!isShootable && (
                      <div className={`absolute bottom-1 right-1 rounded bg-black/55 px-1 py-0.5 text-[10px] text-white/80 ${isFieldFlipped ? 'rotate-180' : ''}`}>
                        Spacer
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="space-y-2 rounded-md border p-3 bg-muted/30">
          <Label>Shot actions</Label>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label htmlFor={`${phase}-shot-cell-select`}>Shot cell</Label>
              <Select
                value={String(selectedShotCellIndex)}
                onValueChange={(value) => setSelectedShotCellIndex(Number(value))}
              >
                <SelectTrigger id={`${phase}-shot-cell-select`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shootableShotCells.map((cell) => (
                    <SelectItem key={`${phase}-shot-option-${cell.index}`} value={String(cell.index)}>
                      {cell.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${phase}-shot-fuel`}>Fuel in shot</Label>
              <Input
                id={`${phase}-shot-fuel`}
                type="number"
                min={1}
                value={shotFuelInput}
                onChange={(event) => setShotFuelInput(event.target.value)}
                onBlur={() => {
                  setShotFuelInput(String(getShotFuelAmount()));
                }}
              />
            </div>
            <Button
              type="button"
              className="p-2"
              onClick={() => {
                const fuelAmount = getShotFuelAmount();
                const nextCounts = [...normalizedShotGridCounts];
                nextCounts[selectedShotCellIndex] = (nextCounts[selectedShotCellIndex] ?? 0) + 1;
                onUpdate({
                  ...values,
                  shotGridCounts: nextCounts,
                  scoreActions: nextCounts.reduce((acc, value) => acc + value, 0),
                  fuelScored: values.fuelScored + fuelAmount,
                });
              }}
            >
              Add shot
            </Button>
            <Button
              type="button"
              variant="outline"
              className="p-2"
              onClick={() => {
                const fuelAmount = getShotFuelAmount();
                const nextCounts = [...normalizedShotGridCounts];
                const existingInCell = nextCounts[selectedShotCellIndex] ?? 0;
                if (existingInCell <= 0) return;
                nextCounts[selectedShotCellIndex] = Math.max(0, (nextCounts[selectedShotCellIndex] ?? 0) - 1);
                onUpdate({
                  ...values,
                  shotGridCounts: nextCounts,
                  scoreActions: nextCounts.reduce((acc, value) => acc + value, 0),
                  fuelScored: Math.max(0, values.fuelScored - fuelAmount),
                });
              }}
            >
              Remove shot
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">Total fuel scored from shot actions: {values.fuelScored}</div>
        </div>

        {phase === 'auto' && (
          <div className="space-y-2 rounded-md border p-3 bg-muted/30">
            <Label>Collect actions</Label>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label htmlFor={`${phase}-collect-cell-select`}>Collect cell</Label>
                <Select
                  value={String(selectedCollectCellIndex)}
                  onValueChange={(value) => setSelectedCollectCellIndex(Number(value))}
                >
                  <SelectTrigger id={`${phase}-collect-cell-select`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allShotCells.map((cell) => (
                      <SelectItem key={`${phase}-collect-option-${cell.index}`} value={String(cell.index)}>
                        {cell.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                className="p-2"
                onClick={() => {
                  const nextCollectCounts = [...normalizedCollectGridCounts];
                  nextCollectCounts[selectedCollectCellIndex] = (nextCollectCounts[selectedCollectCellIndex] ?? 0) + 1;
                  onUpdate({
                    ...values,
                    collectGridCounts: nextCollectCounts,
                    collectActions: values.collectActions + 1,
                  });
                }}
              >
                Add collect
              </Button>
              <Button
                type="button"
                variant="outline"
                className="p-2"
                onClick={() => {
                  const nextCollectCounts = [...normalizedCollectGridCounts];
                  const existingInCell = nextCollectCounts[selectedCollectCellIndex] ?? 0;
                  if (existingInCell <= 0) return;
                  nextCollectCounts[selectedCollectCellIndex] = Math.max(0, existingInCell - 1);
                  onUpdate({
                    ...values,
                    collectGridCounts: nextCollectCounts,
                    collectActions: Math.max(0, values.collectActions - 1),
                  });
                }}
              >
                Remove collect
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Total collect actions: {values.collectActions}
            </div>
          </div>
        )}
        <div className="text-sm text-muted-foreground">
          Total score actions from shot list: {values.scoreActions}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visibleMetricFields.map((field) => (
          <div key={`${phase}-${field.key}`} className="space-y-1">
            <Label htmlFor={`${phase}-${field.key}`}>{field.label}</Label>
            <Input
              id={`${phase}-${field.key}`}
              type="number"
              min={0}
              value={fieldDrafts[getDraftKey(field.key)] ?? String(values[field.key])}
              onChange={(event) => {
                const rawValue = event.target.value;
                const draftKey = getDraftKey(field.key);
                setFieldDrafts((prev) => ({ ...prev, [draftKey]: rawValue }));
                if (rawValue.trim() === '') return;
                onUpdate({
                  ...values,
                  [field.key]: toSafeNumber(rawValue),
                });
              }}
              onBlur={() => {
                const draftKey = getDraftKey(field.key);
                const rawValue = fieldDrafts[draftKey];
                if (rawValue === undefined) return;

                const nextValue = rawValue.trim() === '' ? 0 : toSafeNumber(rawValue);
                onUpdate({
                  ...values,
                  [field.key]: nextValue,
                });

                setFieldDrafts((prev) => {
                  const next = { ...prev };
                  delete next[draftKey];
                  return next;
                });
              }}
            />
          </div>
        ))}
      </div>
    </CardContent>
    </Card>
  );
};

export const ExperimentMetricsEditor = ({ metrics, onChange }: ExperimentMetricsEditorProps) => {
  return (
    <div className="space-y-4">
      <PhaseEditor
        phase="auto"
        values={metrics.auto}
        onUpdate={(next) => onChange({ ...metrics, auto: next })}
      />
      <PhaseEditor
        phase="teleop"
        values={metrics.teleop}
        onUpdate={(next) => onChange({ ...metrics, teleop: next })}
      />
    </div>
  );
};

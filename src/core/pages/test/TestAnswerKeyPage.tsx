import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Textarea } from '@/core/components/ui/textarea';
import { ScoringSections } from '@/game-template/components';
import { GAME_SCOUT_OPTION_KEYS } from '@/game-template/scout-options';
import {
  SHOT_GRID_CELL_LABELS,
  SHOT_GRID_COLS,
  SHOT_GRID_ROW_WEIGHTS,
  SHOT_GRID_SHOOTABLE_ROWS,
  STUDY_CLIP_IDS,
  STUDY_CLIP_OPTIONS,
} from '@/core/lib/experiment/constants';
import fieldMapImage from '@/game-template/assets/2026-field.png';
import { buildMetricsFromActions, createEmptyMetrics } from '@/core/lib/experiment/metrics';
import {
  deleteAnswerKeyByClip,
  getAllAnswerKeys,
  getAnswerKeyByClip,
  saveAnswerKey,
} from '@/core/db/experimentDatabase';
import type { ExperimentAnswerKey } from '@/core/lib/experiment/types';
import { toast } from 'sonner';

type Phase = 'auto' | 'teleop';
type GridPhase = 'auto' | 'teleop';

const TEST_VISUAL_SCOUT_OPTIONS: Record<string, boolean> = {
  [GAME_SCOUT_OPTION_KEYS.disableDefensePopup]: true,
};

const generateId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

const downloadJsonFile = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toSafeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toSafeNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toSafeNumber(item));
};

const normalizeImportedAnswerKey = (raw: unknown): ExperimentAnswerKey | null => {
  if (!isObject(raw)) return null;

  const now = Date.now();
  const metrics = createEmptyMetrics();
  const rawMetrics = isObject(raw.metrics) ? raw.metrics : {};
  const rawAuto = isObject(rawMetrics.auto) ? rawMetrics.auto : {};
  const rawTeleop = isObject(rawMetrics.teleop) ? rawMetrics.teleop : {};

  if (Array.isArray(rawAuto.shotGridCounts)) metrics.auto.shotGridCounts = toSafeNumberArray(rawAuto.shotGridCounts);
  if (Array.isArray(rawAuto.collectGridCounts)) metrics.auto.collectGridCounts = toSafeNumberArray(rawAuto.collectGridCounts);
  if (Array.isArray(rawTeleop.shotGridCounts)) metrics.teleop.shotGridCounts = toSafeNumberArray(rawTeleop.shotGridCounts);

  metrics.auto.scoreActions = toSafeNumber(rawAuto.scoreActions) || metrics.auto.shotGridCounts.reduce((acc, value) => acc + value, 0);
  metrics.teleop.scoreActions = toSafeNumber(rawTeleop.scoreActions) || metrics.teleop.shotGridCounts.reduce((acc, value) => acc + value, 0);

  const autoStartLocation = typeof rawAuto.autoStartLocation === 'string' ? rawAuto.autoStartLocation : 'none';
  metrics.auto.autoStartLocation = autoStartLocation as typeof metrics.auto.autoStartLocation;

  metrics.auto.collectActions = toSafeNumber(rawAuto.collectActions);
  metrics.auto.fuelScored = toSafeNumber(rawAuto.fuelScored);
  metrics.teleop.fuelScored = toSafeNumber(rawTeleop.fuelScored);

  const clipId = typeof raw.clipId === 'string' ? raw.clipId.trim() : '';
  if (!clipId) return null;

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : `${now}-${Math.random().toString(36).slice(2, 8)}`,
    clipId,
    metrics,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    createdAt: toSafeNumber(raw.createdAt) || now,
    updatedAt: toSafeNumber(raw.updatedAt) || now,
  };
};

const toSlimAnswerKeyExport = (key: ExperimentAnswerKey) => ({
  id: key.id,
  clipId: key.clipId,
  notes: key.notes,
  createdAt: key.createdAt,
  updatedAt: key.updatedAt,
  metrics: {
    auto: {
      scoreActions: key.metrics.auto.scoreActions,
      autoStartLocation: key.metrics.auto.autoStartLocation,
      shotGridCounts: key.metrics.auto.shotGridCounts,
      collectGridCounts: key.metrics.auto.collectGridCounts,
      collectActions: key.metrics.auto.collectActions,
      fuelScored: key.metrics.auto.fuelScored,
    },
    teleop: {
      scoreActions: key.metrics.teleop.scoreActions,
      shotGridCounts: key.metrics.teleop.shotGridCounts,
      fuelScored: key.metrics.teleop.fuelScored,
    },
  },
});

const TestAnswerKeyPage = () => {
  const navigate = useNavigate();
  const [clipId, setClipId] = useState<string>(STUDY_CLIP_IDS.block1);
  const [notes, setNotes] = useState('');
  const [phase, setPhase] = useState<Phase>('auto');
  const [autoActions, setAutoActions] = useState<any[]>([]);
  const [teleopActions, setTeleopActions] = useState<any[]>([]);
  const [existingUpdatedAt, setExistingUpdatedAt] = useState<number | null>(null);
  const [answerKeys, setAnswerKeys] = useState<ExperimentAnswerKey[]>([]);
  const [loadedKeyPreview, setLoadedKeyPreview] = useState<ExperimentAnswerKey | null>(null);
  const [savedGridPhase, setSavedGridPhase] = useState<GridPhase>('auto');

  const computedMetrics = useMemo(() => buildMetricsFromActions({
    autoActions,
    teleopActions,
  }), [autoActions, teleopActions]);

  useEffect(() => {
    setExistingUpdatedAt(null);
    setLoadedKeyPreview(null);
  }, [clipId]);

  const refreshAnswerKeys = async () => {
    const all = await getAllAnswerKeys();
    setAnswerKeys(all);
  };

  useEffect(() => {
    void refreshAnswerKeys();
  }, []);

  const handleLoad = async () => {
    const existing = await getAnswerKeyByClip(clipId.trim());
    if (!existing) {
      toast.error('No answer key found for this clip ID');
      return;
    }

    setNotes(existing.notes || '');
    setExistingUpdatedAt(existing.updatedAt);
    setLoadedKeyPreview(existing);
    toast.success('Existing answer key loaded for this clip.');
  };

  const handleAddAction = (action: any) => {
    const timestamped = { ...action, timestamp: action.timestamp ?? Date.now() };
    if (phase === 'auto') {
      setAutoActions((prev) => [...prev, timestamped]);
    } else {
      setTeleopActions((prev) => [...prev, timestamped]);
    }
  };

  const handleUndo = () => {
    if (phase === 'auto') {
      setAutoActions((prev) => prev.slice(0, -1));
    } else {
      setTeleopActions((prev) => prev.slice(0, -1));
    }
  };

  const handleProceed = async () => {
    if (phase === 'auto') {
      setPhase('teleop');
      return;
    }

    await handleSave();
    navigate('/test');
  };

  const handleSave = async () => {
    const now = Date.now();
    const existing = await getAnswerKeyByClip(clipId.trim());

    await saveAnswerKey({
      id: existing?.id || generateId(),
      clipId: clipId.trim(),
      metrics: computedMetrics,
      notes,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });

    setExistingUpdatedAt(now);
    setLoadedKeyPreview({
      id: existing?.id || 'pending',
      clipId: clipId.trim(),
      metrics: computedMetrics,
      notes,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
    await refreshAnswerKeys();
    toast.success('Answer key saved');
  };

  const handleResetActions = () => {
    setPhase('auto');
    setAutoActions([]);
    setTeleopActions([]);
  };

  const handleDeleteSelectedClipKey = async () => {
    const trimmedClipId = clipId.trim();
    if (!window.confirm(`Delete answer key for ${trimmedClipId}? This cannot be undone.`)) {
      return;
    }

    const deleted = await deleteAnswerKeyByClip(trimmedClipId);
    if (!deleted) {
      toast.error('No answer key found for selected clip');
      return;
    }

    setExistingUpdatedAt(null);
    setLoadedKeyPreview(null);
    await refreshAnswerKeys();
    toast.success(`Deleted answer key for ${trimmedClipId}`);
  };

  const handleExportSelectedClipKey = async () => {
    const trimmedClipId = clipId.trim();
    const key = await getAnswerKeyByClip(trimmedClipId);
    if (!key) {
      toast.error('No answer key found for selected clip');
      return;
    }

    downloadJsonFile(`answer-key-${trimmedClipId}.json`, {
      exportedAt: Date.now(),
      exportSchemaVersion: 'answer-key-slim-v1',
      clipId: trimmedClipId,
      answerKey: toSlimAnswerKeyExport(key),
    });
    toast.success(`Exported answer key for ${trimmedClipId}`);
  };

  const handleExportAllAnswerKeys = async () => {
    const allKeys = await getAllAnswerKeys();
    if (allKeys.length === 0) {
      toast.error('No answer keys available to export');
      return;
    }

    downloadJsonFile(`answer-keys-${new Date().toISOString().slice(0, 10)}.json`, {
      exportedAt: Date.now(),
      exportSchemaVersion: 'answer-key-slim-v1',
      answerKeys: allKeys.map(toSlimAnswerKeyExport),
    });
    toast.success(`Exported ${allKeys.length} answer key${allKeys.length === 1 ? '' : 's'}`);
  };

  const handleImportAnswerKeys = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed: unknown = JSON.parse(raw);

      const candidates: unknown[] = [];
      if (isObject(parsed)) {
        if (Array.isArray(parsed.answerKeys)) {
          candidates.push(...parsed.answerKeys);
        } else if (isObject(parsed.answerKey)) {
          candidates.push(parsed.answerKey);
        } else if (Array.isArray((parsed as Record<string, unknown>).answerKeys)) {
          candidates.push(...((parsed as Record<string, unknown>).answerKeys as unknown[]));
        }
      }

      if (candidates.length === 0) {
        throw new Error('No answer keys found in import file.');
      }

      let importedCount = 0;
      for (const candidate of candidates) {
        const normalized = normalizeImportedAnswerKey(candidate);
        if (!normalized) continue;

        const existing = await getAnswerKeyByClip(normalized.clipId);
        await saveAnswerKey({
          ...normalized,
          id: existing?.id || normalized.id,
          createdAt: existing?.createdAt || normalized.createdAt,
          updatedAt: Date.now(),
        });
        importedCount += 1;
      }

      if (importedCount === 0) {
        throw new Error('Import file did not contain valid answer keys.');
      }

      await refreshAnswerKeys();
      toast.success(`Imported ${importedCount} answer key${importedCount === 1 ? '' : 's'}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import answer keys');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="min-h-screen px-4 pt-24 pb-24 space-y-4">
      <div className="max-w-7xl mx-auto">
        <Button className="p-2 mb-3" variant="outline" onClick={() => navigate('/test')}>
          Back
        </Button>
        <h1 className="text-2xl font-bold">Answer Key Builder (Visual)</h1>
        <p className="text-sm text-muted-foreground">Build answer keys from visual actions using the same interface scouts use.</p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          <ScoringSections
            phase={phase}
            actions={phase === 'auto' ? autoActions : teleopActions}
            onAddAction={handleAddAction}
            scoutOptions={TEST_VISUAL_SCOUT_OPTIONS}
            onUndo={handleUndo}
            canUndo={(phase === 'auto' ? autoActions : teleopActions).length > 0}
            onProceed={handleProceed}
            onBack={() => {
              if (phase === 'auto') {
                navigate('/test');
                return;
              }

              if (phase === 'teleop') {
                setPhase('auto');
              }
            }}
            matchNumber={1}
            matchType="qm"
            teamNumber="0000"
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Saved Key Shot Grid on Field</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!loadedKeyPreview ? (
                <div className="text-muted-foreground">Load or check an existing key to visualize saved shot locations on the field.</div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-muted-foreground">Viewing clip <strong>{loadedKeyPreview.clipId}</strong></div>
                    <div className="flex gap-2">
                      <Button
                        className="p-2"
                        variant={savedGridPhase === 'auto' ? 'default' : 'outline'}
                        onClick={() => setSavedGridPhase('auto')}
                      >
                        Auto
                      </Button>
                      <Button
                        className="p-2"
                        variant={savedGridPhase === 'teleop' ? 'default' : 'outline'}
                        onClick={() => setSavedGridPhase('teleop')}
                      >
                        Teleop
                      </Button>
                    </div>
                  </div>

                  <div className="relative w-full max-w-4xl aspect-25/12 rounded-md border overflow-hidden">
                    <img
                      src={fieldMapImage}
                      alt="Field map with saved shot grid overlay"
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
                        const row = Math.floor(index / SHOT_GRID_COLS);
                        const isShootable = SHOT_GRID_SHOOTABLE_ROWS.includes(row as (typeof SHOT_GRID_SHOOTABLE_ROWS)[number]);
                        const count = savedGridPhase === 'auto'
                          ? (loadedKeyPreview.metrics.auto.shotGridCounts?.[index] ?? 0)
                          : (loadedKeyPreview.metrics.teleop.shotGridCounts?.[index] ?? 0);

                        return (
                          <div
                            key={`${savedGridPhase}-${cellLabel}`}
                            className={`relative border border-white/45 ${isShootable ? 'bg-black/10' : 'bg-black/35'}`}
                          >
                            <div className="absolute top-1 left-1 text-[10px] font-semibold px-1 rounded bg-black/60 text-white">
                              {cellLabel}
                            </div>
                            {count > 0 && (
                              <div className="absolute bottom-1 left-1 rounded bg-black/65 px-1 py-0.5 text-[10px] text-white">
                                Shots: {count}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Answer Key Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-1">
              <Label htmlFor="clip-id">Clip ID</Label>
              <Select value={clipId} onValueChange={setClipId}>
                <SelectTrigger id="clip-id">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STUDY_CLIP_OPTIONS.map((clip) => (
                    <SelectItem key={clip.id} value={clip.id}>
                      {clip.label} ({clip.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-muted-foreground">
              Selected clip: <strong>{clipId}</strong>
            </div>

            <Button className="w-full p-2" variant="outline" onClick={handleLoad}>Load Existing Key</Button>
            <Button className="w-full p-2" onClick={handleSave}>Save Key to Selected Clip</Button>
            <Button className="w-full p-2" variant="secondary" onClick={handleExportSelectedClipKey}>
              Export Selected Clip Key
            </Button>
            <Button className="w-full p-2" variant="secondary" onClick={handleExportAllAnswerKeys}>
              Export All Answer Keys
            </Button>
            <Input
              type="file"
              accept="application/json,.json"
              onChange={handleImportAnswerKeys}
              className="w-full"
            />
            <Button className="w-full p-2" variant="destructive" onClick={handleDeleteSelectedClipKey}>
              Delete Selected Clip Key
            </Button>
            <Button className="w-full p-2" variant="outline" onClick={handleResetActions}>Reset Actions</Button>

            <div>Current phase: <strong className="capitalize">{phase}</strong></div>
            <div>Auto actions: {autoActions.length}</div>
            <div>Teleop actions: {teleopActions.length}</div>
            <div>Total fuel scored: {computedMetrics.auto.fuelScored + computedMetrics.teleop.fuelScored}</div>
            <div>Total fuel passed: {computedMetrics.auto.fuelPassed + computedMetrics.teleop.fuelPassed}</div>
            {existingUpdatedAt ? (
              <div className="text-muted-foreground">Existing key last updated: {new Date(existingUpdatedAt).toLocaleString()}</div>
            ) : null}

            <div className="space-y-1">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Saved Key Preview (loaded clip)</Label>
              <Textarea
                value={loadedKeyPreview
                  ? JSON.stringify({
                    clipId: loadedKeyPreview.clipId,
                    updatedAt: loadedKeyPreview.updatedAt,
                    notes: loadedKeyPreview.notes || '',
                    metrics: loadedKeyPreview.metrics,
                  }, null, 2)
                  : 'Load an existing key to inspect saved metrics for this clip.'}
                readOnly
                className="min-h-45 font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="max-w-7xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Answer Keys by Clip</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {STUDY_CLIP_OPTIONS.map((clip) => {
              const key = answerKeys.find((item) => item.clipId === clip.id);

              return (
                <div key={clip.id} className="border rounded p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium">{clip.label} ({clip.id})</div>
                    <div className="text-muted-foreground">
                      {key
                        ? `Key exists • updated ${new Date(key.updatedAt).toLocaleString()}`
                        : 'No answer key saved yet'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="p-2"
                      variant="outline"
                      onClick={async () => {
                        setClipId(clip.id);
                        const existing = await getAnswerKeyByClip(clip.id);
                        if (!existing) {
                          toast.error('No answer key found for this clip ID');
                          return;
                        }

                        setNotes(existing.notes || '');
                        setExistingUpdatedAt(existing.updatedAt);
                        setLoadedKeyPreview(existing);
                      }}
                    >
                      Check Key
                    </Button>
                    <Button className="p-2" onClick={() => setClipId(clip.id)}>
                      Set Active Clip
                    </Button>
                    <Button
                      className="p-2"
                      variant="secondary"
                      onClick={async () => {
                        const existing = await getAnswerKeyByClip(clip.id);
                        if (!existing) {
                          toast.error('No answer key found for this clip ID');
                          return;
                        }

                        downloadJsonFile(`answer-key-${clip.id}.json`, {
                          exportedAt: Date.now(),
                          exportSchemaVersion: 'answer-key-slim-v1',
                          clipId: clip.id,
                          answerKey: toSlimAnswerKeyExport(existing),
                        });
                        toast.success(`Exported answer key for ${clip.id}`);
                      }}
                    >
                      Export Key
                    </Button>
                    <Button
                      className="p-2"
                      variant="destructive"
                      onClick={async () => {
                        if (!window.confirm(`Delete answer key for ${clip.id}? This cannot be undone.`)) {
                          return;
                        }

                        const deleted = await deleteAnswerKeyByClip(clip.id);
                        if (!deleted) {
                          toast.error('No answer key found for this clip ID');
                          return;
                        }

                        if (clipId === clip.id) {
                          setExistingUpdatedAt(null);
                          setLoadedKeyPreview(null);
                        }

                        await refreshAnswerKeys();
                        toast.success(`Deleted answer key for ${clip.id}`);
                      }}
                    >
                      Delete Key
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default TestAnswerKeyPage;

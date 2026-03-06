import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  clearExperimentData,
  getAllAnswerKeys,
  getAllPreferences,
  getAllResponses,
  getAllSessions,
} from '@/core/db/experimentDatabase';
import type {
  ComparisonSummary,
  ExperimentPreferenceForm,
  ExperimentResponse,
  ExperimentSession,
  TLXRawScores,
} from '@/core/lib/experiment/types';
import { compareMetrics } from '@/core/lib/experiment/metrics';
import { exportExperimentCsv, exportExperimentJson } from '@/core/lib/experiment/export';
import { importExperimentJsonText } from '@/core/lib/experiment/import';
import { seedExperimentDemoData } from '@/core/lib/experiment/demoData';
import { toast } from 'sonner';

const TLX_DIMENSIONS: Array<{ key: keyof TLXRawScores; label: string }> = [
  { key: 'mentalDemand', label: 'Mental' },
  { key: 'physicalDemand', label: 'Physical' },
  { key: 'temporalDemand', label: 'Temporal' },
  { key: 'performance', label: 'Performance' },
  { key: 'effort', label: 'Effort' },
  { key: 'frustration', label: 'Frustration' },
];

const TestResultsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedSessionId: string | undefined = location.state?.sessionId;

  const [sessions, setSessions] = useState<ExperimentSession[]>([]);
  const [responses, setResponses] = useState<ExperimentResponse[]>([]);
  const [preferences, setPreferences] = useState<ExperimentPreferenceForm[]>([]);
  const [comparisons, setComparisons] = useState<ComparisonSummary[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [groupFilter, setGroupFilter] = useState<'all' | 'A' | 'B'>('all');
  const [clipFilter, setClipFilter] = useState<'all' | string>('all');

  const reloadData = useCallback(async () => {
    const [allResponses, keys, allPreferences, allSessions] = await Promise.all([
      getAllResponses(),
      getAllAnswerKeys(),
      getAllPreferences(),
      getAllSessions(),
    ]);

    const filteredResponses = selectedSessionId
      ? allResponses.filter((response) => response.sessionId === selectedSessionId)
      : allResponses;

    const filteredPreferences = selectedSessionId
      ? allPreferences.filter((preference) => preference.sessionId === selectedSessionId)
      : allPreferences;

    const filteredSessions = selectedSessionId
      ? allSessions.filter((session) => session.id === selectedSessionId)
      : allSessions;

    const rows: ComparisonSummary[] = [];
    for (const response of filteredResponses) {
      const key = keys.find((item) => item.clipId === response.clipId);
      if (!key) continue;

      rows.push(compareMetrics({
        responseId: response.id,
        sessionId: response.sessionId,
        clipId: response.clipId,
        block: response.block,
        interfaceType: response.interfaceType,
        scout: response.metrics,
        answer: key.metrics,
      }));
    }

    setSessions(filteredSessions);
    setResponses(filteredResponses);
    setPreferences(filteredPreferences);
    setComparisons(rows);
  }, [selectedSessionId]);

  useEffect(() => {
    void reloadData();
  }, [reloadData]);

  const sessionGroupById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session.group] as const)),
    [sessions],
  );

  const availableClipIds = useMemo(() => {
    const clipIds = Array.from(new Set(responses.map((response) => response.clipId)));
    return clipIds.sort((left, right) => left.localeCompare(right));
  }, [responses]);

  const filteredResponses = useMemo(
    () => responses.filter((response) => {
      if (groupFilter !== 'all' && sessionGroupById.get(response.sessionId) !== groupFilter) return false;
      if (clipFilter !== 'all' && response.clipId !== clipFilter) return false;
      return true;
    }),
    [responses, groupFilter, clipFilter, sessionGroupById],
  );

  const filteredComparisons = useMemo(
    () => comparisons.filter((comparison) => {
      if (groupFilter !== 'all' && sessionGroupById.get(comparison.sessionId) !== groupFilter) return false;
      if (clipFilter !== 'all' && comparison.clipId !== clipFilter) return false;
      return true;
    }),
    [comparisons, groupFilter, clipFilter, sessionGroupById],
  );

  const filteredSessionIds = useMemo(
    () => new Set(filteredResponses.map((response) => response.sessionId)),
    [filteredResponses],
  );

  const filteredSessions = useMemo(
    () => sessions.filter((session) => filteredSessionIds.has(session.id)),
    [sessions, filteredSessionIds],
  );

  const filteredPreferences = useMemo(
    () => preferences.filter((preference) => filteredSessionIds.has(preference.sessionId)),
    [preferences, filteredSessionIds],
  );

  const averageByInterface = useMemo(() => {
    const buckets: Record<'visual' | 'form', number[]> = { visual: [], form: [] };
    filteredComparisons.forEach((row) => {
      buckets[row.interfaceType].push(row.accuracyPercent);
    });

    return {
      visual: buckets.visual.length
        ? buckets.visual.reduce((acc, value) => acc + value, 0) / buckets.visual.length
        : null,
      form: buckets.form.length
        ? buckets.form.reduce((acc, value) => acc + value, 0) / buckets.form.length
        : null,
    };
  }, [filteredComparisons]);

  const durationByInterface = useMemo(() => {
    const buckets: Record<'visual' | 'form', number[]> = { visual: [], form: [] };
    filteredResponses.forEach((response) => {
      buckets[response.interfaceType].push(response.durationMs / 1000);
    });

    return {
      visual: buckets.visual.length
        ? buckets.visual.reduce((acc, value) => acc + value, 0) / buckets.visual.length
        : null,
      form: buckets.form.length
        ? buckets.form.reduce((acc, value) => acc + value, 0) / buckets.form.length
        : null,
    };
  }, [filteredResponses]);

  const durationDeltaSeconds = useMemo(() => {
    if (durationByInterface.visual === null || durationByInterface.form === null) return null;
    return durationByInterface.form - durationByInterface.visual;
  }, [durationByInterface]);

  const tlxSummary = useMemo(() => {
    const perDimensionBuckets: Record<'visual' | 'form', Record<keyof TLXRawScores, number[]>> = {
      visual: {
        mentalDemand: [],
        physicalDemand: [],
        temporalDemand: [],
        performance: [],
        effort: [],
        frustration: [],
      },
      form: {
        mentalDemand: [],
        physicalDemand: [],
        temporalDemand: [],
        performance: [],
        effort: [],
        frustration: [],
      },
    };

    filteredResponses.forEach((response) => {
      if (!response.tlxRaw) return;
      const bucket = perDimensionBuckets[response.interfaceType];
      TLX_DIMENSIONS.forEach(({ key }) => {
        bucket[key].push(response.tlxRaw![key]);
      });
    });

    const avg = (values: number[]) => values.length
      ? values.reduce((acc, value) => acc + value, 0) / values.length
      : null;

    const dimensionAverages = TLX_DIMENSIONS.map(({ key, label }) => ({
      key,
      label,
      visual: avg(perDimensionBuckets.visual[key]),
      form: avg(perDimensionBuckets.form[key]),
    }));

    const overallVisual = avg(dimensionAverages.map((row) => row.visual).filter((value): value is number => value !== null));
    const overallForm = avg(dimensionAverages.map((row) => row.form).filter((value): value is number => value !== null));

    return {
      overallVisual,
      overallForm,
      dimensions: dimensionAverages,
    };
  }, [filteredResponses]);

  const fieldDifferenceSummary = useMemo(() => {
    type Bucket = {
      key: string;
      total: number;
      count: number;
      visualTotal: number;
      visualCount: number;
      formTotal: number;
      formCount: number;
    };

    const buckets = new Map<string, Bucket>();

    filteredComparisons.forEach((comparison) => {
      comparison.lineItems.forEach((lineItem) => {
        const existing = buckets.get(lineItem.key) ?? {
          key: lineItem.key,
          total: 0,
          count: 0,
          visualTotal: 0,
          visualCount: 0,
          formTotal: 0,
          formCount: 0,
        };

        existing.total += lineItem.absoluteDiff;
        existing.count += 1;

        if (comparison.interfaceType === 'visual') {
          existing.visualTotal += lineItem.absoluteDiff;
          existing.visualCount += 1;
        } else {
          existing.formTotal += lineItem.absoluteDiff;
          existing.formCount += 1;
        }

        buckets.set(lineItem.key, existing);
      });
    });

    const rows = Array.from(buckets.values()).map((bucket) => ({
      key: bucket.key,
      overallAvg: bucket.count ? bucket.total / bucket.count : 0,
      visualAvg: bucket.visualCount ? bucket.visualTotal / bucket.visualCount : null,
      formAvg: bucket.formCount ? bucket.formTotal / bucket.formCount : null,
      isCellMetric: bucket.key.includes('_cell_'),
    }));

    const nonCellRows = rows
      .filter((row) => !row.isCellMetric)
      .sort((left, right) => right.overallAvg - left.overallAvg);

    const cellRows = rows
      .filter((row) => row.isCellMetric)
      .sort((left, right) => right.overallAvg - left.overallAvg);

    return {
      nonCellRows,
      cellRows,
    };
  }, [filteredComparisons]);

  const preferenceSummary = useMemo(() => {
    const preferredCounts = {
      visual: filteredPreferences.filter((item) => item.preferredInterface === 'visual').length,
      form: filteredPreferences.filter((item) => item.preferredInterface === 'form').length,
      none: filteredPreferences.filter((item) => item.preferredInterface === 'no-preference').length,
    };

    const avg = (values: number[]) => values.length
      ? values.reduce((acc, value) => acc + value, 0) / values.length
      : null;

    return {
      preferredCounts,
      visualSatisfaction: avg(filteredPreferences.map((item) => item.visualSatisfaction)),
      formSatisfaction: avg(filteredPreferences.map((item) => item.formSatisfaction)),
      visualEase: avg(filteredPreferences.map((item) => item.visualEase)),
      formEase: avg(filteredPreferences.map((item) => item.formEase)),
    };
  }, [filteredPreferences]);

  const handleImportJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    setIsImporting(true);
    try {
      let totalSessions = 0;
      let totalResponses = 0;
      let totalAnswerKeys = 0;
      let totalPreferences = 0;
      let successCount = 0;
      const failedFiles: string[] = [];

      for (const file of files) {
        try {
          const text = await file.text();
          const counts = await importExperimentJsonText(text);
          totalSessions += counts.sessions;
          totalResponses += counts.responses;
          totalAnswerKeys += counts.answerKeys;
          totalPreferences += counts.preferences;
          successCount += 1;
        } catch {
          failedFiles.push(file.name);
        }
      }

      await reloadData();
      if (successCount > 0) {
        toast.success(
          `Imported ${successCount}/${files.length} files • ${totalSessions} sessions, ${totalResponses} responses, ${totalAnswerKeys} answer keys, ${totalPreferences} preferences`,
        );
      }

      if (failedFiles.length > 0) {
        toast.error(`Failed to import ${failedFiles.length} file(s): ${failedFiles.join(', ')}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import file');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const handleSeedDemoData = async () => {
    setIsSeedingDemo(true);
    try {
      const counts = await seedExperimentDemoData();
      await reloadData();
      toast.success(
        `Demo seeded: ${counts.answerKeys} answer keys, ${counts.sessions} sessions, ${counts.responses} responses, ${counts.preferences} preferences`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to seed demo data');
    } finally {
      setIsSeedingDemo(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Clear all experiment data (sessions, responses, answer keys, preferences)? This cannot be undone.')) {
      return;
    }

    try {
      await clearExperimentData();
      await reloadData();
      toast.success('Experiment data cleared');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to clear data');
    }
  };

  const handleExportCsv = async () => {
    await exportExperimentCsv(selectedSessionId ? { sessionId: selectedSessionId } : undefined);
  };

  const handleExportJson = async () => {
    await exportExperimentJson(selectedSessionId ? { sessionId: selectedSessionId } : undefined);
  };

  return (
    <div className="min-h-screen container mx-auto px-4 pt-24 pb-24 space-y-6 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>Experiment Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="p-2" variant="outline" onClick={() => navigate('/test')}>
            Back
          </Button>

          <div className="flex flex-wrap gap-3">
            <Button className="p-2" onClick={handleExportCsv}>
              {selectedSessionId ? 'Export This Session Responses CSV' : 'Export Responses CSV'}
            </Button>
            <Button className="p-2" variant="outline" onClick={handleExportJson}>
              {selectedSessionId ? 'Export This Session Responses JSON' : 'Export Responses JSON'}
            </Button>
            <Button
              className="p-2"
              variant="secondary"
              onClick={handleSeedDemoData}
              disabled={isSeedingDemo}
            >
              {isSeedingDemo ? 'Seeding demo data...' : 'Seed Demo Data (12 Scouts)'}
            </Button>
            <Button className="p-2" variant="destructive" onClick={handleClearData}>
              Clear Experiment Data
            </Button>
            <Input
              type="file"
              accept="application/json,.json"
              multiple
              onChange={handleImportJson}
              disabled={isImporting}
              className="max-w-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">Filter by group</div>
              <Select value={groupFilter} onValueChange={(value) => setGroupFilter(value as 'all' | 'A' | 'B')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  <SelectItem value="A">Group A</SelectItem>
                  <SelectItem value="B">Group B</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">Filter by clip</div>
              <Select value={clipFilter} onValueChange={setClipFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clips</SelectItem>
                  {availableClipIds.map((clipId) => (
                    <SelectItem key={clipId} value={clipId}>{clipId}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded border p-3">Sessions: {filteredSessions.length}</div>
            <div className="rounded border p-3">Responses: {filteredResponses.length}</div>
            <div className="rounded border p-3">
              Visual avg accuracy: {averageByInterface.visual === null ? 'N/A' : `${averageByInterface.visual.toFixed(1)}%`}
            </div>
            <div className="rounded border p-3">
              Form avg accuracy: {averageByInterface.form === null ? 'N/A' : `${averageByInterface.form.toFixed(1)}%`}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div className="rounded border p-3">
              Visual avg time: {durationByInterface.visual === null ? 'N/A' : `${durationByInterface.visual.toFixed(1)}s`}
            </div>
            <div className="rounded border p-3">
              Form avg time: {durationByInterface.form === null ? 'N/A' : `${durationByInterface.form.toFixed(1)}s`}
            </div>
            <div className="rounded border p-3">
              Form vs Visual time: {durationDeltaSeconds === null
                ? 'N/A'
                : `${durationDeltaSeconds >= 0 ? '+' : ''}${durationDeltaSeconds.toFixed(1)}s`}
            </div>
            <div className="rounded border p-3">
              Avg TLX (Visual/Form): {tlxSummary.overallVisual === null || tlxSummary.overallForm === null
                ? 'N/A'
                : `${tlxSummary.overallVisual.toFixed(1)} / ${tlxSummary.overallForm.toFixed(1)}`}
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-medium text-sm">NASA-TLX averages by dimension</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              {tlxSummary.dimensions.map((row) => (
                <div key={row.key} className="rounded border p-3">
                  <div className="font-medium">{row.label}</div>
                  <div>Visual: {row.visual === null ? 'N/A' : row.visual.toFixed(2)}</div>
                  <div>Form: {row.form === null ? 'N/A' : row.form.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div className="rounded border p-3">
              Preference counts: Visual {preferenceSummary.preferredCounts.visual}, Form {preferenceSummary.preferredCounts.form}, None {preferenceSummary.preferredCounts.none}
            </div>
            <div className="rounded border p-3">
              Satisfaction (1-10): Visual {preferenceSummary.visualSatisfaction === null ? 'N/A' : preferenceSummary.visualSatisfaction.toFixed(2)}, Form {preferenceSummary.formSatisfaction === null ? 'N/A' : preferenceSummary.formSatisfaction.toFixed(2)}
            </div>
            <div className="rounded border p-3">
              Ease (1-10): Visual {preferenceSummary.visualEase === null ? 'N/A' : preferenceSummary.visualEase.toFixed(2)}, Form {preferenceSummary.formEase === null ? 'N/A' : preferenceSummary.formEase.toFixed(2)}
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-medium text-sm">Average absolute differences (non-cell fields)</div>
            {fieldDifferenceSummary.nonCellRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No comparison rows available yet.</div>
            ) : (
              <div className="rounded border overflow-hidden">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 p-2 text-xs font-medium border-b bg-muted/30">
                  <div>Field</div>
                  <div>Overall</div>
                  <div>Visual</div>
                  <div>Form</div>
                </div>
                <div className="max-h-72 overflow-auto">
                  {fieldDifferenceSummary.nonCellRows.map((row) => (
                    <div key={row.key} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 p-2 text-xs border-b last:border-b-0">
                      <div>{row.key}</div>
                      <div>{row.overallAvg.toFixed(3)}</div>
                      <div>{row.visualAvg === null ? 'N/A' : row.visualAvg.toFixed(3)}</div>
                      <div>{row.formAvg === null ? 'N/A' : row.formAvg.toFixed(3)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="font-medium text-sm">Average absolute differences (location cell fields)</div>
            {fieldDifferenceSummary.cellRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No cell-level comparison rows available yet.</div>
            ) : (
              <div className="rounded border overflow-hidden">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 p-2 text-xs font-medium border-b bg-muted/30">
                  <div>Field</div>
                  <div>Overall</div>
                  <div>Visual</div>
                  <div>Form</div>
                </div>
                <div className="max-h-72 overflow-auto">
                  {fieldDifferenceSummary.cellRows.map((row) => (
                    <div key={row.key} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 p-2 text-xs border-b last:border-b-0">
                      <div>{row.key}</div>
                      <div>{row.overallAvg.toFixed(3)}</div>
                      <div>{row.visualAvg === null ? 'N/A' : row.visualAvg.toFixed(3)}</div>
                      <div>{row.formAvg === null ? 'N/A' : row.formAvg.toFixed(3)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {filteredComparisons.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No comparisons available yet. Add answer keys and complete at least one test session.
              </div>
            ) : filteredComparisons.map((row) => (
              <div key={row.responseId} className="rounded border p-3 text-sm space-y-1">
                <div className="font-medium">
                  Session {row.sessionId.slice(0, 8)} • Block {row.block} • {row.interfaceType}
                </div>
                <div>Clip: {row.clipId}</div>
                <div>Accuracy: {row.accuracyPercent.toFixed(1)}%</div>
                <div>Total absolute diff: {row.totalAbsoluteDiff}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestResultsPage;

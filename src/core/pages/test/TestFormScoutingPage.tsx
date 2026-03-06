import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { createEmptyMetrics } from '@/core/lib/experiment/metrics';
import { ExperimentMetricsEditor } from './components/ExperimentMetricsEditor';
import { getExperimentSession, saveExperimentResponse } from '@/core/db/experimentDatabase';
import type { ExperimentSession } from '@/core/lib/experiment/types';

const generateId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

const TestFormScoutingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const sessionId: string | undefined = location.state?.sessionId;
  const block: 1 | 2 = location.state?.block === 2 ? 2 : 1;
  const startedAt: number = location.state?.startedAt ?? Date.now();

  const [session, setSession] = useState<ExperimentSession | null>(null);
  const [metrics, setMetrics] = useState(createEmptyMetrics());

  useEffect(() => {
    if (!sessionId) {
      navigate('/test');
      return;
    }

    getExperimentSession(sessionId).then((result) => {
      if (!result) {
        navigate('/test');
        return;
      }
      setSession(result);
    });
  }, [navigate, sessionId]);

  const clipId = useMemo(() => {
    if (!session) return '';
    return block === 1 ? session.clip1Id : session.clip2Id;
  }, [session, block]);

  const handleSubmit = async () => {
    if (!sessionId || !session) return;

    const submittedAt = Date.now();
    await saveExperimentResponse({
      id: generateId(),
      sessionId,
      block,
      interfaceType: 'form',
      clipId,
      startedAt,
      submittedAt,
      durationMs: Math.max(0, submittedAt - startedAt),
      metrics,
    });

    navigate('/test/tlx', {
      state: {
        sessionId,
        block,
      },
    });
  };

  if (!session) {
    return <div className="min-h-screen p-6">Loading experiment session...</div>;
  }

  return (
    <div className="min-h-screen container mx-auto px-4 pt-24 pb-24 space-y-6 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>Form Interface (Block {block})</CardTitle>
          <CardDescription>
            Participant {session.participantCode} • Clip {clipId}. Paths and advanced timers are intentionally disabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="p-2" variant="outline" onClick={() => navigate('/test')}>
            Back
          </Button>
          <ExperimentMetricsEditor metrics={metrics} onChange={setMetrics} />
          <Button className="p-2" onClick={handleSubmit}>Submit Form Block</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestFormScoutingPage;

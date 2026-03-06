import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { ScoringSections } from '@/game-template/components';
import { GAME_SCOUT_OPTION_KEYS } from '@/game-template/scout-options';
import { buildMetricsFromActions } from '@/core/lib/experiment/metrics';
import { getExperimentSession, saveExperimentResponse } from '@/core/db/experimentDatabase';
import type { ExperimentSession } from '@/core/lib/experiment/types';

type Phase = 'auto' | 'teleop';

const TEST_VISUAL_SCOUT_OPTIONS: Record<string, boolean> = {
  [GAME_SCOUT_OPTION_KEYS.disableDefensePopup]: true,
};

const generateId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

const TestVisualScoutingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const sessionId: string | undefined = location.state?.sessionId;
  const block: 1 | 2 = location.state?.block === 2 ? 2 : 1;
  const startedAtFromState: number | undefined = location.state?.startedAt;

  const [phase, setPhase] = useState<Phase>('auto');
  const [autoActions, setAutoActions] = useState<any[]>([]);
  const [teleopActions, setTeleopActions] = useState<any[]>([]);
  const [session, setSession] = useState<ExperimentSession | null>(null);
  const [startedAt] = useState<number>(startedAtFromState ?? Date.now());

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
    if (!sessionId || !session) return;

    if (phase === 'auto') {
      setPhase('teleop');
      return;
    }

    const submittedAt = Date.now();
    const metrics = buildMetricsFromActions({
      autoActions,
      teleopActions,
    });

    await saveExperimentResponse({
      id: generateId(),
      sessionId,
      block,
      interfaceType: 'visual',
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
    <div className="min-h-screen px-4 pt-12 pb-24 space-y-4">
      <div className="max-w-7xl mx-auto">
        <Button className="p-2 mb-3" variant="outline" onClick={() => navigate('/test')}>
          Back
        </Button>
        <h1 className="text-2xl font-bold">Visual Interface (Block {block})</h1>
        <p className="text-sm text-muted-foreground">Participant {session.participantCode} • Clip {clipId}</p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
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
            matchNumber={block}
            matchType="qm"
            teamNumber="0000"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>Current phase: <strong className="capitalize">{phase}</strong></div>
            <div>Auto actions: {autoActions.length}</div>
            <div>Teleop actions: {teleopActions.length}</div>
            <Button className="w-full p-2" onClick={handleProceed}>
              {phase === 'auto' ? 'Continue to Teleop' : 'Submit Visual Block'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestVisualScoutingPage;

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Slider } from '@/core/components/ui/slider';
import {
  getExperimentSession,
  getResponsesBySession,
  saveExperimentResponse,
} from '@/core/db/experimentDatabase';
import type { ExperimentResponse, ExperimentSession, TLXRawScores } from '@/core/lib/experiment/types';

const tlxPrompts = [
  {
    key: 'mentalDemand',
    label: 'Mental Demand',
    description: 'How much mental and perceptual activity was required (thinking, deciding, calculating, remembering, looking, searching)?',
    lowAnchor: 'Very low',
    highAnchor: 'Very high',
  },
  {
    key: 'physicalDemand',
    label: 'Physical Demand',
    description: 'How much physical activity was required (touching, pressing, moving)?',
    lowAnchor: 'Very low',
    highAnchor: 'Very high',
  },
  {
    key: 'temporalDemand',
    label: 'Temporal Demand',
    description: 'How much time pressure did you feel due to the pace or rate at which tasks occurred?',
    lowAnchor: 'Very low',
    highAnchor: 'Very high',
  },
  {
    key: 'performance',
    label: 'Performance',
    description: 'How successful were you in accomplishing the task goals with this interface?',
    lowAnchor: 'Perfect',
    highAnchor: 'Failure',
  },
  {
    key: 'effort',
    label: 'Effort',
    description: 'How hard did you have to work to accomplish your level of performance?',
    lowAnchor: 'Very low',
    highAnchor: 'Very high',
  },
  {
    key: 'frustration',
    label: 'Frustration',
    description: 'How insecure, discouraged, irritated, stressed, and annoyed did you feel?',
    lowAnchor: 'Very low',
    highAnchor: 'Very high',
  },
] as const;

const TestTLXPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const sessionId: string | undefined = location.state?.sessionId;
  const block: 1 | 2 = location.state?.block === 2 ? 2 : 1;

  const [session, setSession] = useState<ExperimentSession | null>(null);
  const [response, setResponse] = useState<ExperimentResponse | null>(null);
  const [tlx, setTlx] = useState<TLXRawScores>({
    mentalDemand: 5,
    physicalDemand: 5,
    temporalDemand: 5,
    performance: 5,
    effort: 5,
    frustration: 5,
  });

  useEffect(() => {
    if (!sessionId) {
      navigate('/test');
      return;
    }

    Promise.all([getExperimentSession(sessionId), getResponsesBySession(sessionId)]).then(([loadedSession, responses]) => {
      if (!loadedSession) {
        navigate('/test');
        return;
      }

      const blockResponse = responses.find((item) => item.block === block);
      if (!blockResponse) {
        navigate('/test');
        return;
      }

      setSession(loadedSession);
      setResponse(blockResponse);
    });
  }, [block, navigate, sessionId]);

  const nextInterface = useMemo(() => {
    if (!session) return null;
    return block === 1 ? session.interfaceOrder[1] : null;
  }, [session, block]);

  const handleSubmit = async () => {
    if (!session || !response) return;

    await saveExperimentResponse({
      ...response,
      tlxRaw: tlx,
    });

    if (block === 1 && nextInterface) {
      navigate(`/test/interface/${nextInterface}`, {
        state: {
          sessionId: session.id,
          block: 2,
          startedAt: Date.now(),
        },
      });
      return;
    }

    navigate('/test/preferences', { state: { sessionId: session.id } });
  };

  if (!session || !response) {
    return <div className="min-h-screen p-6">Loading NASA-TLX form...</div>;
  }

  return (
    <div className="min-h-screen container mx-auto px-4 pt-24 pb-24 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>NASA-TLX (Raw) • Block {block}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Rate the interface you just used on each NASA-TLX dimension using the labeled anchors.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="p-2" variant="outline" onClick={() => navigate('/test')}>
            Back
          </Button>
          {tlxPrompts.map(({ key, label, description, lowAnchor, highAnchor }) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={key}>{label} (1-10)</Label>
              <p className="text-xs text-muted-foreground">{description}</p>
              <Slider
                id={key}
                min={1}
                max={10}
                step={1}
                value={[tlx[key]]}
                onValueChange={(value) => {
                  setTlx((prev) => ({
                    ...prev,
                    [key]: value[0] ?? prev[key],
                  }));
                }}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>1 = {lowAnchor}</span>
                <span className="font-medium text-foreground">{tlx[key]}</span>
                <span>10 = {highAnchor}</span>
              </div>
            </div>
          ))}

          <Button className="p-2" onClick={handleSubmit}>
            {block === 1 ? 'Continue to Block 2' : 'Continue to Preference Form'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestTLXPage;

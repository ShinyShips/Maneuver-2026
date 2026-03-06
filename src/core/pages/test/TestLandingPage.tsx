import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { saveExperimentSession } from '@/core/db/experimentDatabase';
import { STUDY_CLIP_IDS } from '@/core/lib/experiment/constants';
import { exportExperimentCsv, exportExperimentJson } from '@/core/lib/experiment/export';
import type { ExperimentGroup, InterfaceType } from '@/core/lib/experiment/types';

const generateParticipantCode = () => `P-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const generateId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

const getOrder = (group: ExperimentGroup): [InterfaceType, InterfaceType] => (
  group === 'A' ? ['visual', 'form'] : ['form', 'visual']
);

const TestLandingPage = () => {
  const navigate = useNavigate();
  const [group, setGroup] = useState<ExperimentGroup>('A');
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    setIsStarting(true);
    const sessionId = generateId();
    const interfaceOrder = getOrder(group);

    await saveExperimentSession({
      id: sessionId,
      participantCode: generateParticipantCode(),
      group,
      interfaceOrder,
      createdAt: Date.now(),
      clip1Id: STUDY_CLIP_IDS.block1,
      clip2Id: STUDY_CLIP_IDS.block2,
    });

    navigate(`/test/interface/${interfaceOrder[0]}`, {
      state: {
        sessionId,
        block: 1,
        startedAt: Date.now(),
      },
    });
  };

  const handleExportResponsesCsv = async () => {
    await exportExperimentCsv();
  };

  const handleExportResponsesJson = async () => {
    await exportExperimentJson();
  };

  return (
    <div className="min-h-screen container mx-auto px-4 pt-24 pb-24 space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Experiment Setup</CardTitle>
          <CardDescription>
            Anonymous A/B flow for visual vs form scouting (Auto + Teleop only)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="p-2" variant="outline" onClick={() => navigate('/')}>
            Back
          </Button>

          <div className="space-y-2">
            <Label>Group</Label>
            <Select value={group} onValueChange={(value) => setGroup(value as ExperimentGroup)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Group A (Visual then Form)</SelectItem>
                <SelectItem value="B">Group B (Form then Visual)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button className="p-2" onClick={handleStart} disabled={isStarting}>
              Start Session
            </Button>
            <Button className="p-2" variant="outline" onClick={() => navigate('/test/answer-key')}>Answer Key Builder</Button>
            <Button className="p-2" variant="outline" onClick={() => navigate('/test/results')}>Results + Export</Button>
            <Button className="p-2" variant="secondary" onClick={handleExportResponsesCsv}>
              Export Responses CSV
            </Button>
            <Button className="p-2" variant="secondary" onClick={handleExportResponsesJson}>
              Export Responses JSON
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestLandingPage;

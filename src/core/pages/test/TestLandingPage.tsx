import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Checkbox } from '@/core/components/ui/checkbox';
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
import {
  exportExperimentCsv,
  exportExperimentJson,
} from '@/core/lib/experiment/export';
import type { ExperimentGroup, InterfaceType } from '@/core/lib/experiment/types';

const generateParticipantCode = () => `P-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const generateId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
const CONSENT_VERSION = 'gatech-qualtrics-consent-v1';
const OFFICIAL_CONSENT_URL = 'https://gatech.co1.qualtrics.com/jfe/form/SV_3f8Yrdr23Q8kKnI';

const getOrder = (group: ExperimentGroup): [InterfaceType, InterfaceType] => (
  group === 'A' ? ['visual', 'form'] : ['form', 'visual']
);

const TestLandingPage = () => {
  const navigate = useNavigate();
  const [group, setGroup] = useState<ExperimentGroup>('A');
  const [isStarting, setIsStarting] = useState(false);
  const [officialConsentCompleted, setOfficialConsentCompleted] = useState(false);

  const handleStart = async () => {
    if (!officialConsentCompleted) return;

    setIsStarting(true);
    try {
      const sessionId = generateId();
      const interfaceOrder = getOrder(group);
      const participantCode = generateParticipantCode();
      const now = Date.now();

      await saveExperimentSession({
        id: sessionId,
        participantCode,
        group,
        interfaceOrder,
        createdAt: now,
        clip1Id: STUDY_CLIP_IDS.block1,
        clip2Id: STUDY_CLIP_IDS.block2,
        consentAgreedAt: now,
        consentVersion: CONSENT_VERSION,
        consentSourceUrl: OFFICIAL_CONSENT_URL,
      });

      navigate(`/test/interface/${interfaceOrder[0]}`, {
        state: {
          sessionId,
          block: 1,
          startedAt: now,
        },
      });
    } finally {
      setIsStarting(false);
    }
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

          <div className="rounded-lg border p-4 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Informed Consent</h3>
              <p className="text-xs text-muted-foreground">
                Complete the official Georgia Tech consent survey before beginning this study.
                Participation is voluntary and you may stop at any time.
              </p>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p><span className="font-medium text-foreground">Required form:</span> Open and complete the official consent survey link below.</p>
              <p><span className="font-medium text-foreground">Procedure:</span> You will use both interfaces to scout match clips, then complete short workload and preference surveys.</p>
              <p><span className="font-medium text-foreground">Time:</span> Approximately 50 minutes total.</p>
              <p><span className="font-medium text-foreground">Risks:</span> Minimal risk, similar to standard computer use and timed observation tasks.</p>
              <p><span className="font-medium text-foreground">Privacy:</span> This app stores only de-identified response data and consent-complete status for the session.</p>
            </div>

            <Button
              className="p-2"
              variant="outline"
              onClick={() => window.open(OFFICIAL_CONSENT_URL, '_blank', 'noopener,noreferrer')}
            >
              Open Official Consent Survey
            </Button>

            <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
              <Checkbox
                checked={officialConsentCompleted}
                onCheckedChange={(checked) => setOfficialConsentCompleted(checked === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                I confirm I completed the official Georgia Tech consent survey linked above.
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              className="p-2"
              onClick={handleStart}
              disabled={isStarting || !officialConsentCompleted}
            >
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

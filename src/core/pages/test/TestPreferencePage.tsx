import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Slider } from '@/core/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { Textarea } from '@/core/components/ui/textarea';
import { markExperimentSessionComplete, savePreferenceForm } from '@/core/db/experimentDatabase';
import type { InterfacePreference } from '@/core/lib/experiment/types';

const generateId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

const TestPreferencePage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const sessionId: string | undefined = location.state?.sessionId;

  const [preferredInterface, setPreferredInterface] = useState<InterfacePreference>('no-preference');
  const [visualSatisfaction, setVisualSatisfaction] = useState(5);
  const [formSatisfaction, setFormSatisfaction] = useState(5);
  const [visualEase, setVisualEase] = useState(5);
  const [formEase, setFormEase] = useState(5);
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    if (!sessionId) {
      navigate('/test');
      return;
    }

    await savePreferenceForm({
      id: generateId(),
      sessionId,
      preferredInterface,
      visualSatisfaction,
      formSatisfaction,
      visualEase,
      formEase,
      notes: notes.trim() || undefined,
      submittedAt: Date.now(),
    });

    await markExperimentSessionComplete(sessionId, Date.now());
    navigate('/test/results', { state: { sessionId } });
  };

  return (
    <div className="min-h-screen container mx-auto px-4 pt-24 pb-24 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Preference + Satisfaction</CardTitle>
          <p className="text-sm text-muted-foreground">
            Final questionnaire about both interfaces. For sliders, 1 means very low and 10 means very high.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="p-2" variant="outline" onClick={() => navigate('/test')}>
            Back
          </Button>
          <div className="space-y-2">
            <Label>Preferred interface</Label>
            <p className="text-xs text-muted-foreground">
              Pick the interface you would choose for real scouting work.
            </p>
            <Select value={preferredInterface} onValueChange={(value) => setPreferredInterface(value as InterfacePreference)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visual">Visual interface</SelectItem>
                <SelectItem value="form">Form interface</SelectItem>
                <SelectItem value="no-preference">No preference</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="visual-satisfaction">Visual satisfaction (1-10)</Label>
              <p className="text-xs text-muted-foreground">Overall satisfaction with the visual interface experience.</p>
              <Slider
                id="visual-satisfaction"
                min={1}
                max={10}
                step={1}
                value={[visualSatisfaction]}
                onValueChange={(value) => setVisualSatisfaction(value[0] ?? visualSatisfaction)}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>1 = Very low</span>
                <span className="font-medium text-foreground">{visualSatisfaction}</span>
                <span>10 = Very high</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="form-satisfaction">Form satisfaction (1-10)</Label>
              <p className="text-xs text-muted-foreground">Overall satisfaction with the form interface experience.</p>
              <Slider
                id="form-satisfaction"
                min={1}
                max={10}
                step={1}
                value={[formSatisfaction]}
                onValueChange={(value) => setFormSatisfaction(value[0] ?? formSatisfaction)}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>1 = Very low</span>
                <span className="font-medium text-foreground">{formSatisfaction}</span>
                <span>10 = Very high</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="visual-ease">Visual ease of use (1-10)</Label>
              <p className="text-xs text-muted-foreground">How easy the visual interface felt to learn and use.</p>
              <Slider
                id="visual-ease"
                min={1}
                max={10}
                step={1}
                value={[visualEase]}
                onValueChange={(value) => setVisualEase(value[0] ?? visualEase)}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>1 = Very low</span>
                <span className="font-medium text-foreground">{visualEase}</span>
                <span>10 = Very high</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="form-ease">Form ease of use (1-10)</Label>
              <p className="text-xs text-muted-foreground">How easy the form interface felt to learn and use.</p>
              <Slider
                id="form-ease"
                min={1}
                max={10}
                step={1}
                value={[formEase]}
                onValueChange={(value) => setFormEase(value[0] ?? formEase)}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>1 = Very low</span>
                <span className="font-medium text-foreground">{formEase}</span>
                <span>10 = Very high</span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="preference-notes">Notes (optional)</Label>
            <Textarea id="preference-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          <Button className="p-2" onClick={handleSubmit}>Finish Study Session</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestPreferencePage;

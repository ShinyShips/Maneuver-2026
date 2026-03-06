export type ExperimentGroup = 'A' | 'B';
export type InterfaceType = 'visual' | 'form';
export type InterfacePreference = InterfaceType | 'no-preference';
export type AutoStartLocationValue = 'none' | 'trench1' | 'bump1' | 'hub' | 'bump2' | 'trench2';
export type ClimbActionValue = 'no' | 'yes';
export type ClimbResultValue = 'none' | 'success' | 'fail';
export type ClimbLocationValue = 'none' | 'side' | 'middle';

export interface TLXRawScores {
  mentalDemand: number;
  physicalDemand: number;
  temporalDemand: number;
  performance: number;
  effort: number;
  frustration: number;
}

export interface PhaseMetrics {
  actionsTotal: number;
  scoreActions: number;
  autoStartLocation: AutoStartLocationValue;
  shotGridCounts: number[];
  passGridCounts: number[];
  collectGridCounts: number[];
  collectActions: number;
  collectFromDepotActions: number;
  collectFromOutpostActions: number;
  passActions: number;
  climbActions: ClimbActionValue;
  climbResult: ClimbResultValue;
  climbLocation: ClimbLocationValue;
  foulActions: number;
  defenseActions: number;
  stealActions: number;
  fuelScored: number;
  fuelCollected: number;
  fuelPassed: number;
  zoneAllianceActions: number;
  zoneNeutralActions: number;
  zoneOpponentActions: number;
}

export interface NormalizedExperimentMetrics {
  auto: PhaseMetrics;
  teleop: PhaseMetrics;
}

export interface ExperimentSession {
  id: string;
  participantCode: string;
  group: ExperimentGroup;
  interfaceOrder: [InterfaceType, InterfaceType];
  createdAt: number;
  clip1Id: string;
  clip2Id: string;
  completedAt?: number;
}

export interface ExperimentResponse {
  id: string;
  sessionId: string;
  block: 1 | 2;
  interfaceType: InterfaceType;
  clipId: string;
  startedAt: number;
  submittedAt: number;
  durationMs: number;
  metrics: NormalizedExperimentMetrics;
  tlxRaw?: TLXRawScores;
}

export interface ExperimentAnswerKey {
  id: string;
  clipId: string;
  metrics: NormalizedExperimentMetrics;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ExperimentPreferenceForm {
  id: string;
  sessionId: string;
  preferredInterface: InterfacePreference;
  visualSatisfaction: number;
  formSatisfaction: number;
  visualEase: number;
  formEase: number;
  notes?: string;
  submittedAt: number;
}

export interface MetricComparison {
  key: string;
  scoutValue: number;
  answerValue: number;
  absoluteDiff: number;
}

export interface ComparisonSummary {
  responseId: string;
  sessionId: string;
  clipId: string;
  block: 1 | 2;
  interfaceType: InterfaceType;
  totalAbsoluteDiff: number;
  normalizedError: number;
  accuracyPercent: number;
  lineItems: MetricComparison[];
}

export interface ExperimentExportBundle {
  exportedAt: number;
  sessions?: ExperimentSession[];
  responses?: ExperimentResponse[];
  answerKeys?: ExperimentAnswerKey[];
  preferences?: ExperimentPreferenceForm[];
  comparisons?: ComparisonSummary[];
}

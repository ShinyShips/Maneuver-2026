import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/core/components/ui/table';

export interface FuelOPRDisplayRow {
  teamNumber: number;
  matchesPlayed: number;
  autoFuelOPRFixed: number;
  teleopFuelOPRFixed: number;
  totalFuelOPRFixed: number;
  autoFuelOPRAdaptive: number;
  teleopFuelOPRAdaptive: number;
  totalFuelOPRAdaptive: number;
  scaledAutoAvg: number;
  scaledTeleopAvg: number;
  scaledTotalAvg: number;
  confidenceScore: number;
  confidencePenalty: number;
  sosPenalty: number;
  hybridScorerIndex: number;
  assistImpact: number;
  defenseImpact: number;
  totalContributionIndex: number;
}

export type FuelOPRDisplayMode = 'impact' | 'production';

interface FuelOPRCardProps {
  impactRows: FuelOPRDisplayRow[];
  productionRows: FuelOPRDisplayRow[];
  fixedLambda: number;
  impactAdaptiveLambda: number | null;
  productionAdaptiveLambda: number | null;
  mode: FuelOPRDisplayMode;
  onModeChange: (mode: FuelOPRDisplayMode) => void;
  isLoading: boolean;
}

const formatValue = (value: number) => value.toFixed(1);

const toCsvValue = (value: string | number): string => {
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
};

export const FuelOPRCard: React.FC<FuelOPRCardProps> = ({
  impactRows,
  productionRows,
  fixedLambda,
  impactAdaptiveLambda,
  productionAdaptiveLambda,
  mode,
  onModeChange,
  isLoading,
}) => {
  const rows = mode === 'production' ? productionRows : impactRows;
  const adaptiveLambda = mode === 'production' ? productionAdaptiveLambda : impactAdaptiveLambda;

  const handleExportCsv = () => {
    if (rows.length === 0) return;

    const headers = [
      'Team',
      'Matches',
      'Auto mOPR (lambda 0.3)',
      'Teleop mOPR (lambda 0.3)',
      'Total mOPR (lambda 0.3)',
      'Auto mOPR (adaptive)',
      'Teleop mOPR (adaptive)',
      'Total mOPR (adaptive)',
      'Scaled Auto Avg',
      'Scaled Teleop Avg',
      'Scaled Total Avg',
      'Confidence Score',
      'Confidence Penalty',
      'SOS Penalty',
      'Hybrid Scorer Index',
      'Assist Impact',
      'Defense Impact',
      'Total Contribution Index',
    ];

    const csvRows = rows.map((row) => [
      row.teamNumber,
      row.matchesPlayed,
      formatValue(row.autoFuelOPRFixed),
      formatValue(row.teleopFuelOPRFixed),
      formatValue(row.totalFuelOPRFixed),
      formatValue(row.autoFuelOPRAdaptive),
      formatValue(row.teleopFuelOPRAdaptive),
      formatValue(row.totalFuelOPRAdaptive),
      formatValue(row.scaledAutoAvg),
      formatValue(row.scaledTeleopAvg),
      formatValue(row.scaledTotalAvg),
      formatValue(row.confidenceScore),
      formatValue(row.confidencePenalty),
      formatValue(row.sosPenalty),
      formatValue(row.hybridScorerIndex),
      formatValue(row.assistImpact),
      formatValue(row.defenseImpact),
      formatValue(row.totalContributionIndex),
    ]);

    const csv = [
      headers.map(toCsvValue).join(','),
      ...csvRows.map((csvRow) => csvRow.map(toCsvValue).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suffix = mode === 'production' ? 'production' : 'impact';

    link.href = url;
    link.download = `fuel-mopr-${suffix}-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span>Fuel mOPR & Scaled Fuel ({mode === 'production' ? 'Production' : 'Impact'})</span>
            <span className="text-xs font-normal text-muted-foreground">Fixed λ={fixedLambda}</span>
            {adaptiveLambda !== null && (
              <span className="text-xs font-normal text-muted-foreground">Adaptive λ={adaptiveLambda.toFixed(3)}</span>
            )}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={mode === 'impact' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onModeChange('impact')}
              disabled={isLoading}
            >
              Impact
            </Button>
            <Button
              type="button"
              variant={mode === 'production' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onModeChange('production')}
              disabled={isLoading}
            >
              Production
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isLoading || rows.length === 0}
            >
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading mOPR and scaled fuel views...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No mOPR/scaled fuel data yet. Validate the event first.
          </p>
        ) : (
          <div className="max-h-96 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Matches</TableHead>
                  <TableHead>Auto mOPR (0.3)</TableHead>
                  <TableHead>Teleop mOPR (0.3)</TableHead>
                  <TableHead>Total mOPR (0.3)</TableHead>
                  <TableHead>Auto mOPR (Adaptive)</TableHead>
                  <TableHead>Teleop mOPR (Adaptive)</TableHead>
                  <TableHead>Total mOPR (Adaptive)</TableHead>
                  <TableHead>Scaled Auto Avg</TableHead>
                  <TableHead>Scaled Teleop Avg</TableHead>
                  <TableHead>Scaled Total Avg</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Hybrid Index</TableHead>
                  <TableHead>Assist</TableHead>
                  <TableHead>Defense</TableHead>
                  <TableHead>Total Index</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.teamNumber}>
                    <TableCell className="font-medium">{row.teamNumber}</TableCell>
                    <TableCell>{row.matchesPlayed}</TableCell>
                    <TableCell>{formatValue(row.autoFuelOPRFixed)}</TableCell>
                    <TableCell>{formatValue(row.teleopFuelOPRFixed)}</TableCell>
                    <TableCell>{formatValue(row.totalFuelOPRFixed)}</TableCell>
                    <TableCell>{formatValue(row.autoFuelOPRAdaptive)}</TableCell>
                    <TableCell>{formatValue(row.teleopFuelOPRAdaptive)}</TableCell>
                    <TableCell>{formatValue(row.totalFuelOPRAdaptive)}</TableCell>
                    <TableCell>{formatValue(row.scaledAutoAvg)}</TableCell>
                    <TableCell>{formatValue(row.scaledTeleopAvg)}</TableCell>
                    <TableCell>{formatValue(row.scaledTotalAvg)}</TableCell>
                    <TableCell>{formatValue(row.confidenceScore)}</TableCell>
                    <TableCell>{formatValue(row.hybridScorerIndex)}</TableCell>
                    <TableCell>{formatValue(row.assistImpact)}</TableCell>
                    <TableCell>{formatValue(row.defenseImpact)}</TableCell>
                    <TableCell>{formatValue(row.totalContributionIndex)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

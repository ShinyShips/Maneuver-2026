import React, { useState, useEffect } from 'react';
import { useMatchValidationWithScaling } from '@/game-template/hooks/useMatchValidationWithScaling';
import {
  ValidationSummaryCard,
  MatchValidationDetail,
  MatchListFilters,
  ValidationSettingsSheet,
  MatchListCard,
  FuelOPRCard,
  type FuelOPRDisplayRow,
  type FuelOPRDisplayMode,
} from '@/core/components/match-validation';
import { EventNameSelector } from '@/core/components/GameStartComponents/EventNameSelector';
import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Checkbox } from '@/core/components/ui/checkbox';
import { RefreshCw, Settings } from 'lucide-react';
import { toast } from 'sonner';
import type { MatchListItem, ValidationConfig } from '@/core/lib/matchValidationTypes';
import { DEFAULT_VALIDATION_CONFIG } from '@/core/lib/matchValidationTypes';
import { formatMatchLabel } from '@/core/lib/matchValidationUtils';
import { getCachedTBAEventMatches } from '@/core/lib/tbaCache';
import { getEntriesByEvent } from '@/core/db/scoutingDatabase';
import { calculateFuelOPRHybrid } from '@/game-template/fuelOpr';
import { processPredictionRewardsForMatches } from '@/core/lib/predictionRewards';

const VALIDATION_CONFIG_KEY = 'validationConfig';
const FUEL_OPR_INCLUDE_PLAYOFFS_KEY = 'fuelOprIncludePlayoffs';

const GAME_VALIDATION_DEFAULT_CONFIG: ValidationConfig = {
  ...DEFAULT_VALIDATION_CONFIG,
  thresholds: {
    ...DEFAULT_VALIDATION_CONFIG.thresholds,
    criticalAbsolute: 60,
    warningAbsolute: 40,
    minorAbsolute: 20,
  },
};

export const MatchValidationPage: React.FC = () => {
  const [eventKey, setEventKey] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<MatchListItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [validationConfig, setValidationConfig] = useState<ValidationConfig>(GAME_VALIDATION_DEFAULT_CONFIG);
  const [demoAutoValidated, setDemoAutoValidated] = useState(false);
  const [impactFuelOprRows, setImpactFuelOprRows] = useState<FuelOPRDisplayRow[]>([]);
  const [productionFuelOprRows, setProductionFuelOprRows] = useState<FuelOPRDisplayRow[]>([]);
  const [impactFuelOprLambda, setImpactFuelOprLambda] = useState<number | null>(null);
  const [productionFuelOprLambda, setProductionFuelOprLambda] = useState<number | null>(null);
  const [fuelOprMode, setFuelOprMode] = useState<FuelOPRDisplayMode>('impact');
  const [fuelOprLoading, setFuelOprLoading] = useState(false);
  const [fuelOprIncludePlayoffs, setFuelOprIncludePlayoffs] = useState(true);

  // Load current event and validation config from localStorage on mount
  useEffect(() => {
    const currentEvent = localStorage.getItem('eventKey') || '';
    setEventKey(currentEvent);

    // Load validation config
    const savedConfig = localStorage.getItem(VALIDATION_CONFIG_KEY);
    if (savedConfig) {
      try {
        setValidationConfig(JSON.parse(savedConfig));
      } catch {
        setValidationConfig(GAME_VALIDATION_DEFAULT_CONFIG);
      }
    } else {
      setValidationConfig(GAME_VALIDATION_DEFAULT_CONFIG);
    }

    const savedIncludePlayoffs = localStorage.getItem(FUEL_OPR_INCLUDE_PLAYOFFS_KEY);
    if (savedIncludePlayoffs !== null) {
      setFuelOprIncludePlayoffs(savedIncludePlayoffs === 'true');
    }
  }, []);

  const {
    isValidating,
    matchList,
    filteredMatchList,
    filters,
    setFilters,
    validateEvent,
    refreshResults,
  } = useMatchValidationWithScaling({
    eventKey: eventKey,
    autoLoad: true,
    config: validationConfig,
    enableScaling: true, // 2026: Enable fuel scaling
  });

  // Sync selectedMatch with matchList to get updated validation results
  useEffect(() => {
    if (selectedMatch && matchList.length > 0) {
      const updated = matchList.find(m => m.matchKey === selectedMatch.matchKey);
      if (updated && updated.validationResult !== selectedMatch.validationResult) {
        setSelectedMatch(updated);
      }
    }
  }, [matchList, selectedMatch]);

  // Handle event change
  const handleEventChange = (newEventKey: string) => {
    setEventKey(newEventKey);
    localStorage.setItem('eventKey', newEventKey);
  };

  // Handle validation config save
  const handleConfigSave = (newConfig: ValidationConfig) => {
    setValidationConfig(newConfig);
    localStorage.setItem(VALIDATION_CONFIG_KEY, JSON.stringify(newConfig));
    // Note: Will need to re-validate for changes to take effect
  };

  // Reset demo auto-validation marker when switching events
  useEffect(() => {
    setDemoAutoValidated(false);
  }, [eventKey]);

  // Auto-run validation once for demo event after match data loads
  useEffect(() => {
    if (eventKey !== 'demo2026') return;
    if (demoAutoValidated || isValidating) return;
    if (matchList.length === 0) return;

    const hasEligibleMatches = matchList.some(m => m.hasScouting && m.hasTBAResults);
    if (!hasEligibleMatches) return;

    setDemoAutoValidated(true);
    void validateEvent();
  }, [eventKey, demoAutoValidated, isValidating, matchList, validateEvent]);

  useEffect(() => {
    if (!eventKey) {
      setImpactFuelOprRows([]);
      setProductionFuelOprRows([]);
      setImpactFuelOprLambda(null);
      setProductionFuelOprLambda(null);
      return;
    }

    let cancelled = false;

    const parseFuelCounts = (gameData: Record<string, unknown>): { auto: number; teleop: number } => {
      const auto = gameData.auto as Record<string, unknown> | undefined;
      const teleop = gameData.teleop as Record<string, unknown> | undefined;

      const autoFuel =
        (typeof auto?.fuelScoredCount === 'number' ? auto.fuelScoredCount : undefined) ??
        (typeof auto?.fuelScored === 'number' ? auto.fuelScored : undefined) ??
        (typeof gameData.autoFuelScored === 'number' ? gameData.autoFuelScored : undefined) ??
        0;

      const teleopFuel =
        (typeof teleop?.fuelScoredCount === 'number' ? teleop.fuelScoredCount : undefined) ??
        (typeof teleop?.fuelScored === 'number' ? teleop.fuelScored : undefined) ??
        (typeof gameData.teleopFuelScored === 'number' ? gameData.teleopFuelScored : undefined) ??
        0;

      return { auto: autoFuel, teleop: teleopFuel };
    };

    const loadFuelOprData = async () => {
      setFuelOprLoading(true);
      try {
        const [cachedMatches, entries] = await Promise.all([
          getCachedTBAEventMatches(eventKey, true),
          getEntriesByEvent(eventKey),
        ]);

        if (cancelled) return;

        const impactHybrid = calculateFuelOPRHybrid(cachedMatches, {
          includePlayoffs: fuelOprIncludePlayoffs,
          nonNegative: false,
        });

        const productionHybrid = calculateFuelOPRHybrid(cachedMatches, {
          includePlayoffs: fuelOprIncludePlayoffs,
          nonNegative: true,
        });

        const impactOpr = impactHybrid.opr;
        const productionOpr = productionHybrid.opr;

        if (import.meta.env.DEV && eventKey.startsWith('demo')) {
          console.log(`[Fuel OPR] Impact lambda for ${eventKey}: ${impactHybrid.selectedLambda.toFixed(3)} (${impactHybrid.mode})`);
          console.log(`[Fuel OPR] Production lambda for ${eventKey}: ${productionHybrid.selectedLambda.toFixed(3)} (${productionHybrid.mode})`);

          const latestSweep = impactHybrid.latestSweep;
          if (latestSweep && latestSweep.rows.length > 0) {
            console.log(`[Fuel OPR] Impact sweep (train ${latestSweep.trainMatchCount}, holdout ${latestSweep.holdoutMatchCount})`);
            console.table(
              latestSweep.rows.map(row => ({
                lambda: row.lambda,
                holdoutRmse: Math.round(row.holdoutRmse * 100) / 100,
              }))
            );
          }
        }

        const scaledByTeam = new Map<number, {
          matches: number;
          autoSum: number;
          teleopSum: number;
          fuelDataMatches: number;
        }>();

        const passingByTeam = new Map<number, {
          passSum: number;
          passDataMatches: number;
        }>();

        const sosByTeam = new Map<number, { sum: number; count: number }>();

        const toFiniteNumber = (value: unknown): number | null => {
          if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
          }

          if (typeof value === 'string') {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
          }

          return null;
        };

        const extractSosValue = (gameData: Record<string, unknown>): number | null => {
          const direct = toFiniteNumber(gameData.strengthOfSchedule ?? gameData.sos);
          if (direct !== null) {
            return direct;
          }

          const statbotics = gameData.statbotics as Record<string, unknown> | undefined;
          if (!statbotics) {
            return null;
          }

          return toFiniteNumber(
            statbotics.strengthOfSchedule
            ?? statbotics.sos
            ?? statbotics.scheduleStrength
          );
        };

        const sumActionPassAmounts = (actions: unknown): number | null => {
          if (!Array.isArray(actions)) {
            return null;
          }

          let sum = 0;
          let hasPass = false;

          for (const action of actions) {
            if (!action || typeof action !== 'object') {
              continue;
            }

            const typed = action as Record<string, unknown>;
            const type = typed.type;
            if (type !== 'pass' && type !== 'pass_alliance') {
              continue;
            }

            hasPass = true;
            const amount = toFiniteNumber(typed.amount ?? typed.count ?? typed.value);
            sum += amount ?? 1;
          }

          return hasPass ? sum : null;
        };

        const extractPassingValue = (gameData: Record<string, unknown>): { value: number; hasData: boolean } => {
          const auto = gameData.auto as Record<string, unknown> | undefined;
          const teleop = gameData.teleop as Record<string, unknown> | undefined;

          const fields: unknown[] = [
            auto?.fuelPassedCount,
            teleop?.fuelPassedCount,
            gameData.autoFuelPassed,
            gameData.teleopFuelPassed,
            gameData.autoFuelPassedCount,
            gameData.teleopFuelPassedCount,
            gameData.totalFuelPassed,
            gameData.fuelPassed,
            gameData.auto_fuel_neutral_alliance_pass,
            gameData.tele_fuel_neutral_alliance_pass,
            gameData.tele_fuel_opponent_alliance_pass,
            gameData.tele_fuel_opponent_neutral_pass,
            gameData.autoFuelNeutralAlliancePass,
            gameData.teleFuelNeutralAlliancePass,
            gameData.teleFuelOpponentAlliancePass,
            gameData.teleFuelOpponentNeutralPass,
            auto?.fuelNeutralAlliancePass,
            auto?.fuelOpponentAlliancePass,
            teleop?.fuelNeutralAlliancePass,
            teleop?.fuelOpponentAlliancePass,
            teleop?.fuelOpponentNeutralPass,
          ];

          const actionDerived = [
            sumActionPassAmounts(gameData.autoActions),
            sumActionPassAmounts(gameData.teleopActions),
            sumActionPassAmounts(auto?.actions),
            sumActionPassAmounts(teleop?.actions),
          ];

          const numericValues = [...fields, ...actionDerived]
            .map(toFiniteNumber)
            .filter((value): value is number => value !== null);

          if (numericValues.length === 0) {
            return { value: 0, hasData: false };
          }

          const value = numericValues.reduce((sum, v) => sum + v, 0);
          return { value, hasData: true };
        };

        for (const entry of entries) {
          const team = entry.teamNumber;
          const gameData = (entry.gameData ?? {}) as Record<string, unknown>;
          const auto = gameData.auto as Record<string, unknown> | undefined;
          const teleop = gameData.teleop as Record<string, unknown> | undefined;
          const scaledMetrics = gameData.scaledMetrics as {
            scaledAutoFuel?: number;
            scaledTeleopFuel?: number;
          } | undefined;

          const rawFuel = parseFuelCounts(gameData);
          const hasScaledAuto = typeof scaledMetrics?.scaledAutoFuel === 'number';
          const hasScaledTeleop = typeof scaledMetrics?.scaledTeleopFuel === 'number';
          const hasRawAuto =
            typeof auto?.fuelScoredCount === 'number' ||
            typeof auto?.fuelScored === 'number' ||
            typeof gameData.autoFuelScored === 'number';
          const hasRawTeleop =
            typeof teleop?.fuelScoredCount === 'number' ||
            typeof teleop?.fuelScored === 'number' ||
            typeof gameData.teleopFuelScored === 'number';

          const hasFuelData = hasScaledAuto || hasScaledTeleop || hasRawAuto || hasRawTeleop;

          const scaledAuto = hasScaledAuto
            ? (scaledMetrics?.scaledAutoFuel ?? rawFuel.auto)
            : rawFuel.auto;
          const scaledTeleop = hasScaledTeleop
            ? (scaledMetrics?.scaledTeleopFuel ?? rawFuel.teleop)
            : rawFuel.teleop;

          const current = scaledByTeam.get(team) ?? { matches: 0, autoSum: 0, teleopSum: 0, fuelDataMatches: 0 };
          current.matches += 1;
          if (hasFuelData) {
            current.autoSum += scaledAuto;
            current.teleopSum += scaledTeleop;
            current.fuelDataMatches += 1;
          }
          scaledByTeam.set(team, current);

          const passing = extractPassingValue(gameData);
          const passCurrent = passingByTeam.get(team) ?? { passSum: 0, passDataMatches: 0 };
          if (passing.hasData) {
            passCurrent.passSum += passing.value;
            passCurrent.passDataMatches += 1;
          }
          passingByTeam.set(team, passCurrent);

          const sosValue = extractSosValue(gameData);
          if (sosValue !== null) {
            const sosCurrent = sosByTeam.get(team) ?? { sum: 0, count: 0 };
            sosCurrent.sum += sosValue;
            sosCurrent.count += 1;
            sosByTeam.set(team, sosCurrent);
          }
        }

        const buildRows = (oprRows: typeof impactOpr.teams): FuelOPRDisplayRow[] => {
          const oprByTeam = new Map(oprRows.map(team => [team.teamNumber, team]));

          const defenseByTeam = new Map<number, { suppressionSum: number; samples: number }>();
          const eligibleMatches = cachedMatches.filter(match => fuelOprIncludePlayoffs || match.comp_level === 'qm');

          const getObservedTotal = (match: typeof eligibleMatches[number], alliance: 'red' | 'blue'): number => {
            const scoreBreakdown = match.score_breakdown as {
              red?: { hubScore?: Record<string, unknown> };
              blue?: { hubScore?: Record<string, unknown> };
            } | null;
            return toFiniteNumber(scoreBreakdown?.[alliance]?.hubScore?.totalCount) ?? 0;
          };

          const getAllianceTeams = (match: typeof eligibleMatches[number], alliance: 'red' | 'blue'): number[] => {
            return match.alliances[alliance].team_keys
              .map(key => Number.parseInt(key.replace('frc', ''), 10))
              .filter(Number.isFinite);
          };

          for (const match of eligibleMatches) {
            for (const alliance of ['red', 'blue'] as const) {
              const defendingTeams = getAllianceTeams(match, alliance);
              const opponentAlliance = alliance === 'red' ? 'blue' : 'red';
              const opponentTeams = getAllianceTeams(match, opponentAlliance);
              const observedOpponentFuel = getObservedTotal(match, opponentAlliance);

              const expectedOpponentFuel = opponentTeams.reduce((sum, teamNumber) => {
                return sum + (oprByTeam.get(teamNumber)?.totalFuelOPR ?? 0);
              }, 0);

              const suppression = expectedOpponentFuel - observedOpponentFuel;
              const perTeamSuppression = defendingTeams.length > 0 ? suppression / defendingTeams.length : 0;

              for (const teamNumber of defendingTeams) {
                const current = defenseByTeam.get(teamNumber) ?? { suppressionSum: 0, samples: 0 };
                current.suppressionSum += perTeamSuppression;
                current.samples += 1;
                defenseByTeam.set(teamNumber, current);
              }
            }
          }

          const allTeamNumbers = new Set<number>([
            ...oprByTeam.keys(),
            ...scaledByTeam.keys(),
            ...passingByTeam.keys(),
            ...defenseByTeam.keys(),
          ]);

          return [...allTeamNumbers]
            .map(teamNumber => {
              const oprTeam = oprByTeam.get(teamNumber);
              const scaledTeam = scaledByTeam.get(teamNumber);
              const matchesPlayed = Math.max(oprTeam?.matchesPlayed ?? 0, scaledTeam?.matches ?? 0);

              const fuelDataMatches = scaledTeam?.fuelDataMatches ?? 0;
              const hasScaledFuelData = fuelDataMatches > 0;
              const scaledAutoAvg = hasScaledFuelData ? (scaledTeam?.autoSum ?? 0) / fuelDataMatches : 0;
              const scaledTeleopAvg = hasScaledFuelData ? (scaledTeam?.teleopSum ?? 0) / fuelDataMatches : 0;
              const scaledTotalAvg = scaledAutoAvg + scaledTeleopAvg;
              const totalFuelOPR = oprTeam?.totalFuelOPR ?? 0;
              const passingAggregate = passingByTeam.get(teamNumber);
              const hasPassingData = (passingAggregate?.passDataMatches ?? 0) > 0;
              const passingAvg = hasPassingData
                ? (passingAggregate?.passSum ?? 0) / (passingAggregate?.passDataMatches ?? 1)
                : 0;

              const defenseAggregate = defenseByTeam.get(teamNumber);
              const defenseImpact = defenseAggregate && defenseAggregate.samples > 0
                ? defenseAggregate.suppressionSum / defenseAggregate.samples
                : 0;
              const assistImpact = passingAvg;

              const sosAggregate = sosByTeam.get(teamNumber);
              const avgSos = sosAggregate && sosAggregate.count > 0 ? sosAggregate.sum / sosAggregate.count : null;
              const sosPenalty = avgSos !== null
                ? Math.max(0, Math.min(1, avgSos / 6))
                : 0;

              const targetMatches = 6;
              const matchPenalty = Math.max(0, (targetMatches - matchesPlayed) / targetMatches);

              const gap = Math.abs(totalFuelOPR - scaledTotalAvg);
              const scaleBase = Math.max(1, Math.abs(totalFuelOPR), Math.abs(scaledTotalAvg));
              const gapPenalty = hasScaledFuelData
                ? Math.max(0, Math.min(1, gap / scaleBase))
                : 0;

              const missingScaledPenalty = hasScaledFuelData ? 0 : 0.6;

              const confidencePenalty = Math.max(0, Math.min(1,
                0.35 * matchPenalty +
                0.25 * gapPenalty +
                0.15 * sosPenalty +
                0.25 * missingScaledPenalty
              ));

              const confidenceScore = 1 - confidencePenalty;
              const hybridBase = hasScaledFuelData
                ? 0.6 * scaledTotalAvg + 0.4 * totalFuelOPR
                : totalFuelOPR;
              const hybridScorerIndex = hybridBase * confidenceScore;
              const assistComponent = hasPassingData ? assistImpact * 0.2 : 0;
              const defenseComponent = defenseImpact * 0.2;
              const totalContributionIndex = hybridScorerIndex + assistComponent + defenseComponent;

              return {
                teamNumber,
                matchesPlayed,
                autoFuelOPR: oprTeam?.autoFuelOPR ?? 0,
                teleopFuelOPR: oprTeam?.teleopFuelOPR ?? 0,
                totalFuelOPR,
                scaledAutoAvg,
                scaledTeleopAvg,
                scaledTotalAvg,
                confidenceScore,
                confidencePenalty,
                sosPenalty,
                hybridScorerIndex,
                assistImpact,
                defenseImpact,
                totalContributionIndex,
              };
            })
            .sort((a, b) => b.totalContributionIndex - a.totalContributionIndex || b.hybridScorerIndex - a.hybridScorerIndex || a.teamNumber - b.teamNumber);
        };

        const impactRows = buildRows(impactOpr.teams);
        const productionRows = buildRows(productionOpr.teams);

        if (!cancelled) {
          setImpactFuelOprRows(impactRows);
          setProductionFuelOprRows(productionRows);
          setImpactFuelOprLambda(impactHybrid.selectedLambda);
          setProductionFuelOprLambda(productionHybrid.selectedLambda);
        }
      } catch (error) {
        console.error('Failed to load Fuel OPR data:', error);
        if (!cancelled) {
          setImpactFuelOprRows([]);
          setProductionFuelOprRows([]);
          setImpactFuelOprLambda(null);
          setProductionFuelOprLambda(null);
        }
      } finally {
        if (!cancelled) {
          setFuelOprLoading(false);
        }
      }
    };

    void loadFuelOprData();

    return () => {
      cancelled = true;
    };
  }, [eventKey, matchList, isValidating, fuelOprIncludePlayoffs]);

  useEffect(() => {
    if (!eventKey || isValidating || matchList.length === 0) {
      return;
    }

    let cancelled = false;

    const runAutoPredictionRewards = async () => {
      try {
        const cachedMatches = await getCachedTBAEventMatches(eventKey, true);
        if (cancelled || cachedMatches.length === 0) {
          return;
        }

        const processed = await processPredictionRewardsForMatches(cachedMatches, {
          eventKey,
          onlyFinalResults: true,
          includeZeroResultMatches: false,
        });

        if (cancelled) {
          return;
        }

        if (processed.summary.processedPredictionCount > 0) {
          toast.success(
            `Auto-processed ${processed.summary.processedPredictionCount} predictions (${processed.summary.correctPredictionCount} correct, ${processed.summary.totalStakesAwarded} stakes)`
          );
        }
      } catch (error) {
        console.error('Failed to auto-process prediction rewards:', error);
      }
    };

    void runAutoPredictionRewards();

    return () => {
      cancelled = true;
    };
  }, [eventKey, isValidating, matchList]);

  useEffect(() => {
    if (!eventKey || isValidating || matchList.length === 0) {
      return;
    }

    let cancelled = false;

    const runAutoPredictionRewards = async () => {
      try {
        const cachedMatches = await getCachedTBAEventMatches(eventKey, true);
        if (cancelled || cachedMatches.length === 0) {
          return;
        }

        const processed = await processPredictionRewardsForMatches(cachedMatches, {
          eventKey,
          onlyFinalResults: true,
          includeZeroResultMatches: false,
        });

        if (cancelled) {
          return;
        }

        if (processed.summary.processedPredictionCount > 0) {
          toast.success(
            `Auto-processed ${processed.summary.processedPredictionCount} predictions (${processed.summary.correctPredictionCount} correct, ${processed.summary.totalStakesAwarded} stakes)`
          );
        }
      } catch (error) {
        console.error('Failed to auto-process prediction rewards:', error);
      }
    };

    void runAutoPredictionRewards();

    return () => {
      cancelled = true;
    };
  }, [eventKey, isValidating, matchList]);

  return (
    <div className="container min-h-screen mx-auto px-4 pt-12 pb-24 space-y-6 mt-safe">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="shrink-0">
            <h1 className="text-3xl font-bold">Match Validation</h1>
            <p className="text-muted-foreground">
              Verify scouting data against official TBA results
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              onClick={() => {
                setSettingsOpen(true);
              }}
              variant="outline"
              size="icon"
              title="Validation Settings"
              aria-label="Open validation settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => refreshResults()}
              disabled={isValidating}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isValidating ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => validateEvent()}
              disabled={isValidating || !eventKey}
              className='p-4'
            >
              {isValidating ? 'Validating...' : 'Validate Event'}
            </Button>
          </div>
        </div>


        {/* Event Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <label className="font-medium shrink-0">Event:</label>
            <EventNameSelector
              currentEventKey={eventKey}
              onEventKeyChange={handleEventChange}
            />
          </div>
          {!eventKey && (
            <p className="text-sm text-muted-foreground wrap-break-word">
              Please select an event to view validation results
            </p>
          )}
        </div>
      </div>

      {/* No Event Selected */}
      {!eventKey && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">No Event Selected</p>
              <p className="text-sm mt-2">
                Please select an event from the dropdown above to view validation results.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      {matchList.length > 0 && (
        <ValidationSummaryCard results={matchList} />
      )}

      {/* Fuel OPR + Scaled Fuel */}
      {eventKey && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuel-opr-include-playoffs"
              checked={fuelOprIncludePlayoffs}
              onCheckedChange={(checked) => {
                const next = checked === true;
                setFuelOprIncludePlayoffs(next);
                localStorage.setItem(FUEL_OPR_INCLUDE_PLAYOFFS_KEY, String(next));
              }}
            />
            <label htmlFor="fuel-opr-include-playoffs" className="text-sm text-muted-foreground">
              Include playoff matches in Fuel OPR calculation
            </label>
          </div>
          <FuelOPRCard
            impactRows={impactFuelOprRows}
            productionRows={productionFuelOprRows}
            impactLambda={impactFuelOprLambda}
            productionLambda={productionFuelOprLambda}
            mode={fuelOprMode}
            onModeChange={setFuelOprMode}
            isLoading={fuelOprLoading}
          />
        </div>
      )}

      {/* Filters */}
      {matchList.length > 0 && (
        <MatchListFilters
          filters={filters}
          onFiltersChange={setFilters}
          matchCount={matchList.length}
          filteredCount={filteredMatchList.length}
        />
      )}

      {/* Match List */}
      <MatchListCard
        results={matchList}
        filteredResults={filteredMatchList}
        onMatchClick={setSelectedMatch}
      />

      {/* Match Detail Modal */}
      {selectedMatch && (
        <MatchValidationDetail
          match={selectedMatch}
          isOpen={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onReValidate={() => {
            // Re-validate this specific match
            setSelectedMatch(null);
            validateEvent();
          }}
          formatMatchLabel={formatMatchLabel as any}
        />
      )}

      {/* Validation Settings Sheet */}
      <ValidationSettingsSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentConfig={validationConfig}
        onSave={handleConfigSave}
      />
    </div>
  );
};

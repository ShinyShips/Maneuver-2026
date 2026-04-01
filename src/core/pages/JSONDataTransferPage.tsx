
import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import JSONUploader from "@/core/components/data-transfer/JSONUploader";
import { convertArrayOfArraysToCSV } from "@/core/lib/utils";
import { loadScoutingData } from "@/core/lib/scoutingDataUtils";
import { loadPitScoutingData, exportPitScoutingToCSV, downloadPitScoutingImagesOnly } from "@/core/lib/pitScoutingUtils";
import { gamificationDB as gameDB } from "@/game-template/gamification";
import { csvExcludedFields, pitCsvExcludedFields } from "@/game-template/transformation";
import { Separator } from "@/core/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { createMatchSchedulePayload } from "@/core/lib/matchScheduleTransfer";
import { downloadTextFile } from "@/core/lib/downloadUtils";
import { Loader2 } from "lucide-react";

const getSortableMatchNumber = (matchNumber: unknown, matchKey: unknown): number => {
  if (typeof matchNumber === 'number' && Number.isFinite(matchNumber)) return matchNumber;

  const fromMatchNumber = Number.parseInt(String(matchNumber ?? ''), 10);
  if (Number.isFinite(fromMatchNumber)) return fromMatchNumber;

  const key = String(matchKey ?? '');
  const keyPart = key.includes('_') ? (key.split('_')[1] || key) : key;
  const parsedFromKey = Number.parseInt(keyPart.replace(/\D/g, ''), 10);
  return Number.isFinite(parsedFromKey) ? parsedFromKey : Number.MAX_SAFE_INTEGER;
};

const waitForUiPaint = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
};



const JSONDataTransferPage = () => {
  const [mode, setMode] = useState<'select' | 'upload'>('select');
  const [dataType, setDataType] = useState<'scouting' | 'scoutProfiles' | 'pitScouting' | 'pitScoutingImagesOnly' | 'matchSchedule'>('scouting');
  const [activeDownload, setActiveDownload] = useState<'json' | 'csv' | null>(null);

  if (mode === 'upload') {
    return (
      <JSONUploader
        onBack={() => setMode('select')}
      />
    );
  }

  const handleDownloadCSV = async () => {
    setActiveDownload('csv');

    try {
      await waitForUiPaint();

      let csv: string;
      let filename: string;

      switch (dataType) {
        case 'scouting': {
          const scoutingEntries = await loadScoutingData();
          const sortedScoutingEntries = [...scoutingEntries].sort((a, b) => {
            const matchA = getSortableMatchNumber(a.matchNumber, a.matchKey);
            const matchB = getSortableMatchNumber(b.matchNumber, b.matchKey);
            if (matchA !== matchB) return matchA - matchB;

            if (a.teamNumber !== b.teamNumber) return a.teamNumber - b.teamNumber;

            if (a.allianceColor !== b.allianceColor) {
              return a.allianceColor === 'red' ? -1 : 1;
            }

            return a.timestamp - b.timestamp;
          });

          if (scoutingEntries.length === 0) {
            alert("No scouting data found.");
            return;
          }

          // Build dynamic headers from actual data structure
          const baseFields = ['id', 'scoutName', 'teamNumber', 'matchNumber', 'eventKey', 'matchKey', 'allianceColor', 'timestamp'];
          const autoFieldsSet = new Set<string>();
          const teleopFieldsSet = new Set<string>();
          const endgameFieldsSet = new Set<string>();
          const otherFieldsSet = new Set<string>();

          // Game-specific fields to exclude from CSV (e.g. large visualization arrays)
          const excludedFields = new Set(csvExcludedFields);

          // Helper function to recursively flatten nested objects
          const flattenObject = (obj: Record<string, any>, prefix = ''): Record<string, any> => {
            const flattened: Record<string, any> = {};
            for (const key of Object.keys(obj)) {
              const value = obj[key];
              const newKey = prefix ? `${prefix}.${key}` : key;

              // Skip excluded visualization fields
              if (excludedFields.has(newKey)) {
                continue;
              }

              if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                // Recursively flatten nested objects
                Object.assign(flattened, flattenObject(value, newKey));
              } else if (Array.isArray(value)) {
                // Convert arrays to JSON strings to prevent [object Object] in CSV
                flattened[newKey] = JSON.stringify(value);
              } else {
                flattened[newKey] = value;
              }
            }
            return flattened;
          };

          // First pass: collect all unique flattened gameData fields, organized by phase
          for (const entry of sortedScoutingEntries) {
            if (entry.gameData) {
              const flattened = flattenObject(entry.gameData as Record<string, any>);
              for (const key of Object.keys(flattened)) {
                // Organize fields by phase prefix
                if (key.startsWith('auto.')) {
                  autoFieldsSet.add(key);
                } else if (key.startsWith('teleop.')) {
                  teleopFieldsSet.add(key);
                } else if (key.startsWith('endgame.')) {
                  endgameFieldsSet.add(key);
                } else {
                  otherFieldsSet.add(key);
                }
              }
            }
          }

          // Build complete header with proper match timeline ordering
          // Sort auto fields with startPosition first (matches match timeline: start position → auto actions)
          const autoFields = Array.from(autoFieldsSet).sort((a, b) => {
            if (a.startsWith('auto.startPosition')) return -1;
            if (b.startsWith('auto.startPosition')) return 1;
            return a.localeCompare(b);
          });
          const teleopFields = Array.from(teleopFieldsSet).sort();
          const endgameFields = Array.from(endgameFieldsSet).sort();
          const otherFields = Array.from(otherFieldsSet).sort();
          const gameDataFields = [...autoFields, ...teleopFields, ...endgameFields, ...otherFields];
          // Comments comes last - it's the final field gathered in the match timeline
          const dynamicHeader = [...baseFields, ...gameDataFields, 'comments'];

          // Second pass: convert entries to arrays using pre-built header
          const dataArrays: (string | number)[][] = [];
          for (const entry of sortedScoutingEntries) {
            const row: (string | number)[] = [];
            const entryAsRecord = entry as unknown as Record<string, unknown>;

            // Process base fields
            for (const field of baseFields) {
              const value = entryAsRecord[field];
              row.push(value !== undefined ? value as string | number : '');
            }

            // Process gameData fields with flattening
            if (entry.gameData) {
              const flattened = flattenObject(entry.gameData as Record<string, any>);
              for (const field of gameDataFields) {
                const value = flattened[field];
                if (value === undefined || value === null) {
                  row.push('');
                } else if (typeof value === 'string' || typeof value === 'number') {
                  row.push(value);
                } else if (typeof value === 'boolean') {
                  row.push(value ? 'true' : 'false');
                } else {
                  // Safety fallback: stringify any remaining objects/arrays
                  row.push(JSON.stringify(value));
                }
              }
            } else {
              // Fill with empty strings if no gameData
              for (let i = 0; i < gameDataFields.length; i++) {
                row.push('');
              }
            }

            // Add comments field at the end
            const comments = entryAsRecord['comments'];
            row.push(comments !== undefined ? comments as string | number : '');

            dataArrays.push(row);
          }

          const finalDataArr = [dynamicHeader, ...dataArrays];

          csv = convertArrayOfArraysToCSV(finalDataArr as (string | number)[][]);
          filename = `ManeuverScoutingData-${new Date().toLocaleTimeString()}-local.csv`;
          break;
        }
        case 'pitScouting': {
          csv = await exportPitScoutingToCSV(pitCsvExcludedFields);
          if (!csv || csv.split('\n').length <= 1) {
            alert("No pit scouting data found.");
            return;
          }
          filename = `ManeuverPitScoutingData-${new Date().toLocaleTimeString()}-local.csv`;
          break;
        }
        case 'pitScoutingImagesOnly': {
          alert("CSV export not available for images-only data. Use JSON or Wifi download instead.");
          return;
        }
        case 'matchSchedule': {
          const matchDataStr = localStorage.getItem('matchData');
          const matches = matchDataStr ? JSON.parse(matchDataStr) : [];
          const eventKey = localStorage.getItem('eventKey') || '';
          const payload = createMatchSchedulePayload(matches, eventKey);

          if (!payload) {
            alert("No match schedule data found.");
            return;
          }

          const header: (string | number)[] = ['matchNum', 'redAlliance', 'blueAlliance'];
          const rows: (string | number)[][] = payload.matches.map((match) => {
            const matchNum = match.matchNum;
            const redAlliance = match.redAlliance.join(',');
            const blueAlliance = match.blueAlliance.join(',');

            return [matchNum, redAlliance, blueAlliance];
          });

          csv = convertArrayOfArraysToCSV([header, ...rows]);
          filename = `ManeuverMatchSchedule-${new Date().toLocaleTimeString()}-local.csv`;
          break;
        }
        case 'scoutProfiles': {
          // CSV export for scout profiles
          const scoutsData = await gameDB.scouts.toArray();
          const predictionsData = await gameDB.predictions.toArray();

          if (scoutsData.length === 0 && predictionsData.length === 0) {
            alert("No scout profiles data found.");
            return;
          }

          // Create CSV for scout profiles
          const scoutHeaders = ['Name', 'Stakes', 'Stakes From Predictions', 'Total Predictions', 'Correct Predictions', 'Accuracy %', 'Current Streak', 'Longest Streak', 'Detailed Comments', 'Created At', 'Last Updated'];
          const scoutRows = scoutsData.map(scout => [
            scout.name,
            scout.stakes,
            scout.stakesFromPredictions,
            scout.totalPredictions,
            scout.correctPredictions,
            scout.totalPredictions > 0 ? Math.round((scout.correctPredictions / scout.totalPredictions) * 100) : 0,
            scout.currentStreak,
            scout.longestStreak,
            typeof scout.detailedCommentsCount === 'number' ? scout.detailedCommentsCount : 0,
            new Date(scout.createdAt).toLocaleDateString(),
            new Date(scout.lastUpdated).toLocaleDateString()
          ]);

          const scoutCsvData = [scoutHeaders, ...scoutRows];
          csv = convertArrayOfArraysToCSV(scoutCsvData as (string | number)[][]);
          filename = `ManeuverScoutProfiles-${new Date().toLocaleTimeString()}-local.csv`;
          break;
        }
        default:
          alert("Unknown data type selected.");
          return;
      }

      downloadTextFile(filename, csv, "text/csv;charset=utf-8");
    } catch (error) {
      console.error("Failed to export data as CSV:", error);
      alert("Failed to export data as CSV.");
    } finally {
      setActiveDownload(null);
    }
  };

  const handleDownloadJSON = async () => {
    setActiveDownload('json');

    try {
      await waitForUiPaint();

      let dataToExport: unknown;
      let filename: string;

      switch (dataType) {
        case 'scouting': {
          const scoutingEntries = await loadScoutingData();

          if (scoutingEntries.length === 0) {
            alert("No scouting data found.");
            return;
          }

          dataToExport = { entries: scoutingEntries };
          filename = `ManeuverScoutingData-${new Date().toLocaleTimeString()}.json`;
          break;
        }
        case 'pitScouting': {
          const pitData = await loadPitScoutingData();

          if (pitData.entries.length === 0) {
            alert("No pit scouting data found.");
            return;
          }

          dataToExport = pitData;
          filename = `ManeuverPitScoutingData-${new Date().toLocaleTimeString()}.json`;
          break;
        }
        case 'pitScoutingImagesOnly': {
          try {
            await downloadPitScoutingImagesOnly();
            return;
          } catch (error) {
            console.error('Error downloading pit scouting images:', error);
            alert("Failed to download pit scouting images.");
            return;
          }
        }
        case 'matchSchedule': {
          const matchDataStr = localStorage.getItem('matchData');
          const matches = matchDataStr ? JSON.parse(matchDataStr) : [];
          const eventKey = localStorage.getItem('eventKey') || '';
          const payload = createMatchSchedulePayload(matches, eventKey);

          if (!payload) {
            alert("No match schedule data found.");
            return;
          }

          dataToExport = payload;
          filename = `ManeuverMatchSchedule-${new Date().toLocaleTimeString()}.json`;
          break;
        }
        case 'scoutProfiles': {
          const scoutsData = await gameDB.scouts.toArray();
          const predictionsData = await gameDB.predictions.toArray();

          if (scoutsData.length === 0 && predictionsData.length === 0) {
            alert("No scout profiles data found.");
            return;
          }

          dataToExport = {
            scouts: scoutsData,
            predictions: predictionsData,
            exportedAt: new Date().toISOString(),
            version: "1.0"
          };
          filename = `ManeuverScoutProfiles-${new Date().toLocaleTimeString()}.json`;
          break;
        }
        default:
          alert("Unknown data type selected.");
          return;
      }

      downloadTextFile(
        filename,
        JSON.stringify(dataToExport, null, 2),
        "application/json;charset=utf-8"
      );
    } catch (error) {
      console.error("Failed to export data as JSON:", error);
      alert("Failed to export data as JSON.");
    } finally {
      setActiveDownload(null);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center px-4 pt-12 pb-24">
      <div className="flex flex-col items-start gap-4 max-w-md w-full">
        <h1 className="text-2xl font-bold">JSON Data Transfer</h1>
        <p className="text-muted-foreground">
          Export your data as CSV for analysis, or upload JSON files to overwrite your local data storage. Choose the type of data you want to export below.
        </p>


        <div className="flex flex-col gap-4 w-full">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Data Type to Export:</label>
            <Select value={dataType} onValueChange={(value: 'scouting' | 'scoutProfiles' | 'pitScouting' | 'pitScoutingImagesOnly' | 'matchSchedule') => setDataType(value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select data type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scouting">Scouting Data</SelectItem>
                <SelectItem value="scoutProfiles">Scout Profiles</SelectItem>
                <SelectItem value="pitScouting">Pit Scouting Data</SelectItem>
                <SelectItem value="pitScoutingImagesOnly">Pit Scouting Images Only</SelectItem>
                <SelectItem value="matchSchedule">Match Schedule</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleDownloadJSON}
            disabled={activeDownload !== null}
            className="w-full h-16 text-xl"
          >
            {activeDownload === 'json' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Preparing JSON Download...</span>
              </span>
            ) : `Download ${dataType === 'scouting' ? 'Scouting Data' : dataType === 'pitScouting' ? 'Pit Scouting Data' : dataType === 'pitScoutingImagesOnly' ? 'Pit Scouting Images' : dataType === 'matchSchedule' ? 'Match Schedule' : 'Scout Profiles'} as JSON`}
          </Button>

          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>

          <div className="w-full">
            <Button
              onClick={handleDownloadCSV}
              variant="secondary"
              disabled={dataType === 'pitScoutingImagesOnly' || activeDownload !== null}
              className="w-full h-16 text-xl"
            >
              {activeDownload === 'csv'
                ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Preparing CSV Download...</span>
                  </span>
                )
                : dataType === 'pitScoutingImagesOnly'
                ? 'Images Cannot Be Downloaded as CSV'
                : `Download ${dataType === 'scouting' ? 'Scouting Data' : dataType === 'pitScouting' ? 'Pit Scouting Data' : dataType === 'matchSchedule' ? 'Match Schedule' : 'Scout Profiles'} as CSV`
              }
            </Button>
            {activeDownload && (
              <div className="mt-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <p>Building the export file. Large downloads can take a while on mobile devices.</p>
              </div>
            )}
            {dataType === 'pitScouting' && (
              <p className="text-xs text-muted-foreground mt-1 text-center">
                Game-specific fields automatically expanded into separate columns
              </p>
            )}
            {dataType === 'pitScoutingImagesOnly' && (
              <p className="text-xs text-muted-foreground mt-1 text-center">
                Images cannot be exported as CSV
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>

          <Button
            onClick={() => setMode('upload')}
            variant="outline"
            className="w-full h-16 text-xl"
          >
            Upload JSON Data
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-start space-y-1">
          <p>• CSV: Export data for spreadsheet analysis</p>
          <p>• JSON: Export/import data for backup or device transfer</p>
          <p>• Scouting Data: Match performance data</p>
          <p>• Scout Profiles: User achievements and predictions</p>
          <p>• Pit Scouting: Team technical specifications and capabilities</p>
          <p>• Pit Scouting Images Only: Robot photos for merging with existing data (requires text data first)</p>
          <p>• Match Schedule: Qualification match lineups loaded from TBA</p>
        </div>
      </div>
    </div>
  );
};

export default JSONDataTransferPage;
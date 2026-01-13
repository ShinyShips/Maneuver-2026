import React, { useState, useEffect } from 'react';
import { useMatchValidation } from '@/core/hooks/useMatchValidation';
import {
  ValidationSummaryCard,
  MatchValidationDetail,
  MatchListFilters,
  ValidationSettingsSheet,
  MatchListCard,
} from '@/core/components/match-validation';
import { EventNameSelector } from '@/core/components/GameStartComponents/EventNameSelector';
import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { RefreshCw, Settings } from 'lucide-react';
import type { MatchListItem, ValidationConfig } from '@/core/lib/matchValidationTypes';
import { DEFAULT_VALIDATION_CONFIG } from '@/core/lib/matchValidationTypes';
import { formatMatchLabel } from '@/core/lib/matchValidationUtils';

const VALIDATION_CONFIG_KEY = 'validationConfig';

export const MatchValidationPage: React.FC = () => {
  const [eventKey, setEventKey] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<MatchListItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [validationConfig, setValidationConfig] = useState<ValidationConfig>(DEFAULT_VALIDATION_CONFIG);

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
        setValidationConfig(DEFAULT_VALIDATION_CONFIG);
      }
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
  } = useMatchValidation({
    eventKey: eventKey,
    autoLoad: true,
    config: validationConfig, // Pass config to validation hook
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

  return (
    <div className="container min-h-screen mx-auto p-4 pb-24 space-y-6 mt-safe">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="shrink-0">
            <h1 className="text-3xl font-bold">Match Validation</h1>
            <p className="text-muted-foreground">
              Verify scouting data against official TBA results
            </p>
          </div>
          <div className="flex gap-2 flex-wrap z-50 relative">
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
              <RefreshCw className={`h - 4 w - 4 mr - 2 ${isValidating ? 'animate-spin' : ''} `} />
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

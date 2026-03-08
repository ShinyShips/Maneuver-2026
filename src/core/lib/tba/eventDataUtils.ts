// Event data management utilities for managing current event and event history

import { clearStoredEventTeams } from './tbaUtils';
import { clearStoredNexusData } from './nexusUtils';
import { toast } from 'sonner';

// Storage keys
const EVENT_HISTORY_KEY = 'event_history';
const CURRENT_EVENT_KEY = 'current_event';

export interface EventHistoryItem {
  eventKey: string;
  eventName: string;
  timestamp: number;
}

/**
 * Get the history of events that have been loaded
 */
export const getEventHistory = (): EventHistoryItem[] => {
  try {
    const stored = localStorage.getItem(EVENT_HISTORY_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to retrieve event history:', error);
    return [];
  }
};

/**
 * Add an event to the history (or update if it already exists)
 */
export const addToEventHistory = (eventKey: string, eventName: string): void => {
  try {
    const history = getEventHistory();
    
    // Check if event already exists in history
    const existingIndex = history.findIndex(item => item.eventKey === eventKey);
    
    const newItem: EventHistoryItem = {
      eventKey,
      eventName,
      timestamp: Date.now()
    };
    
    if (existingIndex >= 0) {
      // Update existing entry with new timestamp
      history[existingIndex] = newItem;
    } else {
      // Add new entry
      history.push(newItem);
    }
    
    // Sort by most recent first
    history.sort((a, b) => b.timestamp - a.timestamp);
    
    // Keep only the last 10 events
    const trimmedHistory = history.slice(0, 10);
    
    localStorage.setItem(EVENT_HISTORY_KEY, JSON.stringify(trimmedHistory));
    console.log(`Updated event history for ${eventKey}`);
  } catch (error) {
    console.error('Failed to update event history:', error);
  }
};

/**
 * Get the currently selected event
 */
export const getCurrentEvent = (): string => {
  try {
    const stored = localStorage.getItem(CURRENT_EVENT_KEY);
    return stored || '';
  } catch (error) {
    console.error('Failed to retrieve current event:', error);
    return '';
  }
};

/**
 * Set the currently selected event and add it to history
 */
export const setCurrentEvent = (eventKey: string): void => {
  if (!eventKey.trim()) return;
  
  try {
    localStorage.setItem(CURRENT_EVENT_KEY, eventKey);
    addToEventHistory(eventKey, eventKey); // Use eventKey as name fallback
    console.log(`Set current event to ${eventKey}`);
  } catch (error) {
    console.error('Failed to set current event:', error);
    throw new Error('Failed to set current event');
  }
};

/**
 * Check if there is a stored event
 */
export const hasStoredEventData = (eventKey: string): boolean => {
  if (!eventKey.trim()) return false;

  // Check for TBA event teams
  const teamStorageKey = `tba_event_teams_${eventKey}`;
  if (localStorage.getItem(teamStorageKey)) return true;

  // Check for Nexus data
  const nexusKeys = [
    `nexus_pit_addresses_${eventKey}`,
    `nexus_pit_map_${eventKey}`,
    `nexus_event_teams_${eventKey}`,
  ];
  
  for (const key of nexusKeys) {
    if (localStorage.getItem(key)) return true;
  }

  // Check for other event-specific data
  const eventSpecificKeys = [
    `matches_${eventKey}`,
    `match_results_${eventKey}`,
    `event_info_${eventKey}`,
    `pit_assignments_${eventKey}`,
  ];
  
  for (const key of eventSpecificKeys) {
    if (localStorage.getItem(key)) return true;
  }

  return false;
};

/**
 * Check if the event key is different from the currently stored event
 */
export const isDifferentEvent = (newEventKey: string): boolean => {
  const currentEvent = getCurrentEvent();
  return !!(currentEvent && currentEvent !== newEventKey && newEventKey.trim() !== '');
};

/**
 * Clear all event-related data from localStorage
 * This includes TBA teams, Nexus pit data, and match schedule
 */
export const clearEventData = (eventKey: string): void => {
  if (!eventKey.trim()) {
    toast.error('Event key is required to clear data');
    return;
  }

  try {
    console.log(`Clearing all event data for ${eventKey}...`);
    
    // Clear TBA teams data
    clearStoredEventTeams(eventKey);
    
    // Clear Nexus data (pit addresses, pit map, extracted teams)
    clearStoredNexusData(eventKey);
    
    // Clear match schedule
    const scheduleKey = `tba_match_schedule_${eventKey}`;
    localStorage.removeItem(scheduleKey);
    
    // Clear match data
    const matchDataKey = `tba_match_data_${eventKey}`;
    localStorage.removeItem(matchDataKey);
    
    // Clear match results
    const matchResultsKey = `match_results_${eventKey}`;
    localStorage.removeItem(matchResultsKey);
    
    // Clear event info
    const eventInfoKey = `event_info_${eventKey}`;
    localStorage.removeItem(eventInfoKey);
    
    // Clear pit assignments
    const pitAssignmentsKey = `pit_assignments_${eventKey}`;
    localStorage.removeItem(pitAssignmentsKey);
    
    console.log(`Successfully cleared all event data for ${eventKey}`);
    toast.success(`Cleared all stored data for event ${eventKey}`);
  } catch (error) {
    console.error('Failed to clear event data:', error);
    toast.error('Failed to clear some event data');
  }
};

/**
 * Clear the current event selection (but keep history)
 */
export const clearCurrentEvent = (): void => {
  try {
    localStorage.removeItem(CURRENT_EVENT_KEY);
    console.log('Cleared current event selection');
  } catch (error) {
    console.error('Failed to clear current event:', error);
  }
};

/**
 * Clear entire event history
 */
export const clearEventHistory = (): void => {
  try {
    localStorage.removeItem(EVENT_HISTORY_KEY);
    console.log('Cleared event history');
  } catch (error) {
    console.error('Failed to clear event history:', error);
  }
};

/**
 * Get the most recent event from history
 */
export const getMostRecentEvent = (): EventHistoryItem | null => {
  const history = getEventHistory();
  return history.length > 0 ? history[0] ?? null : null;
};

/**
 * Remove an event from history
 */
export const removeFromEventHistory = (eventKey: string): void => {
  try {
    const history = getEventHistory();
    const filtered = history.filter(item => item.eventKey !== eventKey);
    localStorage.setItem(EVENT_HISTORY_KEY, JSON.stringify(filtered));
    console.log(`Removed ${eventKey} from event history`);
  } catch (error) {
    console.error('Failed to remove event from history:', error);
  }
};

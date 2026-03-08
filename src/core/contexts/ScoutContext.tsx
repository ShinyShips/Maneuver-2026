import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getOrCreateScoutByName } from '@/core/lib/scoutGamificationUtils';

interface ScoutContextType {
  currentScout: string;
  currentScoutStakes: number;
  scoutsList: string[];
  playerStation: string;
  isLoading: boolean;
  setCurrentScout: (name: string) => Promise<void>;
  setPlayerStation: (station: string) => void;
  addScout: (name: string) => Promise<void>;
  removeScout: (name: string) => Promise<void>;
  refreshScout: () => Promise<void>;
}

const ScoutContext = createContext<ScoutContextType | undefined>(undefined);

export const useScout = () => {
  const context = useContext(ScoutContext);
  if (!context) {
    throw new Error('useScout must be used within a ScoutProvider');
  }
  return context;
};

interface ScoutProviderProps {
  children: ReactNode;
}

export const ScoutProvider: React.FC<ScoutProviderProps> = ({ children }) => {
  const [currentScout, setCurrentScoutState] = useState<string>('');
  const [currentScoutStakes, setCurrentScoutStakes] = useState<number>(0);
  const [scoutsList, setScoutsList] = useState<string[]>([]);
  const [playerStation, setPlayerStationState] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Load initial data from localStorage
  const loadScouts = useCallback(async () => {
    try {
      // Load scouts list
      const savedScouts = localStorage.getItem('scoutsList');
      const scouts = savedScouts ? JSON.parse(savedScouts) : [];
      setScoutsList(scouts);

      // Load current scout
      const savedCurrentScout = localStorage.getItem('currentScout');
      if (savedCurrentScout) {
        setCurrentScoutState(savedCurrentScout);
        
        // Get scout stakes from database
        try {
          const scout = await getOrCreateScoutByName(savedCurrentScout);
          setCurrentScoutStakes(scout.stakes);
        } catch (error) {
          console.error('Error loading scout stakes:', error);
          setCurrentScoutStakes(0);
        }
      }

      // Load player station
      const savedPlayerStation = localStorage.getItem('playerStation');
      if (savedPlayerStation) {
        setPlayerStationState(savedPlayerStation);
      }
    } catch (error) {
      console.error('Error loading scouts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set current scout
  const setCurrentScout = useCallback(async (name: string) => {
    if (!name.trim()) return;

    const trimmedName = name.trim();
    
    try {
      // Create/get scout from database
      const scout = await getOrCreateScoutByName(trimmedName);
      
      // Update state
      setCurrentScoutState(trimmedName);
      setCurrentScoutStakes(scout.stakes);
      
      // Update localStorage
      localStorage.setItem('currentScout', trimmedName);
      
      // Add to scouts list if not present
      if (!scoutsList.includes(trimmedName)) {
        const updatedList = [...scoutsList, trimmedName].sort();
        setScoutsList(updatedList);
        localStorage.setItem('scoutsList', JSON.stringify(updatedList));
      }
    } catch (error) {
      console.error('Error setting current scout:', error);
      throw error;
    }
  }, [scoutsList]);

  // Add a new scout to the list
  const addScout = useCallback(async (name: string) => {
    if (!name.trim()) return;

    const trimmedName = name.trim();
    
    if (scoutsList.includes(trimmedName)) {
      // Scout already exists, just set as current
      await setCurrentScout(trimmedName);
      return;
    }

    try {
      // Create scout in database
      const scout = await getOrCreateScoutByName(trimmedName);
      
      // Update scouts list
      const updatedList = [...scoutsList, trimmedName].sort();
      setScoutsList(updatedList);
      localStorage.setItem('scoutsList', JSON.stringify(updatedList));
      
      // Set as current scout
      setCurrentScoutState(trimmedName);
      setCurrentScoutStakes(scout.stakes);
      localStorage.setItem('currentScout', trimmedName);
      
      console.log('✅ ScoutContext: Scout set to', trimmedName);
    } catch (error) {
      console.error('Error adding scout:', error);
      throw error;
    }
  }, [scoutsList, setCurrentScout]);

  // Remove a scout from the list
  const removeScout = useCallback(async (name: string) => {
    const updatedList = scoutsList.filter(s => s !== name);
    setScoutsList(updatedList);
    localStorage.setItem('scoutsList', JSON.stringify(updatedList));

    // If removing current scout, clear it
    if (currentScout === name) {
      setCurrentScoutState('');
      setCurrentScoutStakes(0);
      localStorage.removeItem('currentScout');
    }
  }, [scoutsList, currentScout]);

  // Set player station
  const setPlayerStation = useCallback((station: string) => {
    setPlayerStationState(station);
    localStorage.setItem('playerStation', station);
  }, []);

  // Refresh current scout data
  const refreshScout = useCallback(async () => {
    if (!currentScout) return;

    try {
      const { getScout } = await import('@/core/lib/scoutGamificationUtils');
      const scout = await getScout(currentScout);
      if (scout) {
        setCurrentScoutStakes(scout.stakes);
      }
    } catch (error) {
      console.error('Error refreshing scout:', error);
    }
  }, [currentScout]);

  // Load scouts on mount
  useEffect(() => {
    loadScouts();
  }, [loadScouts]);

  // Listen for external scout changes (from other components or demo generator)
  useEffect(() => {
    const handleScoutChanged = () => {
      loadScouts();
    };

    const handleScoutDataCleared = () => {
      // Clear state immediately
      setCurrentScoutState('');
      setCurrentScoutStakes(0);
      setScoutsList([]);
      setPlayerStationState('');
    };

    const handlePlayerStationChanged = () => {
      const newStation = localStorage.getItem('playerStation') || '';
      setPlayerStationState(newStation);
    };

    window.addEventListener('scoutChanged', handleScoutChanged);
    window.addEventListener('scoutDataCleared', handleScoutDataCleared);
    window.addEventListener('playerStationChanged', handlePlayerStationChanged);
    
    return () => {
      window.removeEventListener('scoutChanged', handleScoutChanged);
      window.removeEventListener('scoutDataCleared', handleScoutDataCleared);
      window.removeEventListener('playerStationChanged', handlePlayerStationChanged);
    };
  }, [loadScouts]);

  const value: ScoutContextType = {
    currentScout,
    currentScoutStakes,
    scoutsList,
    playerStation,
    isLoading,
    setCurrentScout,
    setPlayerStation,
    addScout,
    removeScout,
    refreshScout,
  };

  return <ScoutContext.Provider value={value}>{children}</ScoutContext.Provider>;
};

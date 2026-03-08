import React from 'react';
import { ExternalLink } from 'lucide-react';

interface DataAttributionProps {
  sources: ('tba' | 'nexus')[];
  variant?: 'full' | 'compact' | 'inline';
  className?: string;
}

export const DataAttribution: React.FC<DataAttributionProps> = ({ 
  sources, 
  variant = 'compact',
  className = '' 
}) => {
  const showTBA = sources.includes('tba');
  const showNexus = sources.includes('nexus');

  if (variant === 'full') {
    return (
      <div className={`space-y-2 text-xs text-muted-foreground ${className}`}>
        {showTBA && (
          <div className="flex items-center gap-1">
            <span>Powered by</span>
            <a 
              href="https://thebluealliance.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline flex items-center gap-1"
            >
              The Blue Alliance
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        {showNexus && (
          <div className="flex items-center gap-1">
            <span>Pit data from</span>
            <a 
              href="https://frc.nexus" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 underline flex items-center gap-1"
            >
              Nexus for FRC
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'inline') {
    const attributions = [];
    if (showTBA) {
      attributions.push(
        <a 
          key="tba"
          href="https://thebluealliance.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
        >
          The Blue Alliance
        </a>
      );
    }
    if (showNexus) {
      attributions.push(
        <a 
          key="nexus"
          href="https://frc.nexus" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 underline"
        >
          Nexus for FRC
        </a>
      );
    }

    return (
      <span className={`text-xs text-muted-foreground ${className}`}>
        Data from {attributions.reduce((prev, curr, index) => {
          if (prev === null) return [curr];
          return [...prev, index === attributions.length - 1 ? ' and ' : ', ', curr];
        }, null as React.ReactNode[] | null)}
      </span>
    );
  }

  // Compact variant (default)
  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs text-muted-foreground ${className}`}>
      {showTBA && (
        <a 
          href="https://thebluealliance.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline flex items-center gap-1"
          title="Powered by The Blue Alliance"
        >
          <span className="hidden sm:inline">Powered by </span>The Blue Alliance
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {showNexus && (
        <a 
          href="https://frc.nexus" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 underline flex items-center gap-1"
          title="Pit data from FRC Nexus"
        >
          Nexus<span className="hidden sm:inline"> for FRC</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
};

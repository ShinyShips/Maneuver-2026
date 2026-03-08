/**
 * Lead Scout Mode Component
 * Handles the lead scout's workflow:
 * - Generate room code for scouts to join
 * - Display room code and connection status
 * - Manage connected scouts
 * - Request/push data with filtering options
 * - Auto-reconnect scouts on refresh/disconnect
 * - View transfer history
 */

import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { AlertCircle, RefreshCw } from 'lucide-react';
import {
    ConnectedScoutCard,
    DataTransferControls,
    TransferHistoryCard,
    RoomCodeConnection
} from '@/core/components/peer-transfer';
import { DataFilteringControls } from '@/core/components/data-transfer/DataFilteringControls';
import { type DataFilters } from '@/core/lib/dataFiltering';
import { loadScoutingData } from '@/core/lib/scoutingDataUtils';
import type { TransferDataType } from '@/core/contexts/WebRTCContext';
import { debugLog, getRelativeTime } from '@/core/lib/peerTransferUtils';

interface ConnectedScout {
    id: string;
    name: string;
    channel: RTCDataChannel | null;
}

interface ReceivedDataEntry {
    scoutName: string;
    data: unknown;
    timestamp: number;
}

interface LeadScoutModeProps {
    connectedScouts: ConnectedScout[];
    receivedData: ReceivedDataEntry[];
    dataType: TransferDataType;
    setDataType: (type: TransferDataType) => void;
    filters: DataFilters;
    allScoutingData: Awaited<ReturnType<typeof loadScoutingData>> | null;
    historyCollapsed: boolean;
    setHistoryCollapsed: (collapsed: boolean) => void;
    requestingScouts: Set<string>;
    setRequestingScouts: React.Dispatch<React.SetStateAction<Set<string>>>;
    setImportedDataCount: (count: number) => void;
    onBack: () => void;
    onRequestDataFromScout: (scoutId: string, filters: DataFilters, dataType: TransferDataType) => void;
    onRequestDataFromAll: (filters: DataFilters, dataType: TransferDataType) => void;
    onPushData: (dataType: TransferDataType, scouts: ConnectedScout[]) => void;
    onPushDataToScout: (scoutId: string, data: unknown, dataType: TransferDataType) => void;
    onDisconnectScout: (scoutId: string) => void;
    onAddToHistory: (entry: ReceivedDataEntry) => void;
    onClearHistory: () => void;
    onFiltersChange: (filters: DataFilters) => void;
    onApplyFilters: () => void;
}

export const LeadScoutMode = ({
    connectedScouts,
    receivedData,
    dataType,
    setDataType,
    filters,
    allScoutingData,
    historyCollapsed,
    setHistoryCollapsed,
    requestingScouts,
    setRequestingScouts,
    setImportedDataCount,
    onBack,
    onRequestDataFromScout,
    onRequestDataFromAll,
    onPushData,
    onPushDataToScout,
    onDisconnectScout,
    onAddToHistory,
    onClearHistory,
    onFiltersChange,
    onApplyFilters,
}: LeadScoutModeProps) => {
    return (
        <div className="h-screen w-full flex flex-col items-center justify-start px-4 pt-12 pb-24 2xl:pb-6 overflow-y-auto">
            <div className="flex flex-col items-start gap-6 max-w-md w-full">
                <Button onClick={onBack} variant="ghost" size="sm">
                    ← Change Mode
                </Button>

                <div className="w-full">
                    <h1 className="text-2xl font-bold mb-2">Lead Scout Session</h1>
                    <p className="text-muted-foreground">
                        Scouts connect using the room code below
                    </p>
                </div>

                <RoomCodeConnection mode="lead" />

                {connectedScouts.length > 0 && (
                    <Card className="w-full">
                        <CardHeader>
                            <CardTitle>Filter Data Request (Optional)</CardTitle>
                            <CardDescription>
                                {allScoutingData && allScoutingData.length > 0
                                    ? `Request specific data from scouts • Current dataset: ${allScoutingData.length} entries`
                                    : 'Request specific data from scouts'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <DataFilteringControls
                                data={allScoutingData && allScoutingData.length > 0
                                    ? { entries: allScoutingData, exportedAt: Date.now(), version: '1.0' }
                                    : undefined}
                                filters={filters}
                                onFiltersChange={onFiltersChange}
                                onApplyFilters={onApplyFilters}
                                useCompression={false}
                                hideQRStats={true}
                                hideApplyButton={true}
                            />
                        </CardContent>
                    </Card>
                )}

                <Card className="w-full">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Connected Scouts</span>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        console.log('🔄 Refreshing connected scouts state');
                                        setRequestingScouts(new Set(requestingScouts));
                                    }}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Badge variant="secondary">{connectedScouts.length} connected</Badge>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {connectedScouts.length === 0 ? (
                            <div className="text-center py-4">
                                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground">
                                    No scouts connected yet
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {connectedScouts.map(scout => (
                                    <ConnectedScoutCard
                                        key={scout.id}
                                        scout={scout}
                                        isRequesting={requestingScouts.has(scout.id)}
                                        receivedData={receivedData}
                                        dataType={dataType}
                                        onRequestData={(scoutId) => {
                                            setRequestingScouts(prev => new Set(prev).add(scoutId));
                                            debugLog('📤 Requesting', dataType, 'data from', scout.name, 'with filters:', filters);
                                            onRequestDataFromScout(scoutId, filters, dataType);
                                        }}
                                        onPushData={onPushDataToScout}
                                        onDisconnect={(scoutId) => {
                                            onDisconnectScout(scoutId);
                                        }}
                                        onAddToHistory={onAddToHistory}
                                    />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {connectedScouts.length > 0 && (
                    <DataTransferControls
                        dataType={dataType}
                        onDataTypeChange={(value) => setDataType(value)}
                        readyScoutsCount={connectedScouts.filter(s => s.channel?.readyState === 'open').length}
                        onRequestData={() => {
                            const readyScouts = connectedScouts.filter(s => s.channel?.readyState === 'open');
                            setRequestingScouts(new Set(readyScouts.map(s => s.id)));
                            setImportedDataCount(receivedData.length);
                            debugLog('📤 Requesting', dataType, 'data with filters:', filters);
                            onRequestDataFromAll(filters, dataType);
                        }}
                        onPushData={() => onPushData(dataType, connectedScouts)}
                    />
                )}

                {receivedData.length > 0 && (
                    <TransferHistoryCard
                        receivedData={receivedData}
                        historyCollapsed={historyCollapsed}
                        onToggleCollapse={() => setHistoryCollapsed(!historyCollapsed)}
                        onClearHistory={onClearHistory}
                        getRelativeTime={getRelativeTime}
                    />
                )}
            </div>
        </div>
    );
};

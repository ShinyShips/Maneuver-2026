/**
 * Scout Mode Component
 * Scouts connect via room code and wait for data requests
 */

import { Button } from '@/core/components/ui/button';
import { ScoutConnectedCard, RoomCodeConnection } from '@/core/components/peer-transfer';
import { convertTeamRole } from '@/core/lib/utils';
import { useWebRTC } from '@/core/contexts/WebRTCContext';

interface ScoutModeProps {
    // Connection state
    myRole: string;

    // Handlers
    onBack: () => void;
    onCancel: () => void;
}

export const ScoutMode = ({
    myRole,
    onBack,
    onCancel,
}: ScoutModeProps) => {
    const roleDisplay = convertTeamRole(myRole) || myRole;

    // Get WebRTC state to determine when to show connected card
    const { mode: webrtcMode, connectionStatus, roomCode } = useWebRTC();

    // Show connected card when fully connected via WebRTC
    // connectionStatus can be "Connected - Ready to send data" or contain "Connected"
    const shouldShowConnected = webrtcMode === 'scout' && connectionStatus.includes('Connected');

    return (
        <div className="h-screen w-full flex flex-col items-center justify-start px-4 pt-12 pb-24 2xl:pb-6 overflow-y-auto">
            <div className="flex flex-col items-start gap-6 max-w-md w-full">
                <Button onClick={onBack} variant="ghost" size="sm">
                    ← Change Mode
                </Button>

                <div className="w-full">
                    <h1 className="text-2xl font-bold mb-2">Scout Mode</h1>
                    <p className="text-muted-foreground">
                        Enter room code below to connect
                    </p>
                </div>

                {/* Room Code Connection Card */}
                <RoomCodeConnection mode="scout" />

                {/* Show connected status when WebRTC connection is active */}
                {shouldShowConnected && (
                    <ScoutConnectedCard
                        roleName={roleDisplay}
                        roomCode={roomCode}
                        onDisconnect={onCancel}
                    />
                )}
            </div>
        </div>
    );
};

/**
 * Universal QR Fountain Code Generator
 * Framework component - game-agnostic
 * 
 * Generates multiple QR codes using Luby Transform fountain codes for reliable data transfer.
 * Supports auto-cycling, playback controls, and smart compression.
 */

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/core/components/ui/alert";
import { Badge } from "@/core/components/ui/badge";
import { toast } from "sonner";
import { createEncoder, blockToBinary } from "luby-transform";
import { fromUint8Array } from "js-base64";
import { Info, Play, Pause, SkipForward, SkipBack, ChevronsLeft, ChevronsRight } from "lucide-react";
import {
  shouldUseCompression,
  getCompressionStats,
  compressData,
  MIN_FOUNTAIN_SIZE_COMPRESSED,
  MIN_FOUNTAIN_SIZE_UNCOMPRESSED,
  QR_CODE_SIZE_BYTES
} from "@/core/lib/compressionUtils";

interface FountainPacket {
  type: string;
  sessionId: string;
  packetId: number;
  k: number;
  bytes: number;
  checksum: string;
  indices: number[];
  data: string; // Base64 encoded binary data
}

export interface UniversalFountainGeneratorProps {
  onBack: () => void;
  onSwitchToScanner?: () => void;
  dataType: string;
  loadData: () => Promise<unknown> | unknown;
  compressData?: (data: unknown, originalJson?: string) => Uint8Array;
  title: string;
  description: string;
  noDataMessage: string;
}

export const UniversalFountainGenerator = ({
  onBack,
  onSwitchToScanner,
  dataType,
  loadData,
  compressData: customCompress,
  title,
  description,
  noDataMessage
}: UniversalFountainGeneratorProps) => {
  const [packets, setPackets] = useState<FountainPacket[]>([]);
  const [currentPacketIndex, setCurrentPacketIndex] = useState(0);
  const [data, setData] = useState<unknown>(null);
  const [cycleSpeed, setCycleSpeed] = useState(500);
  const [compressionInfo, setCompressionInfo] = useState<string>('');
  const [isPaused, setIsPaused] = useState(false);
  const [jumpToPacket, setJumpToPacket] = useState<string>('');

  // Speed presets
  const speedPresets = [
    { label: "Default (2/sec)", value: 500 },
    { label: "Slower (1/sec)", value: 1000 }
  ];

  // Load data on mount
  useEffect(() => {
    const loadDataAsync = async () => {
      try {
        const loadedData = await loadData();
        setData(loadedData);

        if (import.meta.env.DEV) {
          if (loadedData) {
            console.log(`Loaded ${dataType} data for fountain codes:`, loadedData);
          } else {
            console.log(`No ${dataType} data found`);
          }
        }
      } catch (error) {
        console.error(`Error loading ${dataType} data:`, error);
        toast.error(`Error loading ${dataType} data: ` + (error instanceof Error ? error.message : String(error)));
        setData(null);
      }
    };

    loadDataAsync();
  }, [loadData, dataType]);

  const generateFountainPackets = () => {
    if (!data) {
      toast.error(`No ${dataType} data available`);
      return;
    }

    let encodedData: Uint8Array;
    let currentCompressionInfo = '';

    // Cache JSON string to avoid duplicate serialization
    const jsonString = JSON.stringify(data);

    // Check if custom compression is provided
    if (customCompress && shouldUseCompression(data, jsonString)) {
      if (import.meta.env.DEV) {
        console.log(`🗜️ Using custom compression for ${dataType} data...`);
      }
      encodedData = customCompress(data, jsonString);
      const stats = getCompressionStats(data, encodedData, jsonString);
      currentCompressionInfo = `Custom compression: ${stats.originalSize} → ${stats.compressedSize} bytes (${(100 - stats.compressionRatio * 100).toFixed(1)}% reduction, ${stats.estimatedQRReduction})`;
      toast.success(`Compressed ${dataType} data: ${(100 - stats.compressionRatio * 100).toFixed(1)}% size reduction!`);
    } else if (shouldUseCompression(data, jsonString)) {
      // Use standard compression
      if (import.meta.env.DEV) {
        console.log(`🗜️ Using standard compression for ${dataType} data...`);
      }
      encodedData = compressData(data, jsonString);
      const stats = getCompressionStats(data, encodedData, jsonString);
      currentCompressionInfo = `Standard compression: ${stats.originalSize} → ${stats.compressedSize} bytes (${(100 - stats.compressionRatio * 100).toFixed(1)}% reduction, ${stats.estimatedQRReduction})`;
      toast.success(`Compressed data: ${(100 - stats.compressionRatio * 100).toFixed(1)}% size reduction!`);
    } else {
      // No compression - use standard JSON encoding
      encodedData = new TextEncoder().encode(jsonString);
      currentCompressionInfo = `Standard JSON: ${encodedData.length} bytes`;
    }

    // Store compression info for display
    setCompressionInfo(currentCompressionInfo);

    // Validate data size - need sufficient data for meaningful fountain codes
    const isCompressed = currentCompressionInfo.toLowerCase().includes('compress');
    const minDataSize = isCompressed ? MIN_FOUNTAIN_SIZE_COMPRESSED : MIN_FOUNTAIN_SIZE_UNCOMPRESSED;

    if (encodedData.length < minDataSize) {
      toast.error(`${dataType} data is too small (${encodedData.length} bytes). Need at least ${minDataSize} bytes for fountain code generation.`);
      console.warn(`Data too small for fountain codes: ${encodedData.length} bytes (min: ${minDataSize})`);
      return;
    }

    if (import.meta.env.DEV) {
      console.log(`📊 ${currentCompressionInfo}`);
    }

    const blockSize = 200;
    const ltEncoder = createEncoder(encodedData, blockSize);
    const newSessionId = `${dataType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const generatedPackets: FountainPacket[] = [];
    let packetId = 0;
    const seenIndicesCombinations = new Set();
    let iterationCount = 0;

    // Calculate how many blocks we have for intelligent packet generation
    const estimatedBlocks = Math.ceil(encodedData.length / blockSize);

    // Fountain codes need significant redundancy for reliable decoding
    // Small datasets (< 25 blocks) need 150% redundancy (2.5x packets)
    // Larger datasets can use 50% redundancy due to probability math
    const redundancyFactor = estimatedBlocks < 25 ? 2.5 : 1.5;
    const targetPackets = Math.ceil(estimatedBlocks * redundancyFactor);

    // Cap maximum iterations to prevent infinite loops
    const maxIterations = targetPackets * 5;

    if (import.meta.env.DEV) {
      console.log(`📊 Fountain code generation: ${estimatedBlocks} blocks, targeting ${targetPackets} packets (${Math.round((redundancyFactor - 1) * 100)}% redundancy)`);
    }

    for (const block of ltEncoder.fountain()) {
      iterationCount++;

      // Safety check to prevent infinite loops
      if (iterationCount > maxIterations) {
        console.warn(`⚠️ Reached maximum iterations (${maxIterations}), stopping generation with ${generatedPackets.length} packets`);
        console.warn(`Target was ${targetPackets} packets, achieved ${Math.round((generatedPackets.length / targetPackets) * 100)}%`);
        break;
      }

      // Stop when we have enough packets for reliable decoding
      if (generatedPackets.length >= targetPackets) {
        if (import.meta.env.DEV) {
          console.log(`✅ Generated target ${targetPackets} packets, stopping`);
        }
        break;
      }

      try {
        const indicesKey = block.indices.sort().join(',');
        if (seenIndicesCombinations.has(indicesKey)) {
          continue;
        }
        seenIndicesCombinations.add(indicesKey);

        const binary = blockToBinary(block);
        const base64Data = fromUint8Array(binary);

        const packet: FountainPacket = {
          type: `${dataType}_fountain_packet`,
          sessionId: newSessionId,
          packetId,
          k: block.k,
          bytes: block.bytes,
          checksum: String(block.checksum),
          indices: block.indices,
          data: base64Data
        };

        const packetJson = JSON.stringify(packet);

        // 90% of QR capacity to leave room for encoding overhead
        if (packetJson.length > (QR_CODE_SIZE_BYTES * 0.9)) {
          console.warn(`📦 Packet ${packetId} too large (${packetJson.length} chars), skipping`);
          continue;
        }

        generatedPackets.push(packet);
        packetId++;
      } catch (error) {
        console.error(`Error generating packet ${packetId}:`, error);
        break;
      }
    }

    setPackets(generatedPackets);
    setCurrentPacketIndex(0);
    setIsPaused(false); // Start playing automatically
    setJumpToPacket(''); // Clear jump input

    const selectedSpeed = speedPresets.find(s => s.value === cycleSpeed);
    const estimatedTime = Math.round((generatedPackets.length * cycleSpeed) / 1000);
    toast.success(`Generated ${generatedPackets.length} packets - cycling at ${selectedSpeed?.label}! (~${estimatedTime}s per cycle)`);
  };

  // Auto-cycle packets based on selected speed (respects pause state)
  useEffect(() => {
    if (packets.length > 0 && !isPaused) {
      const interval = setInterval(() => {
        setCurrentPacketIndex(prev => (prev + 1) % packets.length);
      }, cycleSpeed);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [packets.length, cycleSpeed, isPaused]);

  // Navigation helper functions
  const togglePlayPause = () => {
    setIsPaused(!isPaused);
  };

  const goToNextPacket = () => {
    setCurrentPacketIndex(prev => (prev + 1) % packets.length);
  };

  const goToPrevPacket = () => {
    setCurrentPacketIndex(prev => (prev - 1 + packets.length) % packets.length);
  };

  const jumpToSpecificPacket = () => {
    const packetNum = parseInt(jumpToPacket);
    if (packetNum >= 1 && packetNum <= packets.length) {
      setCurrentPacketIndex(packetNum - 1); // Convert to 0-based index
      setJumpToPacket('');
      toast.success(`Jumped to packet ${packetNum}`);
    } else {
      toast.error(`Invalid packet number. Must be between 1 and ${packets.length}`);
    }
  };

  const goToFirstPacket = () => {
    setCurrentPacketIndex(0);
  };

  const goToLastPacket = () => {
    setCurrentPacketIndex(packets.length - 1);
  };

  // Helper function to check if data is sufficient for fountain code generation
  const isDataSufficient = () => {
    if (!data) return false;

    const jsonString = JSON.stringify(data);
    const useCompression = shouldUseCompression(data, jsonString);
    const minSize = useCompression ? MIN_FOUNTAIN_SIZE_COMPRESSED : MIN_FOUNTAIN_SIZE_UNCOMPRESSED;

    const encodedData = new TextEncoder().encode(jsonString);
    return encodedData.length >= minSize;
  };

  const getDataSizeInfo = () => {
    if (!data) return null;

    const jsonString = JSON.stringify(data);
    const useCompression = shouldUseCompression(data, jsonString);
    const minSize = useCompression ? MIN_FOUNTAIN_SIZE_COMPRESSED : MIN_FOUNTAIN_SIZE_UNCOMPRESSED;

    const encodedData = new TextEncoder().encode(jsonString);

    return {
      size: encodedData.length,
      sufficient: encodedData.length >= minSize,
      compressed: useCompression
    };
  };

  const currentPacket = packets[currentPacketIndex];
  const currentSpeedLabel = speedPresets.find(s => s.value === cycleSpeed)?.label;
  const dataSizeInfo = getDataSizeInfo();

  return (
    <div className="min-h-screen w-full flex flex-col items-center gap-6 px-4 pt-16 pb-6">
      <div className="flex flex-col items-center gap-4 max-w-md w-full pb-4">
        {/* Navigation Header */}
        <div className="flex items-center justify-between w-full">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
          >
            ← Back
          </Button>
          {onSwitchToScanner && (
            <Button
              onClick={onSwitchToScanner}
              variant="outline"
              size="sm"
            >
              Switch to Scanner
            </Button>
          )}
        </div>

        {/* Title and Description */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </Card>

        {/* Generation Controls - Only show if no packets generated yet */}
        {packets.length === 0 ? (
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-lg">Generator Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Speed Selection */}
              <div className="w-full">
                <p className="text-sm font-medium mb-2 text-center">Cycle Speed:</p>
                <div className="grid grid-cols-2 gap-2">
                  {speedPresets.map((preset) => (
                    <Button
                      key={preset.value}
                      variant={cycleSpeed === preset.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCycleSpeed(preset.value)}
                      className="text-xs"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                onClick={generateFountainPackets}
                className="w-full h-12"
                disabled={!isDataSufficient()}
              >
                Generate & Start Auto-Cycling
              </Button>

              {!data ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {noDataMessage}
                  </AlertDescription>
                </Alert>
              ) : data && !isDataSufficient() ? (
                <Alert variant="destructive">
                  <AlertDescription className="col-span-2">
                    {dataType} data is too small ({dataSizeInfo?.size || 0} bytes).
                    Need at least {dataSizeInfo?.compressed ? MIN_FOUNTAIN_SIZE_COMPRESSED : MIN_FOUNTAIN_SIZE_UNCOMPRESSED} bytes for fountain code generation.
                    {dataSizeInfo?.compressed && ' (Compressed data threshold)'}
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full">
            {/* Scanning Instructions */}
            <Alert>
              <AlertTitle className="col-span-2">📱 Scanning Instructions</AlertTitle>
              <AlertDescription className="col-span-2">
                Point your scanner at the QR code. Use playback controls to pause, navigate, or jump to specific packets.
                Estimated time per cycle: {Math.round((packets.length * cycleSpeed) / 1000)}s
              </AlertDescription>
            </Alert>

            {/* QR Code Display */}
            <Card className="w-full">
              <CardContent className="p-4 flex justify-center">
                {currentPacket && (
                  <div className="bg-white p-4 rounded-lg shadow-lg">
                    <QRCodeSVG
                      value={JSON.stringify(currentPacket)}
                      size={300}
                      level="L"
                      includeMargin={false}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Speed & Playback Controls */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-sm">Speed & Playback Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Speed Selection */}
                <div className="w-full">
                  <p className="text-sm font-medium mb-2">Cycle Speed:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {speedPresets.map((preset) => (
                      <Button
                        key={preset.value}
                        variant={cycleSpeed === preset.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCycleSpeed(preset.value)}
                        className="text-xs"
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Play/Pause and Step Controls */}
                <div className="w-full">
                  <p className="text-sm font-medium mb-2">Navigation:</p>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={goToFirstPacket}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={goToPrevPacket}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={togglePlayPause}
                      variant={isPaused ? "default" : "secondary"}
                      size="sm"
                      className="flex-2"
                    >
                      {isPaused ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
                      {isPaused ? "Play" : "Pause"}
                    </Button>
                    <Button
                      onClick={goToNextPacket}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={goToLastPacket}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Jump to Packet */}
                <div className="w-full">
                  <p className="text-sm font-medium mb-2">Jump to Packet:</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Packet #"
                      value={jumpToPacket}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Only allow numeric input
                        if (value === '' || /^\d+$/.test(value)) {
                          setJumpToPacket(value);
                        }
                      }}
                      min="1"
                      max={packets.length}
                      className="flex-1"
                    />
                    <Button
                      onClick={jumpToSpecificPacket}
                      variant="outline"
                      size="sm"
                      disabled={!jumpToPacket || parseInt(jumpToPacket) < 1 || parseInt(jumpToPacket) > packets.length}
                    >
                      Jump
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Info className="inline mt-0.5 text-muted-foreground shrink-0" size={16} />
                  <p className="text-xs text-muted-foreground">
                    If unable to get final packets, try slowing down the cycle speed or use manual navigation.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Packet Info */}
            {currentPacket && (
              <Card className="w-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Packet #{currentPacket.packetId + 1}
                    </CardTitle>
                    <Badge variant="outline">
                      {currentSpeedLabel}
                    </Badge>
                  </div>
                  <CardDescription>
                    Broadcasting {packets.length} fountain packets
                    {compressionInfo && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {compressionInfo}
                      </div>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="font-medium">Indices:</span>
                      <span className="ml-1 break-all">
                        {currentPacket.indices.length > 20
                          ? `[${currentPacket.indices.slice(0, 20).join(',')}...+${currentPacket.indices.length - 20} more]`
                          : `[${currentPacket.indices.join(',')}]`
                        }
                      </span>
                    </div>
                    <p><span className="font-medium">K:</span> {currentPacket.k} | <span className="font-medium">Bytes:</span> {currentPacket.bytes}</p>
                    <p><span className="font-medium">Checksum:</span> {String(currentPacket.checksum).slice(0, 8)}...</p>
                  </div>

                  {/* Progress Indicator */}
                  <div className="w-full">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Current cycle:</span>
                      <span>{currentPacketIndex + 1}/{packets.length}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all ease-linear"
                        style={{
                          width: `${((currentPacketIndex + 1) / packets.length) * 100}%`,
                          transitionDuration: `${cycleSpeed}ms`
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reset Button */}
            <Button
              onClick={() => {
                setPackets([]);
                setCurrentPacketIndex(0);
                setIsPaused(false);
                setJumpToPacket('');
              }}
              variant="secondary"
              className="w-full"
            >
              Stop & Generate New Packets
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

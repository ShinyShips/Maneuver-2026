import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/core/components/ui/popover";
import { Eraser, EyeOff, Maximize2, Pencil, RotateCw, Save, Trash2, Undo2 } from "lucide-react";
import { PRESET_COLORS } from "@/core/lib/drawingColors";

interface DrawingControlsProps {
    isErasing: boolean;
    brushSize: number;
    brushColor: string;
    currentStageId: string;
    isMobile: boolean;
    isFullscreen: boolean;
    isFieldRotated: boolean;
    canUndo: boolean;
    onToggleErasing: (erasing: boolean) => void;
    onBrushSizeChange: (size: number) => void;
    onBrushColorChange: (color: string) => void;
    onClearCanvas: () => void;
    onSaveCanvas: () => void;
    onUndo: () => void;
    onToggleFieldOrientation: () => void;
    onToggleFullscreen: () => void;
    onToggleHideControls: () => void;
}

// Helper to get size label
const getSizeLabel = (size: number): string => {
    if (size <= 2) return 'Small';
    if (size <= 5) return 'Medium';
    if (size <= 10) return 'Large';
    return 'X-Large';
};

const ResponsiveButtonLabel = ({
    icon,
    label,
}: {
    icon: React.ReactNode;
    label: string;
}) => (
    <>
        <span className="lg:hidden" aria-hidden="true">{icon}</span>
        <span className="hidden lg:inline">{label}</span>
    </>
);

export const DrawingControls = ({
    isErasing,
    brushSize,
    brushColor,
    currentStageId,
    isMobile,
    isFullscreen,
    isFieldRotated,
    canUndo,
    onToggleErasing,
    onBrushSizeChange,
    onBrushColorChange,
    onClearCanvas,
    onSaveCanvas,
    onUndo,
    onToggleFieldOrientation,
    onToggleFullscreen,
    onToggleHideControls
}: DrawingControlsProps) => {
    const [colorPickerOpen, setColorPickerOpen] = useState(false);

    const handleColorChange = (color: string) => {
        onBrushColorChange(color);
        setColorPickerOpen(false);
    };

    if (isFullscreen) {
        // Fullscreen drawing controls
        return (
            <div className="shrink-0 p-2 md:p-4 border-b bg-background relative z-40">
                {/* Mobile: 2 rows, Desktop: single row */}
                <div className="flex flex-col md:flex-row md:flex-wrap justify-center items-center gap-2">
                    {/* Row 1: Main drawing actions */}
                    <div className="flex flex-wrap justify-center items-center gap-2">
                        <Button
                            variant={!isErasing ? "default" : "outline"}
                            size="sm"
                            onClick={() => onToggleErasing(false)}
                            title="Draw"
                        >
                            <ResponsiveButtonLabel icon={<Pencil className="h-4 w-4" />} label="Draw" />
                        </Button>
                        <Button
                            variant={isErasing ? "default" : "outline"}
                            size="sm"
                            onClick={() => onToggleErasing(true)}
                            title="Erase"
                        >
                            <ResponsiveButtonLabel icon={<Eraser className="h-4 w-4" />} label="Erase" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onUndo}
                            disabled={!canUndo}
                            title="Undo last action"
                        >
                            <ResponsiveButtonLabel icon={<Undo2 className="h-4 w-4" />} label="Undo" />
                        </Button>
                        <Button onClick={onClearCanvas} variant="outline" size="sm" title="Clear canvas">
                            <ResponsiveButtonLabel icon={<Trash2 className="h-4 w-4" />} label="Clear" />
                        </Button>
                    </div>

                    {/* Row 2: Tools and settings */}
                    <div className="flex flex-wrap justify-center items-center gap-2">
                        {/* Size selector */}
                        <Select
                            value={brushSize.toString()}
                            onValueChange={(value) => onBrushSizeChange(Number(value))}
                        >
                            <SelectTrigger className="w-fit" size="sm">
                                <SelectValue>{getSizeLabel(brushSize)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2">Small</SelectItem>
                                <SelectItem value="5">Medium</SelectItem>
                                <SelectItem value="10">Large</SelectItem>
                                <SelectItem value="20">X-Large</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Color selector */}
                        <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-8 h-8 p-0"
                                    style={{ backgroundColor: brushColor }}
                                    title="Select color"
                                    aria-label="Select drawing color"
                                >
                                    <span className="sr-only">Select color</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2">
                                <div className="grid grid-cols-5 gap-1">
                                    {PRESET_COLORS.map((color) => (
                                        <button
                                            key={color.value}
                                            onClick={() => handleColorChange(color.value)}
                                            className={`w-8 h-8 rounded border-2 cursor-pointer transition-all hover:scale-110 relative ${brushColor === color.value ? 'border-black ring-2 ring-offset-2 ring-white' : 'border-gray-600'
                                                }`}
                                            style={{ backgroundColor: color.value }}
                                            title={color.label}
                                            aria-label={color.label}
                                        >
                                            {brushColor === color.value && (
                                                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="h-4 w-4 text-black drop-shadow"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        strokeWidth={3}
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Button onClick={onSaveCanvas} variant="outline" size="sm" title="Save canvas">
                            <ResponsiveButtonLabel icon={<Save className="h-4 w-4" />} label="Save" />
                        </Button>

                        <Button
                            onClick={onToggleFieldOrientation}
                            variant="outline"
                            size="sm"
                            title={isFieldRotated ? "Reset field orientation" : "Rotate field 180°"}
                        >
                            <RotateCw className={`h-4 w-4 ${isFieldRotated ? 'rotate-180' : ''}`} />
                        </Button>

                        {/* Hide Controls Button - Only on mobile screens */}
                        {isMobile && (
                            <Button
                                onClick={onToggleHideControls}
                                variant="outline"
                                size="sm"
                                title="Hide controls for more drawing space"
                            >
                                <EyeOff className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Normal drawing controls
    return (
        <div className="mb-4 shrink-0">
            {/* Mobile: stacked rows, Tablet+: single row with all controls */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                {/* Main actions */}
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant={!isErasing ? "default" : "outline"}
                        size="sm"
                        onClick={() => onToggleErasing(false)}
                            title="Draw"
                    >
                            <ResponsiveButtonLabel icon={<Pencil className="h-4 w-4" />} label="Draw" />
                    </Button>
                    <Button
                        variant={isErasing ? "default" : "outline"}
                        size="sm"
                        onClick={() => onToggleErasing(true)}
                            title="Erase"
                    >
                            <ResponsiveButtonLabel icon={<Eraser className="h-4 w-4" />} label="Erase" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onUndo}
                        disabled={!canUndo}
                        title="Undo last action"
                    >
                            <ResponsiveButtonLabel icon={<Undo2 className="h-4 w-4" />} label="Undo" />
                    </Button>
                    <Button onClick={onClearCanvas} variant="outline" size="sm" title="Clear canvas">
                        <ResponsiveButtonLabel icon={<Trash2 className="h-4 w-4" />} label="Clear" />
                    </Button>
                </div>

                {/* Size and color */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Size selector */}
                    <Select
                        value={brushSize.toString()}
                        onValueChange={(value) => onBrushSizeChange(Number(value))}
                    >
                        <SelectTrigger className="w-25" size="sm">
                            <SelectValue>{getSizeLabel(brushSize)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2">Small</SelectItem>
                            <SelectItem value="5">Medium</SelectItem>
                            <SelectItem value="10">Large</SelectItem>
                            <SelectItem value="20">X-Large</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Color selector */}
                    <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-8 h-8 p-0"
                                style={{ backgroundColor: brushColor }}
                                title="Select color"
                                aria-label="Select drawing color"
                            >
                                <span className="sr-only">Select color</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2">
                            <div className="grid grid-cols-5 gap-1">
                                {PRESET_COLORS.map((color) => (
                                    <button
                                        key={color.value}
                                        onClick={() => handleColorChange(color.value)}
                                        className={`w-8 h-8 rounded border-2 cursor-pointer transition-all hover:scale-110 relative ${brushColor === color.value ? 'border-black ring-2 ring-offset-2 ring-white' : 'border-gray-600'
                                            }`}
                                        style={{ backgroundColor: color.value }}
                                        title={color.label}
                                        aria-label={color.label}
                                    >
                                        {brushColor === color.value && (
                                            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="h-4 w-4 text-black drop-shadow"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={3}
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Button onClick={onSaveCanvas} variant="outline" size="sm" title={`Save ${currentStageId}`}>
                        <span className="lg:hidden" aria-hidden="true"><Save className="h-4 w-4" /></span>
                        <span className="hidden lg:inline">Save {currentStageId}</span>
                    </Button>
                    <Button
                        onClick={onToggleFieldOrientation}
                        variant="outline"
                        size="sm"
                        title={isFieldRotated ? "Reset field orientation" : "Rotate field 180°"}
                    >
                        <RotateCw className={`h-4 w-4 ${isFieldRotated ? 'rotate-180' : ''}`} />
                        <span className="hidden lg:inline">
                            {isFieldRotated ? 'Reset Rotation' : 'Rotate 180°'}
                        </span>
                    </Button>
                    <Button onClick={onToggleFullscreen} variant="outline" size="sm" title="Fullscreen">
                        <Maximize2 className="h-4 w-4 lg:mr-2" />
                        <span className="hidden lg:inline">Fullscreen</span>
                    </Button>
                </div>
            </div>
        </div>
    );
};

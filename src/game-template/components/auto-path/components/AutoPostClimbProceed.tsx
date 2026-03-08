/**
 * AutoPostClimbProceed Component
 * 
 * Confirmation popup shown after climb action to proceed to next phase.
 * Extracted from AutoPathTracker for better organization.
 */

import { Button } from '@/core/components/ui/button';
import { Card, CardHeader, CardTitle, CardFooter } from '@/core/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/core/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface AutoPostClimbProceedProps {
    isFieldRotated: boolean;
    onProceed: () => void;
    onStay: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AutoPostClimbProceed({
    isFieldRotated,
    onProceed,
    onStay,
}: AutoPostClimbProceedProps) {
    return (
        <div className={cn("absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm pointer-events-none p-4", isFieldRotated && "rotate-180")}>
            <Card className="w-full max-w-sm pointer-events-auto shadow-2xl animate-in zoom-in duration-300">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-2">
                        <ArrowRight className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl font-bold">Climb Recorded</CardTitle>
                    <p className="text-sm">Would you like to move to the next phase?</p>
                </CardHeader>
                <CardFooter className="flex flex-col gap-2 pt-2">
                    <Button
                        onClick={onProceed}
                        className="w-full h-12 text-base font-bold"
                    >
                        Proceed to Next
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onStay}
                        className="w-full h-10"
                    >
                        Stay on Page
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

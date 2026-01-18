import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Badge } from "@/core/components/ui/badge";
import { Separator } from "@/core/components/ui/separator";
import {
    Database,
    UserPlus,
    Trash2,
    Trophy,
    RefreshCw,
    CheckCircle,
    AlertTriangle,
    Layout
} from 'lucide-react';
import {
    generateRandomScouts,
    generateRandomScoutingData,
    generateTBAAlignedScoutingData,
    resetEntireDatabase
} from '@/core/lib/testDataGenerator';
import { backfillAchievementsForAllScouts } from '@/core/lib/achievementUtils';
import { getAllScouts } from '@/db';
import { toast } from 'sonner';

const DevUtilitiesPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

    const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
        setMessage(text);
        setMessageType(type);
        setTimeout(() => setMessage(''), 5000);
    };

    const handleCreateTestProfiles = async () => {
        setLoading(true);
        try {
            await generateRandomScouts();
            showMessage('✅ Created random scout profiles successfully!', 'success');
            toast.success('Random scout profiles created');
        } catch (error) {
            console.error('Error creating test profiles:', error);
            showMessage('❌ Failed to create test profiles', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateMatchData = async () => {
        setLoading(true);
        try {
            await generateRandomScoutingData(30);
            showMessage('✅ Generated 30 schema-based match entries!', 'success');
            toast.success('Schema-based match data generated');
        } catch (error) {
            console.error('Error generating match data:', error);
            showMessage('❌ Failed to generate match data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateTBAAlignedData = async () => {
        setLoading(true);
        try {
            const result = await generateTBAAlignedScoutingData(15);
            if (result.success) {
                showMessage(`✅ ${result.message}`, 'success');
                toast.success(result.message);
            } else {
                showMessage(`⚠️ ${result.message}`, 'error');
                toast.error(result.message);
            }
        } catch (error) {
            console.error('Error generating TBA-aligned data:', error);
            showMessage('❌ Failed to generate TBA-aligned data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClearData = async () => {
        if (!confirm('Are you absolutely sure? This will wipe ALL databases including scouting data, pits, and profiles.')) {
            return;
        }

        setLoading(true);
        try {
            await resetEntireDatabase();
            showMessage('✅ All databases cleared successfully!', 'success');
            toast.success('Database reset complete');
        } catch (error) {
            console.error('Error clearing data:', error);
            showMessage('❌ Failed to clear data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBackfillAchievements = async () => {
        setLoading(true);
        try {
            await backfillAchievementsForAllScouts();
            showMessage('✅ Achievement backfill completed!', 'success');
            toast.success('Achievements backfilled for all scouts');
        } catch (error) {
            console.error('Error during achievement backfill:', error);
            showMessage('❌ Achievement backfill failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckCurrentData = async () => {
        setLoading(true);
        try {
            const scouts = await getAllScouts();
            showMessage(`📊 Current database has ${scouts.length} scouts`, 'info');
        } catch (error) {
            console.error('Error checking data:', error);
            showMessage('❌ Failed to check current data', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen container mx-auto px-4 pt-12 pb-24 space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Agnostic Dev Utilities</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Framework-level tools for testing and managing scouting data
                </p>
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                    Development Only
                </Badge>
            </div>

            {message && (
                <Card className={`border-2 ${messageType === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-950' :
                    messageType === 'error' ? 'border-red-500 bg-red-50 dark:bg-red-950' :
                        'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    }`}>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            {messageType === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
                            {messageType === 'error' && <AlertTriangle className="h-5 w-5 text-red-600" />}
                            {messageType === 'info' && <Database className="h-5 w-5 text-blue-600" />}
                            <span className={
                                messageType === 'success' ? 'text-green-800 dark:text-green-200' :
                                    messageType === 'error' ? 'text-red-800 dark:text-red-200' :
                                        'text-blue-800 dark:text-blue-200'
                            }>
                                {message}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Gamification Testing */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5" />
                            Gamification Tools
                        </CardTitle>
                        <CardDescription>
                            Test scout profiles, predictions, and achievements
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            onClick={handleCreateTestProfiles}
                            disabled={loading}
                            className="w-full"
                            size="lg"
                        >
                            <UserPlus className="h-4 w-4 mr-2" />
                            {loading ? 'Generating...' : 'Generate Random Scouts'}
                        </Button>

                        <Button
                            onClick={handleBackfillAchievements}
                            disabled={loading}
                            className="w-full"
                            variant="outline"
                            size="lg"
                        >
                            <Trophy className="h-4 w-4 mr-2" />
                            {loading ? 'Processing...' : 'Backfill Achievements'}
                        </Button>
                    </CardContent>
                </Card>

                {/* Scouting Data Testing */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Layout className="h-5 w-5" />
                            Scouting Data Tools
                        </CardTitle>
                        <CardDescription>
                            Test match scouting entries using current game schema
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            onClick={handleGenerateMatchData}
                            disabled={loading}
                            className="w-full"
                            size="lg"
                            variant="secondary"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            {loading ? 'Generating...' : 'Generate Schema Data'}
                        </Button>

                        <Button
                            onClick={handleGenerateTBAAlignedData}
                            disabled={loading}
                            className="w-full"
                            size="lg"
                            variant="default"
                        >
                            <Database className="h-4 w-4 mr-2" />
                            {loading ? 'Generating...' : 'Generate TBA Match Data'}
                        </Button>

                        <p className="text-xs text-gray-500 italic">
                            * TBA Match Data uses current event to create scouting entries for real matches (for validation testing).
                        </p>
                    </CardContent>
                </Card>

                {/* Database Management */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            Database Management
                        </CardTitle>
                        <CardDescription>
                            Clean up and inspect local storage
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            onClick={handleClearData}
                            disabled={loading}
                            variant="destructive"
                            className="w-full"
                            size="lg"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {loading ? 'Clearing...' : 'Reset All Databases'}
                        </Button>

                        <Separator />

                        <Button
                            onClick={handleCheckCurrentData}
                            disabled={loading}
                            variant="outline"
                            className="w-full"
                        >
                            <Database className="h-4 w-4 mr-2" />
                            {loading ? 'Checking...' : 'Check DB Stats'}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Manual Console Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Global Test Hooks</CardTitle>
                    <CardDescription>
                        Exposed on window for console testing
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 text-sm font-mono bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                        <div className="text-blue-600 dark:text-blue-400"># Reset everything</div>
                        <div>await window.dev.resetDB()</div>
                        <div className="text-blue-600 dark:text-blue-400 mt-3"># Generate data</div>
                        <div>await window.dev.seedData()</div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default DevUtilitiesPage;

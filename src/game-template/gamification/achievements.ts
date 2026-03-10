import { Achievement, AchievementTierStyles } from '@/core/types/achievements';

// Achievement tier styling - defined here so teams can customize colors
export const ACHIEVEMENT_TIERS: AchievementTierStyles = {
    bronze: {
        color: '#CD7F32',
        bgColor: 'bg-amber-100 dark:bg-amber-950',
        borderColor: 'border-amber-300 dark:border-amber-700',
        textColor: 'text-amber-800 dark:text-amber-200'
    },
    silver: {
        color: '#C0C0C0',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-600',
        textColor: 'text-gray-800 dark:text-gray-200'
    },
    gold: {
        color: '#FFD700',
        bgColor: 'bg-yellow-100 dark:bg-yellow-950',
        borderColor: 'border-yellow-300 dark:border-yellow-700',
        textColor: 'text-yellow-800 dark:text-yellow-200'
    },
    platinum: {
        color: '#E5E4E2',
        bgColor: 'bg-blue-100 dark:bg-blue-950',
        borderColor: 'border-blue-300 dark:border-blue-700',
        textColor: 'text-blue-800 dark:text-blue-200'
    },
    legendary: {
        color: '#9932CC',
        bgColor: 'bg-purple-100 dark:bg-purple-950',
        borderColor: 'border-purple-300 dark:border-purple-700',
        textColor: 'text-purple-800 dark:text-purple-200'
    }
} as const;

// Achievement definitions
export const ACHIEVEMENT_DEFINITIONS: Achievement[] = [
    // Volume Achievements
    {
        id: 'first_prediction',
        name: 'Scout Rookie',
        description: 'Make your first prediction',
        icon: '🎯',
        category: 'volume',
        tier: 'bronze',
        requirements: { type: 'minimum', value: 1, property: 'totalPredictions' },
        stakesReward: 5
    },
    {
        id: 'predictions_10',
        name: 'Getting Started',
        description: 'Make 10 predictions',
        icon: '📊',
        category: 'volume',
        tier: 'bronze',
        requirements: { type: 'minimum', value: 10, property: 'totalPredictions' },
        stakesReward: 10
    },
    {
        id: 'predictions_50',
        name: 'Active Scout',
        description: 'Make 50 predictions',
        icon: '📈',
        category: 'volume',
        tier: 'silver',
        requirements: { type: 'minimum', value: 50, property: 'totalPredictions' },
        stakesReward: 25
    },
    {
        id: 'predictions_100',
        name: 'Dedicated Scout',
        description: 'Make 100 predictions',
        icon: '💪',
        category: 'volume',
        tier: 'gold',
        requirements: { type: 'minimum', value: 100, property: 'totalPredictions' },
        stakesReward: 50
    },
    {
        id: 'predictions_200',
        name: 'Scout Veteran',
        description: 'Make 200 predictions',
        icon: '🏆',
        category: 'volume',
        tier: 'platinum',
        requirements: { type: 'minimum', value: 200, property: 'totalPredictions' },
        stakesReward: 100
    },
    {
        id: 'predictions_300',
        name: 'Scout Legend',
        description: 'Make 300 predictions',
        icon: '👑',
        category: 'volume',
        tier: 'legendary',
        requirements: { type: 'minimum', value: 300, property: 'totalPredictions' },
        stakesReward: 200
    },

    // Accuracy Achievements
    {
        id: 'accuracy_60',
        name: 'Sharp Eye',
        description: 'Achieve 60% accuracy with at least 10 predictions',
        icon: '🎯',
        category: 'accuracy',
        tier: 'bronze',
        requirements: {
            type: 'custom',
            value: 60,
            customCheck: (scout) => scout.totalPredictions >= 10 && (scout.correctPredictions / scout.totalPredictions * 100) >= 60
        },
        stakesReward: 20
    },
    {
        id: 'accuracy_70',
        name: 'Scout Sharpshooter',
        description: 'Achieve 70% accuracy with at least 20 predictions',
        icon: '🏹',
        category: 'accuracy',
        tier: 'silver',
        requirements: {
            type: 'custom',
            value: 70,
            customCheck: (scout) => scout.totalPredictions >= 20 && (scout.correctPredictions / scout.totalPredictions * 100) >= 70
        },
        stakesReward: 40
    },
    {
        id: 'accuracy_80',
        name: 'Oracle',
        description: 'Achieve 80% accuracy with at least 30 predictions',
        icon: '🔮',
        category: 'accuracy',
        tier: 'gold',
        requirements: {
            type: 'custom',
            value: 80,
            customCheck: (scout) => scout.totalPredictions >= 30 && (scout.correctPredictions / scout.totalPredictions * 100) >= 80
        },
        stakesReward: 75
    },
    {
        id: 'accuracy_85',
        name: 'Prophet',
        description: 'Achieve 85% accuracy with at least 50 predictions',
        icon: '✨',
        category: 'accuracy',
        tier: 'platinum',
        requirements: {
            type: 'custom',
            value: 85,
            customCheck: (scout) => scout.totalPredictions >= 50 && (scout.correctPredictions / scout.totalPredictions * 100) >= 85
        },
        stakesReward: 150
    },

    // Streak Achievements
    {
        id: 'streak_3',
        name: 'Hot Streak',
        description: 'Get 3 predictions correct in a row',
        icon: '🔥',
        category: 'streaks',
        tier: 'bronze',
        requirements: { type: 'minimum', value: 3, property: 'longestStreak' },
        stakesReward: 15
    },
    {
        id: 'streak_5',
        name: 'On Fire',
        description: 'Get 5 predictions correct in a row',
        icon: '🔥🔥',
        category: 'streaks',
        tier: 'silver',
        requirements: { type: 'minimum', value: 5, property: 'longestStreak' },
        stakesReward: 30
    },
    {
        id: 'streak_10',
        name: 'Unstoppable',
        description: 'Get 10 predictions correct in a row',
        icon: '🔥🔥🔥',
        category: 'streaks',
        tier: 'gold',
        requirements: { type: 'minimum', value: 10, property: 'longestStreak' },
        stakesReward: 60
    },
    {
        id: 'streak_20',
        name: 'Legendary Streak',
        description: 'Get 20 predictions correct in a row',
        icon: '⚡',
        category: 'streaks',
        tier: 'platinum',
        requirements: { type: 'minimum', value: 20, property: 'longestStreak' },
        stakesReward: 120
    },
    {
        id: 'streak_50',
        name: 'Godlike',
        description: 'Get 50 predictions correct in a row',
        icon: '👑⚡',
        category: 'streaks',
        tier: 'legendary',
        requirements: { type: 'minimum', value: 50, property: 'longestStreak' },
        stakesReward: 300
    },

    // Stakes from Predictions Achievements
    {
        id: 'stakes_100',
        name: 'Stake Builder',
        description: 'Earn 100 stakes from predictions',
        icon: '💰',
        category: 'volume',
        tier: 'bronze',
        requirements: { type: 'minimum', value: 100, property: 'stakesFromPredictions' },
        stakesReward: 20
    },
    {
        id: 'stakes_300',
        name: 'Stake Master',
        description: 'Earn 300 stakes from predictions',
        icon: '💎',
        category: 'volume',
        tier: 'silver',
        requirements: { type: 'minimum', value: 300, property: 'stakesFromPredictions' },
        stakesReward: 50
    },
    {
        id: 'stakes_600',
        name: 'Stake Tycoon',
        description: 'Earn 600 stakes from predictions',
        icon: '💍',
        category: 'volume',
        tier: 'gold',
        requirements: { type: 'minimum', value: 600, property: 'stakesFromPredictions' },
        stakesReward: 100
    },
    {
        id: 'stakes_1000',
        name: 'Stake Emperor',
        description: 'Earn 1000 stakes from predictions',
        icon: '👑💎',
        category: 'volume',
        tier: 'platinum',
        requirements: { type: 'minimum', value: 1000, property: 'stakesFromPredictions' },
        stakesReward: 200
    },

    // Commentary Achievements
    {
        id: 'comments_5',
        name: 'Debrief Starter',
        description: 'Submit 5 detailed match comments',
        icon: '📝',
        category: 'special',
        tier: 'bronze',
        requirements: { type: 'minimum', value: 5, property: 'detailedCommentsCount' },
        stakesReward: 15
    },
    {
        id: 'comments_20',
        name: 'Field Reporter',
        description: 'Submit 20 detailed match comments',
        icon: '📓',
        category: 'special',
        tier: 'silver',
        requirements: { type: 'minimum', value: 20, property: 'detailedCommentsCount' },
        stakesReward: 40
    },
    {
        id: 'comments_50',
        name: 'Robot Storyteller',
        description: 'Submit 50 detailed match comments',
        icon: '📚',
        category: 'special',
        tier: 'gold',
        requirements: { type: 'minimum', value: 50, property: 'detailedCommentsCount' },
        stakesReward: 90
    },

    // Special Achievements
    {
        id: 'perfectionist',
        name: 'Perfectionist',
        description: 'Get 5 consecutive predictions correct',
        icon: '💯',
        category: 'special',
        tier: 'gold',
        requirements: {
            type: 'minimum',
            value: 12,
            property: 'longestStreak'
        },
        stakesReward: 100,
        hidden: true
    },
    {
        id: 'high_roller',
        name: 'High Roller',
        description: 'Earn 1000 total stakes (predictions + achievements)',
        icon: '💍',
        category: 'special',
        tier: 'platinum',
        requirements: {
            type: 'minimum',
            value: 1000,
            property: 'stakesFromPredictions'
        },
        stakesReward: 200,
        hidden: true
    },
    {
        id: 'steady_hand',
        name: 'Steady Hand',
        description: 'Maintain 75% accuracy with at least 40 predictions',
        icon: '🎯',
        category: 'special',
        tier: 'silver',
        requirements: {
            type: 'custom',
            value: 75,
            customCheck: (scout) => scout.totalPredictions >= 40 && (scout.correctPredictions / scout.totalPredictions * 100) >= 75
        },
        stakesReward: 75,
        hidden: true
    }
];

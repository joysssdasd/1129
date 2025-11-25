// Invitation Statistics Component
import { useState, useEffect } from 'react';
import { Users, Gift, TrendingUp, Share2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import ShareModal from './ui/ShareModal';

interface InvitationStats {
    inviteCode: string;
    invitationLink: string;
    statistics: {
        totalInvites: number;
        successfulInvites: number;
        pendingInvites: number;
        totalPointsEarned: number;
    };
}

export default function InvitationStatistics() {
    const [stats, setStats] = useState<InvitationStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showShareModal, setShowShareModal] = useState(false);

    useEffect(() => {
        fetchInvitationInfo();
    }, []);

    const fetchInvitationInfo = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.functions.invoke('get-invitation-info');

            if (error) throw error;

            if (data?.data) {
                setStats(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch invitation info:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="h-20 bg-gray-200 rounded"></div>
                        <div className="h-20 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!stats) {
        return null;
    }

    return (
        <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Users className="w-6 h-6 text-blue-600" />
                        Invitation Rewards
                    </h2>
                    <button
                        onClick={() => setShowShareModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Share2 className="w-4 h-4" />
                        Invite Friends
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="w-5 h-5 text-blue-600" />
                            <div className="text-xs text-gray-600">Total Invites</div>
                        </div>
                        <div className="text-2xl font-bold text-blue-600">
                            {stats.statistics.totalInvites}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                            <div className="text-xs text-gray-600">Successful</div>
                        </div>
                        <div className="text-2xl font-bold text-green-600">
                            {stats.statistics.successfulInvites}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="w-5 h-5 text-yellow-600" />
                            <div className="text-xs text-gray-600">Pending</div>
                        </div>
                        <div className="text-2xl font-bold text-yellow-600">
                            {stats.statistics.pendingInvites}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <Gift className="w-5 h-5 text-purple-600" />
                            <div className="text-xs text-gray-600">Points Earned</div>
                        </div>
                        <div className="text-2xl font-bold text-purple-600">
                            {stats.statistics.totalPointsEarned}
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 p-6 rounded-lg border border-blue-200">
                    <div className="text-center mb-4">
                        <div className="text-sm text-gray-600 mb-2">Your Invitation Code</div>
                        <div className="text-3xl font-bold text-blue-600 mb-4">
                            {stats.inviteCode}
                        </div>
                    </div>

                    <div className="bg-white bg-opacity-80 p-4 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-3">How it works:</div>
                        <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-start gap-2">
                                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                    1
                                </div>
                                <div>Share your invitation link or code with friends</div>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                    2
                                </div>
                                <div>They register using your invitation code</div>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                    3
                                </div>
                                <div>You get 10 points, they get 30 points!</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ShareModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                invitationLink={stats.invitationLink}
                inviteCode={stats.inviteCode}
            />
        </>
    );
}

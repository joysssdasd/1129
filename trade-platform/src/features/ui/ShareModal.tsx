// Share Modal Component for Invitation System
import React, { useState } from 'react';
import { X, Copy, Share2, Check } from 'lucide-react';
import { log } from '../../utils/logger';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    invitationLink: string;
    inviteCode: string;
}

function ShareModal({ isOpen, onClose, invitationLink, inviteCode }: ShareModalProps) {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(invitationLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            log.error('Failed to copy:', error);
        }
    };

    const handleShareToWechat = () => {
        // WeChat share implementation (requires WeChat JS SDK)
        alert('Please copy the link and share it in WeChat');
        handleCopyLink();
    };

    const handleShareToQQ = () => {
        // QQ share implementation
        const qqShareUrl = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(invitationLink)}&title=${encodeURIComponent('Join Niuniu Trading Platform')}&summary=${encodeURIComponent('Use my invite code: ' + inviteCode)}`;
        window.open(qqShareUrl, '_blank');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Share2 className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Invite Friends</h2>
                    <p className="text-gray-600">Share your invitation link and earn rewards!</p>
                </div>

                <div className="mb-6">
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg mb-4">
                        <div className="text-center">
                            <div className="text-sm text-gray-600 mb-1">Your Invitation Code</div>
                            <div className="text-3xl font-bold text-blue-600">{inviteCode}</div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600 mb-2">Invitation Link</div>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={invitationLink}
                                readOnly
                                className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-sm"
                            />
                            <button
                                onClick={handleCopyLink}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        <span>Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        <span>Copy</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mb-6">
                    <div className="text-sm font-medium text-gray-700 mb-3">Share to:</div>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={handleShareToWechat}
                            className="border border-gray-300 rounded-lg py-3 hover:bg-gray-50 flex items-center justify-center gap-2"
                        >
                            <div className="w-6 h-6 bg-green-500 rounded-full"></div>
                            <span>WeChat</span>
                        </button>
                        <button
                            onClick={handleShareToQQ}
                            className="border border-gray-300 rounded-lg py-3 hover:bg-gray-50 flex items-center justify-center gap-2"
                        >
                            <div className="w-6 h-6 bg-blue-500 rounded-full"></div>
                            <span>QQ</span>
                        </button>
                    </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="text-sm text-gray-700">
                        <div className="font-medium mb-2">Reward Rules:</div>
                        <ul className="space-y-1 text-xs">
                            <li>You get 10 points for each successful invitation</li>
                            <li>Your friend gets 30 points upon registration</li>
                            <li>Earn unlimited rewards!</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default React.memo(ShareModal)

// Generate invitation link and get invitation statistics
Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Max-Age': '86400',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabase configuration missing');
        }

        // Get user from auth header
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('No authorization header');
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify token and get user
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': serviceRoleKey
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid token');
        }

        const userData = await userResponse.json();
        const userId = userData.id;

        // Get user info
        const userInfoResponse = await fetch(
            `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=*`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                }
            }
        );

        if (!userInfoResponse.ok) {
            throw new Error('Failed to fetch user info');
        }

        const users = await userInfoResponse.json();
        if (!users || users.length === 0) {
            throw new Error('User not found');
        }

        const user = users[0];

        // Get invitation statistics
        const invitationsResponse = await fetch(
            `${supabaseUrl}/rest/v1/invitations?inviter_code=eq.${user.invite_code}&select=*`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                }
            }
        );

        const invitations = await invitationsResponse.json() || [];

        // Count successful invitations (where reward was sent)
        const successfulInvites = invitations.filter(inv => inv.reward_sent).length;
        const pendingInvites = invitations.filter(inv => !inv.reward_sent).length;

        // Get points earned from invitations
        const pointsResponse = await fetch(
            `${supabaseUrl}/rest/v1/point_transactions?user_id=eq.${userId}&change_type=eq.4&select=*`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                }
            }
        );

        const pointTransactions = await pointsResponse.json() || [];
        const totalPointsEarned = pointTransactions.reduce((sum, tx) => sum + tx.change_amount, 0);

        // Generate invitation link
        const baseUrl = req.headers.get('origin') || 'https://hezts70cj2m9.space.minimaxi.com';
        const invitationLink = `${baseUrl}/login?invite=${user.invite_code}`;

        return new Response(JSON.stringify({
            data: {
                inviteCode: user.invite_code,
                invitationLink,
                statistics: {
                    totalInvites: user.total_invites || 0,
                    successfulInvites,
                    pendingInvites,
                    totalPointsEarned
                }
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({
            error: {
                code: 'INVITATION_ERROR',
                message: error.message
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

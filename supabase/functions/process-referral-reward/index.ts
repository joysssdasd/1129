// Process referral rewards when new user registers
Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const { inviterCode, newUserId } = await req.json();

        if (!inviterCode || !newUserId) {
            throw new Error('Inviter code and new user ID are required');
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabase configuration missing');
        }

        // Find inviter by invite code
        const inviterResponse = await fetch(
            `${supabaseUrl}/rest/v1/users?invite_code=eq.${inviterCode}&select=*`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                }
            }
        );

        const inviters = await inviterResponse.json();
        if (!inviters || inviters.length === 0) {
            throw new Error('Inviter not found');
        }

        const inviter = inviters[0];

        // Check if invitation already processed
        const existingInvitationResponse = await fetch(
            `${supabaseUrl}/rest/v1/invitations?inviter_code=eq.${inviterCode}&invitee_id=eq.${newUserId}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                }
            }
        );

        const existingInvitations = await existingInvitationResponse.json();
        if (existingInvitations && existingInvitations.length > 0) {
            return new Response(JSON.stringify({
                data: { message: 'Invitation already processed' }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Create invitation record
        const invitationData = {
            inviter_code: inviterCode,
            invitee_id: newUserId,
            has_posted: false,
            reward_sent: false
        };

        await fetch(`${supabaseUrl}/rest/v1/invitations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(invitationData)
        });

        // Award points: Inviter gets 10, Invitee gets 30
        const now = new Date().toISOString();

        // Award inviter
        await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${inviter.id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                points: inviter.points + 10,
                total_invites: (inviter.total_invites || 0) + 1
            })
        });

        // Record inviter's point transaction
        await fetch(`${supabaseUrl}/rest/v1/point_transactions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                user_id: inviter.id,
                change_type: 4, // Invitation reward
                change_amount: 10,
                description: 'Invite new user reward'
            })
        });

        // Award invitee
        const inviteeResponse = await fetch(
            `${supabaseUrl}/rest/v1/users?id=eq.${newUserId}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                }
            }
        );

        const invitees = await inviteeResponse.json();
        const invitee = invitees[0];

        await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${newUserId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                points: invitee.points + 30,
                invited_by: inviterCode
            })
        });

        // Record invitee's point transaction
        await fetch(`${supabaseUrl}/rest/v1/point_transactions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                user_id: newUserId,
                change_type: 4, // Invitation reward
                change_amount: 30,
                description: 'New user registration reward'
            })
        });

        // Update invitation record
        await fetch(
            `${supabaseUrl}/rest/v1/invitations?inviter_code=eq.${inviterCode}&invitee_id=eq.${newUserId}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    reward_sent: true,
                    completed_at: now
                })
            }
        );

        return new Response(JSON.stringify({
            data: {
                message: 'Referral rewards processed successfully',
                inviterReward: 10,
                inviteeReward: 30
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({
            error: {
                code: 'REFERRAL_PROCESSING_ERROR',
                message: error.message
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

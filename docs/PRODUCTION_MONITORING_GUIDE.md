# Production Monitoring Guide
**Platform**: Niuniu C2C Trading Platform  
**Deployment URL**: https://qd4xeejgqgtk.space.minimaxi.com  
**Monitoring Period**: 24-48 hours post-deployment  
**Created**: 2025-11-16

## Overview
This guide outlines monitoring strategies for the two newly deployed features:
1. **User Referral/Invitation System**
2. **Data Analytics Dashboard with K-line Charts**

---

## 1. Invitation System Monitoring

### Key Metrics to Track

#### A. Registration Conversion Rate
**What to monitor**:
- Total visits to invitation links (URLs with `?invite=CODE` parameter)
- Successful registrations using invitation codes
- Conversion rate = (Successful invites / Total invite link clicks) × 100%

**How to check**:
```sql
-- Check invitation statistics
SELECT 
    i.inviter_id,
    u.phone as inviter_phone,
    COUNT(*) as total_invitations,
    COUNT(CASE WHEN i.reward_status = 'completed' THEN 1 END) as successful_invites,
    ROUND(COUNT(CASE WHEN i.reward_status = 'completed' THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as conversion_rate
FROM invitations i
JOIN users u ON i.inviter_id = u.id
WHERE i.created_at > NOW() - INTERVAL '24 hours'
GROUP BY i.inviter_id, u.phone
ORDER BY total_invitations DESC;
```

#### B. Points Distribution Accuracy
**Expected behavior**:
- Inviter receives: +10 points
- Invitee receives: +30 points (bonus on top of base 100)
- Total points after registration: Invitee = 130, Inviter = Previous + 10

**Verification query**:
```sql
-- Verify recent invitation rewards
SELECT 
    i.id as invitation_id,
    i.created_at,
    inviter.phone as inviter_phone,
    inviter.points as inviter_current_points,
    invitee.phone as invitee_phone,
    invitee.points as invitee_current_points,
    i.reward_status,
    i.reward_distributed_at
FROM invitations i
JOIN users inviter ON i.inviter_id = inviter.id
JOIN users invitee ON i.invitee_id = invitee.id
WHERE i.created_at > NOW() - INTERVAL '24 hours'
ORDER BY i.created_at DESC;
```

**Check point transaction records**:
```sql
-- Verify point transaction logs
SELECT 
    pt.id,
    pt.created_at,
    u.phone,
    pt.change_type,
    pt.points,
    pt.description
FROM point_transactions pt
JOIN users u ON pt.user_id = u.id
WHERE pt.change_type IN (9, 10)  -- 9=invited bonus, 10=inviter reward
  AND pt.created_at > NOW() - INTERVAL '24 hours'
ORDER BY pt.created_at DESC;
```

#### C. Anti-Fraud Detection
**Monitor for suspicious patterns**:
- Multiple invitations from same device fingerprint
- Rapid succession registrations (potential bot activity)
- Same IP address for multiple invitees

**Detection query**:
```sql
-- Check for duplicate device fingerprints
SELECT 
    device_fingerprint,
    COUNT(DISTINCT id) as account_count,
    array_agg(phone) as phone_numbers,
    array_agg(created_at) as registration_times
FROM users
WHERE device_fingerprint IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY device_fingerprint
HAVING COUNT(DISTINCT id) > 1
ORDER BY account_count DESC;

-- Check for rapid registrations from same IP
SELECT 
    register_ip,
    COUNT(*) as registration_count,
    array_agg(phone) as phones,
    MIN(created_at) as first_registration,
    MAX(created_at) as last_registration,
    EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 60 as time_span_minutes
FROM users
WHERE register_ip IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY register_ip
HAVING COUNT(*) > 3
ORDER BY registration_count DESC;
```

---

## 2. Data Analytics Dashboard Monitoring

### Key Metrics to Track

#### A. Loading Performance
**What to monitor**:
- Edge Function response time for `get-keyword-analytics`
- Chart rendering time in browser
- Data volume returned (number of data points)

**How to check via Supabase Logs**:
1. Go to Supabase Dashboard → Edge Functions → Logs
2. Filter for `get-keyword-analytics` function
3. Check response times in log entries
4. Expected response time: < 3 seconds for 180-day queries

**Manual performance test**:
```bash
# Test analytics API response time
time curl -X POST 'https://mgyelmyjeidlvmmmjkqi.supabase.co/functions/v1/get-keyword-analytics' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"keyword": "iPhone", "days": 180}'
```

#### B. Query Response Time Analysis
**Benchmark expectations**:
- 7 days data: < 500ms
- 30 days data: < 1s
- 90 days data: < 2s
- 180 days data: < 3s

**Check aggregate function performance**:
```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM aggregate_keyword_prices('iPhone', 180);

-- Check data volume
SELECT 
    COUNT(*) as total_posts,
    COUNT(DISTINCT keyword) as unique_keywords,
    MIN(created_at) as earliest_post,
    MAX(created_at) as latest_post
FROM posts
WHERE status = 1;
```

#### C. Data Accuracy Verification
**Verify OHLC calculations**:
```sql
-- Sample verification for a specific keyword on a specific date
SELECT 
    keyword,
    date,
    open,
    high,
    low,
    close,
    volume
FROM aggregate_keyword_prices('iPhone', 7)
WHERE keyword = 'iPhone'
ORDER BY date DESC
LIMIT 5;

-- Cross-check with raw data
SELECT 
    keyword,
    DATE(created_at) as date,
    MIN(price) as actual_low,
    MAX(price) as actual_high,
    COUNT(*) as actual_volume
FROM posts
WHERE keyword = 'iPhone'
  AND created_at > NOW() - INTERVAL '7 days'
  AND status = 1
GROUP BY keyword, DATE(created_at)
ORDER BY date DESC
LIMIT 5;
```

---

## 3. Mobile User Experience Monitoring

### Manual Testing Checklist

#### Invitation System (Mobile)
- [ ] Share modal displays correctly on mobile screens
- [ ] Copy invite link button works on iOS/Android
- [ ] Invite link opens correctly in mobile browsers
- [ ] Registration form pre-fills invite code parameter
- [ ] Invitation statistics cards are responsive
- [ ] QR code generation works for WeChat sharing

#### Analytics Dashboard (Mobile)
- [ ] K-line chart renders properly on small screens
- [ ] Time range selector buttons are touchable (min 44x44px)
- [ ] Chart pinch-to-zoom works (if enabled)
- [ ] Keyword filter dropdown functions correctly
- [ ] CSV export triggers download on mobile
- [ ] Chart tooltips display without overflow

### Browser Compatibility Testing
Test on:
- [ ] iOS Safari (latest)
- [ ] Android Chrome (latest)
- [ ] WeChat In-App Browser
- [ ] QQ Browser

---

## 4. Error Monitoring

### Check Supabase Logs
**Where to check**: Supabase Dashboard → Logs → Edge Function Logs

**What to look for**:
1. **HTTP 500 errors** - Server-side failures
2. **HTTP 400 errors** - Invalid request parameters
3. **HTTP 401/403 errors** - Authentication issues
4. **Timeout errors** - Performance problems

**Filter by function**:
- `get-invitation-info`
- `process-referral-reward`
- `get-keyword-analytics`
- `register-with-password`

### Frontend Error Monitoring
**Add console logging** (already implemented):
- Check browser console for errors during:
  - Sharing invitation links
  - Viewing invitation statistics
  - Loading K-line charts
  - Filtering chart data

---

## 5. User Feedback Collection

### Create Feedback Channels
**Option 1: Simple database table**
```sql
-- Create feedback table (optional)
CREATE TABLE user_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    feature VARCHAR(50),  -- 'invitation' or 'analytics'
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Option 2: Monitor support channels**
- Check WeChat group messages
- Review customer service tickets
- Monitor app store reviews (if applicable)

---

## 6. Automated Monitoring Setup (Optional)

### Option A: Supabase Cron Job for Daily Reports
Create a daily monitoring edge function:

```typescript
// supabase/functions/daily-monitoring-report/index.ts
Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Gather metrics
  const { data: invitationStats } = await supabase
    .from('invitations')
    .select('*')
    .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString());
  
  const report = {
    date: new Date().toISOString(),
    invitations: {
      total: invitationStats?.length || 0,
      successful: invitationStats?.filter(i => i.reward_status === 'completed').length || 0
    }
  };
  
  // Send report via email or SMS (integrate with your notification service)
  console.log('Daily Report:', report);
  
  return new Response(JSON.stringify(report), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### Option B: Third-Party APM Tools
Consider integrating:
- **Sentry** - Error tracking and performance monitoring
- **LogRocket** - Session replay and frontend monitoring
- **Google Analytics** - User behavior tracking

---

## 7. Quick Health Check Commands

### Daily Morning Check (5 minutes)
```sql
-- 1. Check invitation activity (last 24h)
SELECT COUNT(*) as new_invitations FROM invitations 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 2. Check points distribution (last 24h)
SELECT 
    change_type,
    COUNT(*) as transaction_count,
    SUM(points) as total_points_moved
FROM point_transactions
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND change_type IN (9, 10)
GROUP BY change_type;

-- 3. Check analytics API usage (from logs)
-- Go to Supabase Dashboard → Edge Functions → get-keyword-analytics → Logs

-- 4. Check for errors
-- Go to Supabase Dashboard → Logs → Filter by "error" or "500"
```

### Weekly Deep Dive (30 minutes)
- Review conversion rates by day
- Analyze most popular keywords for analytics
- Check for fraudulent invitation patterns
- Review Edge Function performance trends
- Test mobile experience on real devices

---

## 8. Success Criteria

### Invitation System
✅ **Healthy metrics**:
- Conversion rate > 20%
- 0 failed reward distributions
- < 5% duplicate device fingerprints
- Average invite link click-to-registration time < 5 minutes

⚠️ **Warning signs**:
- Conversion rate < 10%
- Multiple failed reward transactions
- > 20% duplicate device fingerprints
- Spike in registrations from single IP

### Analytics Dashboard
✅ **Healthy metrics**:
- Edge Function response time < 3s (95th percentile)
- 0 timeout errors
- Chart loads successfully on mobile (100% success rate)
- Data accuracy matches raw database queries

⚠️ **Warning signs**:
- Response time > 5s consistently
- HTTP 500 errors > 1% of requests
- Mobile users report broken charts
- Data discrepancies in OHLC values

---

## 9. Troubleshooting Guide

### Issue: Invitation rewards not distributed
**Diagnosis**:
```sql
SELECT * FROM invitations 
WHERE reward_status = 'pending' 
ORDER BY created_at DESC 
LIMIT 10;
```

**Possible causes**:
1. Edge Function error - Check Supabase logs
2. Insufficient points for inviter
3. Duplicate invitation code usage

**Fix**: Re-run reward distribution manually if needed

### Issue: K-line chart not loading
**Diagnosis**:
1. Open browser DevTools → Network tab
2. Look for failed request to `get-keyword-analytics`
3. Check response status and error message

**Possible causes**:
1. No data for selected keyword/timeframe
2. Edge Function timeout (> 30s)
3. Invalid authentication token

**Fix**: Check Edge Function logs, verify data exists, test with smaller timeframe

---

## Contact Information
**For urgent issues**:
- Review Supabase Dashboard logs immediately
- Check browser console for frontend errors
- Test with the provided test accounts

**Test Accounts** (already created):
- Inviter: Phone 13900000999, Password: Test123456 (110 points, invite code: AHSEKQ)
- Invitee: Phone 13900000888, Password: Test123456 (130 points)
- Admin: Phone 13011319329, SMS code: 999999

**Deployment URL**: https://qd4xeejgqgtk.space.minimaxi.com

---

## Next Steps
1. ✅ Review this monitoring guide
2. ⏳ Execute "Daily Morning Check" queries for first 3 days
3. ⏳ Monitor Supabase Edge Function logs daily
4. ⏳ Test mobile experience on real devices
5. ⏳ Collect user feedback through support channels
6. ⏳ Review weekly performance metrics
7. ⏳ Provide WeChat OAuth credentials when ready (optional)

---

**Last Updated**: 2025-11-16  
**Monitoring Start Date**: 2025-11-16  
**Next Review**: 2025-11-17

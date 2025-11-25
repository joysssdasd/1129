# New Features Summary - User Guide

## Overview
Two major features have been added to the Niuniu Trading Platform:
1. **User Referral & Invitation System** - Earn rewards by inviting friends
2. **Data Analytics Dashboard** - Professional price trend analysis for admins

---

## Feature 1: User Referral System

### How to Use (For Users):

#### Invite Friends:
1. Log in to your account
2. Go to "Personal Center" (Profile page)
3. Click on "Invitation Rewards" button or tab
4. Click "Invite Friends" button
5. Share your unique invitation link via:
   - WeChat
   - QQ
   - Copy link manually

#### Your Invitation Code:
- Located in Personal Center overview section
- Unique 6-character code (e.g., "ABC123")
- Friends can enter this code during registration

#### Rewards:
- **When you invite someone**: You get 10 points
- **When someone uses your code**: They get 30 bonus points (130 total)
- Track your earnings in the "Invitation Rewards" section

### How Your Friends Register:
1. Click your invitation link (e.g., `?invite=ABC123`)
2. System automatically fills in your invitation code
3. They complete registration
4. Both of you receive rewards instantly!

### Statistics Tracked:
- Total invites sent
- Successful invitations (completed)
- Pending invitations
- Total points earned from invitations

---

## Feature 2: Data Analytics Dashboard

### How to Use (For Admins):

#### Access the Dashboard:
1. Log in with admin credentials (13011319329)
2. Go to "Admin Panel"
3. Click on "Data Analysis" tab

#### View Price Trends:
- Professional K-line (candlestick) charts
- Shows price movements over time
- Understand market trends at a glance

#### Customize Analysis:
1. **Select Keyword**: Filter by specific keywords or view all
2. **Choose Time Range**: 
   - Last 7 days
   - Last 30 days
   - Last 90 days
   - Last 180 days

#### Chart Features:
- **Interactive Zoom**: Drag to zoom into specific periods
- **Hover for Details**: See exact prices and post counts
- **OHLC Data**: Open, High, Low, Close prices for each day
- **Volume Bars**: Number of posts per day

#### Export Data:
- Click "Export CSV" button
- Downloads data in spreadsheet format
- Contains all price information for analysis
- Filename includes keyword and date

#### Summary Statistics:
- Latest Price
- Highest Price (period)
- Lowest Price (period)
- Total Posts Count

---

## Technical Details

### For Developers:

#### Invitation System:
- **URL Parameter**: `?invite=CODE` automatically captured
- **Anti-fraud**: Device fingerprinting + IP tracking
- **Database**: New fields for WeChat login + tracking
- **API**: Three new edge functions for invitation management

#### Analytics System:
- **Real-time Mode**: Aggregates data from posts table on-the-fly
- **Snapshot Mode**: Uses pre-calculated daily snapshots (faster)
- **Chart Library**: ECharts for professional visualization
- **Export Format**: CSV with headers: Date, Open, Close, High, Low, Average, Volume

---

## New UI Elements

### Personal Center:
- ✅ New "Invitation Rewards" quick access button
- ✅ Shows invite count next to the button
- ✅ Full invitation statistics tab
- ✅ Share modal with multiple sharing options

### Admin Panel:
- ✅ New "Data Analysis" tab
- ✅ Professional K-line chart component
- ✅ Filter and export controls
- ✅ Summary statistics cards

---

## Future Enhancements (Optional)

### WeChat Login:
- WeChat OAuth integration prepared
- Requires WeChat App credentials:
  - `WECHAT_APPID`
  - `WECHAT_APPSECRET`
- Contact platform owner to enable

### Automated Price Snapshots:
- Daily aggregation function created
- Can be scheduled via cron job
- Improves analytics performance for large datasets

---

## Support

If you encounter any issues:
1. Check your internet connection
2. Refresh the page
3. Clear browser cache
4. Contact support via "Service" tab in Personal Center

## URLs
- **Production**: https://qd4xeejgqgtk.space.minimaxi.com
- **Admin Login**: Use phone 13011319329 (SMS verification)

---

**Developed by**: MiniMax Agent
**Version**: 2.2.0
**Release Date**: 2025-11-16

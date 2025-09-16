# Strava Integration Setup Guide

## 🎯 **Your Configuration:**
- **Vercel App**: `https://tempo-guide-bot.vercel.app`
- **Supabase Project**: `https://otwcyimspsqxmbwzlmjo.supabase.co`
- **Strava Client ID**: `174698`

## 🛠️ **Step 1: Update Strava App Configuration**

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Find your app with Client ID: `174698`
3. Update the **Authorization Callback Domain** to:
   ```
   otwcyimspsqxmbwzlmjo.supabase.co
   ```
4. Click **Save**

## 🧪 **Step 2: Test the New Integration**

1. **Deploy the new functions** (push to GitHub)
2. **Go to**: `https://tempo-guide-bot.vercel.app/strava-test`
3. **Click "Connect to Strava"**
4. **Authorize on Strava**
5. **Should redirect back** with success

## 🔄 **How It Works:**

```
User → Vercel App → Supabase Function → Strava → Supabase Callback → Vercel App
```

1. **User clicks "Connect"** → Vercel app calls `strava-auth-simple`
2. **Supabase generates auth URL** → Redirects to Strava
3. **User authorizes** → Strava redirects to `strava-callback-simple`
4. **Supabase processes** → Saves tokens, updates profile
5. **Redirects back** → `https://tempo-guide-bot.vercel.app/?strava=connected`

## 🐛 **If It Doesn't Work:**

1. **Check browser console** for error messages
2. **Check Supabase logs** in the dashboard
3. **Verify Strava app configuration** matches exactly
4. **Test the functions directly** using the test page

## 📝 **Next Steps:**

Once the simple integration works:
1. **Replace the old Strava components** with the new simple ones
2. **Add data fetching** functionality
3. **Integrate with your main app**

## 🔧 **Files Created:**

- `supabase/functions/strava-auth-simple/index.ts` - Simple auth function
- `supabase/functions/strava-callback-simple/index.ts` - Simple callback function
- `src/components/StravaConnectionSimple.tsx` - Simple connection component
- `src/pages/StravaTest.tsx` - Test page
- `src/App.tsx` - Added test route

## 🚀 **Ready to Test!**

Push these changes and test at: `https://tempo-guide-bot.vercel.app/strava-test`

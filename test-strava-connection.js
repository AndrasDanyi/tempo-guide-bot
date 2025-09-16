// Test script to diagnose Strava connection issues
// Run this in your browser console to check the connection

async function testStravaConnection() {
    console.log('🔍 Testing Strava Connection...');
    
    // Check current environment
    console.log('📍 Current URL:', window.location.href);
    console.log('📍 Origin:', window.location.origin);
    console.log('📍 Is Localhost:', window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    
    // Expected redirect URI
    const expectedRedirectUri = `${window.location.origin}/functions/v1/strava-callback`;
    console.log('📍 Expected Redirect URI:', expectedRedirectUri);
    
    try {
        // Test the strava-auth function
        console.log('🚀 Calling strava-auth function...');
        
        const response = await fetch('/functions/v1/strava-auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || 'test-token'}`,
            },
            body: JSON.stringify({
                redirectUrl: window.location.origin
            })
        });
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Success! Auth URL:', data.authUrl);
            
            // Check if the auth URL looks correct
            const authUrl = new URL(data.authUrl);
            console.log('🔗 Auth URL components:');
            console.log('  - Client ID:', authUrl.searchParams.get('client_id'));
            console.log('  - Redirect URI:', authUrl.searchParams.get('redirect_uri'));
            console.log('  - Scope:', authUrl.searchParams.get('scope'));
            console.log('  - State:', authUrl.searchParams.get('state'));
            
            // Check if redirect URI matches
            const redirectUri = authUrl.searchParams.get('redirect_uri');
            if (redirectUri === expectedRedirectUri) {
                console.log('✅ Redirect URI matches expected value');
            } else {
                console.log('❌ Redirect URI mismatch!');
                console.log('  Expected:', expectedRedirectUri);
                console.log('  Actual:', redirectUri);
            }
            
        } else {
            const errorText = await response.text();
            console.log('❌ Error response:', errorText);
            
            // Try to parse as JSON
            try {
                const errorData = JSON.parse(errorText);
                console.log('❌ Parsed error:', errorData);
            } catch (e) {
                console.log('❌ Raw error text:', errorText);
            }
        }
        
    } catch (error) {
        console.log('❌ Network error:', error);
    }
}

// Instructions for the user
console.log(`
🔧 Strava Connection Debug Tool
===============================

To diagnose your Strava connection issue:

1. Run: testStravaConnection()
2. Check the console output above
3. Look for any ❌ errors

Common Issues:
- Redirect URI mismatch: Your Strava app needs the exact redirect URI
- Missing environment variables: Check SUPABASE_URL and STRAVA_CLIENT_SECRET
- Localhost restrictions: Strava might not allow localhost redirects

To fix redirect URI issues:
1. Go to https://www.strava.com/settings/api
2. Find your app (Client ID: 174698)
3. Add this redirect URI: ${window.location.origin}/functions/v1/strava-callback
4. Make sure it matches exactly (including http/https)

Run the test now: testStravaConnection()
`);

// Auto-run the test
testStravaConnection();


import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Ensure WebBrowser works correctly on web
if (Platform.OS === 'web') {
    WebBrowser.maybeCompleteAuthSession();
}

const LoginScreen = () => {
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            // Create a deep link for redirect
            const redirectUrl = Linking.createURL('/auth/callback');
            console.log('Redirect URL:', redirectUrl);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true, // We will handle the URL opening
                },
            });

            if (error) throw error;

            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

                if (result.type === 'success' && result.url) {
                    // Parse the URL parameters to extract the access_token and refresh_token
                    // Supabase implicitly handles sessions if the URL structure matches expected OAuth callback
                    // But with skipBrowserRedirect: true, we might need to manually set session or let Supabase's auto-detect logic handle it?
                    // Actually, manually extracting tokens from hash is safer.
                    const { queryParams } = Linking.parse(result.url);

                    if (queryParams?.access_token && queryParams?.refresh_token) {
                        const { error: sessionError } = await supabase.auth.setSession({
                            access_token: queryParams.access_token as string,
                            refresh_token: queryParams.refresh_token as string,
                        });
                        if (sessionError) throw sessionError;
                    }
                    // Note: If Supabase returns the tokens in the hash part (implicit flow), Linking.parse might put them in different properties.
                    // Usually OAuth2 PKCE returns code, but implicit flow returns tokens directly.
                    // Let's rely on supabase-js handling via deep linking listener in App.tsx if we use standard flow.
                    // But here, we are manually handling the browser result.
                    // Let's try the simpler approach first: standard flow.
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>SaveSense</Text>
            <Text style={styles.subtitle}>Welcome back!</Text>

            <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleLogin}
                disabled={loading}
            >
                <Text style={styles.buttonText}>
                    {loading ? 'Signing in...' : 'Sign in with Google'}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    subtitle: {
        fontSize: 18,
        color: '#666',
        marginBottom: 40,
    },
    googleButton: {
        backgroundColor: '#4285F4',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default LoginScreen;

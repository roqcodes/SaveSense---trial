
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
            // Create a deep link for redirect - remove leading slash to avoid ///
            const redirectUrl = Linking.createURL('auth/callback');
            console.log('Redirect URL:', redirectUrl);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
                },
            });

            if (error) throw error;

            if (data?.url) {
                // Setup a listener for deep links as a fallback/primary way to catch the result
                // because sometimes openAuthSessionAsync doesn't return the url on Android
                let authUrl = '';

                const handleUrl = (event: { url: string }) => {
                    console.log('Deep link received:', event.url);
                    authUrl = event.url;
                };

                const subscription = Linking.addEventListener('url', handleUrl);

                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

                // Cleanup listener
                subscription.remove();

                // Determine which URL to use
                const finalUrl = (result.type === 'success' && result.url) ? result.url : authUrl;

                if (finalUrl) {
                    console.log('Processing Auth URL:', finalUrl);

                    // Helper to extract params from URL (query or hash)
                    const extractParams = (url: string) => {
                        const params: Record<string, string> = {};
                        // Check for hash parameters first (common in implicit flow)
                        const hashPart = url.split('#')[1];
                        if (hashPart) {
                            hashPart.split('&').forEach(part => {
                                const [key, value] = part.split('=');
                                if (key && value) params[key] = decodeURIComponent(value);
                            });
                        }

                        // Also check query parameters as fallback
                        const queryPart = url.split('?')[1]?.split('#')[0];
                        if (queryPart) {
                            queryPart.split('&').forEach(part => {
                                const [key, value] = part.split('=');
                                if (key && value) params[key] = decodeURIComponent(value);
                            });
                        }
                        return params;
                    };

                    const params = extractParams(finalUrl);

                    if (params.access_token && params.refresh_token) {
                        const { error: sessionError } = await supabase.auth.setSession({
                            access_token: params.access_token,
                            refresh_token: params.refresh_token,
                        });
                        if (sessionError) throw sessionError;
                    } else {
                        console.log('No tokens found in URL:', finalUrl);
                    }
                } else {
                    console.log('Auth Session finished but no URL captured. Result type:', result.type);
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

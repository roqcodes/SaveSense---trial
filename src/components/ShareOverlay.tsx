import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, BackHandler, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSharedContentProcessor } from '../hooks/useSharedContentProcessor';
import { useShareIntent } from 'expo-share-intent';

export const ShareOverlay = ({ onComplete }: { onComplete: () => void }) => {
    const { processSharedContent, isSaving } = useSharedContentProcessor();
    const { shareIntent, resetShareIntent } = useShareIntent();
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [errorMessage, setErrorMessage] = useState('Something went wrong. Please try again.');
    const slideAnim = React.useRef(new Animated.Value(500)).current;

    useEffect(() => {
        console.log('ShareOverlay mounted. ShareIntent present:', !!shareIntent);

        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();

        const handleShare = async () => {
            if (!shareIntent) return;
            console.log('Starting share processing for:', shareIntent.type);

            try {
                const result = await processSharedContent(shareIntent);
                console.log('Share processing result:', !!result);
                if (result) {
                    setStatus('success');
                    setTimeout(done, 2000);
                } else {
                    console.log('No result from processor (link already exists or empty)');
                    // Visual feedback for "Already Saved" would be better, but for now we follow old logic
                    setStatus('success'); // Still show success if it already exists
                    setTimeout(done, 1500);
                }
            } catch (error: any) {
                console.error('ShareOverlay error:', error);
                if (error.message === 'User not logged in') {
                    setErrorMessage('Please sign in to the app first to save content.');
                }
                setStatus('error');
            }
        };

        handleShare();
    }, [shareIntent]);

    const done = () => {
        Animated.timing(slideAnim, { toValue: 500, duration: 300, useNativeDriver: true }).start(() => {
            onComplete();
            resetShareIntent();
        });
    };

    const handleOpenApp = () => {
        onComplete(); // Just switch to home screen
    };

    const handleClose = () => {
        done();
        // Exit app after animation to return user to previous app
        setTimeout(() => {
            BackHandler.exitApp();
        }, 400);
    };

    return (
        <Modal transparent={true} visible={true} animationType="fade">
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={handleClose} />
                <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>
                    <View style={styles.content}>
                        {status === 'processing' && (
                            <>
                                <ActivityIndicator size="large" color="#4285F4" />
                                <Text style={styles.title}>Saving to SaveSense...</Text>
                            </>
                        )}

                        {status === 'success' && (
                            <>
                                <View style={styles.iconContainer}>
                                    <Ionicons name="checkmark-circle" size={60} color="#34A853" />
                                </View>
                                <Text style={styles.title}>Successfully Saved!</Text>
                                <Text style={styles.subtitle}>You can find this in your list later.</Text>
                            </>
                        )}

                        {status === 'error' && (
                            <>
                                <View style={styles.iconContainer}>
                                    <Ionicons name="alert-circle" size={60} color="#EA4335" />
                                </View>
                                <Text style={styles.title}>Failed to Save</Text>
                                <Text style={styles.subtitle}>{errorMessage}</Text>
                            </>
                        )}
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.buttonSecondary} onPress={handleClose}>
                            <Text style={styles.buttonTextSecondary}>Close</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.buttonPrimary} onPress={handleOpenApp}>
                            <Text style={styles.buttonTextPrimary}>Open App</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)', // Dim the background
    },
    dismissArea: {
        flex: 1,
    },
    card: {
        backgroundColor: 'white',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 30,
        paddingBottom: 50,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 20,
    },
    content: {
        alignItems: 'center',
        marginBottom: 30,
    },
    iconContainer: {
        marginBottom: 15,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginTop: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: '#666',
        marginTop: 8,
        textAlign: 'center',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    buttonPrimary: {
        flex: 1,
        backgroundColor: '#4285F4',
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonSecondary: {
        flex: 1,
        backgroundColor: '#F1F3F4',
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonTextPrimary: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    buttonTextSecondary: {
        color: '#3C4043',
        fontWeight: '600',
        fontSize: 16,
    },
});

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, Linking, TouchableOpacity, SafeAreaView, Platform, StatusBar, RefreshControl } from 'react-native';
import { useShareIntent } from 'expo-share-intent';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

type DbEntry = {
    id: string;
    content_type: 'text' | 'image' | 'file' | 'weburl';
    value: string;
    metadata?: {
        title?: string;
        image?: string;
        description?: string;
    };
    platform?: string;
    created_at: string;
};

type UserProfile = {
    name: string;
    avatarUrl: string;
    email: string;
};

const HomeScreen = () => {
    const [entries, setEntries] = useState<DbEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [user, setUser] = useState<UserProfile | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser({
                    name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
                    avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || 'https://via.placeholder.com/150',
                    email: user.email || '',
                });
                loadEntries();
            }
        };
        fetchUser();
    }, []);

    const loadEntries = async () => {
        const { data, error } = await supabase
            .from('shared_entries')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading entries:', error);
        } else {
            setEntries(data as DbEntry[]);
        }
        setRefreshing(false);
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadEntries();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        // App.tsx auth listener will handle navigation
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <View>
                <Text style={styles.greeting}>Welcome back,</Text>
                <Text style={styles.userName}>{user?.name.split(' ')[0] || 'Friend'}</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.profileContainer}>
                <Image
                    source={{ uri: user?.avatarUrl }}
                    style={styles.profileImage}
                />
            </TouchableOpacity>
        </View>
    );

    const getPlatformIcon = (platform?: string) => {
        switch (platform?.toLowerCase()) {
            case 'twitter': return 'logo-twitter';
            case 'youtube': return 'logo-youtube';
            case 'instagram': return 'logo-instagram';
            case 'facebook': return 'logo-facebook';
            case 'tiktok': return 'logo-tiktok';
            case 'reddit': return 'logo-reddit';
            default: return 'globe-outline';
        }
    };

    const renderItem = ({ item }: { item: DbEntry }) => {
        if (item.content_type === 'image') {
            return (
                <View style={styles.card}>
                    <Image source={{ uri: item.value }} style={styles.cardInfoImage} resizeMode="cover" />
                    <View style={styles.cardFooter}>
                        <Text style={styles.cardLabel}>IMAGE</Text>
                        <Ionicons name="image-outline" size={20} color="#666" />
                    </View>
                </View>
            );
        }

        if (item.content_type === 'weburl' && item.metadata) {
            const meta = item.metadata as any;
            return (
                <TouchableOpacity style={styles.card} onPress={() => Linking.openURL(item.value)}>
                    {meta.image && (
                        <Image source={{ uri: meta.image }} style={styles.cardInfoImage} resizeMode="cover" />
                    )}
                    <View style={styles.cardContent}>
                        <View style={styles.titleRow}>
                            {meta.author_avatar && (
                                <Image source={{ uri: meta.author_avatar }} style={styles.authorAvatar} />
                            )}
                            <Text style={styles.cardTitle} numberOfLines={1}>
                                {meta.title || 'Untitled Link'}
                            </Text>
                        </View>
                        {meta.description && (
                            <Text style={styles.cardDescription} numberOfLines={3}>{meta.description}</Text>
                        )}
                        <Text style={styles.cardUrl} numberOfLines={1}>{item.value}</Text>
                    </View>
                    <View style={styles.cardFooter}>
                        <Text style={styles.cardLabel}>{item.platform?.toUpperCase() || 'WEB'}</Text>
                        <Ionicons name={getPlatformIcon(item.platform) as any} size={18} color="#666" />
                    </View>
                </TouchableOpacity>
            );
        }

        return (
            <View style={styles.card}>
                <Text style={styles.cardText} numberOfLines={4}>{item.value}</Text>
                <View style={styles.cardFooter}>
                    <Text style={styles.cardLabel}>NOTE</Text>
                    <Ionicons name="document-text-outline" size={20} color="#666" />
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.container}>
                {renderHeader()}

                {loading && <ActivityIndicator size="small" color="#4285F4" style={styles.loader} />}

                <FlatList
                    data={entries}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4285F4']} tintColor="#4285F4" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="cube-outline" size={48} color="#ccc" />
                            <Text style={styles.placeholder}>No items saved yet</Text>
                            <Text style={styles.placeholderSub}>Share content to SaveSense to get started</Text>
                        </View>
                    }
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F7F8FA', // Softer background
        paddingTop: Platform.OS === 'android' ? 30 : 0
    },
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 30,
    },
    greeting: {
        fontSize: 16,
        color: '#888',
        fontWeight: '500',
    },
    userName: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1A1A1A',
        letterSpacing: -0.5,
    },
    profileContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
        borderRadius: 25,
    },
    profileImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: '#fff',
    },
    loader: {
        marginBottom: 20,
    },
    listContent: {
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 20,
        shadowColor: '#171717',
        shadowOffset: { width: 0, height: 4 }, // Deeper shadow
        shadowOpacity: 0.1,
        shadowRadius: 10, // Softer dispersion
        elevation: 6,
        overflow: 'hidden',
        borderWidth: 1, // Subtle border
        borderColor: 'rgba(0,0,0,0.02)',
    },
    cardContent: {
        padding: 16,
    },
    cardInfoImage: {
        width: '100%',
        height: 180,
        backgroundColor: '#f0f0f0',
    },
    cardText: {
        fontSize: 16,
        color: '#333',
        lineHeight: 24,
        padding: 16,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1A1A1A',
        lineHeight: 22,
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    authorAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        marginRight: 8,
        backgroundColor: '#eee',
    },
    cardDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 10,
        lineHeight: 20,
    },
    cardUrl: {
        fontSize: 12,
        color: '#4285F4',
        fontWeight: '500',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 0,
    },
    cardLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#999',
        letterSpacing: 1,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        opacity: 0.7,
    },
    placeholder: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginTop: 10,
    },
    placeholderSub: {
        fontSize: 14,
        color: '#999',
        marginTop: 5,
    },
});

export default HomeScreen;

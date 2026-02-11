import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, Linking, TouchableOpacity } from 'react-native';
import { useShareIntent } from 'expo-share-intent';

type SharedItem = {
    type: 'text' | 'image' | 'file' | 'weburl';
    value: string;
    originalFile?: any;
    metadata?: {
        title?: string;
        image?: string;
        description?: string;
    };
};

const HomeScreen = () => {
    const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
    const [sharedData, setSharedData] = useState<SharedItem[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchUrlMetadata = async (url: string) => {
        try {
            console.log('Fetching metadata for:', url);
            const response = await fetch(url);
            const html = await response.text();

            const getMeta = (propName: string) => {
                const match = html.match(new RegExp(`<meta property="${propName}" content="([^"]*)"`, 'i')) ||
                    html.match(new RegExp(`<meta name="${propName}" content="([^"]*)"`, 'i'));
                return match ? match[1] : undefined;
            };

            const title = getMeta('og:title') || html.match(/<title>([^<]*)<\/title>/i)?.[1] || '';
            const image = getMeta('og:image');
            const description = getMeta('og:description') || getMeta('description');

            return { title, image, description };
        } catch (error) {
            console.log('Error fetching metadata:', error);
            return {};
        }
    };

    useEffect(() => {
        if (hasShareIntent && shareIntent) {
            console.log('Received Share Intent:', shareIntent);

            const processIntent = async () => {
                if (shareIntent.type === 'text' || shareIntent.type === 'weburl') {
                    const textValue = shareIntent.value || shareIntent.text || shareIntent.webUrl;
                    if (textValue) {
                        // Check if it's a URL
                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                        const isUrl = urlRegex.test(textValue);

                        let metadata = {};
                        if (isUrl) {
                            setLoading(true);
                            metadata = await fetchUrlMetadata(textValue);
                            setLoading(false);
                        }

                        // Use existing meta from share intent if available and regex failed or incomplete
                        if (shareIntent.meta) {
                            metadata = { ...shareIntent.meta, ...metadata };
                        }

                        setSharedData(prev => {
                            const isDuplicate = prev.some(item => item.value === textValue);
                            if (isDuplicate) return prev;

                            return [...prev, {
                                type: isUrl ? 'weburl' : 'text',
                                value: textValue,
                                metadata
                            }];
                        });
                    }
                } else if (shareIntent.files) {
                    shareIntent.files.forEach((file: any) => {
                        setSharedData(prev => {
                            const isDuplicate = prev.some(item => item.value === (file.path || file.uri));
                            if (isDuplicate) return prev;

                            return [...prev, {
                                type: file.mimeType?.startsWith('image') ? 'image' : 'file',
                                value: file.path || file.uri,
                                originalFile: file
                            }];
                        });
                    });
                }
                resetShareIntent();
            };

            processIntent();
        }
    }, [hasShareIntent, shareIntent, resetShareIntent]);

    const renderItem = ({ item }: { item: SharedItem }) => {
        if (item.type === 'image') {
            return (
                <View style={styles.card}>
                    <Image source={{ uri: item.value }} style={styles.cardImage} resizeMode="cover" />
                    <Text style={styles.cardLabel}>Shared Image</Text>
                </View>
            );
        }

        if (item.type === 'weburl' && item.metadata) {
            return (
                <TouchableOpacity style={styles.card} onPress={() => Linking.openURL(item.value)}>
                    {item.metadata.image ? (
                        <Image source={{ uri: item.metadata.image }} style={styles.cardImage} resizeMode="cover" />
                    ) : null}
                    <View style={styles.cardContent}>
                        <Text style={styles.cardTitle} numberOfLines={2}>{item.metadata.title || item.value}</Text>
                        {item.metadata.description ? (
                            <Text style={styles.cardDescription} numberOfLines={3}>{item.metadata.description}</Text>
                        ) : null}
                        <Text style={styles.cardUrl} numberOfLines={1}>{item.value}</Text>
                    </View>
                </TouchableOpacity>
            );
        }

        return (
            <View style={styles.card}>
                <Text style={styles.cardText}>{item.value}</Text>
                <Text style={styles.cardLabel}>Shared Text</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Home Screen</Text>
            {loading && <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />}
            {sharedData.length > 0 ? (
                <FlatList
                    data={sharedData}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                />
            ) : (
                <Text style={styles.placeholder}>Share content with SaveSense to see it here</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: '#333',
    },
    loader: {
        marginBottom: 20,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        overflow: 'hidden',
    },
    cardContent: {
        padding: 15,
    },
    cardText: {
        fontSize: 16,
        color: '#333',
        marginBottom: 8,
        padding: 15,
    },
    cardImage: {
        width: '100%',
        height: 200,
        backgroundColor: '#e1e1e1',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 5,
    },
    cardDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    cardUrl: {
        fontSize: 12,
        color: '#007AFF',
    },
    cardLabel: {
        fontSize: 12,
        color: '#888',
        textTransform: 'uppercase',
        marginLeft: 15,
        marginBottom: 15,
    },
    listContent: {
        paddingBottom: 20,
    },
    placeholder: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        marginTop: 50,
        fontStyle: 'italic',
    },
});

export default HomeScreen;

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
// @ts-ignore
import ShareMenu from 'react-native-share-menu';

type RootTabParamList = {
    Home: undefined;
    Analyze: undefined;
};

type Props = BottomTabScreenProps<RootTabParamList, 'Home'>;

type SharedItem = {
    mimeType: string;
    data: string | string[];
    extraData?: any;
};

const HomeScreen: React.FC<Props> = ({ navigation }) => {
    const [sharedItems, setSharedItems] = useState<SharedItem[]>([]);

    const handleShare = useCallback((item: any) => {
        if (!item || !item.data) return;

        console.log('Received share:', item);
        const newItem: SharedItem = {
            mimeType: item.mimeType,
            data: item.data,
            extraData: item.extraData,
        };

        setSharedItems(prevItems => [newItem, ...prevItems]);
    }, []);

    useEffect(() => {
        // Check if app was launched via share
        ShareMenu.getInitialShare(handleShare);

        // Listen for new shares while app is open
        const listener = ShareMenu.addNewShareListener(handleShare);

        return () => {
            if (listener && listener.remove) {
                listener.remove();
            }
        };
    }, [handleShare]);

    const renderItem = ({ item }: { item: SharedItem }) => (
        <View style={styles.card}>
            <Text style={styles.mimeType}>{item.mimeType}</Text>
            <Text style={styles.data}>{String(item.data)}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Home Screen</Text>
            {sharedItems.length > 0 ? (
                <FlatList
                    data={sharedItems}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={renderItem}
                    style={styles.list}
                />
            ) : (
                <Text style={styles.placeholder}>No shared items yet.</Text>
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
        marginTop: 40,
    },
    list: {
        width: '100%',
    },
    card: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    mimeType: {
        fontSize: 12,
        color: '#666',
        marginBottom: 5,
        textTransform: 'uppercase',
    },
    data: {
        fontSize: 16,
        color: '#333',
    },
    placeholder: {
        textAlign: 'center',
        color: '#999',
        marginTop: 50,
    },
});

export default HomeScreen;

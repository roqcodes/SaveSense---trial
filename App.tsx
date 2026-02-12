import * as React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import * as WebBrowser from 'expo-web-browser';

import HomeScreen from './src/screens/HomeScreen';
import AnalyzeScreen from './src/screens/AnalyzeScreen';
import LoginScreen from './src/screens/LoginScreen';

type RootTabParamList = {
  Home: undefined;
  Analyze: undefined;
};

type AuthStackParamList = {
  Login: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      id="TabNavigator"
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Analyze') {
            iconName = focused ? 'analytics' : 'analytics-outline';
          } else {
            iconName = 'help';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: 'tomato',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Analyze" component={AnalyzeScreen} />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator id="AuthNavigator" screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

import { ShareIntentProvider, useShareIntent } from 'expo-share-intent';
import { ShareOverlay } from './src/components/ShareOverlay';

function MainContent({ session, loading }: { session: Session | null, loading: boolean }) {
  const { hasShareIntent, resetShareIntent } = useShareIntent();
  const [showShareOverlay, setShowShareOverlay] = React.useState(false);

  React.useEffect(() => {
    if (hasShareIntent && session) {
      setShowShareOverlay(true);
    }
  }, [hasShareIntent, !!session]);

  const handleShareComplete = () => {
    setShowShareOverlay(false);
    resetShareIntent();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // If we are in share mode, ONLY render the overlay to keep it lightweight
  if (showShareOverlay) {
    return (
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <ShareOverlay onComplete={handleShareComplete} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session && session.user ? <TabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

export default function App() {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Check for initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth State Change:', _event, session?.user?.email);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <ShareIntentProvider>
      <MainContent session={session} loading={loading} />
    </ShareIntentProvider>
  );
}


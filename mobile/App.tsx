import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { store } from '@/store/store';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAppSelector } from '@/store/hooks';
import { navigationRef, resetToAuth } from '@/navigation/navigationRef';

function AuthSessionBridge() {
  const bootstrapped = useAppSelector((s) => s.auth.bootstrapped);
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  useEffect(() => {
    if (bootstrapped && !accessToken && navigationRef.isReady()) {
      resetToAuth();
    }
  }, [bootstrapped, accessToken]);

  return null;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <AuthSessionBridge />
          <RootNavigator />
          <StatusBar style="dark" />
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

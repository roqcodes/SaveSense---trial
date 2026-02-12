import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import shareTask from './src/tasks/shareTask';

// Register the background task for native Android headless bridge
AppRegistry.registerHeadlessTask('ShareTask', () => shareTask);

import App from './App';

registerRootComponent(App);

const { withAndroidManifest, withAndroidStyles, AndroidConfig } = require('@expo/config-plugins');

const withShareActivity = (config) => {
    // 1. Modify MainActivity in AndroidManifest.xml
    config = withAndroidManifest(config, (config) => {
        const mainActivity = config.modResults.manifest.application[0].activity.find(
            (a) => a['$']['android:name'] === '.MainActivity'
        );
        if (mainActivity) {
            // Use our custom transparent theme
            mainActivity['$']['android:theme'] = '@style/AppTheme.Transparent';

            // Prevent the app from appearing in recents when shared (keeps it feeling like a transient extension)
            // We only want this if we can detect it's a share, but since we use one activity, 
            // we'll stick to transparency + finish() logic.
            mainActivity['$']['android:windowSoftInputMode'] = 'adjustResize';
        }
        return config;
    });

    // 2. Define the Translucent Theme
    config = withAndroidStyles(config, (config) => {
        // Explicitly overwrite the SplashScreen theme to be transparent too
        // This removes the "White Blank" flash during boot
        config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
            name: 'Theme.App.SplashScreen',
            parent: 'Theme.AppCompat.Light.NoTitleBar',
            items: [
                { name: 'android:windowIsTranslucent', value: 'true' },
                { name: 'android:windowBackground', value: '@android:color/transparent' },
                { name: 'android:windowContentOverlay', value: '@null' },
                { name: 'android:windowNoTitle', value: 'true' },
                { name: 'android:windowIsFloating', value: 'false' },
                { name: 'android:backgroundDimEnabled', value: 'true' },
                { name: 'android:windowDisablePreview', value: 'true' }, // CRITICAL: Removes the white screen
            ],
        });

        // Add a generic transparent theme for the main app
        config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
            name: 'AppTheme.Transparent',
            parent: 'Theme.AppCompat.Light.NoTitleBar',
            items: [
                { name: 'android:windowIsTranslucent', value: 'true' },
                { name: 'android:windowBackground', value: '@android:color/transparent' },
                { name: 'android:backgroundDimEnabled', value: 'false' },
                { name: 'android:windowDisablePreview', value: 'true' },
            ],
        });
        return config;
    });

    return config;
};

module.exports = withShareActivity;

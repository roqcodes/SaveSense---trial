const { withAndroidManifest, withAndroidStyles, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNativeBackgroundShare = (config) => {
    // 1. Modify AndroidManifest.xml
    config = withAndroidManifest(config, (config) => {
        const mainApplication = config.modResults.manifest.application[0];
        const mainActivity = mainApplication.activity.find(a => a['$']['android:name'] === '.MainActivity');

        // Add WAKE_LOCK permission
        if (!config.modResults.manifest['uses-permission']) {
            config.modResults.manifest['uses-permission'] = [];
        }
        if (!config.modResults.manifest['uses-permission'].some(p => p['$']['android:name'] === 'android.permission.WAKE_LOCK')) {
            config.modResults.manifest['uses-permission'].push({
                $: { 'android:name': 'android.permission.WAKE_LOCK' }
            });
        }
        // Add READ_EXTERNAL_STORAGE permission if not present (often needed for older androids to read the stream)
        if (!config.modResults.manifest['uses-permission'].some(p => p['$']['android:name'] === 'android.permission.READ_EXTERNAL_STORAGE')) {
            config.modResults.manifest['uses-permission'].push({
                $: { 'android:name': 'android.permission.READ_EXTERNAL_STORAGE' }
            });
        }

        // Remove existing share intent filters from MainActivity to avoid conflicts
        if (mainActivity && mainActivity['intent-filter']) {
            mainActivity['intent-filter'] = mainActivity['intent-filter'].filter(filter => {
                const actions = filter.action || [];
                const hasSendAction = actions.some(action => action['$']['android:name'] === 'android.intent.action.SEND');
                return !hasSendAction;
            });
        }

        // Add THE INVISIBLE ShareActivity
        if (!mainApplication.activity.find(a => a['$']['android:name'] === '.ShareActivity')) {
            mainApplication.activity.push({
                $: {
                    'android:name': '.ShareActivity',
                    'android:theme': '@style/AppTheme_Transparent',
                    'android:label': 'Save to SaveSense',
                    'android:exported': 'true',
                    'android:excludeFromRecents': 'true',
                    'android:noHistory': 'true',
                    'android:taskAffinity': 'com.savesense.share',
                },
                'intent-filter': [
                    {
                        action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
                        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
                        data: [
                            { $: { 'android:mimeType': 'text/*' } },
                            { $: { 'android:mimeType': 'image/*' } },
                            { $: { 'android:mimeType': 'video/*' } }
                        ],
                    }
                ]
            });
        }

        // Register the Headless JS Service
        if (!mainApplication.service) mainApplication.service = [];
        if (!mainApplication.service.find(s => s['$']['android:name'] === '.ShareTaskService')) {
            mainApplication.service.push({
                $: {
                    'android:name': '.ShareTaskService',
                    'android:enabled': 'true',
                    'android:exported': 'false',
                    'android:foregroundServiceType': 'shortService',
                }
            });
        }

        return config;
    });

    // 2. Add the transparency style
    config = withAndroidStyles(config, (config) => {
        const resources = config.modResults.resources;
        if (!resources.style) resources.style = [];

        const styleName = 'AppTheme_Transparent';
        if (!resources.style.some(s => s['$'].name === styleName)) {
            resources.style.push({
                $: { name: styleName, parent: 'Theme.AppCompat.DayNight.NoActionBar' },
                item: [
                    { $: { name: 'android:windowIsTranslucent' }, _: 'true' },
                    { $: { name: 'android:windowBackground' }, _: '@android:color/transparent' },
                    { $: { name: 'android:windowContentOverlay' }, _: '@null' },
                    { $: { name: 'android:windowNoTitle' }, _: 'true' },
                    { $: { name: 'android:windowIsFloating' }, _: 'false' },
                    { $: { name: 'android:backgroundDimEnabled' }, _: 'false' },
                    { $: { name: 'android:windowDisablePreview' }, _: 'true' },
                ]
            });
        }
        return config;
    });

    // 3. Inject Native Java Code
    config = withDangerousMod(config, [
        'android',
        async (config) => {
            const packageName = config.android?.package || 'com.savesense';
            const packagePath = packageName.replace(/\./g, '/');
            const androidRoot = path.join(config.modRequest.projectRoot, 'android/app/src/main/java', packagePath);

            if (!fs.existsSync(androidRoot)) {
                fs.mkdirSync(androidRoot, { recursive: true });
            }

            // NO-UI Share Proxy
            const shareActivityClass = `package ${packageName};

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;
import com.facebook.react.HeadlessJsTaskService;

public class ShareActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent intent = getIntent();
        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action) && type != null) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            Uri contentUri = (Uri) intent.getParcelableExtra(Intent.EXTRA_STREAM);
            
            if (sharedText != null || contentUri != null) {
                // 1. Instant Native Feedback
                Toast.makeText(this, "Saving to SaveSense...", Toast.LENGTH_SHORT).show();

                // 2. Start Headless Background Service
                Intent serviceIntent = new Intent(this, ShareTaskService.class);
                Bundle bundle = new Bundle();
                
                if (sharedText != null) {
                    bundle.putString("text", sharedText);
                }
                
                if (contentUri != null) {
                    bundle.putString("contentUri", contentUri.toString());
                    bundle.putString("mimeType", type);
                    // Grant permission to read this URI
                    try {
                         // We can't easily grant permissions to a service started this way for a specific URI 
                         // without passing the data via setClipData/setFlags on the service intent, 
                         // but for now let's just pass the URI string. 
                         // The Headless JS task might need to use a native module to resolve it if it's strictly permissioned.
                         
                         // Note: In many cases passing the URI string to React Native is enough if we use a library that can read it.
                    } catch(Exception e) {
                        e.printStackTrace();
                    }
                }
                
                serviceIntent.putExtras(bundle);
                
                // Acquire wake lock to prevent sleep
                try {
                    HeadlessJsTaskService.acquireWakeLockNow(this);
                    this.startService(serviceIntent);
                } catch (Exception e) {
                    // Fallback for Android 12+ background start restrictions
                    this.getApplicationContext().startService(serviceIntent);
                }
            }
        }

        // 3. Close immediately so the user stays in their news app
        finish();
    }
}`;

            // Headless JS Bridge
            const shareTaskServiceClass = `package ${packageName};

import android.content.Intent;
import android.os.Bundle;
import androidx.annotation.Nullable;
import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;

public class ShareTaskService extends HeadlessJsTaskService {
    @Override
    protected @Nullable HeadlessJsTaskConfig getTaskConfig(Intent intent) {
        Bundle extras = intent.getExtras();
        if (extras != null) {
            return new HeadlessJsTaskConfig(
                "ShareTask",
                Arguments.fromBundle(extras),
                5000, 
                true  
            );
        }
        return null;
    }
}`;

            fs.writeFileSync(path.join(androidRoot, 'ShareActivity.java'), shareActivityClass);
            fs.writeFileSync(path.join(androidRoot, 'ShareTaskService.java'), shareTaskServiceClass);

            return config;
        },
    ]);

    return config;
};

module.exports = withNativeBackgroundShare;

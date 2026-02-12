const { withAndroidManifest, withAndroidStyles, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNativeShare = (config) => {
    // 1. Modify AndroidManifest.xml
    config = withAndroidManifest(config, (config) => {
        const mainApplication = config.modResults.manifest.application[0];
        const mainActivity = mainApplication.activity.find(a => a['$']['android:name'] === '.MainActivity');

        // Remove existing share intent filters from MainActivity to avoid conflict
        if (mainActivity && mainActivity['intent-filter']) {
            mainActivity['intent-filter'] = mainActivity['intent-filter'].filter(filter => {
                const action = filter.action && filter.action[0]['$']['android:name'];
                return action !== 'android.intent.action.SEND';
            });
        }

        // Add ShareActivity
        if (!mainApplication.activity.find(a => a['$']['android:name'] === '.ShareActivity')) {
            mainApplication.activity.push({
                $: {
                    'android:name': '.ShareActivity',
                    'android:theme': '@style/Theme.Design.Light.NoActionBar', // Minimal theme
                    'android:label': 'Save to SaveSense',
                    'android:exported': 'true',
                    'android:excludeFromRecents': 'true',
                    'android:noHistory': 'true',
                },
                'intent-filter': [
                    {
                        action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
                        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
                        data: [{ $: { 'android:mimeType': 'text/plain' } }],
                    }
                ]
            });
        }

        // Add Service for Headless JS
        if (!mainApplication.service) mainApplication.service = [];
        if (!mainApplication.service.find(s => s['$']['android:name'] === '.ShareTaskService')) {
            mainApplication.service.push({
                $: {
                    'android:name': '.ShareTaskService',
                    'android:enabled': 'true',
                    'android:exported': 'false',
                }
            });
        }

        return config;
    });

    // 2. Inject Java Files
    config = withDangerousMod(config, [
        'android',
        async (config) => {
            const packagePath = 'com/savesense'; // Verify this matches your app.json package name
            const androidRoot = path.join(config.modRequest.projectRoot, 'android/app/src/main/java', packagePath);

            if (!fs.existsSync(androidRoot)) {
                fs.mkdirSync(androidRoot, { recursive: true });
            }

            // WRITE ShareActivity.java
            const shareActivityClass = `package com.savesense;

import android.app.Activity;
import android.content.Intent;
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
            if ("text/plain".equals(type)) {
                String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
                if (sharedText != null) {
                    // 1. Show Instant Toast
                    Toast.makeText(this, "Saving to SaveSense...", Toast.LENGTH_SHORT).show();

                    // 2. Start Headless Task
                    Intent serviceIntent = new Intent(this, ShareTaskService.class);
                    Bundle bundle = new Bundle();
                    bundle.putString("text", sharedText);
                    bundle.putString("userId", "hnaaa899@gmail.com"); // Hardcoded for now or fetch from SecureStore
                    serviceIntent.putExtras(bundle);
                    
                    this.startService(serviceIntent);
                    HeadlessJsTaskService.acquireWakeLockNow(this);
                }
            }
        }

        // 3. Kill activity immediately
        finish();
    }
}`;

            // WRITE ShareTaskService.java
            const shareTaskServiceClass = `package com.savesense;

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
                5000, // timeout for the task in milliseconds
                true  // allowed in foreground
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

module.exports = withNativeShare;

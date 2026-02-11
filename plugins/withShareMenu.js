const { withAndroidManifest, withMainActivity } = require('@expo/config-plugins');

const withShareMenu = (config) => {
    config = withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults;
        const mainActivity = androidManifest.manifest.application[0].activity.find(
            (activity) => activity['@android:name'] === '.MainActivity'
        );

        if (mainActivity) {
            if (!mainActivity['intent-filter']) {
                mainActivity['intent-filter'] = [];
            }

            mainActivity['intent-filter'].push({
                action: [
                    {
                        $: {
                            'android:name': 'android.intent.action.SEND',
                        },
                    },
                ],
                category: [
                    {
                        $: {
                            'android:name': 'android.intent.category.DEFAULT',
                        },
                    },
                ],
                data: [
                    {
                        $: {
                            'android:mimeType': 'text/plain',
                        },
                    },
                    {
                        $: {
                            'android:mimeType': 'image/*',
                        },
                    },
                ],
            });
        }

        return config;
    });

    config = withMainActivity(config, async (config) => {
        if (config.modResults.language === 'java') {
            let contents = config.modResults.contents;
            if (!contents.includes('ShareMenuPackage')) {
                contents = contents.replace(
                    /import android.os.Bundle;/,
                    'import android.os.Bundle;\nimport android.content.Intent;\nimport com.qed.react.sharemenu.ShareMenuPackage;'
                );
            }
            if (!contents.includes('onNewIntent')) {
                const onNewIntent = `
    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        ShareMenuPackage.onNewIntent(intent);
    }
`;
                // Insert before last closing brace
                const lastBrace = contents.lastIndexOf('}');
                contents = contents.substring(0, lastBrace) + onNewIntent + contents.substring(lastBrace);
            }
            config.modResults.contents = contents;
        } else if (config.modResults.language === 'kotlin') {
            let contents = config.modResults.contents;
            if (!contents.includes('ShareMenuPackage')) {
                contents = contents.replace(
                    /import android.os.Bundle/,
                    'import android.os.Bundle\nimport android.content.Intent\nimport com.qed.react.sharemenu.ShareMenuPackage'
                );
            }
            if (!contents.includes('onNewIntent')) {
                const onNewIntent = `
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        ShareMenuPackage.onNewIntent(intent)
    }
`;
                // Insert before last closing brace
                const lastBrace = contents.lastIndexOf('}');
                contents = contents.substring(0, lastBrace) + onNewIntent + contents.substring(lastBrace);
            }
            config.modResults.contents = contents;
        }
        return config;
    });

    return config;
};

module.exports = withShareMenu;

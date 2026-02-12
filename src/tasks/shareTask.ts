import { ToastAndroid } from 'react-native';
import { supabase } from '../lib/supabase';
import { scrapeInstagramPost } from '../lib/instagramScraper';

const getPlatform = (url: string): string | null => {
    if (!url) return null;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('instagram.com')) return 'instagram';
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter';
    if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch')) return 'facebook';
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
    if (lowerUrl.includes('reddit.com')) return 'reddit';
    if (lowerUrl.includes('tiktok.com')) return 'tiktok';
    return 'web';
};

const fetchTwitterMetadata = async (url: string) => {
    try {
        // Extracting Tweet ID from URL (e.g. status/123456)
        const tweetIdMatch = url.match(/status\/(\d+)/);
        if (!tweetIdMatch) return null;
        const tweetId = tweetIdMatch[1];

        console.log('[Headless] Detected Twitter URL. Fetching social data for ID:', tweetId);

        // Using vxtwitter's public API for clean JSON metadata
        const response = await fetch(`https://api.vxtwitter.com/status/${tweetId}`);
        const data = await response.json();

        if (data) {
            return {
                title: `${data.user_name} (@${data.user_screen_name})`,
                description: data.text,
                image: data.mediaURLs?.[0] || data.user_profile_image_url,
                author_avatar: data.user_profile_image_url,
                raw_data: data // Keep full data for debug or future UI expansions
            };
        }
    } catch (error) {
        console.log('[Headless] Twitter API fetch failed:', error);
    }
    return null;
};

const fetchRedditMetadata = async (url: string) => {
    try {
        let cleanUrl = url.split('?')[0];

        // Handle Reddit shortlinks (e.g., /s/ or redd.it)
        if (cleanUrl.includes('/s/') || cleanUrl.includes('redd.it')) {
            console.log('[Headless] Resolving Reddit shortlink:', cleanUrl);
            try {
                const redirectResponse = await fetch(cleanUrl, {
                    method: 'HEAD',
                    redirect: 'follow', // Follow redirects automatically
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });

                // If fetch followed the redirect, .url will be the final destination
                if (redirectResponse.url && redirectResponse.url !== cleanUrl) {
                    cleanUrl = redirectResponse.url.split('?')[0];
                    console.log('[Headless] Resolved to:', cleanUrl);
                }
            } catch (e) {
                console.log('[Headless] Shortlink resolution failed', e);
            }
        }

        const jsonUrl = cleanUrl.endsWith('/') ? `${cleanUrl}.json` : `${cleanUrl}/.json`;

        console.log('[Headless] Fetching Reddit JSON:', jsonUrl);

        const response = await fetch(jsonUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) return null;

        const text = await response.text();
        // Check if response is actually JSON
        if (text.trim().startsWith('<')) {
            throw new Error('Received HTML instead of JSON (likely a redirect page)');
        }

        const data = JSON.parse(text);

        // Reddit structure: array of listings. First one contains the post.
        const post = data?.[0]?.data?.children?.[0]?.data;

        if (post) {
            return {
                title: post.title,
                description: post.selftext || `Shared from r/${post.subreddit}`,
                image: post.url_overridden_by_dest || post.thumbnail,
                author_avatar: null, // Reddit API doesn't give avatar in post detail easily
                source: 'reddit_api',
                // Custom fields for Reddit
                subreddit: `r/${post.subreddit}`,
                author: `u/${post.author}`
            };
        }
    } catch (e) {
        console.log('[Headless] Reddit error:', e);
    }
    return null;
};

const fetchUrlMetadata = async (url: string) => {
    try {
        console.log('[Headless] Scrambling generic metadata for:', url.substring(0, 50));
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36'
            }
        });
        const html = await response.text();

        const getMeta = (propName: string) => {
            const regexes = [
                new RegExp(`<meta[^>]*property=["']og:${propName}["'][^>]*content=["']([^"']*)["']`, 'i'),
                new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${propName}["']`, 'i'),
                new RegExp(`<meta[^>]*name=["']${propName}["'][^>]*content=["']([^"']*)["']`, 'i'),
                new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${propName}["']`, 'i'),
            ];

            for (const regex of regexes) {
                const match = html.match(regex);
                if (match) return match[1];
            }
            return undefined;
        };

        const title = getMeta('title') || html.match(/<title>([^<]*)<\/title>/i)?.[1] || 'Untitled Link';
        const image = getMeta('image');
        const description = getMeta('og:description') || getMeta('description');

        return { title, image, description };
    } catch (error) {
        console.log('[Headless] Metadata fetch failed:', error);
        return { title: 'Untitled Link' };
    }
};

const shareTask = async (taskData: any) => {
    console.log('[Headless] New share task intercepted.');

    const { text } = taskData;
    if (!text) {
        console.error('[Headless] No text in taskData');
        return;
    }

    try {
        // 1. Get Authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('[Headless] Authentication fail:', authError);
            ToastAndroid.show('Please login to SaveSense first', ToastAndroid.LONG);
            return;
        }

        // 2. Extract and Process Value
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = text.match(urlRegex);
        const extractedUrl = matches ? matches[0] : null;

        let metadata: any = {
            source: 'android_native_background',
            captured_at: new Date().toISOString()
        };
        let platform = 'text';
        let contentType = 'text';
        let finalValue = text;

        if (extractedUrl) {
            console.log('[Headless] Processing as URL...');
            platform = getPlatform(extractedUrl) || 'web';

            let socialMeta: any = null;
            if (platform === 'twitter') {
                socialMeta = await fetchTwitterMetadata(extractedUrl);
            } else if (platform === 'instagram') {
                console.log('[Headless] Detected Instagram. Invoking scraper (local)...');
                const shortcodeMatch = extractedUrl.match(/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
                if (shortcodeMatch) {
                    try {
                        const data = await scrapeInstagramPost(shortcodeMatch[1]);

                        if (data) {
                            socialMeta = {
                                title: data.author ? `${data.author} on Instagram` : 'Instagram Post',
                                description: data.caption,
                                image: data.mediaUrl || data.author_avatar,
                                author_avatar: data.author_avatar,
                                source: 'headless_share_instagram'
                            };
                            if (data.isVideo) socialMeta.isVideo = true;
                        }
                    } catch (e) {
                        console.error('[Headless] Instagram scrape failed:', e);
                    }
                }
            } else if (platform === 'reddit') {
                socialMeta = await fetchRedditMetadata(extractedUrl);
            }

            if (socialMeta) {
                metadata = { ...metadata, ...socialMeta };
            }

            // Fallback: If we don't have a title yet (or scraper failed), fetch generic metadata
            if (!metadata.title || metadata.title === 'Untitled Link') {
                const scraped = await fetchUrlMetadata(extractedUrl);
                metadata = { ...metadata, ...scraped };
                // Restore specialized title if we accidentally overwrote it with "Instagram"
                if (socialMeta?.title) metadata.title = socialMeta.title;
            }

            contentType = 'weburl';
            finalValue = extractedUrl;
        }

        // 3. Prevent Duplicates
        const { data: existing } = await supabase
            .from('shared_entries')
            .select('id')
            .eq('user_id', user.id)
            .eq('value', finalValue)
            .maybeSingle();

        if (existing) {
            console.log('[Headless] Already exists.');
            ToastAndroid.show('Link already saved!', ToastAndroid.SHORT);
            return;
        }

        // 4. Final Upload
        console.log('[Headless] Sending to Supabase...');
        const { error: insertError } = await supabase.from('shared_entries').insert({
            user_id: user.id,
            content_type: contentType,
            value: finalValue,
            platform: platform,
            metadata: metadata,
        });

        if (insertError) throw insertError;

        console.log('[Headless] Save confirmed.');
        ToastAndroid.show('Link Saved!', ToastAndroid.SHORT);
    } catch (error: any) {
        console.error('[Headless] Fatal task error:', error.message || error);
        ToastAndroid.show('Failed to save link', ToastAndroid.SHORT);
    }
};

export default shareTask;

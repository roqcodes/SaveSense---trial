import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useShareIntent } from 'expo-share-intent';
import { scrapeInstagramPost } from '../lib/instagramScraper';

export const useSharedContentProcessor = () => {
    const { shareIntent, resetShareIntent } = useShareIntent();
    const [isSaving, setIsSaving] = useState(false);

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

    const fetchUrlMetadata = async (url: string) => {
        try {
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

    const processSharedContent = useCallback(async (intentOverride?: any) => {
        const activeIntent = intentOverride || shareIntent;
        if (!activeIntent) {
            console.log('No share intent to process');
            return null;
        }

        try {
            setIsSaving(true);
            const anyIntent = activeIntent as any;
            console.log('Full share intent:', JSON.stringify(activeIntent, null, 2));
            console.log('Available keys in intent:', Object.keys(anyIntent));

            console.log('Fetching user for share...');
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) {
                console.error('Auth error in processor:', userError);
                throw new Error('User not logged in');
            }

            console.log('Processing content for user:', user.email);
            let savedEntry = null;

            // Be extremely aggressive in finding a value
            const textValue = anyIntent.value || anyIntent.text || anyIntent.webUrl || anyIntent.weburl || anyIntent.content || anyIntent.extraText || anyIntent.urls?.[0];

            console.log('Extracted textValue:', textValue ? textValue.substring(0, 50) : 'NULL');

            if (textValue || activeIntent.type === 'text' || activeIntent.type === 'weburl') {
                if (textValue) {
                    console.log('Processing as Text/URL');
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    const isUrl = urlRegex.test(textValue);
                    let metadata: any = {};
                    let platform = 'text';

                    if (isUrl) {
                        const platformDetected = getPlatform(textValue) || 'web';
                        platform = platformDetected;

                        if (platform === 'twitter') {
                            // ... existing twitter logic ...
                            console.log('Fetching Twitter enrichment in foreground...');
                            const tweetIdMatch = textValue.match(/status\/(\d+)/);
                            if (tweetIdMatch) {
                                try {
                                    const response = await fetch(`https://api.vxtwitter.com/status/${tweetIdMatch[1]}`);
                                    const data = await response.json();
                                    if (data) {
                                        metadata = {
                                            title: `${data.user_name} (@${data.user_screen_name})`,
                                            description: data.text,
                                            image: data.mediaURLs?.[0] || data.user_profile_image_url,
                                            author_avatar: data.user_profile_image_url,
                                            source: 'foreground_share_processor'
                                        };
                                    }
                                } catch (e) {
                                    console.log('Foreground Twitter fetch failed', e);
                                }
                            }
                        } else if (platform === 'instagram') {
                            console.log('Fetching Instagram enrichment (Client Side)...');
                            // Extract shortcode: https://www.instagram.com/p/SHORTCODE/
                            const shortcodeMatch = textValue.match(/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
                            if (shortcodeMatch) {
                                const shortcode = shortcodeMatch[1];
                                try {
                                    const data = await scrapeInstagramPost(shortcode);

                                    if (data) {
                                        metadata = {
                                            title: data.author ? `${data.author} on Instagram` : 'Instagram Post',
                                            description: data.caption,
                                            image: data.mediaUrl || data.author_avatar, // Fallback to avatar if media fails
                                            author_avatar: data.author_avatar,
                                            source: 'foreground_share_processor_instagram'
                                        };
                                        if (data.isVideo) metadata.isVideo = true;
                                    }
                                } catch (e) {
                                    console.error('Instagram scrape failed:', e);
                                }
                            }
                        } else if (platform === 'reddit') {
                            console.log('Fetching Reddit enrichment...');
                            try {
                                let cleanUrl = textValue.split('?')[0];

                                // Resolve shortlinks
                                if (cleanUrl.includes('/s/') || cleanUrl.includes('redd.it')) {
                                    try {
                                        const r = await fetch(cleanUrl, { method: 'HEAD', redirect: 'follow' });
                                        if (r.url) cleanUrl = r.url.split('?')[0];
                                    } catch (e) {
                                        console.log('Reddit shortlink resolve fail', e);
                                    }
                                }

                                const jsonUrl = cleanUrl.endsWith('/') ? `${cleanUrl}.json` : `${cleanUrl}/.json`;
                                const response = await fetch(jsonUrl);
                                const text = await response.text();

                                if (!text.trim().startsWith('<')) {
                                    const data = JSON.parse(text);
                                    const post = data?.[0]?.data?.children?.[0]?.data;

                                    if (post) {
                                        metadata = {
                                            title: post.title,
                                            description: post.selftext || `Shared from r/${post.subreddit}`,
                                            image: post.url_overridden_by_dest || post.thumbnail,
                                            author_avatar: null,
                                            source: 'foreground_share_reddit',
                                            subreddit: `r/${post.subreddit}`,
                                            author: `u/${post.author}`
                                        };
                                    }
                                }
                            } catch (e) {
                                console.log('Reddit fetch failed', e);
                            }
                        }

                        if (!metadata.title || metadata.title === 'Untitled Link') {
                            const scraped = await fetchUrlMetadata(textValue);
                            metadata = { ...metadata, ...scraped };
                            // Restore specialized title if we accidentally overwrote it with "Instagram"
                            if (platform === 'instagram' && metadata.title && metadata.title.includes('Instagram')) {
                                // Keep the scraped title if it's better
                            }
                        }
                    }
                    if (activeIntent.meta) metadata = { ...activeIntent.meta, ...metadata };

                    console.log('Checking for duplicates in DB...');
                    const { data: existing, error: checkError } = await supabase
                        .from('shared_entries')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('value', textValue)
                        .maybeSingle();

                    if (checkError) console.error('DB Check Error:', checkError);

                    if (!existing) {
                        console.log('Inserting new entry...');
                        const { data, error } = await supabase.from('shared_entries').insert({
                            user_id: user.id,
                            content_type: isUrl ? 'weburl' : 'text',
                            value: textValue,
                            platform: platform,
                            metadata: metadata,
                        }).select().single();

                        if (error) {
                            console.error('Insert error:', error);
                            throw error;
                        }
                        savedEntry = data;
                        console.log('Entry saved successfully');
                    } else {
                        console.log('Duplicate found, skipping insert');
                        savedEntry = existing;
                    }
                }
            } else if (activeIntent.files) {
                console.log('Processing files:', activeIntent.files.length);
                for (const file of activeIntent.files) {
                    const anyFile = file as any;
                    const filePath = anyFile.filePath || anyFile.contentUri || anyFile.uri;

                    const { data: existingFile } = await supabase
                        .from('shared_entries')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('value', filePath)
                        .maybeSingle();

                    if (!existingFile) {
                        const { data, error } = await supabase.from('shared_entries').insert({
                            user_id: user.id,
                            content_type: file.mimeType?.startsWith('image') ? 'image' : 'file',
                            value: filePath,
                            platform: 'local_file',
                            metadata: { originalFile: file }
                        }).select().single();
                        if (error) throw error;
                        savedEntry = data;
                    }
                }
            }

            console.log('Resetting share intent state');
            resetShareIntent();
            return savedEntry;
        } catch (error) {
            console.error('Processing error:', error);
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [shareIntent, resetShareIntent]);

    return { processSharedContent, isSaving };
};

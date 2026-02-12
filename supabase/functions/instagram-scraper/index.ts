import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { shortcode } = await req.json();

        if (!shortcode) {
            throw new Error('Shortcode is required');
        }

        const url = `https://imginn.com/p/${shortcode}/`;
        console.log(`Fetching ${url}...`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            // handle 404 or other errors
            if (response.status === 404) {
                throw new Error('Post not found or private');
            }
            throw new Error(`Failed to fetch page: ${response.status}`);
        }

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        if (!doc) {
            throw new Error('Failed to parse HTML');
        }

        // 1. Extract Profile Info
        // Usually in .user-info or similar passed structure
        let author = doc.querySelector('.username')?.textContent?.trim();
        let author_avatar = doc.querySelector('.avatar img')?.getAttribute('src') || doc.querySelector('.user img')?.getAttribute('src');

        // Fallback to meta tags for author if structure fails
        if (!author) {
            const title = doc.querySelector('title')?.textContent || "";
            // Title often "Author (@username) on Instagram..."
            const match = title.match(/^(.+?)\s\(@/);
            if (match) author = match[1];
        }

        // 2. Extract Caption
        let caption = doc.querySelector('.description')?.textContent?.trim();
        if (!caption) {
            // Try meta description
            caption = doc.querySelector('meta[name="description"]')?.getAttribute('content');
        }

        // 3. Extract Media (High Res)
        // Structure typically has a .downloads or .media container
        let mediaUrl = null;
        let isVideo = false;

        // Check for video first
        const video = doc.querySelector('.media video source') || doc.querySelector('.media video');
        if (video) {
            mediaUrl = video.getAttribute('src');
            isVideo = true;
        }

        // Fallback to image
        if (!mediaUrl) {
            // Look for the high-res image, often in .media img or .downloads a
            const img = doc.querySelector('.media img');
            if (img) {
                mediaUrl = img.getAttribute('src');
                // Sometimes src is a thumb, check for data-src or parent 'a' href
                const parentLink = img.parentElement?.tagName === 'A' ? img.parentElement : null;
                if (parentLink) mediaUrl = parentLink.getAttribute('href');
            }
        }

        // Final check on meta tags if scraped content failed
        if (!mediaUrl) {
            mediaUrl = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
        }

        // ensure URLs are absolute
        if (mediaUrl && mediaUrl.startsWith('//')) mediaUrl = 'https:' + mediaUrl;
        if (author_avatar && author_avatar.startsWith('//')) author_avatar = 'https:' + author_avatar;

        const result = {
            shortcode,
            caption,
            mediaUrl,
            isVideo,
            author,
            author_avatar
        };

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});

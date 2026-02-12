export const scrapeInstagramPost = async (shortcode: string) => {
    try {
        const url = `https://imginn.com/p/${shortcode}/`;
        console.log(`[InstagramScraper] Fetching ${url}...`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch page: ${response.status}`);
        }

        const html = await response.text();

        // Regex Extraction

        // 1. Author Name (e.g. <span class="username">username</span>)
        const authorMatch = html.match(/<span class="username">([\s\S]*?)<\/span>/);
        let author = authorMatch ? authorMatch[1].trim() : null;

        if (!author) {
            // Fallback: Title tag often has "Author (@username) on Instagram..."
            const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
            if (titleMatch) {
                const titleText = titleMatch[1];
                const userMatch = titleText.match(/^(.+?)\s\(@/);
                if (userMatch) author = userMatch[1].trim();
            }
        }

        // 2. Author Avatar (e.g. <div class="user">...<img src="...">)
        // Usually inside .user-info or .user container
        const avatarMatch = html.match(/class="user"[\s\S]*?<img[^>]+src="([^"]+)"/);
        let author_avatar = avatarMatch ? avatarMatch[1] : null;

        // 3. Caption (e.g. <div class="description">...</div>)
        const captionMatch = html.match(/class="description">([\s\S]*?)<\/div>/);
        let caption = captionMatch ? captionMatch[1].trim() : null;

        if (!caption) {
            // Fallback to meta description
            const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
            if (metaDescMatch) caption = metaDescMatch[1];
        }

        // 4. Media (High Res)
        let mediaUrl = null;
        let isVideo = false;

        // Check for video first: <div class="media">...<video...src="...">
        const videoMatch = html.match(/class="media"[\s\S]*?<video[^>]+src="([^"]+)"/);
        if (videoMatch) {
            mediaUrl = videoMatch[1];
            isVideo = true;
        } else {
            // Check for image: <div class="media">...<img src="...">
            // Prioritize high-res link if wrapped in <a>
            const highResLinkMatch = html.match(/class="media"[\s\S]*?<a[^>]+href="([^"]+)"/);
            if (highResLinkMatch) {
                mediaUrl = highResLinkMatch[1];
            } else {
                const imgMatch = html.match(/class="media"[\s\S]*?<img[^>]+src="([^"]+)"/);
                if (imgMatch) mediaUrl = imgMatch[1];
            }
        }

        // Clean up URLs
        if (mediaUrl && mediaUrl.startsWith('//')) mediaUrl = 'https:' + mediaUrl;
        if (author_avatar && author_avatar.startsWith('//')) author_avatar = 'https:' + author_avatar;

        return {
            shortcode,
            caption,
            mediaUrl,
            isVideo,
            author,
            author_avatar
        };

    } catch (error: any) {
        console.error('[InstagramScraper] Error:', error.message);
        return null;
    }
};

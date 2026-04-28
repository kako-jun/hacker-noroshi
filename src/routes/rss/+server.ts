import type { RequestHandler } from './$types';
import { getDB, getStories } from '$lib/server/db';

function escapeXml(str: string): string {
	if (!str) return '';
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export const GET: RequestHandler = async ({ platform }) => {
	const db = getDB(platform);
	const stories = await getStories(db, { orderBy: 'rank', limit: 30 });

	const items = stories
		.map((story) => {
			const link = story.url || `https://hn.llll-ll.com/item/${story.id}`;
			const author = story.user_deleted ? '[deleted]' : story.username;
			const description = `${story.points} points by ${author} | ${story.comment_count} comments`;
			const date = new Date(story.created_at);
			const pubDate = isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();

			return `    <item>
      <title>${escapeXml(story.title)}</title>
      <link>${escapeXml(link)}</link>
      <comments>https://hn.llll-ll.com/item/${story.id}</comments>
      <description>${escapeXml(description)}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="false">https://hn.llll-ll.com/item/${story.id}</guid>
    </item>`;
		})
		.join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ハッカーのろし</title>
    <link>https://hn.llll-ll.com</link>
    <description>日本の技術者向けリンク集約サイト</description>
    <language>ja</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://hn.llll-ll.com/rss" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/rss+xml; charset=utf-8',
			'Cache-Control': 'public, max-age=120, s-maxage=120'
		}
	});
};

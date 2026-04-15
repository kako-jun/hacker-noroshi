import type { RequestHandler } from './$types';
import { getDB, getStories } from '$lib/server/db';

function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export const GET: RequestHandler = async ({ platform }) => {
	const db = getDB(platform);
	const stories = await getStories(db, { orderBy: 'rank', limit: 30 });

	const items = stories
		.map((story) => {
			const link = story.url || `https://hn.llll-ll.com/item/${story.id}`;
			const description = `${story.points} points by ${story.username} | ${story.comment_count} comments`;
			const pubDate = new Date(story.created_at).toUTCString();

			return `    <item>
      <title>${escapeXml(story.title)}</title>
      <link>${escapeXml(link)}</link>
      <description>${escapeXml(description)}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="false">https://hn.llll-ll.com/item/${story.id}</guid>
    </item>`;
		})
		.join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>ハッカーのろし</title>
    <link>https://hn.llll-ll.com</link>
    <description>日本の技術者向けリンク集約サイト</description>
    <language>ja</language>
${items}
  </channel>
</rss>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/rss+xml; charset=utf-8'
		}
	});
};

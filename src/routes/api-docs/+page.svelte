<script lang="ts">
	const storyExample = `{
  "id": 42,
  "type": "story",
  "by": "noroshi",
  "time": 1700000000,
  "title": "Show HN: Hacker Noroshi",
  "url": "https://hn.llll-ll.com/",
  "text": null,
  "score": 45,
  "descendants": 3,
  "kids": [44, 47, 51],
  "dead": false,
  "deleted": false
}`;

	const commentExample = `{
  "id": 47,
  "type": "comment",
  "by": "tanaka",
  "time": 1700000100,
  "text": "Nice work.",
  "parent": 42,
  "score": 1,
  "kids": [],
  "dead": false,
  "deleted": false
}`;

	const userExample = `{
  "id": "noroshi",
  "created": 1700000000,
  "karma": 100,
  "about": ""
}`;
</script>

<svelte:head>
	<title>API | ハッカーのろし</title>
</svelte:head>

<div style="padding: 10px 0 10px 40px; font-size: 9pt; line-height: 14pt; color: #000000;">
	<b>Hacker Noroshi API</b>

	<p>
		Read-only JSON API. No authentication required. Modeled after the
		<a href="https://github.com/HackerNews/API">official Hacker News API</a>,
		with minor differences noted below.
	</p>

	<p>Base URL: <code>https://hn.llll-ll.com/api/v0</code></p>

	<p><b>Endpoints</b></p>

	<table style="font-size: 9pt; border-collapse: collapse;">
		<thead>
			<tr style="text-align: left;">
				<th style="padding: 2pt 8pt 2pt 0;">Path</th>
				<th style="padding: 2pt 8pt 2pt 0;">Returns</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td style="padding: 1pt 8pt 1pt 0;"><code>GET /api/v0/topstories.json</code></td>
				<td style="padding: 1pt 8pt 1pt 0;">Front page (HN-style ranking) story IDs</td>
			</tr>
			<tr>
				<td style="padding: 1pt 8pt 1pt 0;"><code>GET /api/v0/newstories.json</code></td>
				<td style="padding: 1pt 8pt 1pt 0;">Newest story IDs (descending by created time)</td>
			</tr>
			<tr>
				<td style="padding: 1pt 8pt 1pt 0;"><code>GET /api/v0/beststories.json</code></td>
				<td style="padding: 1pt 8pt 1pt 0;">Story IDs ordered by points (descending)</td>
			</tr>
			<tr>
				<td style="padding: 1pt 8pt 1pt 0;"><code>GET /api/v0/askstories.json</code></td>
				<td style="padding: 1pt 8pt 1pt 0;">"Ask HN"-style story IDs (type=ask)</td>
			</tr>
			<tr>
				<td style="padding: 1pt 8pt 1pt 0;"><code>GET /api/v0/showstories.json</code></td>
				<td style="padding: 1pt 8pt 1pt 0;">"Show HN"-style story IDs (type=show)</td>
			</tr>
			<tr>
				<td style="padding: 1pt 8pt 1pt 0;"><code>GET /api/v0/activestories.json</code></td>
				<td style="padding: 1pt 8pt 1pt 0;">Stories with the most recent comments (Hacker Noroshi extension)</td>
			</tr>
			<tr>
				<td style="padding: 1pt 8pt 1pt 0;"><code>GET /api/v0/item/&lt;id&gt;.json</code></td>
				<td style="padding: 1pt 8pt 1pt 0;">Story or comment by ID</td>
			</tr>
			<tr>
				<td style="padding: 1pt 8pt 1pt 0;"><code>GET /api/v0/user/&lt;username&gt;.json</code></td>
				<td style="padding: 1pt 8pt 1pt 0;">User profile (lightweight)</td>
			</tr>
		</tbody>
	</table>

	<p>Listings currently return up to 60 IDs (HN returns 500 — we may raise this later).</p>

	<p><b>Listing example</b></p>

	<p>
		<code>$ curl https://hn.llll-ll.com/api/v0/topstories.json</code><br />
		<code>[42, 17, 8, 3, ...]</code>
	</p>

	<p><b>Story item example</b></p>

	<p>
		<code>$ curl https://hn.llll-ll.com/api/v0/item/42.json</code>
	</p>
	<pre style="font-size: 9pt; background: #f6f6ef; padding: 4pt; border: 1px solid #ccc; overflow-x: auto;">{storyExample}</pre>

	<p><b>Comment item example</b></p>

	<pre style="font-size: 9pt; background: #f6f6ef; padding: 4pt; border: 1px solid #ccc; overflow-x: auto;">{commentExample}</pre>

	<p><b>User example</b></p>

	<pre style="font-size: 9pt; background: #f6f6ef; padding: 4pt; border: 1px solid #ccc; overflow-x: auto;">{userExample}</pre>

	<p><b>Field reference</b></p>

	<table style="font-size: 9pt; border-collapse: collapse;">
		<tbody>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>id</code></td><td>Item or user identifier (number for items, string for users).</td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>type</code></td><td>One of <code>story</code>, <code>comment</code>, <code>ask</code>, <code>show</code>, <code>poll</code>. (HN's <code>job</code> type is not used here.)</td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>by</code></td><td>Author username. <code>"[deleted]"</code> if the author deleted their account.</td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>time</code></td><td>Creation time as Unix seconds.</td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>title</code></td><td>Story title (stories only).</td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>url</code></td><td>Story URL or <code>null</code> for self-posts (stories only).</td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>text</code></td><td>Body text (HTML allowed). May be <code>null</code> for URL stories.</td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>score</code></td><td>Points (upvotes minus downvotes).</td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>descendants</code></td><td>Total comment count (stories only).</td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>kids</code></td><td>IDs of immediate child comments in chronological order (oldest first). One level only — recurse via <code>/item/&lt;id&gt;.json</code> per kid. Note: HN sorts kids by best-comment score; we sort chronologically.</td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>parent</code></td><td>Parent item ID (comments only). Top-level comments point at the story; replies point at the parent comment.</td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>dead</code></td><td><code>true</code> if the item was killed by moderation.</td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>deleted</code></td><td><code>true</code> if the author deleted their account. <b>Note: this differs from HN's <code>deleted</code></b>, which means the post itself was deleted (and content fields are dropped). On Hacker Noroshi the post content (title/text/url) is preserved when an author deletes; only <code>by</code> becomes <code>"[deleted]"</code>.</td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>created</code></td><td>Account creation time as Unix seconds (users only).</td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>karma</code></td><td>Total karma (users only).</td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;"><code>about</code></td><td>About text (users only). Empty string for deleted accounts.</td></tr>
		</tbody>
	</table>

	<p><b>Caching</b></p>

	<table style="font-size: 9pt; border-collapse: collapse;">
		<tbody>
			<tr><td style="padding: 1pt 8pt 1pt 0;">Listings</td><td><code>Cache-Control: public, max-age=10, s-maxage=60</code></td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;">Items</td><td><code>Cache-Control: public, max-age=30, s-maxage=300</code></td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;">Users</td><td><code>Cache-Control: public, max-age=60, s-maxage=300</code></td></tr>
			<tr><td style="padding: 1pt 8pt 1pt 0;">Errors (4xx/5xx)</td><td><code>Cache-Control: no-store</code></td></tr>
		</tbody>
	</table>

	<p><b>CORS</b></p>

	<p>
		All endpoints respond with <code>Access-Control-Allow-Origin: *</code> and accept
		<code>GET</code> / <code>OPTIONS</code>. Calls from browser-side JS are fine.
	</p>

	<p><b>Errors</b></p>

	<p>
		Unknown items / users return <code>404</code> with body <code>&#123;"error": "not found"&#125;</code>.
		Malformed input (non-numeric ID, invalid username format) is also <code>404</code> by design,
		matching HN's behaviour. Internal failures return <code>500</code> with body
		<code>&#123;"error": "internal"&#125;</code>.
	</p>

	<p><b>Rate limits</b></p>

	<p>
		There is currently no per-IP rate limit on the public API. Edge caching
		(<code>s-maxage</code>) absorbs most of the load, but please be polite — keep
		concurrent requests low and prefer caching responses on your side.
	</p>

	<p><b>Item ID space</b></p>

	<p>
		Stories and comments are stored in separate tables on Hacker Noroshi, so their
		IDs come from different sequences and can collide. <code>/item/&lt;id&gt;.json</code>
		resolves a collision by checking the stories table first, then comments. This
		differs from HN, where every item shares a single sequence. If you need to
		distinguish, look at the <code>type</code> field in the response.
	</p>

	<p><b>Differences from the official HN API</b></p>

	<ul style="margin: 0; padding-left: 1.6em;">
		<li>Listings cap at 60 IDs (HN: 500).</li>
		<li>No <code>maxitem</code> endpoint.</li>
		<li>No <code>/v0/updates</code> stream.</li>
		<li>User <code>submitted</code> array is not included (use <code>/user/&lt;username&gt;</code> on the site instead, for now).</li>
		<li>Realtime / Firebase subscription is not provided. Use polling.</li>
		<li><code>activestories.json</code> is a Hacker Noroshi extension and has no HN counterpart.</li>
		<li><code>deleted</code> means "the author deleted their account" rather than HN's "the post was deleted". See the field reference for details.</li>
		<li><code>kids</code> is sorted chronologically (oldest first), not by HN's best-comment ranking.</li>
		<li>Item IDs are not globally unique across stories and comments (see "Item ID space").</li>
	</ul>

	<p>
		Source code: <a href="https://github.com/kako-jun/hacker-noroshi">github.com/kako-jun/hacker-noroshi</a>
	</p>
</div>

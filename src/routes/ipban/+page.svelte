<script lang="ts">
	let { data, form } = $props();

	function formatExpires(expiresAt: string | null): string {
		if (!expiresAt) return '無期限';
		// 日本人向けサイトのため JST 表示。
		return `${new Date(expiresAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} (JST) まで`;
	}

	// banned_at は ISO 文字列（UTC）で来るため、JST に変換して表示する。
	function formatBannedAt(iso: string): string {
		return `${new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} (JST)`;
	}
</script>

<svelte:head>
	<title>IP ban | ハッカーのろし</title>
	{#if data.ban && data.turnstileSiteKey}
		<!-- #91: Turnstile widget の JS。ban 中かつ site key が設定済みのときのみ読み込む -->
		<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
	{/if}
</svelte:head>

<div style="padding: 20pt; font-family: Verdana, Geneva, sans-serif; font-size: 10pt; color: #000000;">
	{#if data.ban}
		<table style="border-collapse: collapse;">
			<tbody>
				<tr>
					<td style="padding: 4pt 0;">
						<b>あなたの IP ({data.ip}) は ban されています。</b>
					</td>
				</tr>
				<tr>
					<td style="padding: 4pt 0;">理由: {data.ban.reason || '(理由未記入)'}</td>
				</tr>
				<tr>
					<td style="padding: 4pt 0;">ban された日時: {formatBannedAt(data.ban.banned_at)}</td>
				</tr>
				<tr>
					<td style="padding: 4pt 0;">解除予定: {formatExpires(data.ban.expires_at)}</td>
				</tr>
				<tr>
					<td style="padding: 12pt 0 4pt 0;">
						共有 IP の場合や心当たりがない場合は、管理者に連絡してください。
					</td>
				</tr>
			</tbody>
		</table>

		{#if data.turnstileSiteKey}
			<!-- #91: セルフサービス unban。Turnstile を通せば即時 unban する -->
			<div style="margin-top: 24pt; padding-top: 12pt; border-top: 1px solid #cccccc;">
				<h3 style="font-size: 11pt; margin: 0 0 8pt 0;">セルフサービス unban</h3>
				<p style="margin: 4pt 0;">
					以下の認証を通すと、即座に ban を解除できます。
					<br />
					（24時間以内に 3 回まで試行できます。）
				</p>
				{#if form?.unbanError}
					<p style="color: #b00020; margin: 4pt 0;">{form.unbanError}</p>
				{/if}
				<form method="POST" action="?/unban" style="margin-top: 8pt;">
					<div class="cf-turnstile" data-sitekey={data.turnstileSiteKey}></div>
					<div style="margin-top: 8pt;">
						<button type="submit">認証して unban する</button>
					</div>
				</form>
			</div>
		{:else}
			<!-- #91: site key 未設定時（dev / REPLACE_ME）はセルフ unban を提供しない -->
			<div style="margin-top: 24pt; padding-top: 12pt; border-top: 1px solid #cccccc;">
				<p style="margin: 4pt 0;">
					現在セルフサービス unban は無効です。管理者にご連絡ください。
				</p>
			</div>
		{/if}
	{:else}
		<p>あなたの IP ({data.ip}) は ban されていません。</p>
		<p><a href="/">トップへ戻る</a></p>
	{/if}
</div>

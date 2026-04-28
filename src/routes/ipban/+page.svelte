<script lang="ts">
	let { data } = $props();

	function formatExpires(expiresAt: string | null): string {
		if (!expiresAt) return '無期限';
		const d = new Date(expiresAt);
		const yyyy = d.getUTCFullYear();
		const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
		const dd = String(d.getUTCDate()).padStart(2, '0');
		const hh = String(d.getUTCHours()).padStart(2, '0');
		const mi = String(d.getUTCMinutes()).padStart(2, '0');
		return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC まで`;
	}
</script>

<svelte:head>
	<title>IP ban | ハッカーのろし</title>
</svelte:head>

<div style="padding: 20pt; font-family: Verdana, Geneva, sans-serif; font-size: 10pt; color: #000000;">
	{#if data.ban}
		<table style="border-collapse: collapse;">
			<tr>
				<td style="padding: 4pt 0;">
					<b>あなたの IP ({data.ip}) は ban されています。</b>
				</td>
			</tr>
			<tr>
				<td style="padding: 4pt 0;">理由: {data.ban.reason || '(理由未記入)'}</td>
			</tr>
			<tr>
				<td style="padding: 4pt 0;">ban された日時: {data.ban.banned_at}</td>
			</tr>
			<tr>
				<td style="padding: 4pt 0;">解除予定: {formatExpires(data.ban.expires_at)}</td>
			</tr>
			<tr>
				<td style="padding: 12pt 0 4pt 0;">
					共有 IP の場合や心当たりがない場合は、管理者に連絡してください。
				</td>
			</tr>
		</table>
	{:else}
		<p>あなたの IP ({data.ip}) は ban されていません。</p>
		<p><a href="/">トップへ戻る</a></p>
	{/if}
</div>

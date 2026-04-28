<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>admin / IP ban | ハッカーのろし</title>
</svelte:head>

<div style="padding: 20pt; font-family: Verdana, Geneva, sans-serif; font-size: 10pt; color: #000000;">
	<p><b>IP ban 管理</b></p>

	{#if form?.error}
		<p style="color: #cc0000;">{form.error}</p>
	{/if}
	{#if form?.success}
		<p style="color: #008800;">処理しました。</p>
	{/if}

	<p><b>新規 ban</b></p>
	<form method="POST" action="?/ban">
		<table style="border-collapse: collapse;">
			<tr>
				<td style="padding: 4pt 8pt 4pt 0;">IP:</td>
				<td style="padding: 4pt 0;">
					<input type="text" name="ip" value={form?.ip ?? ''} size="20" style="font-family: Verdana, Geneva, sans-serif; font-size: 10pt;" />
				</td>
			</tr>
			<tr>
				<td style="padding: 4pt 8pt 4pt 0;">理由:</td>
				<td style="padding: 4pt 0;">
					<input type="text" name="reason" value={form?.reason ?? ''} size="40" style="font-family: Verdana, Geneva, sans-serif; font-size: 10pt;" />
				</td>
			</tr>
			<tr>
				<td style="padding: 4pt 8pt 4pt 0;">有効期限 (時間):</td>
				<td style="padding: 4pt 0;">
					<input type="text" name="expiresIn" value={form?.expiresInRaw ?? ''} size="6" style="font-family: Verdana, Geneva, sans-serif; font-size: 10pt;" />
					<span style="margin-left: 8pt;">空欄で無期限</span>
				</td>
			</tr>
			<tr>
				<td colspan="2" style="padding: 8pt 0;">
					<button type="submit" style="font-family: Verdana, Geneva, sans-serif; font-size: 10pt;">ban する</button>
				</td>
			</tr>
		</table>
	</form>

	<p style="margin-top: 16pt;"><b>active な ban 一覧 ({data.bans.length} 件)</b></p>
	{#if data.bans.length === 0}
		<p>active な ban はありません。</p>
	{:else}
		<table style="border-collapse: collapse; border: 1pt solid #cccccc;">
			<thead>
				<tr style="background-color: #f0f0f0;">
					<th style="padding: 4pt 8pt; text-align: left; border: 1pt solid #cccccc;">IP</th>
					<th style="padding: 4pt 8pt; text-align: left; border: 1pt solid #cccccc;">理由</th>
					<th style="padding: 4pt 8pt; text-align: left; border: 1pt solid #cccccc;">ban 日時</th>
					<th style="padding: 4pt 8pt; text-align: left; border: 1pt solid #cccccc;">解除予定</th>
					<th style="padding: 4pt 8pt; text-align: left; border: 1pt solid #cccccc;">操作</th>
				</tr>
			</thead>
			<tbody>
				{#each data.bans as ban (ban.id)}
					<tr>
						<td style="padding: 4pt 8pt; border: 1pt solid #cccccc;">{ban.ip}</td>
						<td style="padding: 4pt 8pt; border: 1pt solid #cccccc;">{ban.reason || '-'}</td>
						<td style="padding: 4pt 8pt; border: 1pt solid #cccccc;">{ban.banned_at}</td>
						<td style="padding: 4pt 8pt; border: 1pt solid #cccccc;">{ban.expires_at ?? '無期限'}</td>
						<td style="padding: 4pt 8pt; border: 1pt solid #cccccc;">
							<form method="POST" action="?/unban" style="display: inline;">
								<input type="hidden" name="id" value={ban.id} />
								<button type="submit" style="font-family: Verdana, Geneva, sans-serif; font-size: 9pt;">unban</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

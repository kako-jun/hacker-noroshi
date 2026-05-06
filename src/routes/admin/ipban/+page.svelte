<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>admin / IP ban | ハッカーのろし</title>
</svelte:head>

<div class="hn-form">
	<p><b>IP ban 管理</b></p>

	{#if form?.banError}
		<p style="color: #ff0000;">{form.banError}</p>
	{:else if form?.error}
		<p style="color: #ff0000;">{form.error}</p>
	{/if}
	{#if form?.success}
		<p>処理しました。</p>
	{/if}

	<p><b>新規 ban</b></p>
	<!-- SvelteKit form action は同一オリジンチェック付き -->
	<form method="POST" action="?/ban">
		<table>
			<tbody>
				<tr>
					<td>IP:</td>
					<td>
						<input type="text" name="ip" value={form?.ip ?? ''} />
					</td>
				</tr>
				<tr>
					<td>理由:</td>
					<td>
						<input type="text" name="reason" value={form?.reason ?? ''} maxlength="1024" />
					</td>
				</tr>
				<tr>
					<td>有効期限 (時間):</td>
					<td>
						<input type="text" name="expiresIn" value={form?.expiresInRaw ?? ''} />
						<span> 空欄で無期限</span>
					</td>
				</tr>
				<tr>
					<td></td>
					<td>
						<button type="submit">ban する</button>
					</td>
				</tr>
			</tbody>
		</table>
	</form>

	<p style="margin-top: 16pt;"><b>active な ban 一覧 ({data.bans.length} 件)</b></p>
	{#if data.bans.length === 0}
		<p>active な ban はありません。</p>
	{:else}
		<table class="ipban-list">
			<thead>
				<tr>
					<th>IP</th>
					<th>理由</th>
					<th>ban 日時</th>
					<th>解除予定</th>
					<th>操作</th>
				</tr>
			</thead>
			<tbody>
				{#each data.bans as ban (ban.id)}
					<tr>
						<td>{ban.ip}</td>
						<td>{ban.reason || '-'}</td>
						<td>{ban.banned_at}</td>
						<td>{ban.expires_at ?? '無期限'}</td>
						<td>
							<form method="POST" action="?/unban" class="inline-form">
								<input type="hidden" name="id" value={ban.id} />
								<button type="submit">unban</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	/* 独自画面の ban 一覧テーブル。DESIGN.md の在パレット色のみで、
	   行を区切る最小限の装飾（border-bottom）に留める。 */
	.ipban-list {
		border-collapse: collapse;
		font-size: 9pt;
		margin-top: 4pt;
	}

	.ipban-list th,
	.ipban-list td {
		text-align: left;
		padding: 2pt 8pt 2pt 0;
		vertical-align: top;
	}

	.ipban-list th {
		color: #828282;
		font-weight: normal;
		border-bottom: 1px solid #828282;
	}

	.ipban-list td {
		color: #000000;
	}
</style>

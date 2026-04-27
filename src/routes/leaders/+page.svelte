<script lang="ts">
	import { isNewUser } from '$lib/ranking';

	let { data } = $props();
</script>

<svelte:head>
	<title>Leaders | ハッカーのろし</title>
</svelte:head>

<div class="leaders-page">
	<table>
		<tbody>
			{#each data.users as user, i}
				<tr>
					<td class="rank">{(data.page - 1) * 30 + i + 1}.</td>
					<td class="user">
						<a href="/user/{user.username}" style={isNewUser(user.created_at) ? 'color: #3c963c;' : ''}>{user.username}</a>
					</td>
					<td class="karma">{user.karma}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if data.hasMore}
	<div class="more-link">
		<a href="/leaders?p={data.page + 1}">More</a>
	</div>
{/if}

<style>
	.leaders-page {
		padding: 8pt 0 8pt 30pt;
		font-size: 10pt;
	}

	.leaders-page table {
		border-spacing: 0;
	}

	.leaders-page td {
		padding: 1pt 6pt 1pt 0;
		vertical-align: top;
	}

	.leaders-page td.rank {
		text-align: right;
		color: #828282;
	}

	.leaders-page td.user a {
		color: #000000;
	}

	.leaders-page td.karma {
		color: #828282;
	}
</style>

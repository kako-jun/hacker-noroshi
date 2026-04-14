<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toISOString().split('T')[0];
	}
</script>

<svelte:head>
	<title>Profile: {data.profile.username} | ハッカーのろし</title>
</svelte:head>

<div class="user-profile" style="padding-left: 40px;">
	<table>
		<tbody>
			<tr>
				<td>user:</td>
				<td>{data.profile.username}</td>
			</tr>
			<tr>
				<td>created:</td>
				<td>{formatDate(data.profile.created_at)}</td>
			</tr>
			<tr>
				<td>karma:</td>
				<td>{data.profile.karma}</td>
			</tr>
			{#if data.isOwnProfile}
				<tr>
					<td>about:</td>
					<td>
						<form method="POST" action="?/update" use:enhance>
							<textarea name="about" rows="5" cols="60">{data.profile.about ?? ''}</textarea>
							<br />
							<button type="submit">update</button>
						</form>
					</td>
				</tr>
			{:else if data.profile.about}
				<tr>
					<td>about:</td>
					<td>{data.profile.about}</td>
				</tr>
			{/if}
		</tbody>
	</table>

	<div style="margin-top: 10px; font-size: 10pt;">
		<a href="/user/{data.profile.username}/submissions">submissions</a><br />
		<a href="/user/{data.profile.username}/comments">comments</a>
	</div>
</div>

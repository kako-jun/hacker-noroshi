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
	{#if data.isOwnProfile}
		<form method="POST" action="?/update" use:enhance>
			<table style="border-spacing: 0;">
				<tbody>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">user:</td>
						<td>{data.profile.username}</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">created:</td>
						<td>{formatDate(data.profile.created_at)}</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">karma:</td>
						<td>{data.profile.karma}</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">about:</td>
						<td>
							<textarea name="about" rows="5" cols="60" style="font-family: monospace; font-size: 9pt;">{data.profile.about ?? ''}</textarea>
						</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">email:</td>
						<td>
							<input type="text" name="email" value={data.profile.email ?? ''} size="60" style="font-family: monospace; font-size: 9pt;" />
						</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">showdead:</td>
						<td>
							<select name="showdead" style="font-family: Verdana, Geneva, sans-serif; font-size: 9pt;">
								<option value="no" selected={data.profile.showdead === 0}>no</option>
								<option value="yes" selected={data.profile.showdead === 1}>yes</option>
							</select>
						</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">noprocrast:</td>
						<td>
							<select name="noprocrast" style="font-family: Verdana, Geneva, sans-serif; font-size: 9pt;">
								<option value="no" selected={data.profile.noprocrast === 0}>no</option>
								<option value="yes" selected={data.profile.noprocrast === 1}>yes</option>
							</select>
						</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">maxvisit:</td>
						<td>
							<input type="text" name="maxvisit" value={data.profile.maxvisit} size="6" style="font-family: monospace; font-size: 9pt;" />
						</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">minaway:</td>
						<td>
							<input type="text" name="minaway" value={data.profile.minaway} size="6" style="font-family: monospace; font-size: 9pt;" />
						</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">delay:</td>
						<td>
							<input type="text" name="delay" value={data.profile.delay} size="6" style="font-family: monospace; font-size: 9pt;" />
						</td>
					</tr>
					<tr>
						<td></td>
						<td>
							<button type="submit" style="font-family: Verdana, Geneva, sans-serif; font-size: 8pt;">update</button>
						</td>
					</tr>
				</tbody>
			</table>
		</form>
	{:else}
		<table style="border-spacing: 0;">
			<tbody>
				<tr>
					<td style="vertical-align: top; text-align: right; padding-right: 4px;">user:</td>
					<td>{data.profile.username}</td>
				</tr>
				<tr>
					<td style="vertical-align: top; text-align: right; padding-right: 4px;">created:</td>
					<td>{formatDate(data.profile.created_at)}</td>
				</tr>
				<tr>
					<td style="vertical-align: top; text-align: right; padding-right: 4px;">karma:</td>
					<td>{data.profile.karma}</td>
				</tr>
				{#if data.profile.about}
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">about:</td>
						<td>{data.profile.about}</td>
					</tr>
				{/if}
			</tbody>
		</table>
	{/if}

	<div style="margin-top: 10px; font-size: 10pt;">
		<a href="/user/{data.profile.username}/submissions">submissions</a><br />
		<a href="/user/{data.profile.username}/comments">comments</a><br />
		<a href="/user/{data.profile.username}/favorites">favorites</a>
		{#if data.isOwnProfile}
			<br />
			<a href="/user/{data.profile.username}/hidden">hidden</a>
		{/if}
	</div>
</div>

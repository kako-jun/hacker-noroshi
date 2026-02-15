<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Create Account | ハッカーのろし</title>
</svelte:head>

<div class="hn-form">
	{#if form?.error}
		<div class="form-error">{form.error}</div>
	{/if}

	<form method="POST" use:enhance>
		<table>
			<tbody>
				<tr>
					<td>username:</td>
					<td><input type="text" name="username" value={form?.username ?? ''} autocomplete="username" /></td>
				</tr>
				<tr>
					<td>password:</td>
					<td><input type="password" name="password" autocomplete="new-password" /></td>
				</tr>
			</tbody>
		</table>
		<br />
		<button type="submit">create account</button>
	</form>

	<div class="form-note">
		Usernames can only contain letters, digits, and underscores, and should be between 3 and 15 characters long.
		Passwords should be at least 8 characters.
	</div>
</div>

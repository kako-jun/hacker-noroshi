<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Reset Password | ハッカーのろし</title>
</svelte:head>

<div class="hn-form">
	<b>Reset Password</b>

	{#if form?.success}
		<br /><br />
		<div>Password changed.</div>
		<br />
		<a href="/login">Login</a>
	{:else if form?.verified}
		{#if form?.resetError}
			<div class="form-error">{form.resetError}</div>
		{/if}
		<br /><br />

		<form method="POST" action="?/resetPassword" use:enhance>
			<input type="hidden" name="username" value={form.username} />
			<input type="hidden" name="email" value={form.email} />
			<table>
				<tbody>
					<tr>
						<td>new password:</td>
						<td><input type="password" name="password" autocomplete="new-password" autofocus /></td>
					</tr>
				</tbody>
			</table>
			<br />
			<button type="submit">reset password</button>
		</form>

		<div class="form-note">
			Passwords should be at least 8 characters.
		</div>
	{:else}
		{#if form?.error}
			<div class="form-error">{form.error}</div>
		{/if}
		<br /><br />

		<form method="POST" use:enhance>
			<table>
				<tbody>
					<tr>
						<td>username:</td>
						<td><input type="text" name="username" value={form?.username ?? ''} autocomplete="username" autocorrect="off" spellcheck="false" autocapitalize="off" autofocus /></td>
					</tr>
					<tr>
						<td>email:</td>
						<td><input type="email" name="email" autocomplete="email" /></td>
					</tr>
				</tbody>
			</table>
			<br />
			<button type="submit">verify</button>
		</form>
	{/if}
</div>

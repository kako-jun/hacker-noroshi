<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Login | ハッカーのろし</title>
</svelte:head>

<div class="hn-form">
	<b>Login</b>
	{#if form?.loginError}
		<div class="form-error">{form.loginError}</div>
	{/if}
	<br /><br />

	<form method="POST" action="?/login" use:enhance>
		<table>
			<tbody>
				<tr>
					<td>username:</td>
					<td><input type="text" name="username" value={form?.loginUsername ?? ''} autocomplete="username" autocorrect="off" spellcheck="false" autocapitalize="off" autofocus /></td>
				</tr>
				<tr>
					<td>password:</td>
					<td><input type="password" name="password" autocomplete="current-password" /></td>
				</tr>
			</tbody>
		</table>
		<br />
		<button type="submit">login</button>
	</form>

	<br /><br />

	<b>Create Account</b>
	{#if form?.signupError}
		<div class="form-error">{form.signupError}</div>
	{/if}
	<br /><br />

	<form method="POST" action="?/signup" use:enhance>
		<table>
			<tbody>
				<tr>
					<td>username:</td>
					<td><input type="text" name="username" value={form?.signupUsername ?? ''} autocomplete="username" autocorrect="off" spellcheck="false" autocapitalize="off" /></td>
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
		Usernames can only contain letters, digits, underscores, and hyphens, and should be between 3 and 15 characters long.
		Passwords should be at least 8 characters.
	</div>
</div>

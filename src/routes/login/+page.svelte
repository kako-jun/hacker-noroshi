<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
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
		<input type="hidden" name="next" value={data.next} />
		<div class="login-row">
			username:
			<input type="text" name="username" value={form?.loginUsername ?? ''} autocomplete="username" autocorrect="off" spellcheck="false" autocapitalize="off" autofocus />
		</div>
		<div class="login-row">
			password:
			<input type="password" name="password" autocomplete="current-password" />
		</div>
		<button type="submit">login</button>
	</form>

	<br /><br />

	<b>Create Account</b>
	{#if form?.signupError}
		<div class="form-error">{form.signupError}</div>
	{/if}
	<br /><br />

	<form method="POST" action="?/signup" use:enhance>
		<input type="hidden" name="next" value={data.next} />
		<div class="login-row">
			username:
			<input type="text" name="username" value={form?.signupUsername ?? ''} autocomplete="username" autocorrect="off" spellcheck="false" autocapitalize="off" />
		</div>
		<div class="login-row">
			password:
			<input type="password" name="password" autocomplete="new-password" />
		</div>
		<button type="submit">create account</button>
	</form>

	<div class="form-note">
		Usernames can only contain letters, digits, underscores, and hyphens, and should be between 3 and 15 characters long.
		Passwords should be at least 8 characters.
	</div>
</div>

<style>
	.login-row {
		margin-bottom: 8pt;
	}
	.login-row input {
		width: 220px;
		margin-left: 4px;
	}
	@media (max-width: 750px) {
		.login-row input {
			width: 100%;
			max-width: 220px;
		}
	}
</style>

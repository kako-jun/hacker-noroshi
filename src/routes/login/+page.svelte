<script lang="ts">
	import { enhance } from '$app/forms';
	import { label, tooltip } from '$lib/i18n';

	let { data, form } = $props();

	function l(key: string): string {
		return label(key, data.locale);
	}

	function tip(key: string): string {
		return tooltip(key, data.locale);
	}
</script>

<svelte:head>
	<title>Login | ハッカーのろし</title>
</svelte:head>

<div class="hn-form">
	<b>{l('Login')}</b>
	{#if form?.loginError}
		<div class="form-error">{form.loginError}</div>
	{/if}
	<br /><br />

	<form method="POST" action="?/login" use:enhance>
		<input type="hidden" name="next" value={data.next} />
		<label class="login-row">
			{l('username')}:
			<input type="text" name="username" value={form?.loginUsername ?? ''} autocomplete="username" autocorrect="off" spellcheck="false" autocapitalize="off" autofocus />
		</label>
		<label class="login-row">
			{l('password')}:
			<input type="password" name="password" autocomplete="current-password" />
		</label>
		<button type="submit" title={tip('login')}>{l('login')}</button>
	</form>

	<br /><br />

	<b>{l('Create Account')}</b>
	{#if form?.signupError}
		<div class="form-error">{form.signupError}</div>
	{/if}
	<br /><br />

	<form method="POST" action="?/signup" use:enhance>
		<input type="hidden" name="next" value={data.next} />
		<label class="login-row">
			{l('username')}:
			<input type="text" name="username" value={form?.signupUsername ?? ''} autocomplete="username" autocorrect="off" spellcheck="false" autocapitalize="off" />
		</label>
		<label class="login-row">
			{l('password')}:
			<input type="password" name="password" autocomplete="new-password" />
		</label>
		<button type="submit" title={tip('create account')}>{l('create account')}</button>
	</form>

	<div class="form-note">
		{l('login-note')}
	</div>
</div>

<style>
	.login-row {
		display: block;
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

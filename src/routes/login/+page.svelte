<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Login | ハッカーのろし</title>
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
					<td><input type="password" name="password" autocomplete="current-password" /></td>
				</tr>
			</tbody>
		</table>
		<br />
		<button type="submit">login</button>
	</form>

	<div class="form-note">
		<a href="/signup" style="color: #828282;">Create Account</a>
	</div>
</div>

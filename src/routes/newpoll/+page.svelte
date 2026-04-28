<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Submit Poll | ハッカーのろし</title>
</svelte:head>

<div class="hn-form">
	{#if form?.error}
		<div class="form-error">{form.error}</div>
	{/if}

	<form method="POST" use:enhance>
		<table>
			<tbody>
				<tr>
					<td>title</td>
					<td><input type="text" name="title" value={form?.title ?? ''} maxlength="80" size="50" /></td>
				</tr>
				<tr>
					<td>text</td>
					<td><textarea name="text" rows="4" cols="49">{form?.text ?? ''}</textarea></td>
				</tr>
				<tr>
					<td style="vertical-align: top;">choices</td>
					<td><textarea name="options" rows="8" cols="49">{form?.options ?? ''}</textarea></td>
				</tr>
				<tr>
					<td></td>
					<td><button type="submit">submit</button></td>
				</tr>
			</tbody>
		</table>
	</form>

	<div class="form-note">
		Choices: one per line, blank lines OK between. Minimum 2, maximum 10. Each choice up to 300 characters.
	</div>
</div>

<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Submit | ハッカーのろし</title>
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
					<td>url</td>
					<td><input type="url" name="url" value={form?.url ?? ''} size="50" /></td>
				</tr>
				<tr>
					<td colspan="2" style="text-align: center; padding: 10px 0; font-size: 9pt; color: #828282;">or</td>
				</tr>
				<tr>
					<td>text</td>
					<td><textarea name="text" rows="4" cols="49">{form?.text ?? ''}</textarea></td>
				</tr>
				<tr>
					<td></td>
					<td><button type="submit">submit</button></td>
				</tr>
			</tbody>
		</table>
	</form>

	<div class="form-note">
		Leave url blank to submit a question for discussion. If the title begins with
		"Ask HN:" or "Show HN:", it will be categorized accordingly.
	</div>
</div>

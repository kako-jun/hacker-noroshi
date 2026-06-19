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
					<td>{l('title')}</td>
					<td><input type="text" name="title" value={form?.title ?? ''} maxlength="80" size="50" /></td>
				</tr>
				<tr>
					<td>{l('text')}</td>
					<td><textarea name="text" rows="4" cols="49">{form?.text ?? ''}</textarea></td>
				</tr>
				<tr>
					<td style="vertical-align: top;">{l('choices')}</td>
					<td><textarea name="options" rows="8" cols="49">{form?.options ?? ''}</textarea></td>
				</tr>
				<tr>
					<td></td>
					<td><button type="submit" title={tip('submit')}>{l('submit')}</button></td>
				</tr>
			</tbody>
		</table>
	</form>

	<div class="form-note">
		{l('form-note-poll')}
	</div>
</div>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { label, STORY_TYPE_OPTIONS, tooltip } from '$lib/i18n';
	import { assistIntro, assistHint } from '$lib/assist';

	let { data, form } = $props();

	function l(key: string): string {
		return label(key, data.locale);
	}

	function tip(key: string): string {
		return tooltip(key, data.locale);
	}
</script>

<svelte:head>
	<title>Submit | ハッカーのろし</title>
</svelte:head>

<div class="hn-form">
	<p class="assist-intro">{assistIntro('/submit', data.locale)}</p>
	{#if form?.error}
		<div class="form-error">{form.error}</div>
	{/if}

	<form method="POST" use:enhance>
		<table>
			<tbody>
				<tr>
					<td>{l('title')}</td>
					<td><input type="text" name="title" value={form?.title ?? ''} maxlength="80" size="50" /><div class="assist-hint">{assistHint('submit.title', data.locale)}</div></td>
				</tr>
				<tr>
					<td>{l('story-type')}</td>
					<td>
						<select name="storyType">
							{#each STORY_TYPE_OPTIONS as option (option.id)}
								<option value={option.id} selected={(form?.storyType ?? 'story') === option.id}>{l(option.labelKey)}</option>
							{/each}
						</select>
						<div class="form-note assist-note">{l('story-type-assist')}</div>
					</td>
				</tr>
				<tr>
					<td>{l('url')}</td>
					<td><input type="url" name="url" value={form?.url ?? ''} size="50" /><div class="assist-hint">{assistHint('submit.url', data.locale)}</div></td>
				</tr>
				<tr>
					<td colspan="2" style="text-align: center; padding: 10px 0; font-size: 9pt; color: #828282;">{l('or')}</td>
				</tr>
				<tr>
					<td>{l('text')}</td>
					<td><textarea name="text" rows="4" cols="49">{form?.text ?? ''}</textarea><div class="assist-hint">{assistHint('submit.text', data.locale)}</div></td>
				</tr>
				<tr>
					<td></td>
					<td><button type="submit" title={tip('submit')}>{l('submit')}</button><div class="assist-hint">{assistHint('submit.submit', data.locale)}</div></td>
				</tr>
			</tbody>
		</table>
	</form>

	<div class="form-note">
		{l('form-note-submit')}
	</div>

	<div class="form-note">
		{l('form-note-poll-prefix')} <a href="/newpoll">{l('form-note-poll-link')}</a>.
	</div>
</div>

<style>
	.assist-note {
		margin-top: 3pt;
		max-width: 500px;
	}
</style>

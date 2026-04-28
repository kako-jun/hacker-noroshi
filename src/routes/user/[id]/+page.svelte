<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toISOString().split('T')[0];
	}

	function formatNextChange(dateString: string | null | undefined): string {
		if (!dateString) return '';
		return new Date(dateString).toISOString().split('T')[0];
	}
</script>

<svelte:head>
	<title>Profile: {data.profile.deleted === 1 ? '[deleted]' : data.profile.username} | ハッカーのろし</title>
</svelte:head>

<div class="user-profile" style="padding-left: 40px;">
	{#if data.profile.deleted === 1}
		<p style="font-size: 9pt;">This user has deleted their account.</p>
	{:else if data.isOwnProfile}
		<form method="POST" action="?/update" use:enhance>
			<table style="border-spacing: 0;">
				<tbody>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">user:</td>
						<td>{data.profile.username}</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">created:</td>
						<td><a href="/front?day={formatDate(data.profile.created_at)}">{formatDate(data.profile.created_at)}</a></td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">karma:</td>
						<td>{data.profile.karma}</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">about:</td>
						<td>
							<textarea name="about" rows="5" cols="60" style="font-family: monospace; font-size: 9pt;">{data.profile.about ?? ''}</textarea>
						</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">email:</td>
						<td>
							<input type="text" name="email" value={data.profile.email ?? ''} size="60" style="font-family: monospace; font-size: 9pt;" />
						</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">showdead:</td>
						<td>
							<select name="showdead" style="font-family: Verdana, Geneva, sans-serif; font-size: 9pt;">
								<option value="no" selected={data.profile.showdead === 0}>no</option>
								<option value="yes" selected={data.profile.showdead === 1}>yes</option>
							</select>
						</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">noprocrast:</td>
						<td>
							<select name="noprocrast" style="font-family: Verdana, Geneva, sans-serif; font-size: 9pt;">
								<option value="no" selected={data.profile.noprocrast === 0}>no</option>
								<option value="yes" selected={data.profile.noprocrast === 1}>yes</option>
							</select>
						</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">maxvisit:</td>
						<td>
							<input type="text" name="maxvisit" value={data.profile.maxvisit} size="6" style="font-family: monospace; font-size: 9pt;" />
						</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">minaway:</td>
						<td>
							<input type="text" name="minaway" value={data.profile.minaway} size="6" style="font-family: monospace; font-size: 9pt;" />
						</td>
					</tr>
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">delay:</td>
						<td>
							<input type="text" name="delay" value={data.profile.delay} size="6" style="font-family: monospace; font-size: 9pt;" />
						</td>
					</tr>
					<tr>
						<td></td>
						<td>
							<button type="submit" style="font-family: Verdana, Geneva, sans-serif; font-size: 8pt;">update</button>
						</td>
					</tr>
				</tbody>
			</table>
		</form>
	{:else}
		<table style="border-spacing: 0;">
			<tbody>
				<tr>
					<td style="vertical-align: top; text-align: right; padding-right: 4px;">user:</td>
					<td>{data.profile.username}</td>
				</tr>
				<tr>
					<td style="vertical-align: top; text-align: right; padding-right: 4px;">created:</td>
					<td><a href="/front?day={formatDate(data.profile.created_at)}">{formatDate(data.profile.created_at)}</a></td>
				</tr>
				<tr>
					<td style="vertical-align: top; text-align: right; padding-right: 4px;">karma:</td>
					<td>{data.profile.karma}</td>
				</tr>
				{#if data.profile.about}
					<tr>
						<td style="vertical-align: top; text-align: right; padding-right: 4px;">about:</td>
						<td>{data.profile.about}</td>
					</tr>
				{/if}
			</tbody>
		</table>
	{/if}

	{#if data.isOwnProfile}
		<div style="margin-top: 14pt; padding-left: 50px;">
			<p style="font-size: 9pt; margin: 0 0 4pt 0;"><b>Change username</b></p>
			{#if form?.changeUsernameError}
				<p style="font-size: 9pt; color: #ff6600; margin: 0 0 4pt 0;">{form.changeUsernameError}</p>
			{/if}
			{#if data.nextUsernameChangeAt}
				<p style="font-size: 9pt; color: #828282; margin: 0 0 4pt 0;">
					次の変更可能日: {formatNextChange(data.nextUsernameChangeAt)}
				</p>
			{/if}
			<form method="POST" action="?/changeUsername" use:enhance>
				<table style="border-spacing: 0;">
					<tbody>
						<tr>
							<td style="vertical-align: top; text-align: right; padding-right: 4px;"><label for="newUsername">new username:</label></td>
							<td>
								<input id="newUsername" type="text" name="newUsername" size="20" required minlength="3" maxlength="15" pattern="[a-zA-Z0-9_\-]+" autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="off" style="font-family: monospace; font-size: 9pt;" />
							</td>
						</tr>
						<tr>
							<td></td>
							<td>
								<button type="submit" style="font-family: Verdana, Geneva, sans-serif; font-size: 8pt;">change username</button>
								<span style="font-size: 8pt; color: #828282; margin-left: 6pt;">90日に1回まで。過去に使われた名前は使えません。</span>
							</td>
						</tr>
					</tbody>
				</table>
			</form>
		</div>
	{/if}

	{#if data.isOwnProfile}
		<div style="margin-top: 14pt; padding-left: 50px;">
			<p style="font-size: 9pt; margin: 0 0 4pt 0;"><b>Delete account</b></p>
			{#if form?.deleteAccountError}
				<p style="font-size: 9pt; color: #ff6600; margin: 0 0 4pt 0;">{form.deleteAccountError}</p>
			{/if}
			<p style="font-size: 8pt; color: #828282; margin: 0 0 6pt 0;">
				アカウントを削除すると元に戻せません。投稿とコメントは <code>[deleted]</code> としてスレッドに残ります。削除済みユーザー名は再取得できません。
			</p>
			<form
				method="POST"
				action="?/deleteAccount"
				use:enhance={({ cancel }) => {
					if (!confirm('本当にアカウントを削除しますか？この操作は元に戻せません。')) {
						cancel();
					}
					return async ({ update }) => {
						await update();
					};
				}}
			>
				<table style="border-spacing: 0;">
					<tbody>
						<tr>
							<td style="vertical-align: top; text-align: right; padding-right: 4px;"><label for="deletePassword">password:</label></td>
							<td>
								<input id="deletePassword" type="password" name="password" size="20" required autocomplete="current-password" style="font-family: monospace; font-size: 9pt;" />
							</td>
						</tr>
						<tr>
							<td></td>
							<td>
								<button type="submit" style="font-family: Verdana, Geneva, sans-serif; font-size: 8pt;">delete account</button>
							</td>
						</tr>
					</tbody>
				</table>
			</form>
		</div>
	{/if}

	<div style="margin-top: 10px; padding-left: 50px; font-size: 10pt;">
		<a href="/user/{data.profile.username}/submissions" style="text-decoration: underline; color: #828282;">submissions</a><br />
		<a href="/user/{data.profile.username}/comments" style="text-decoration: underline; color: #828282;">comments</a>
		{#if data.profile.deleted !== 1}
			<br />
			<a href="/user/{data.profile.username}/favorites" style="text-decoration: underline; color: #828282;">favorites</a>
		{/if}
		{#if data.isOwnProfile}
			<br />
			<a href="/user/{data.profile.username}/hidden" style="text-decoration: underline; color: #828282;">hidden</a>
		{/if}
	</div>
</div>

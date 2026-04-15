<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>noprocrast | ハッカーのろし</title>
</svelte:head>

<div style="padding: 40px;">
	<p style="font-family: Verdana, Geneva, sans-serif; font-size: 10pt;">
		仕事に戻りましょう！あと {data.remaining} 分は閲覧できません。
	</p>
</div>

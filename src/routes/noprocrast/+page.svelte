<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>noprocrast | ハッカーのろし</title>
</svelte:head>

<div style="padding: 40px;">
	<p style="font-family: Verdana, Geneva, sans-serif; font-size: 10pt;">
		あと {data.remaining} 分は戻ってこられません。noprocrast 設定が有効です。
	</p>
</div>

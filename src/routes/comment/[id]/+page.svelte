<script lang="ts">
	import ItemPage from '$lib/components/ItemPage.svelte';
	let { data, form } = $props();
</script>

<ItemPage {data} {form} />

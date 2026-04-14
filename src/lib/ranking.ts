export function calculateScore(points: number, createdAt: string): number {
	const now = Date.now();
	const created = new Date(createdAt).getTime();
	const hoursAge = (now - created) / (1000 * 60 * 60);
	return (points - 1) / Math.pow(hoursAge + 2, 1.8);
}

export function timeAgo(dateString: string): string {
	const now = Date.now();
	const date = new Date(dateString).getTime();
	const seconds = Math.floor((now - date) / 1000);

	if (seconds < 60) return `${seconds} seconds ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
	const years = Math.floor(months / 12);
	return `${years} year${years !== 1 ? 's' : ''} ago`;
}

export function extractDomain(url: string | null): string {
	if (!url) return '';
	try {
		const hostname = new URL(url).hostname;
		return hostname.replace(/^www\./, '');
	} catch {
		return '';
	}
}

export function isNewUser(userCreatedAt: string): boolean {
	const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
	return Date.now() - new Date(userCreatedAt).getTime() < TWO_WEEKS_MS;
}

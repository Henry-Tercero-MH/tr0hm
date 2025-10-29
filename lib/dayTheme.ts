export default function getDayTheme() {
	try {
		const h = new Date().getHours();
		// simple heuristic: daytime 7..18 => light, else dark
		const mode = h >= 7 && h < 19 ? 'light' : 'dark';
		const vars = mode === 'light'
			? {
					'--bg': '#ffffff',
					'--text': '#0f172a'
				}
			: {
					'--bg': '#071123',
					'--text': '#e6eef8'
				};
		return { mode, vars };
	} catch (e) {
		return { mode: 'dark', vars: { '--bg': '#071123', '--text': '#e6eef8' } };
	}
}

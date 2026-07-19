// Standalone scatter-plot SVG generator: data points + best-fit regression line.
// The SVG embeds its own <style> with a prefers-color-scheme block, so it is
// theme-aware when viewed in a browser and needs no external dependencies.

/** Round a range up to a "nice" number (1, 2, 5 × 10ⁿ). */
function niceNum (range, round) {
	const exp = Math.floor(Math.log10(range));
	const frac = range / 10 ** exp;
	let nice;

	if (round) {
		nice = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
	}
	else {
		nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
	}

	return nice * 10 ** exp;
}

/** Produce ~`count` nicely-rounded ticks spanning [0, max]. */
function makeTicks (max, count = 5) {
	const step = niceNum(niceNum(max, false) / (count - 1), true);
	const niceMax = Math.ceil(max / step) * step;
	const ticks = [];

	for (let v = 0; v <= niceMax + step * 0.5; v += step) {
		ticks.push(Number(v.toFixed(10)));
	}

	return { ticks, niceMax };
}

/** Format a tick value compactly. */
function fmt (v) {
	return Number(v.toPrecision(6)).toString();
}

/**
 * Build a scatter-plot SVG string.
 *
 * @param {object} opts
 * @param {Array<[number, number]>} opts.points - [x, y] data points.
 * @param {{ slope: number, intercept: number, r2: number }} opts.regression
 * @param {string} opts.xLabel - x-axis title.
 * @param {string} opts.yLabel - y-axis title.
 * @param {string} opts.title - chart title.
 * @param {number} [opts.xMax] - force x-domain max (else derived from data).
 * @param {number} [opts.yMax] - force y-domain max (else derived from data).
 * @param {number} [opts.width]
 * @param {number} [opts.height]
 * @returns {string} A complete <svg> document.
 */
export function scatterSVG ({
	points,
	regression,
	xLabel,
	yLabel,
	title,
	xMax,
	yMax,
	width = 520,
	height = 440,
}) {
	const m = { top: 48, right: 22, bottom: 54, left: 62 };
	const plotW = width - m.left - m.right;
	const plotH = height - m.top - m.bottom;

	const dataXMax = xMax ?? points.reduce((a, [x]) => Math.max(a, x), 0);
	const dataYMax = yMax ?? points.reduce((a, [, y]) => Math.max(a, y), 0);
	const xt = makeTicks(dataXMax);
	const yt = makeTicks(dataYMax);
	const xDom = xt.niceMax;
	const yDom = yt.niceMax;

	// Data space -> pixel space (SVG y grows downward).
	const px = x => m.left + (x / xDom) * plotW;
	const py = y => m.top + plotH - (y / yDom) * plotH;

	// Gridlines + tick labels.
	const xGrid = xt.ticks.map(t =>
		`<line class="grid" x1="${px(t).toFixed(1)}" y1="${m.top}" x2="${px(t).toFixed(1)}" y2="${m.top + plotH}"/>` +
		`<text class="tick" x="${px(t).toFixed(1)}" y="${m.top + plotH + 18}" text-anchor="middle">${fmt(t)}</text>`
	).join("");

	const yGrid = yt.ticks.map(t =>
		`<line class="grid" x1="${m.left}" y1="${py(t).toFixed(1)}" x2="${m.left + plotW}" y2="${py(t).toFixed(1)}"/>` +
		`<text class="tick" x="${m.left - 10}" y="${(py(t) + 4).toFixed(1)}" text-anchor="end">${fmt(t)}</text>`
	).join("");

	// Scatter points (low opacity so density reads through overplotting).
	const dots = points.map(([x, y]) =>
		`<circle cx="${px(x).toFixed(1)}" cy="${py(y).toFixed(1)}" r="2"/>`
	).join("");

	// Best-fit line across the full x-domain (clipped to the plot rect).
	const { slope, intercept, r2 } = regression;
	const x0 = 0, x1 = xDom;
	const fit = `<line class="fit" x1="${px(x0).toFixed(1)}" y1="${py(slope * x0 + intercept).toFixed(1)}" ` +
		`x2="${px(x1).toFixed(1)}" y2="${py(slope * x1 + intercept).toFixed(1)}"/>`;

	// Equation + r² annotation, placed in the (empty) top-left of the plot.
	const sign = intercept < 0 ? "−" : "+";
	const eqn = `y = ${slope.toFixed(3)}x ${sign} ${Math.abs(intercept).toFixed(3)}`;
	const r2Str = `r² = ${r2.toFixed(4)}`;

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif">
	<style>
		:root {
			--surface: #fcfcfb; --ink: #0b0b0b; --secondary: #52514e; --muted: #898781;
			--grid: #e1e0d9; --axis: #c3c2b7; --series: #2a78d6; --fit: #eb6834;
		}
		@media (prefers-color-scheme: dark) {
			:root {
				--surface: #1a1a19; --ink: #ffffff; --secondary: #c3c2b7; --muted: #898781;
				--grid: #2c2c2a; --axis: #383835; --series: #3987e5; --fit: #d95926;
			}
		}
		.surface { fill: var(--surface); }
		.grid { stroke: var(--grid); stroke-width: 1; }
		.axis { stroke: var(--axis); stroke-width: 1; }
		.tick { fill: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
		.pt { fill: var(--series); fill-opacity: 0.22; }
		.fit { stroke: var(--fit); stroke-width: 2; }
		.title { fill: var(--ink); font-size: 15px; font-weight: 600; }
		.atitle { fill: var(--secondary); font-size: 13px; }
		.annot { fill: var(--ink); font-size: 12px; font-variant-numeric: tabular-nums; }
	</style>
	<rect class="surface" x="0" y="0" width="${width}" height="${height}"/>
	<text class="title" x="${m.left}" y="26">${title}</text>
	<clipPath id="plot"><rect x="${m.left}" y="${m.top}" width="${plotW}" height="${plotH}"/></clipPath>
	${yGrid}
	${xGrid}
	<line class="axis" x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${m.top + plotH}"/>
	<line class="axis" x1="${m.left}" y1="${m.top + plotH}" x2="${m.left + plotW}" y2="${m.top + plotH}"/>
	<g class="pt" clip-path="url(#plot)">${dots}</g>
	<g clip-path="url(#plot)">${fit}</g>
	<text class="annot" x="${m.left + 12}" y="${m.top + 20}">${eqn}</text>
	<text class="annot" x="${m.left + 12}" y="${m.top + 38}">${r2Str}</text>
	<text class="atitle" x="${m.left + plotW / 2}" y="${height - 14}" text-anchor="middle">${xLabel}</text>
	<text class="atitle" x="16" y="${m.top + plotH / 2}" text-anchor="middle" transform="rotate(-90 16 ${m.top + plotH / 2})">${yLabel}</text>
</svg>
`;
}

/** Symmetric ticks spanning [-domain, +domain] at a nice step. */
function symmetricTicks (domain) {
	const step = niceNum(domain / 2, true);
	const ticks = [];

	for (let v = -Math.ceil(domain / step) * step; v <= domain + step * 0.5; v += step) {
		ticks.push(Number(v.toFixed(10)));
	}

	return ticks;
}

/**
 * Build a top-down Oklab a-b scatter SVG: data points plus one or more gamut
 * outlines drawn as closed polygons. Uses equal aspect ratio (a and b share the
 * same scale) and a symmetric domain centered on the neutral axis.
 *
 * @param {object} opts
 * @param {Array<[number, number]>} opts.points - [a, b] data points.
 * @param {string[]} [opts.pointColors] - Optional per-point CSS fill (same
 *   length as points). When given, dots are painted their own color at higher
 *   opacity; otherwise they render as neutral low-opacity ink.
 * @param {Array<{ label: string, slot: string, points: Array<[number, number]> }>} opts.gamuts
 *   Outlines; `slot` is a CSS class ("g1".."g3") mapping to a color.
 * @param {string} opts.title
 * @param {number} [opts.domain] - Half-extent of both axes (else derived).
 * @param {number} [opts.size] - Square canvas side in px.
 * @returns {string} A complete <svg> document.
 */
export function abScatterSVG ({ points, pointColors, gamuts, title, domain, size = 560 }) {
	const m = { top: 48, right: 20, bottom: 48, left: 52 };
	const plot = size - Math.max(m.left + m.right, m.top + m.bottom);
	const ox = m.left;          // plot origin (top-left of plot box)
	const oy = m.top;

	const maxR = domain ?? [...gamuts.flatMap(g => g.points), ...points]
		.reduce((a, [x, y]) => Math.max(a, Math.hypot(x, y)), 0);
	const dom = domain ?? (() => {
		const step = niceNum(maxR / 2, true);
		return Math.ceil(maxR / step) * step;
	})();

	// a -> x (right = +a), b -> y (up = +b), equal scale, origin centered.
	const cx = ox + plot / 2;
	const cy = oy + plot / 2;
	const px = a => cx + (a / dom) * (plot / 2);
	const py = b => cy - (b / dom) * (plot / 2);

	const ticks = symmetricTicks(dom).filter(t => Math.abs(t) <= dom + 1e-9);

	const grid = ticks.map(t => {
		const x = px(t), y = py(t);
		return `<line class="grid" x1="${x.toFixed(1)}" y1="${oy}" x2="${x.toFixed(1)}" y2="${oy + plot}"/>` +
			`<line class="grid" x1="${ox}" y1="${y.toFixed(1)}" x2="${ox + plot}" y2="${y.toFixed(1)}"/>` +
			(t === 0 ? "" :
				`<text class="tick" x="${x.toFixed(1)}" y="${oy + plot + 16}" text-anchor="middle">${fmt(t)}</text>` +
				`<text class="tick" x="${ox - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${fmt(t)}</text>`);
	}).join("");

	// Neutral axes through the origin.
	const axes =
		`<line class="axis" x1="${px(0).toFixed(1)}" y1="${oy}" x2="${px(0).toFixed(1)}" y2="${oy + plot}"/>` +
		`<line class="axis" x1="${ox}" y1="${py(0).toFixed(1)}" x2="${ox + plot}" y2="${py(0).toFixed(1)}"/>`;

	const colored = Array.isArray(pointColors);
	const dotR = colored ? 2.6 : 2;
	const dots = points.map(([a, b], i) => {
		// Inline style (not a fill attribute) so the per-dot color wins over the
		// `circle { fill: var(--ink) }` CSS rule, which outranks presentation attrs.
		const fill = colored ? ` style="fill:${pointColors[i]}"` : "";
		return `<circle cx="${px(a).toFixed(1)}" cy="${py(b).toFixed(1)}" r="${dotR}"${fill}/>`;
	}).join("");

	const outlines = gamuts.map(g => {
		const d = "M" + g.points.map(([a, b]) => `${px(a).toFixed(1)},${py(b).toFixed(1)}`).join("L") + "Z";
		return `<path class="gamut ${g.slot}" d="${d}"/>`;
	}).join("");

	// Legend, top-left inside the plot.
	const legend = gamuts.map((g, i) => {
		const y = oy + 16 + i * 20;
		return `<line class="gamut ${g.slot}" x1="${ox + 12}" y1="${y}" x2="${ox + 32}" y2="${y}"/>` +
			`<text class="legend" x="${ox + 38}" y="${y + 4}">${g.label}</text>`;
	}).join("");

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif">
	<style>
		:root {
			--surface: #fcfcfb; --ink: #0b0b0b; --secondary: #52514e; --muted: #898781;
			--grid: #e1e0d9; --axis: #c3c2b7;
			--g1: #2a78d6; --g2: #008300; --g3: #4a3aa7;
		}
		@media (prefers-color-scheme: dark) {
			:root {
				--surface: #1a1a19; --ink: #ffffff; --secondary: #c3c2b7; --muted: #898781;
				--grid: #2c2c2a; --axis: #383835;
				--g1: #3987e5; --g2: #008300; --g3: #9085e9;
			}
		}
		.surface { fill: var(--surface); }
		.grid { stroke: var(--grid); stroke-width: 1; }
		.axis { stroke: var(--axis); stroke-width: 1; }
		.tick { fill: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
		circle { fill: var(--ink); }
		.gamut { fill: none; stroke-width: 2; }
		.gamut.g1 { stroke: var(--g1); }
		.gamut.g2 { stroke: var(--g2); }
		.gamut.g3 { stroke: var(--g3); }
		.title { fill: var(--ink); font-size: 15px; font-weight: 600; }
		.atitle { fill: var(--secondary); font-size: 13px; font-style: italic; }
		.legend { fill: var(--secondary); font-size: 12px; }
	</style>
	<rect class="surface" x="0" y="0" width="${size}" height="${size}"/>
	<text class="title" x="${ox}" y="26">${title}</text>
	<clipPath id="abplot"><rect x="${ox}" y="${oy}" width="${plot}" height="${plot}"/></clipPath>
	${grid}
	${axes}
	<g clip-path="url(#abplot)" fill-opacity="${colored ? 0.9 : 0.28}">${dots}</g>
	<g clip-path="url(#abplot)">${outlines}</g>
	${legend}
	<text class="atitle" x="${cx.toFixed(1)}" y="${oy + plot + 34}" text-anchor="middle">a</text>
	<text class="atitle" x="18" y="${cy.toFixed(1)}" text-anchor="middle" transform="rotate(-90 18 ${cy.toFixed(1)})">b</text>
</svg>
`;
}

/** Path for a bar with only its top two corners rounded, anchored at baseline. */
function topRoundedBar (x, y, w, h, r) {
	r = Math.min(r, w / 2, h);
	return `M${x.toFixed(1)},${(y + h).toFixed(1)}` +
		`V${(y + r).toFixed(1)}Q${x.toFixed(1)},${y.toFixed(1)} ${(x + r).toFixed(1)},${y.toFixed(1)}` +
		`H${(x + w - r).toFixed(1)}Q${(x + w).toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${(y + r).toFixed(1)}` +
		`V${(y + h).toFixed(1)}Z`;
}

/**
 * Build a histogram SVG for a set of values.
 *
 * @param {object} opts
 * @param {number[]} opts.values - Raw values to bin.
 * @param {number} opts.min - Left edge of the first bin.
 * @param {number} opts.max - Right edge of the last bin.
 * @param {number} [opts.bins] - Number of bins.
 * @param {string} opts.xLabel
 * @param {string} opts.title
 * @param {{ value: number, label: string }} [opts.refLine] - Optional vertical marker.
 * @param {number} [opts.width]
 * @param {number} [opts.height]
 * @returns {string} A complete <svg> document.
 */
export function histogramSVG ({ values, min, max, bins = 20, xLabel, title, refLine, width = 580, height = 380 }) {
	const m = { top: 48, right: 20, bottom: 52, left: 56 };
	const plotW = width - m.left - m.right;
	const plotH = height - m.top - m.bottom;

	const binW = (max - min) / bins;
	const counts = new Array(bins).fill(0);
	for (const v of values) {
		let k = Math.floor((v - min) / binW);
		if (k === bins) k = bins - 1;          // include the exact max in the last bin
		if (k >= 0 && k < bins) counts[k]++;
	}

	const yt = makeTicks(Math.max(...counts));
	const xDomMin = min, xDomMax = max;
	const px = x => m.left + ((x - xDomMin) / (xDomMax - xDomMin)) * plotW;
	const py = c => m.top + plotH - (c / yt.niceMax) * plotH;

	// x ticks: bin edges are noisy, so use nice ticks across [min, max].
	const xt = makeTicks(max);
	const xTicks = xt.ticks.filter(t => t >= min && t <= max);

	const yGrid = yt.ticks.map(t =>
		`<line class="grid" x1="${m.left}" y1="${py(t).toFixed(1)}" x2="${m.left + plotW}" y2="${py(t).toFixed(1)}"/>` +
		`<text class="tick" x="${m.left - 10}" y="${(py(t) + 4).toFixed(1)}" text-anchor="end">${fmt(t)}</text>`
	).join("");

	const xTickLabels = xTicks.map(t =>
		`<text class="tick" x="${px(t).toFixed(1)}" y="${m.top + plotH + 18}" text-anchor="middle">${fmt(t)}</text>`
	).join("");

	const gap = 2; // surface gap between adjacent bars
	const bars = counts.map((c, i) => {
		if (c === 0) return "";
		const x0 = px(min + i * binW) + gap / 2;
		const x1 = px(min + (i + 1) * binW) - gap / 2;
		const y = py(c);
		return `<path class="bar" d="${topRoundedBar(x0, y, x1 - x0, m.top + plotH - y, 4)}"/>`;
	}).join("");

	const ref = refLine ? (() => {
		const x = px(refLine.value).toFixed(1);
		return `<line class="ref" x1="${x}" y1="${m.top}" x2="${x}" y2="${m.top + plotH}"/>` +
			`<text class="reflabel" x="${x}" y="${m.top - 6}" text-anchor="middle">${refLine.label}</text>`;
	})() : "";

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif">
	<style>
		:root {
			--surface: #fcfcfb; --ink: #0b0b0b; --secondary: #52514e; --muted: #898781;
			--grid: #e1e0d9; --axis: #c3c2b7; --series: #2a78d6; --ref: #eb6834;
		}
		@media (prefers-color-scheme: dark) {
			:root {
				--surface: #1a1a19; --ink: #ffffff; --secondary: #c3c2b7; --muted: #898781;
				--grid: #2c2c2a; --axis: #383835; --series: #3987e5; --ref: #d95926;
			}
		}
		.surface { fill: var(--surface); }
		.grid { stroke: var(--grid); stroke-width: 1; }
		.axis { stroke: var(--axis); stroke-width: 1; }
		.tick { fill: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
		.bar { fill: var(--series); }
		.ref { stroke: var(--ref); stroke-width: 2; stroke-dasharray: 4 3; }
		.reflabel { fill: var(--ref); font-size: 12px; }
		.title { fill: var(--ink); font-size: 15px; font-weight: 600; }
		.atitle { fill: var(--secondary); font-size: 13px; }
	</style>
	<rect class="surface" x="0" y="0" width="${width}" height="${height}"/>
	<text class="title" x="${m.left}" y="26">${title}</text>
	${yGrid}
	${bars}
	${ref}
	<line class="axis" x1="${m.left}" y1="${m.top + plotH}" x2="${m.left + plotW}" y2="${m.top + plotH}"/>
	${xTickLabels}
	<text class="atitle" x="${m.left + plotW / 2}" y="${height - 12}" text-anchor="middle">${xLabel}</text>
	<text class="atitle" x="16" y="${m.top + plotH / 2}" text-anchor="middle" transform="rotate(-90 16 ${m.top + plotH / 2})">count</text>
</svg>
`;
}

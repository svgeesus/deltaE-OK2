import Color from "colorjs.io";

/**
 * Seeded pseudo-random number generator (mulberry32). Returns a function that
 * yields deterministic values in [0, 1), so a whole dataset reproduces exactly
 * from its seed. Use one instance for an entire run and pass it through as the
 * `random` argument to the generators below.
 *
 * @param {number} seed - 32-bit integer seed.
 * @returns {() => number} A Math.random-compatible function.
 */
export function makeRandom (seed) {
	let a = seed >>> 0;

	return function () {
		a = (a + 0x6D2B79F5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Generate a normally distributed random number (Box–Muller transform).
 *
 * @param {number} mean
 * @param {number} stdDev
 * @param {() => number} [random] - Uniform [0, 1) source; defaults to Math.random.
 */
function randomNormal (mean = 0, stdDev = 1, random = Math.random) {
	let u1 = 0, u2 = 0;
	while (u1 === 0) u1 = random(); // avoid log(0)
	u2 = random();

	const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
	return z * stdDev + mean;
}

/**
 * Create an array of exactly `n` colors in CAM16-JMh. J and M are drawn from
 * independent normal distributions; hue h is drawn uniformly over the full
 * [0, 360) circle. Colors are kept only if they are strictly inside the
 * REC.2020 (BT.2020) gamut; the loop keeps sampling until `n` are collected.
 *
 * @param {number} n - Number of in-gamut colors to return.
 * @param {object} J - { mean, stdDev } for lightness J.
 * @param {object} M - { mean, stdDev } for colorfulness M.
 * @param {() => number} [random] - Uniform [0, 1) source; defaults to
 *   Math.random. Pass a seeded generator (see makeRandom) for reproducibility.
 * @param {number} [maxMisses] - Safety cap on *consecutive* out-of-gamut
 *   samples. Defaults to 10000. Throws if reached, so a distribution that
 *   sits outside the REC.2020 gamut fails fast instead of grinding through
 *   a total-sample budget.
 * @returns {Color[]} Exactly `n` colors inside REC.2020, in CAM16-JMh.
 */
export function generateColors (n, J, M, random = Math.random, maxMisses = 10000) {
	const colors = [];
	let misses = 0;

	while (colors.length < n) {
		let j = randomNormal(J.mean, J.stdDev, random);
		let m = randomNormal(M.mean, M.stdDev, random);
		let h = random() * 360; // hue: uniform over [0, 360)

		// J and M are non-negative; clamp so imaginary coords don't slip through.
		j = Math.max(0, j);
		m = Math.max(0, m);

		const color = new Color("cam16-jmh", [j, m, h]);

		// epsilon: 0 => strict gamut membership, no tolerance.
		if (color.inGamut("rec2020", { epsilon: 0 })) {
			colors.push(color);
			misses = 0; // reset the consecutive-miss counter on every hit
		}
		else if (++misses >= maxMisses) {
			throw new Error(
				`generateColors: ${maxMisses} consecutive out-of-gamut samples ` +
				`after finding ${colors.length} of ${n} colors. The distribution ` +
				`may sit mostly outside the REC.2020 gamut.`
			);
		}
	}

	return colors;
}

/**
 * For each color in `colors`, generate exactly `m` similar colors by perturbing
 * its J, M, and h coordinates with independent normal distributions centered
 * on the base color's own coordinates. Only similar colors strictly inside the
 * REC.2020 (BT.2020) gamut are kept; the loop keeps resampling until `m` are
 * found for each base. Each is stored as a `[base, similar]` pair.
 *
 * @param {Color[]} colors - Base colors in CAM16-JMh (e.g. from generateColors).
 * @param {number} m - Number of in-gamut similar colors to produce per base.
 * @param {object} stdDevs - { J, M, h } standard deviations for the perturbation.
 * @param {() => number} [random] - Uniform [0, 1) source; defaults to
 *   Math.random. Pass a seeded generator (see makeRandom) for reproducibility.
 * @param {number} [maxMisses] - Safety cap on *consecutive* out-of-gamut
 *   samples for a single base. Defaults to 10000. Throws if reached, so a base
 *   too close to the gamut boundary fails fast instead of looping forever.
 * @returns {Array<[Color, Color]>} Array of [base, similar] color pairs
 *   (exactly `colors.length × m` of them).
 */
export function generatePairs (colors, m, stdDevs, random = Math.random, maxMisses = 10000) {
	const pairs = [];

	for (const base of colors) {
		const [J0, M0, h0] = base.coords;
		let found = 0;
		let misses = 0;

		while (found < m) {
			let j = randomNormal(J0, stdDevs.J, random);
			let mm = randomNormal(M0, stdDevs.M, random);
			let h = randomNormal(h0, stdDevs.h, random);

			// J and M are non-negative; hue is circular, wrap into [0, 360).
			j = Math.max(0, j);
			mm = Math.max(0, mm);
			h = ((h % 360) + 360) % 360;

			const similar = new Color("cam16-jmh", [j, mm, h]);

			// epsilon: 0 => strict gamut membership, no tolerance.
			if (similar.inGamut("rec2020", { epsilon: 0 })) {
				pairs.push([base, similar]);
				found++;
				misses = 0; // reset the consecutive-miss counter on every hit
			}
			else if (++misses >= maxMisses) {
				throw new Error(
					`generatePairs: ${maxMisses} consecutive out-of-gamut samples ` +
					`for base [${J0}, ${M0}, ${h0}] after finding ${found} of ${m}. ` +
					`This base may sit too close to the REC.2020 gamut boundary.`
				);
			}
		}
	}

	return pairs;
}

/**
 * Compute the ΔE between every color pair using three methods: ΔE2000, ΔEOK,
 * and ΔEOK2 (all built into Color.js). Returns three arrays, each aligned with
 * `pairs` by index.
 *
 * @param {Array<[Color, Color]>} pairs - Color pairs (e.g. from generatePairs).
 * @returns {{ deltaE2000: number[], deltaEOK: number[], deltaEOK2: number[] }}
 */
export function computeDeltaEs (pairs) {
	const deltaE2000 = [];
	const deltaEOK = [];
	const deltaEOK2 = [];

	for (const [a, b] of pairs) {
		deltaE2000.push(a.deltaE2000(b));
		deltaEOK.push(a.deltaEOK(b));
		deltaEOK2.push(a.deltaEOK2(b));
	}

	return { deltaE2000, deltaEOK, deltaEOK2 };
}

/**
 * Ordinary least-squares linear regression of `y` on `x` (fits y = slope·x +
 * intercept). Also returns the Pearson correlation `r` and coefficient of
 * determination `r2`. For comparing a candidate metric against a reference,
 * pass x = candidate (ΔEOK / ΔEOK2) and y = reference (ΔE2000); r2 is the same
 * either way, but slope/intercept describe how the reference varies with the
 * candidate.
 *
 * @param {number[]} x - Independent variable (same length as y).
 * @param {number[]} y - Dependent variable.
 * @returns {{ slope: number, intercept: number, r: number, r2: number, n: number }}
 */
export function linearRegression (x, y) {
	const n = x.length;

	if (n !== y.length) {
		throw new Error(`linearRegression: x and y differ in length (${n} vs ${y.length}).`);
	}

	let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;

	for (let i = 0; i < n; i++) {
		sx += x[i];
		sy += y[i];
		sxy += x[i] * y[i];
		sxx += x[i] * x[i];
		syy += y[i] * y[i];
	}

	const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
	const intercept = (sy - slope * sx) / n;
	const r = (n * sxy - sx * sy) /
		Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));

	return { slope, intercept, r, r2: r * r, n };
}

/**
 * Serialize the color pairs and their three ΔE values to CSV, so the dataset
 * can be recomputed and independently verified. Each row holds the CAM16-JMh
 * coordinates of both colors (the source of truth) plus the three distances.
 *
 * @param {Array<[Color, Color]>} pairs - Color pairs (e.g. from generatePairs).
 * @param {{ deltaE2000: number[], deltaEOK: number[], deltaEOK2: number[] }} deltaEs
 * @returns {string} CSV text with a header row and one row per pair.
 */
export function pairsToCSV (pairs, { deltaE2000, deltaEOK, deltaEOK2 }) {
	const header = "baseJ,baseM,baseH,sampleJ,sampleM,sampleH,deltaE2000,deltaEOK,deltaEOK2";

	const rows = pairs.map(([a, b], i) => {
		const [J1, M1, h1] = a.coords;
		const [J2, M2, h2] = b.coords;
		return [J1, M1, h1, J2, M2, h2, deltaE2000[i], deltaEOK[i], deltaEOK2[i]].join(",");
	});

	return [header, ...rows].join("\n") + "\n";
}

// The six most-saturated corners of the RGB cube, in hue order. The edges
// connecting them (one channel high, one low, one ramping) trace the maximum-
// chroma locus of the gamut — its outline in the Oklab a-b plane.
const SATURATED_CORNERS = [
	[1, 0, 0], // red
	[1, 1, 0], // yellow
	[0, 1, 0], // green
	[0, 1, 1], // cyan
	[0, 0, 1], // blue
	[1, 0, 1], // magenta
];

/**
 * Compute the top-down (Oklab a-b plane) silhouette of an RGB gamut: the
 * maximum-chroma outline, i.e. the projection of the gamut's most saturated
 * colors. Traces the six saturated cube edges (red→yellow→green→cyan→blue→
 * magenta→red) in order, so the returned ring is already correctly sequenced
 * and free of the aliasing you get from hue-binning surface samples. The six
 * genuine cusps sit at the primaries/secondaries.
 *
 * Note: this is the max-chroma boundary across ALL lightnesses (the maximal
 * a-b footprint of the gamut), not a single-L slice.
 *
 * @param {string} spaceId - RGB space id: "srgb", "p3", or "rec2020".
 * @param {number} [stepsPerEdge] - Samples per cube edge; higher = smoother.
 * @returns {Array<[number, number]>} Ordered [a, b] ring (draw as closed).
 */
export function gamutBoundaryAB (spaceId, stepsPerEdge = 64) {
	const ring = [];

	for (let e = 0; e < SATURATED_CORNERS.length; e++) {
		const from = SATURATED_CORNERS[e];
		const to = SATURATED_CORNERS[(e + 1) % SATURATED_CORNERS.length];

		// [0, 1) along the edge; the endpoint is covered by the next edge's start.
		for (let s = 0; s < stepsPerEdge; s++) {
			const t = s / stepsPerEdge;
			const rgb = from.map((v, i) => v + (to[i] - v) * t);
			const [, a, b] = new Color(spaceId, rgb).to("oklab").coords;
			ring.push([a, b]);
		}
	}

	return ring;
}

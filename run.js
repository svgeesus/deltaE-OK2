import { writeFileSync } from "node:fs";
import {
	makeRandom,
	generateColors,
	generatePairs,
	computeDeltaEs,
	linearRegression,
	pairsToCSV,
	gamutBoundaryAB,
} from "./generate-colors.js";
import { scatterSVG, abScatterSVG, histogramSVG } from "./plot.js";

// --- Parameters --------------------------------------------------------------

const SEED = 42;                                  // change to regenerate dataset
const N = 1000;                                   // base colors
const S = 5;                                      // similar colors per base
const baseJ = { mean: 60, stdDev: 20 };           // CAM16 lightness
const baseM = { mean: 25, stdDev: 20 };           // CAM16 colorfulness
const perturbation = { J: 4, M: 4, h: 4 };        // stdDevs for similar colors

// --- Pipeline ----------------------------------------------------------------

// Separate seeded generators so each step reproduces independently: changing
// the base-color generation won't disturb the pairing stream, and vice versa.
const colorsRandom = makeRandom(SEED);
const pairsRandom = makeRandom(SEED + 1);

const colors = generateColors(N, baseJ, baseM, colorsRandom);
const pairs = generatePairs(colors, S, perturbation, pairsRandom);
const deltaEs = computeDeltaEs(pairs);

// Regress each candidate metric against the ΔE2000 reference.
const regressions = {
	seed: SEED,
	params: { N, S, baseJ, baseM, perturbation },
	"OK-vs-2000": linearRegression(deltaEs.deltaEOK, deltaEs.deltaE2000),
	"OK2-vs-2000": linearRegression(deltaEs.deltaEOK2, deltaEs.deltaE2000),
};

// --- Write out the datasets for independent verification ---------------------

// The full pairwise dataset: CAM16-JMh coords + the three distances.
writeFileSync("pairs.csv", pairsToCSV(pairs, deltaEs));

// The regression results.
writeFileSync("regressions.json", JSON.stringify(regressions, null, "\t") + "\n");

// Scatter plots with the best-fit line. Share the ΔE2000 (y) axis so the two
// fits are directly comparable.
const yMax = deltaEs.deltaE2000.reduce((a, v) => Math.max(a, v), 0);

writeFileSync("plot-OK.svg", scatterSVG({
	points: deltaEs.deltaEOK.map((x, i) => [x, deltaEs.deltaE2000[i]]),
	regression: regressions["OK-vs-2000"],
	xLabel: "ΔEOK", yLabel: "ΔE2000", title: "ΔEOK vs ΔE2000",
	yMax,
}));

writeFileSync("plot-OK2.svg", scatterSVG({
	points: deltaEs.deltaEOK2.map((x, i) => [x, deltaEs.deltaE2000[i]]),
	regression: regressions["OK2-vs-2000"],
	xLabel: "ΔEOK2", yLabel: "ΔE2000", title: "ΔEOK2 vs ΔE2000",
	yMax,
}));

// Distribution of the base colors in the Oklab a-b plane, with the sRGB, P3,
// and BT.2020 gamut silhouettes overlaid.
const abPoints = colors.map(c => { const [, a, b] = c.to("oklab").coords; return [a, b]; });
const gamutOutlines = [
	{ label: "sRGB", slot: "g1", points: gamutBoundaryAB("srgb") },
	{ label: "P3", slot: "g2", points: gamutBoundaryAB("p3") },
	{ label: "BT.2020", slot: "g3", points: gamutBoundaryAB("rec2020") },
];

// Neutral-dot version: density reads clearly.
writeFileSync("plot-gamuts.svg", abScatterSVG({
	points: abPoints,
	gamuts: gamutOutlines,
	title: "Base colors in Oklab (a-b), gamuts overlaid",
}));

// Colored-dot version: each dot painted its own color, gamut-mapped into P3 and
// emitted as color(display-p3 …) so it renders accurately on a P3 display.
writeFileSync("plot-gamuts-colored.svg", abScatterSVG({
	points: abPoints,
	pointColors: colors.map(c =>
		c.clone().toGamut({ space: "p3" }).to("p3").toString({ precision: 4 })
	),
	gamuts: gamutOutlines,
	title: "Base colors in Oklab (a-b), colored (P3-mapped)",
}));

// Histograms of the KEPT base-color coordinates, after gamut rejection, with
// the nominal input mean marked so the skew introduced by rejection is visible.
writeFileSync("plot-J-histogram.svg", histogramSVG({
	values: colors.map(c => c.coords[0]),   // J is the first CAM16-JMh coord
	min: 0, max: 100, bins: 20,
	xLabel: "CAM16 lightness J",
	title: "Kept base-color lightness (J) distribution",
	refLine: { value: baseJ.mean, label: `input mean ${baseJ.mean}` },
}));

const keptM = colors.map(c => c.coords[1]);   // M is the second CAM16-JMh coord
const maxM = Math.ceil(Math.max(...keptM) / 10) * 10;
writeFileSync("plot-M-histogram.svg", histogramSVG({
	values: keptM,
	min: 0, max: maxM, bins: 20,
	xLabel: "CAM16 colorfulness M",
	title: "Kept base-color colorfulness (M) distribution",
	refLine: { value: baseM.mean, label: `input mean ${baseM.mean}` },
}));

// --- Report ------------------------------------------------------------------

console.log(`${colors.length} base colors → ${pairs.length} pairs`);

for (const [label, reg] of [["ΔEOK ", regressions["OK-vs-2000"]], ["ΔEOK2", regressions["OK2-vs-2000"]]]) {
	// Best-fit line: ΔE2000 = slope·candidate + intercept
	const sign = reg.intercept < 0 ? "-" : "+";
	console.log(
		`${label} vs ΔE2000: ` +
		`ΔE2000 = ${reg.slope.toFixed(4)}·${label.trim()} ${sign} ${Math.abs(reg.intercept).toFixed(4)}` +
		`  (r² = ${reg.r2.toFixed(4)})`
	);
}

console.log("Wrote pairs.csv, regressions.json, plot-OK.svg, plot-OK2.svg, plot-gamuts.svg, plot-gamuts-colored.svg, plot-J-histogram.svg, plot-M-histogram.svg");

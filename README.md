# Delta-EOK2

## Abstract (TL;DR)

ΔEOK2 — ΔEOK with the Oklab a and b axes scaled by 2 — agrees with ΔE2000
noticeably better than ΔEOK does (r² 0.722 vs 0.642 on 5000 BT.2020 color
pairs). Scaling the a/b axes by 2 is a measurable improvement, supporting
Ottosson's recommendation.

## Introduction

This repo compares the existing ΔEOK with ΔEOK2,
a slightly modified version which scales the a and b axes by a factor of 2
as [recommended by Björn Ottosson](https://github.com/w3c/csswg-drafts/issues/6642#issuecomment-945096257),
inventor of Oklab:

> Adjust the scaling of a&b to more accurately predict color distances

He [also said](https://github.com/w3c/csswg-drafts/issues/6642#issuecomment-945714988)

> I unfortunately didn't spend that much time calculating and validating that scaling factor when I first derived Oklab since I was mostly focused on the orthogonality between L, C and h (and I didn't expect it to become so widespread so quickly), and it seems like it is off by quite a bit.
> I've recently done some tests with color distance datasets as implemented in Colorio and on both the Combvd dataset and the OSA-UCS dataset a scale factor of slightly more than 2 for a and b would give the best results (2.016 works best for Combvd and 2.045 for the OSA-UCS dataset).

Instead of changing the definition of Oklab, which is now widely adopted, this produces another distance metric ΔEOK2.

This repo examines the improvement this creates;
both ΔEOK and ΔEOK2 are evaluated against ΔE2000
on a dataset of color pairs
generated in CAM16
(to avoid dependence on Oklab uniformity),
and restricted to colors inside the BT.2020 gamut
(to avoid any wierd behavior for unrealistic or imaginary colors).

## Methodology

The full pipeline lives in [`run.js`](run.js) and is seeded, so the dataset
(`pairs.csv`), regressions and plots reproduce exactly from `node run.js`.

### Base colors

`generateColors()` draws **N = 1000** base colors in CAM16-JMh, using
[Color.js](https://colorjs.io) for the color handling and gamut testing:

- **J** (lightness) ~ Normal(μ = 60, σ = 20)
- **M** (colorfulness) ~ Normal(μ = 25, σ = 20)
- **h** (hue) ~ uniform over [0°, 360°)

A color is kept only if it is strictly inside the BT.2020 gamut; the generator
resamples until exactly N are collected. Below, the kept colors are shown in the
Oklab a–b plane, with the sRGB, P3 and BT.2020 gamut outlines (max-chroma
silhouettes across all lightnesses) overlaid:

![Base colors in Oklab a–b with gamut outlines](plot-gamuts-colored.svg)

Because the reachable colorfulness depends on lightness and hue, gamut rejection
skews the kept sample slightly: the kept means (J ≈ 57, M ≈ 23) sit a little
below the input means. The dashed line marks the input mean.

![Kept lightness (J) distribution](plot-J-histogram.svg)
![Kept colorfulness (M) distribution](plot-M-histogram.svg)

### Color pairs

`generatePairs()` turns each base color into **S = 5** *similar* colors by
perturbing its coordinates independently, each ~ Normal(μ = base value, σ = 4),
with hue wrapped to [0°, 360°). Again only similar colors inside BT.2020 are
kept, resampling until each base has exactly S — giving **N × S = 5000**
`[base, similar]` pairs. This σ = 4 perturbation yields ΔE2000 differences
spanning ~0–16 (mean ≈ 3.9), covering both the small differences of
acceptability testing and the larger ones relevant to gamut mapping.

For every pair the three distances — ΔE2000, ΔEOK and ΔEOK2 — are then computed
with [Color.js](https://colorjs.io).

## Results

ΔE2000 is generally accepted as the best color-difference metric for SDR
colors, but is computationally
[complex](https://www.w3.org/TR/css-color-4/#color-difference-code); ΔEOK, by
contrast, is computationally simple. The question is how well the simpler metric
(and its ΔEOK2 variant) can stand in for ΔE2000.

Taking ΔE2000 as the reference, each candidate metric is fit against it by
ordinary least-squares linear regression. The higher the coefficient of
determination (r²), the more of the ΔE2000 variation the metric explains — i.e.
the better it agrees with ΔE2000.

| Metric | Best-fit line               | r²    |
| ------ | --------------------------- | ----- |
| ΔEOK   | ΔE2000 = 95.10·ΔEOK + 1.03  | 0.642 |
| ΔEOK2  | ΔE2000 = 85.37·ΔEOK2 + 0.47 | 0.722 |

![ΔEOK vs ΔE2000](plot-OK.svg)
![ΔEOK2 vs ΔE2000](plot-OK2.svg)

ΔEOK2 tracks ΔE2000 more closely than ΔEOK (r² 0.722 vs 0.642): scaling the a
and b axes by 2 measurably improves agreement with ΔE2000 on this dataset,
supporting Ottosson's recommendation. Full per-pair figures are in
[`regressions.json`](regressions.json).

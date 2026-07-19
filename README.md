# Delta-EOK2

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

# operator: winsorize

- Category: [Cross Sectional](../categories/cross-sectional.md)
- Scope: REGULAR
- Level: ALL
- Definition: winsorize(x, std=4)
- Documentation: (none)

## Description

Winsorizes x to make sure that all values in x are between the lower and upper limits, which are specified as multiple of std.<br><br>Input: Value of 7 instruments at day t: (2, 4, 5, 6, 3, 8, 10), std: 1<br>Output: (2.81, 4, 5, 6, 3, 8, 8.03) from SD. = 2.61, mean = 5.42
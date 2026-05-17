# operator: quantile

- Category: [Cross Sectional](../categories/cross-sectional.md)
- Scope: REGULAR
- Level: ALL
- Definition: quantile(x, driver = gaussian, sigma = 1.0)
- Documentation: /operators/quantile

## Description

Rank the raw vector, shift the ranked Alpha vector, apply distribution (gaussian, cauchy, uniform). If driver is uniform, it simply subtract each Alpha value with the mean of all Alpha values in the Alpha vector
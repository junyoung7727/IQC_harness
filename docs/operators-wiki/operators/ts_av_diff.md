# operator: ts_av_diff

- Category: [Time Series](../categories/time-series.md)
- Scope: REGULAR
- Level: ALL
- Definition: ts_av_diff(x, d)
- Documentation: /operators/ts_av_diff

## Description

Calculates the difference between a value and its mean over a specified period, ignoring NaN values in the mean calculation. In short, it returns x – ts_mean(x, d) with NaNs ignored.
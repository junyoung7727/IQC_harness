# operator: ts_quantile

- Category: [Time Series](../categories/time-series.md)
- Scope: REGULAR
- Level: ALL
- Definition: ts_quantile(x,d, driver="gaussian" )
- Documentation: /operators/ts_quantile

## Description

Calculates the ts_rank of the input and transforms it using the inverse cumulative distribution function (quantile function) of a specified probability distribution (default: Gaussian/normal). This helps to normalize or reshape the distribution of your data over a rolling window.
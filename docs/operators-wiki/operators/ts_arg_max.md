# operator: ts_arg_max

- Category: [Time Series](../categories/time-series.md)
- Scope: REGULAR
- Level: ALL
- Definition: ts_arg_max(x, d)
- Documentation: /operators/ts_arg_max

## Description

Returns the number of days since the maximum value occurred in the last d days of a time series. If today's value is the maximum, returns 0; if it was yesterday, returns 1, and so on.
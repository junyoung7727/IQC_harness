# operator: ts_arg_min

- Category: [Time Series](../categories/time-series.md)
- Scope: REGULAR
- Level: ALL
- Definition: ts_arg_min(x, d)
- Documentation: /operators/ts_arg_min

## Description

Returns the number of days since the minimum value occurred in a time series over the past d days. If today's value is the minimum, returns 0; if it was yesterday, returns 1, and so on.
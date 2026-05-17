# operator: ts_backfill

- Category: [Time Series](../categories/time-series.md)
- Scope: REGULAR
- Level: ALL
- Definition: ts_backfill(x,lookback = d, k=1)
- Documentation: /operators/ts_backfill

## Description

Replaces missing (NaN) values in a time series with the most recent valid value from a specified lookback window, improving data coverage and reducing risk from missing data.
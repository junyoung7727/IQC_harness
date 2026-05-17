# operator: group_backfill

- Category: [Group](../categories/group.md)
- Scope: REGULAR
- Level: ALL
- Definition: group_backfill(x, group, d, std = 4.0)
- Documentation: /operators/group_backfill

## Description

If a certain value for a certain date and instrument is NaN, from the set of same group instruments, calculate winsorized mean of all non-NaN values over last d days
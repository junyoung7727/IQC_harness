# operator: bucket

- Category: [Transformational](../categories/transformational.md)
- Scope: REGULAR
- Level: ALL
- Definition: bucket(rank(x), range="0, 1, 0.1" or buckets = "2,5,6,7,10")
- Documentation: /operators/bucket

## Description

Convert float values into indexes for user-specified buckets. Bucket is useful for creating group values, which can be passed to GROUP as input
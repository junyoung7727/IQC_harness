# operator: group_zscore

- Category: [Group](../categories/group.md)
- Scope: REGULAR
- Level: ALL
- Definition: group_zscore(x, group)
- Documentation: (none)

## Description

Calculates group Z-score - numerical measurement that describes a value's relationship to the mean of a group of values. Z-score is measured in terms of standard deviations from the mean. zscore = (data - mean) / stddev of x for each instrument within its group.<br><br>Input: Value of 5 instruments of Group A: (100, 0, 50, 60, 25)<br>Output: (1.57, -1.39, 0.09, 0.39, -0.65)
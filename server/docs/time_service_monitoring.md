# TimeService Monitoring and Observability

This document describes the OpenTelemetry instrumentation and monitoring capabilities for the TimeService component of the telescope safety scheduling system.

## Overview

The TimeService is fully instrumented with OpenTelemetry to provide comprehensive observability through traces, metrics, and logs. This enables monitoring of time calculations, viewing window determinations, and DST handling in Grafana dashboards.

## Metrics

### Counters

#### `time_service_calculations_total`
- **Description**: Total number of time calculations performed
- **Unit**: Count (1)
- **Labels**:
  - `operation`: Type of calculation (`sunrise_sunset`, `viewing_window`, `next_viewing_window`)
- **Use Case**: Track usage patterns and calculation frequency

#### `viewing_window_checks_total`
- **Description**: Total number of viewing window status checks
- **Unit**: Count (1)
- **Labels**:
  - `operation`: Always `window_active_check`
- **Use Case**: Monitor how frequently the system checks viewing window status

#### `dst_checks_total`
- **Description**: Total number of DST status checks
- **Unit**: Count (1)
- **Labels**:
  - `operation`: Always `dst_check`
- **Use Case**: Track DST-related operations and seasonal patterns

### Histograms

#### `time_service_calculation_duration_seconds`
- **Description**: Duration of time calculations in seconds
- **Unit**: Seconds (s)
- **Labels**:
  - `operation`: Type of calculation (`sunrise_sunset`, `viewing_window`)
- **Use Case**: Monitor performance and identify slow calculations

## Traces

### Spans

All TimeService methods are instrumented with distributed tracing:

#### `get_melbourne_time`
- **Attributes**:
  - `timezone`: Melbourne timezone string
  - `utc_time`: UTC timestamp
  - `melbourne_time`: Melbourne timestamp
  - `is_dst`: Boolean indicating DST status

#### `is_daylight_saving_active`
- **Attributes**:
  - `check_time`: Time being checked
  - `is_dst`: DST status result
  - `timezone`: Timezone information
  - `dst_offset_seconds`: DST offset in seconds

#### `calculate_sunrise_sunset`
- **Attributes**:
  - `target_date`: Date for calculation
  - `location_lat`: Melbourne latitude
  - `location_lon`: Melbourne longitude
  - `sunrise_time`: Calculated sunrise time
  - `sunset_time`: Calculated sunset time
  - `daylight_hours`: Hours of daylight
  - `used_fallback`: Whether fallback times were used

#### `get_viewing_window`
- **Attributes**:
  - `target_date`: Date for calculation
  - `buffer_hours`: Buffer time in hours
  - `window_start`: Viewing window start time
  - `window_end`: Viewing window end time
  - `window_duration_hours`: Window duration
  - `spans_midnight`: Whether window spans midnight

#### `is_viewing_window_active`
- **Attributes**:
  - `check_time`: Time being checked
  - `window_start`: Current window start
  - `window_end`: Current window end
  - `is_active`: Whether window is active
  - `spans_midnight`: Whether window spans midnight
  - `time_until_change_seconds`: Time until next status change

#### `get_next_viewing_window`
- **Attributes**:
  - `from_time`: Starting time for calculation
  - `currently_in_window`: Whether currently in window
  - `next_window_start`: Next window start time
  - `using_today_window`: Whether using today's window
  - `using_tomorrow_window`: Whether using tomorrow's window
  - `time_until_window_seconds`: Time until next window
  - `time_until_window_hours`: Time until next window (hours)

## Logging

### Log Levels

- **INFO**: Normal operations, successful calculations
- **WARNING**: Fallback calculations, unusual conditions
- **ERROR**: Calculation failures, exceptions

### Log Messages

#### Successful Operations
```
Retrieved Melbourne time: 2024-06-15T14:30:00+10:00
DST check for 2024-06-15T14:30:00+10:00: AEST (standard time)
Calculated sunrise/sunset for 2024-06-15: sunrise=07:30, sunset=17:15
Calculated viewing window for 2024-06-15: 18:15 - 06:30 (12.3 hours)
Viewing window check at 22:00: active (next change in 8.5 hours)
Next viewing window starts at 18:15 (4.2 hours from 14:00)
```

#### Warning Conditions
```
Used fallback times for sunrise/sunset calculation on 2024-06-15
```

#### Error Conditions
```
Error calculating sunrise/sunset for 2024-06-15: [exception details]
Error checking viewing window status: [exception details]
```

## Grafana Dashboard Queries

### Key Performance Indicators

#### Calculation Rate
```promql
rate(time_service_calculations_total[5m])
```

#### Average Calculation Duration
```promql
rate(time_service_calculation_duration_seconds_sum[5m]) / 
rate(time_service_calculation_duration_seconds_count[5m])
```

#### Viewing Window Check Rate
```promql
rate(viewing_window_checks_total[5m])
```

#### DST Check Rate
```promql
rate(dst_checks_total[5m])
```

### Performance Monitoring

#### 95th Percentile Calculation Duration
```promql
histogram_quantile(0.95, rate(time_service_calculation_duration_seconds_bucket[5m]))
```

#### Error Rate
```promql
rate(time_service_errors_total[5m])
```

### Operational Insights

#### Calculation Types Distribution
```promql
sum by (operation) (rate(time_service_calculations_total[5m]))
```

#### Daily Viewing Window Patterns
```promql
increase(viewing_window_checks_total[1h])
```

## Alerting Rules

### Performance Alerts

#### High Calculation Duration
```yaml
- alert: TimeServiceSlowCalculations
  expr: histogram_quantile(0.95, rate(time_service_calculation_duration_seconds_bucket[5m])) > 2.0
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "TimeService calculations are taking too long"
    description: "95th percentile calculation duration is {{ $value }}s"
```

#### High Error Rate
```yaml
- alert: TimeServiceErrors
  expr: rate(time_service_errors_total[5m]) > 0.1
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "TimeService experiencing errors"
    description: "Error rate is {{ $value }} errors/second"
```

### Operational Alerts

#### Fallback Usage
```yaml
- alert: TimeServiceUsingFallbacks
  expr: increase(time_service_fallback_calculations_total[1h]) > 5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "TimeService frequently using fallback calculations"
    description: "{{ $value }} fallback calculations in the last hour"
```

## Dashboard Panels

### Recommended Grafana Panels

1. **Calculation Rate Timeline** - Line graph of calculation rates by operation type
2. **Duration Heatmap** - Heatmap showing calculation duration distribution
3. **Viewing Window Status** - State timeline showing active/inactive periods
4. **DST Transitions** - Annotations showing DST changeover dates
5. **Error Rate** - Single stat panel with error rate and trend
6. **Current Status** - Table showing current Melbourne time, DST status, and viewing window state
7. **Performance Metrics** - Stat panels for avg/p95 duration, total calculations
8. **Trace Samples** - Trace list showing recent operations with duration and status

### Dashboard Variables

- `$timerange`: Time range selector
- `$operation`: Operation type filter (sunrise_sunset, viewing_window, etc.)
- `$environment`: Environment filter (development, production)

## Troubleshooting

### Common Issues

#### Missing Metrics
- Verify OpenTelemetry configuration in `telemetry.py`
- Check OTEL endpoint connectivity
- Ensure TimeService is being used by the application

#### High Calculation Duration
- Check AstroPy library performance
- Monitor system resources during calculations
- Consider caching frequently requested calculations

#### Frequent Fallback Usage
- Investigate AstroPy IERS data availability
- Check network connectivity for astronomical data
- Review calculation error logs

### Debug Queries

#### Recent Errors
```promql
increase(time_service_errors_total[1h]) > 0
```

#### Calculation Pattern Analysis
```promql
sum by (operation, hour) (increase(time_service_calculations_total[1h]))
```

#### Trace Error Investigation
Use Grafana's trace search with:
- Service: `telescope-backend`
- Operation: `calculate_sunrise_sunset`
- Status: `error`

This monitoring setup provides comprehensive visibility into TimeService operations, enabling proactive monitoring and quick troubleshooting of time calculation issues in the telescope safety system.
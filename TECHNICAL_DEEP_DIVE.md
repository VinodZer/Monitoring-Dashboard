# Technical Deep Dive: Market Ticks Monitor

This document provides an exhaustive, function-by-function technical breakdown of the Market Ticks Monitor project. It covers a to z of the logic, data flow, and architectural decisions.

---

## 1. Architectural Overview

The application follows a **Real-Time Observer Pattern**.
- **Data Ingestion**: High-frequency WebSocket streams fetched via custom React hooks.
- **State Management**: Localized React state for live data, synchronized with PocketBase for persistent logging.
- **Logic Layer**: Specialized utility classes for content hashing and timing validation.
- **UI Layer**: High-performance grid and sparkline components reflecting data status in real-time.

---

## 2. Core Logic: Staleness Detection
*File: `lib/stale-data-detector.ts`*

The system doesn't just check if a connection is "alive"; it checks if the **content** of the data is actually changing.

### Key Functions:
- **`stableStringify(value)`**: Ensures that the JSON string representation of data is identical regardless of object key order. This is crucial for consistent hashing.
- **`hashString(input)`**: Uses a **DJB2-like algorithm** to convert the stringified data into a short hex hash. This allows the system to compare massive data payloads using only a few bytes.
- **`detectStaleFeed(instrumentId, marketData)`**:
    - Generates a hash of the incoming `marketData`.
    - Compares it with `previousHashes`.
    - If the hash is identical for longer than the `threshold` (e.g., 15s for Equities), it marks the feed as **Stale**.
    - Thresholds are specialized by market type (Equity: 15s, Currency: 300s, Commodity: 180s).

### `TimingAnalyzer` Class:
- **`analyze(baseline, dataTimestamp)`**: Calculates the drift between the client clock and the exchange timestamp.
- **Discrepancy Types**:
    - `cached_data`: Data is coming in but it's old (timestamp is lagging).
    - `api_delay`: Data is fresh but there is a network bottleneck.

---

## 3. Data Ingestion: `useTickData`
*File: `hooks/use-tick-data.ts`*

This is the primary connector for WebSocket streams (Kite & Upstox).

### Key Logic:
- **`connectToWS()`**: Manages the life-cycle of the WebSocket. It includes **Exponential Backoff** for retries and connection timeouts (8s).
- **`processTickData(rawData)`**:
    - Parses the raw JSON stream.
    - **Inter-tick Delay**: Calculates how much time passed between the current tick and the previous one for that specific instrument.
    - **Upstox Transformation**: If data is from Upstox, it uses `upstox-transformer.ts` to normalize the field names to match the internal Kite-standardized format.
- **`FREEZE_THRESHOLD`**: If zero bytes are received on the socket for 5 seconds, it triggers a `connection` alert immediately.

---

## 4. Alerting Engine: `useInactivityAlerts`
*File: `hooks/use-inactivity-alerts.ts`*

The "System Brain" that decides when to notify the user.

### Alert Types:
1. **LTP Alerts**: Triggers when the Last Traded Price hasn't moved for X seconds.
2. **DPLTP (Depth + LTP)**: A more sophisticated check that ensures the order book (depth) is also stale before alerting, reducing false positives for low-volume stocks.

### Audio Logic (`playAlertSound`):
- Uses the **Web Audio API** (`AudioContext`).
- Generates sounds programmatically using **Oscillators** (Sine, Square, Triangle) so no MP3 files are needed.
- **Logic**: It creates a `GainNode` for volume control and ramps the volume down at the end of the beep to prevent "click" sounds in the speakers.

---

## 5. Market Timing Logic
*File: `utils/market-timings.ts`*

Ensures the app only monitors when the market is actually active.

### Intelligence:
- **Time Zone Conversion**: Automatically converts client time to **Asia/Kolkata (IST)** regardless of where the user is.
- **`getCurrentMarketStatus()`**: 
    - Checks for weekends (Saturday/Sunday).
    - Checks against a hardcoded `MARKET_HOLIDAYS_2024` list.
    - Segments time into `Pre-market`, `Normal`, and `Post-market`.
- **`isInMarketCloseBuffer()`**: Suspends alerts in the last 30 seconds of the trading day (3:29:30 PM) to prevent "EndOfDay" freezes from triggering alarms.

---

## 6. Visualization & Charts
*File: `components/mini-price-chart.tsx`*

High-efficiency rendering for real-time trends.

### Logic:
- **Sparklines**: Uses SVG paths to draw 1-minute trends without the overhead of heavy charting libraries.
- **Visual Feedback**: The chart components read the `isStale` flag from the state and apply `opacity-50` or `grayscale` filters to the UI, providing an immediate visual cue that data is dead.

---

## 7. Persistence: `useAlertLogger`
*File: `hooks/use-alert-logger.ts`*

Connects the frontend alerts to the **PocketBase** backend.

### Operation:
- Every time an inactivity alert is finalized, `logAlert()` sends a POST request to the `alert_logs` collection.
- It stores: `instrument_name`, `alert_type`, `missing_seconds`, and the exact `market_session`.

---

## 8. Summary of Logic flow (A to Z)

1. **WebSocket** receives raw JSON.
2. **`useTickData`** parses and normalizes it.
3. **`StaleDataDetector`** hashes the content and compares it to the previous state.
4. **`useInactivityAlerts`** checks if (Current Time - Last Change) > Threshold.
5. **`market-timings`** checks if we should actually be alerting right now.
6. **Web Audio API** plays the sound if an alert is valid.
7. **PocketBase** records the incident for history.
8. **UI** updates the grid and charts with the status.

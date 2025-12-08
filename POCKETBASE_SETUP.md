# PocketBase Integration Setup

This project is integrated with PocketBase to store tick data.

## 1. Environment Configuration

Ensure your `.env.local` file (or environment variables) has:

```env
NEXT_PUBLIC_POCKETBASE_URL=https://db.vinod.app
```

## 2. PocketBase Collection Setup (Manual)

Since the automation script encountered authentication issues, please follow these steps to create the collection manually in your PocketBase Admin UI.

1.  **Log In**: Go to [https://db.vinod.app/_/](https://db.vinod.app/_/) and log in as Admin.
2.  **Create Collection**: Click on **"New Collection"** (or "Create New Collection").
3.  **Name**: Enter `ticks` (lowercase, exact spelling).
4.  **Type**: Select **"Base"**.
5.  **Add Fields**: Click on **"New Field"** to add the following:

| Field Name | Type | Options |
| :--- | :--- | :--- |
| `instrument_token` | **Number** | Required? **Yes** (Recommended) |
| `last_price` | **Number** | |
| `volume` | **Number** | |
| `timestamp` | **Date** | |
| `raw_data` | **JSON** | |

6.  **API Rules**:
    *   Click on the **"API Rules"** tab (padlock icon).
    *   **List/Search Rule**: Set to Admin only (leave empty or default) OR allow authenticated users: `@request.auth.id != ""`
    *   **View Rule**: Same as List rule.
    *   **Create Rule**: 
        *   **For Development/Testing**: clear the box to make it empty (Public). 
        *   **For Production**: `@request.auth.id != ""` (requires User login).
    *   **Update/Delete Rule**: leave as Admin only (default).

7.  **Save**: Click **Create** to save the collection.

## 3. Data Retention Policy (Server-Side)

To prevent the database from growing indefinitely, set up a cleanup job on your server.

**Option A: Cron Job (via pb_hooks)**
If you have access to the server's `pb_hooks` directory, create `cron.pb.js`:

```javascript
cronAdd("cleanup_ticks", "0 0 * * *", () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const filter = `created < "${date.toISOString().replace('T', ' ')}"`;
    $app.dao().deleteRecords($app.dao().findRecordsByFilter("ticks", filter));
})
```

**Option B: Manual Cleanup**
Periodically delete old records via the Admin UI or API.

## 4. Alert Logs Collection (Manual)

To store inactivity alerts, create a new collection named `alert_logs`.

1.  **Name**: `alert_logs`
2.  **Type**: **Base**
3.  **Fields**:

| Field Name | Type | Options |
| :--- | :--- | :--- |
| `alert_id` | **Text** | |
| `instrument_token` | **Number** | |
| `instrument_name` | **Text** | |
| `alert_type` | **Text** | |
| `message` | **Text** | |
| `duration` | **Number** | |
| `missing_seconds` | **Number** | |
    *   High volume data, only needed for recent history charts.
*   **Alert Logs (`alert_logs`)**: Keep for **1 Year**.
    *   Compliance and historical auditing requirement.

**Example Cron Job (pb_hooks/cron.pb.js):**

```javascript
// Cleanup Ticks (7 Days)
cronAdd("cleanup_ticks", "0 0 * * *", () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const filter = `created < "${date.toISOString().replace('T', ' ')}"`;
    $app.dao().deleteRecords($app.dao().findRecordsByFilter("ticks", filter));
});

// Cleanup Logs (1 Year)
cronAdd("cleanup_logs", "0 2 * * *", () => { // Run at 2 AM
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    const filter = `created < "${date.toISOString().replace('T', ' ')}"`;
    $app.dao().deleteRecords($app.dao().findRecordsByFilter("alert_logs", filter));
});
```

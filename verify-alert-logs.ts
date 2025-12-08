import PocketBase from 'pocketbase';
import fs from 'fs';

// Use the URL from your environment or the default
const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://db.vinod.app';

async function verifyAlertLogs() {
    const result: any = { success: false, logs: [] };
    const log = (msg: string) => { console.log(msg); result.logs.push(msg); };

    log(`Connecting to ${PB_URL}...`);
    const pb = new PocketBase(PB_URL);

    try {
        // 1. Authenticate (optional if Create rule is public, but good to test)
        // If you have admin login, you can uncomment this, or rely on public creation if configured.
        // await pb.admins.authWithPassword('user@example.com', 'password');

        log('Attempting to create a test alert log...');

        // 2. Create a test record
        const record = await pb.collection('alert_logs').create({
            alert_id: 'test-verification-' + Date.now(),
            instrument_token: 12345,
            instrument_name: 'TEST_VERIFICATION',
            alert_type: 'ltp',
            message: 'This is a test log from verification script',
            duration: 5,
            missing_seconds: 5,
            market_session: 'Test',
            raw_data: { test: true, timestamp: Date.now() }
        });

        log('SUCCESS: Created test log record: ' + record.id);
        result.success = true;
        result.recordId = record.id;

        // 3. Clean up (Delete the test record)
        // Note: This might fail if Delete rule is Admin only and we are not authenticated as Admin.
        try {
            await pb.collection('alert_logs').delete(record.id);
            log('SUCCESS: Deleted test log record.');
        } catch (delError) {
            log('WARNING: Could not delete the test record.');
        }

    } catch (err: any) {
        log('FAILED: Could not create alert log.');
        log('Error details: ' + (err.originalError?.message || err.message || JSON.stringify(err)));
        result.error = err.originalError || err.message;
    }

    fs.writeFileSync('verification_result.json', JSON.stringify(result, null, 2));
}

verifyAlertLogs();


import PocketBase from 'pocketbase';
import fs from 'fs';

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://db.vinod.app';

async function benchmark() {
    console.log(`Connecting to ${PB_URL}...`);
    const pb = new PocketBase(PB_URL);

    // 1. Warm-up / Latency Check (1 record)
    const start1 = performance.now();
    try {
        await pb.collection('alert_logs').getList(1, 1, {
            fields: 'id,created',
            sort: '-created'
        });
        const dur1 = performance.now() - start1;
        console.log(`[Latency Check] Fetch 1 record: ${dur1.toFixed(2)}ms`);
    } catch (e) {
        console.error("Failed connection:", e);
        return;
    }

    // 2. Fetch 50 records ( Proposed Optimization )
    const start2 = performance.now();
    await pb.collection('alert_logs').getList(1, 50, {
        fields: 'id,created,instrument_name,alert_type,message,duration,missing_seconds,market_session',
        sort: '-created'
    });
    const dur2 = performance.now() - start2;
    console.log(`[Widget Load] Fetch 50 records: ${dur2.toFixed(2)}ms`);

    // 3. Fetch 500 records ( Current Implementation )
    const start3 = performance.now();
    await pb.collection('alert_logs').getList(1, 500, {
        fields: 'id,created,instrument_name,alert_type,message,duration,missing_seconds,market_session',
        sort: '-created'
    });
    const dur3 = performance.now() - start3;
    console.log(`[Current Load] Fetch 500 records: ${dur3.toFixed(2)}ms`);

    // 4. Fetch 500 records WITHOUT fields optimization (Worst case, if fields param ignored/buggy)
    // Skipping to avoid stressing server unless needed, but 40s suggests something huge.
}

benchmark().catch(console.error);

import PocketBase from 'pocketbase';

async function verify() {
    const url = 'https://db.vinod.app';
    console.log(`Connecting to ${url}...`);
    const pb = new PocketBase(url);

    try {
        // Attempt to create a dummy record to verify permissions and schema
        const data = {
            instrument_token: 12345,
            last_price: 100.5,
            volume: 10,
            timestamp: new Date().toISOString(),
            raw_data: { test: true }
        };

        console.log('Attempting to create test record...');
        const record = await pb.collection('ticks').create(data);
        console.log('✅ Successfully created record:', record.id);

        // Clean up
        // await pb.collection('ticks').delete(record.id);
        console.log('✅ Left test record for visual verification (Refresh your dashboard)');
        console.log('CONNECTION VERIFIED!');

    } catch (error) {
        console.error('❌ Verification Failed:', error);
        if (error.originalError) {
            console.error('Original Error:', error.originalError);
        }
    }
}

verify();

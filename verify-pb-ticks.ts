
import PocketBase from 'pocketbase';

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://db.vinod.app';

async function verifyTicksFetch() {
    console.log(`Connecting to ${PB_URL}...`);
    const pb = new PocketBase(PB_URL);

    try {
        // 1. Simple Fetch (No filters)
        console.log('\n--- Test 1: Simple Fetch (No Filters) ---');
        const result1 = await pb.collection('ticks').getList(1, 5, {
            sort: '-timestamp',
        });
        console.log(`Success! Found ${result1.totalItems} total items.`);
        console.log(`Fetched ${result1.items.length} items.`);
        if (result1.items.length > 0) {
            console.log('Sample Item:', JSON.stringify(result1.items[0], null, 2));
        }

        // 2. Filtered Fetch (Mimicking HistoricalDataViewer)
        console.log('\n--- Test 2: Filtered Fetch (Time Range) ---');
        // Filter for last 24 hours
        const endTime = new Date();
        const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const filterString = `timestamp >= "${startTime.toISOString()}" && timestamp <= "${endTime.toISOString()}"`;
        console.log(`Filter: ${filterString}`);

        const result2 = await pb.collection('ticks').getList(1, 5, {
            filter: filterString,
            sort: '-timestamp',
        });

        console.log(`Success! Found ${result2.totalItems} matching items.`);
        console.log(`Fetched ${result2.items.length} items.`);

        // 3. Token Filter Test
        console.log('\n--- Test 3: Token Filter Test ---');
        if (result1.items.length > 0) {
            const sampleToken = result1.items[0].instrument_token;
            console.log(`Using token from Test 1: ${sampleToken} (Type: ${typeof sampleToken})`);

            // Replicating component logic: `instrument_token = ${selectedToken}`
            // Note: In the component, selectedToken is a string from the Select value.
            const filterStringToken = `instrument_token = ${sampleToken}`;
            console.log(`Filter: ${filterStringToken}`);

            const result3 = await pb.collection('ticks').getList(1, 5, {
                filter: filterStringToken,
                sort: '-timestamp',
            });
            console.log(`Success! Found ${result3.totalItems} items for token ${sampleToken}.`);
        } else {
            console.log('Skipping Test 3 (No items found in Test 1)');
        }

    } catch (err) {
        console.error('FAILED to fetch ticks.');
        console.error('Error details:', err);
        // @ts-ignore
        if (err.response) {
            // @ts-ignore
            console.error('Response data:', err.response.data);
        }
    }
}

verifyTicksFetch();


import pb from "./lib/pocketbase";
import { startOfDay } from "date-fns";

// Mock the environment variable if not present (runs in node)
if (!process.env.NEXT_PUBLIC_POCKETBASE_URL) {
    // @ts-ignore
    global.process.env.NEXT_PUBLIC_POCKETBASE_URL = "https://db.vinod.app";
}

async function measureQuery(name: string, filter: string) {
    console.log(`\n--- Testing: ${name} ---`);
    console.log(`Filter: ${filter}`);

    const start = performance.now();
    try {
        const result = await pb.collection("alert_logs").getList(1, 50, {
            sort: "-created",
            filter: filter,
            fields: "id,created,instrument_name",
            requestKey: null // disable auto-cancellation
        });
        const duration = performance.now() - start;

        console.log(`Duration: ${duration.toFixed(2)}ms`);
        console.log(`Total Items Found: ${result.totalItems}`);
        console.log(`First Item: ${result.items[0]?.created || "None"}`);
    } catch (err: any) {
        console.error(`ERROR: ${err.message}`);
    }
}

async function runTest() {
    console.log("Starting Query Benchmark...");

    // Test 1: No Filter (baseline)
    await measureQuery("No Filter (All Time)", "");

    // Test 2: Today (The one used in app)
    const todayStart = startOfDay(new Date()).toISOString().replace("T", " ");
    await measureQuery("Today Filter", `created >= "${todayStart}"`);

    // Test 3: Specific Index Test (forcing exact match if possible, generic test)
    // This tests if simple lookup is fast
    // await measureQuery("Recent 1 Minute", `created >= "${new Date(Date.now() - 60000).toISOString().replace("T", " ")}"`);
}

runTest();

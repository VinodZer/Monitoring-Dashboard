
import pb from "./lib/pocketbase";
import { startOfDay } from "date-fns";
import fs from 'fs';

// Force URL
// @ts-ignore
global.process.env.NEXT_PUBLIC_POCKETBASE_URL = "https://db.vinod.app";

async function runTest() {
    const results = [];

    try {
        console.log("Starting Benchmark...");

        // Test 0: Health Check (Network Latency)
        const startHealth = performance.now();
        await pb.health.check();
        const endHealth = performance.now();
        console.log("Health Check Logged");

        results.push({
            test: "Health Check (Network Latency)",
            durationMs: endHealth - startHealth
        });

        // Test 1: Query
        const start = performance.now();
        const todayStart = startOfDay(new Date()).toISOString().replace("T", " ");

        console.log("Fetching logs with filter: ", todayStart);

        const result = await pb.collection("alert_logs").getList(1, 50, {
            sort: "-created",
            filter: `created >= "${todayStart}"`,
            fields: "id,created,instrument_name",
            skipTotal: true,
            requestKey: null
        });

        const end = performance.now();
        const duration = end - start;

        results.push({
            test: "Today Filter + skipTotal",
            durationMs: duration,
            items: result.items.length,
            firstItem: result.items[0]?.created
        });

    } catch (err: any) {
        results.push({ error: err.message });
    }

    fs.writeFileSync('benchmark_v2.json', JSON.stringify(results, null, 2));
    console.log("Done. Results written to benchmark_v2.json");
}

runTest();

import PocketBase from 'pocketbase';

// Initialize the PocketBase client
// Use environment variable for the URL, fallback to localhost if not set
const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://db.vinod.app');

// Disable auto-cancellation globally (optional, but good for multiple rapid requests)
pb.autoCancellation(false);

export default pb;

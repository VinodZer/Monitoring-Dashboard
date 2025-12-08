import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface CompareFeedStatusProps {
    /** Display name of the feed */
    feedName: string
    /** Whether the feed is currently connected */
    isConnected: boolean
    /** URL or identifier of the feed source */
    feedUrl: string
}

/**
 * Component to display the connection status of a data feed
 * Shows a visual indicator (green/red dot), connection status text, and feed URL
 */
export function CompareFeedStatus({ feedName, isConnected, feedUrl }: CompareFeedStatusProps) {
    return (
        <Card className="shadow-sm border-gray-100 dark:border-gray-800">
            <CardContent className="p-4">
                <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm">{feedName}</h3>
                    <span className="text-xs text-gray-400 font-medium">{feedUrl}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                        {isConnected ? "Connected" : "Disconnected"}
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}

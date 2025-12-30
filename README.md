# Market Ticks Monitor

A real-time financial market data monitoring dashboard built with **Next.js**. It tracks dual WebSocket feeds (Kite and Upstox), detects staleness in live data, and provides multi-channel alerts (audio, visual, and browser notifications).

## 🚀 Key Features

- **Dual Feed Monitoring**: Tracks live feeds from Kite (Primary) and Upstox (Secondary) for redundancy.
- **Staleness Detection**: Automatically detects when market data feeds stop updating or freeze.
- **Multi-Channel Alerts**: 
  - **Audio**: Configurable beep sounds via Web Audio API.
  - **Visual**: Highlights rows/charts that have gone stale.
  - **Browser Notifications**: Desktop notifications for critical inactivity.
- **Market Hours Intelligence**: Automatically respects Indian Market timings to prevent false alarms.
- **Lean Architecture**: Optimized with a minimal dependency footprint for maximum performance.

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Database/Auth**: [PocketBase](https://pocketbase.io/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/) & [Lucide Icons](https://lucide.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Visualization**: [Recharts](https://recharts.org/) & Custom SVG Sparklines
- **Validation**: [Zod](https://zod.dev/)

## 🏃 Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher is recommended.
- **PocketBase**: A running PocketBase instance for logging and configuration.

### Installation

1. Clone the repository and navigate to the project folder.
2. Install the production dependencies:
   ```bash
   npm install
   ```

### Running the App

To build and start the application in production mode:
```bash
npm run build
npm start
```

For development with hot-reloading:
```bash
npm run dev
```

## ⚙️ Configuration

Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_POCKETBASE_URL=your_pocketbase_url_here
```

## 📄 License

MIT

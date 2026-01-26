/**
 * @name Traffic Adapter
 * @description Extracts traffic usage and expiry date from proxy node names and sets standard subscription headers.
 * @author AntiGravity
 * @version 1.0.0
 * 
 * Logic:
 * 1. Scans all proxies in the subscription.
 * 2. Parses node names for traffic patterns (e.g., "50 G | 100 G") and dates.
 * 3. Aggregates found values.
 * 4. Sets 'subscription-userinfo' header for downstream consumption (e.g., by Sub-Store aggregators).
 */

async function operator(proxies = [], targetPlatform, context) {
    const LOG_PREFIX = '[Traffic Adapter]';

    // Logging helper
    const log = (msg) => console.log(`${LOG_PREFIX} ${msg}`);

    log(`Starting execution. Node count: ${proxies.length}`);

    // State
    let state = {
        upload: 0,
        download: 0,
        total: 0,
        expire: 0
    };

    /**
     * Configuration & Regex Patterns
     */
    const Config = {
        // Matches: "51.69 G | 200.00 G" (Supports G/M/KB, whitespace, optional 'B')
        // Capture Groups: 1=UsedVal, 2=UsedUnit, 3=TotalVal, 4=TotalUnit
        trafficRegex: /(\d+(?:\.\d+)?)\s*([GMK])B?\s*\|\s*(\d+(?:\.\d+)?)\s*([GMK])B?/i,

        // Matches: "Expire Date：2026/02/16" (Supports English/Chinese colon, various separators)
        // Capture Groups: 1=DateString
        dateRegex: /Expire Date[:：]\s*(\d{4}[\/\-]\d{2}[\/\-]\d{2})/i,

        // Valid units and their byte multipliers
        units: {
            'K': 1024,
            'M': 1024 * 1024,
            'G': 1024 * 1024 * 1024
        }
    };

    /**
     * Converts value and unit to bytes
     * @param {string} val - Numeric string
     * @param {string} unit - Unit string (G, M, K)
     * @returns {number} Bytes
     */
    const toBytes = (val, unit) => {
        const num = parseFloat(val);
        const multiplier = Config.units[unit?.toUpperCase()] || 1;
        return isNaN(num) ? 0 : num * multiplier;
    };

    // --- Processing Loop ---
    proxies.forEach(p => {
        const name = p.name || "";

        // 1. Extract Traffic
        const tMatch = name.match(Config.trafficRegex);
        if (tMatch) {
            log(`[Match] Traffic found in node: "${name.substring(0, 20)}..." -> ${tMatch[0]}`);
            // Usually "Used | Total". We map Used -> Download (as per common convention)
            state.download = toBytes(tMatch[1], tMatch[2]);
            state.total = toBytes(tMatch[3], tMatch[4]);
        }

        // 2. Extract Expiry
        const dMatch = name.match(Config.dateRegex);
        if (dMatch) {
            log(`[Match] Expiry found in node: "${name.substring(0, 20)}..." -> ${dMatch[1]}`);
            // Standardize separator to '/' for consistent Date parsing
            const dateStr = dMatch[1].replace(/-/g, '/');
            const ts = new Date(dateStr).getTime();
            if (!isNaN(ts)) {
                // Sub-Store / Clash headers typically use Seconds for timestamps
                state.expire = Math.floor(ts / 1000);
            }
        }
    });

    // --- Result Construction ---
    // Format: upload=0; download=12345; total=67890; expire=1234567890
    const parts = [
        `upload=${Math.floor(state.upload)}`,
        `download=${Math.floor(state.download)}`,
        `total=${Math.floor(state.total)}`
    ];
    if (state.expire > 0) {
        parts.push(`expire=${state.expire}`);
    }

    const subUserInfo = parts.join('; ');
    log(`Result: ${subUserInfo}`);

    // --- Output (Header Injection) ---
    // This allows subsequent scripts (like sum.js) to read this data as if it came from the provider.
    if (typeof $options !== 'undefined') {
        $options._res = {
            headers: {
                'subscription-userinfo': subUserInfo
            }
        };
    }

    return proxies;
}

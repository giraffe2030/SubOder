/**
 * Sub-Store Script: Traffic Calculation
 * Extracts key traffic information (Used, Total, Expire) from proxy node names.
 * Compatible with node names like: "51.69 G | 200.00 G" and "Expire Date：2026/02/16"
 */

function operator(proxies, targetPlatform) {
    let used = 0;
    let total = 0;
    let expire = 0;

    // Regex patterns
    // Matches: 51.69 G | 200.00 G (handles G/M, spaces)
    const trafficRegex = /(\d+(?:\.\d+)?)\s*([GM])B?\s*\|\s*(\d+(?:\.\d+)?)\s*([GM])B?/i;
    // Matches: Expire Date：2026/02/16 (handles chinese/english colon)
    const dateRegex = /Expire Date[:：]\s*(\d{4}[\/\-]\d{2}[\/\-]\d{2})/;

    // Helper to convert to bytes
    const toBytes = (num, unit) => {
        const n = parseFloat(num);
        const u = unit.toUpperCase();
        if (u === 'G') return n * 1024 * 1024 * 1024;
        if (u === 'M') return n * 1024 * 1024;
        return n;
    };

    proxies.forEach(p => {
        const name = p.name || "";

        // Extract Traffic
        const trafficMatch = name.match(trafficRegex);
        if (trafficMatch) {
            used = toBytes(trafficMatch[1], trafficMatch[2]);
            total = toBytes(trafficMatch[3], trafficMatch[4]);
        }

        // Extract Expiry
        const dateMatch = name.match(dateRegex);
        if (dateMatch) {
            const dateStr = dateMatch[1].replace(/-/g, '/'); // standardizing
            const ts = new Date(dateStr).getTime();
            if (!isNaN(ts)) {
                expire = Math.floor(ts / 1000); // Sub-Store expects seconds? header usually standard unix ts (seconds)
            }
        }
    });

    // Construct header string
    // Format: upload=0; download=123; total=456; expire=789
    const subUserInfo = `upload=0; download=${Math.floor(used)}; total=${Math.floor(total)}; expire=${expire}`;

    // Check if running in a script environment with $options to set headers
    if (typeof $options !== 'undefined') {
        $options._res = {
            headers: {
                'subscription-userinfo': subUserInfo
            }
        };
    } else {
        // Fallback or debug log
        console.log("Calculated Header:", subUserInfo);
    }

    return proxies;
}

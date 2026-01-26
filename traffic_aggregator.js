/**
 * @name Traffic Aggregator
 * @description Robust aggregation of traffic from multiple subscriptions.
 * @author AntiGravity (Refactored from xream/sum.js)
 * @version 2.0.0
 * 
 * Architectural Improvements:
 * 1. Dual Strategy: 
 *    - Primary: HTTP Headers (Standard Sub-Store logic)
 *    - Fallback: Node Name Parsing (for providers like NXO that embed info in names)
 * 2. Fault Tolerance: Handles ECONNRESET and missing headers gracefully.
 * 3. Unified Reporting: Writes to both collection storage and response headers.
 */

async function operator(proxies = [], targetPlatform, context) {
    const LOG_PREFIX = '[Traffic Aggregator]';
    const log = (msg) => console.log(`${LOG_PREFIX} ${msg}`);
    const errLog = (msg) => console.error(`${LOG_PREFIX} ❌ ${msg}`);
    const successLog = (msg) => console.log(`${LOG_PREFIX} ✅ ${msg}`);
    const warnLog = (msg) => console.log(`${LOG_PREFIX} ⚠️ ${msg}`);

    const SUBS_KEY = 'subs';
    const COLLECTIONS_KEY = 'collections';
    const $ = $substore;
    const { source } = context;
    const { _collection: collection } = source;

    if (!collection || Object.keys(source).length > 1) {
        throw new Error('This script is designed for Compound Subscriptions (Collections) only.');
    }

    const allSubs = $.read(SUBS_KEY) || [];
    let stats = { upload: 0, download: 0, total: 0, expire: 0 };

    // Helpers from Sub-Store environment
    // Try to access global flowUtils directly
    let fUtils;
    try {
        fUtils = flowUtils;
    } catch (e) {
        fUtils = {};
        errLog("flowUtils is not defined in this scope!");
    }
    const { getFlowHeaders, parseFlowHeaders, normalizeFlowHeader } = fUtils;

    // --- Strategy B: Node Name Parser (Fallback) ---
    const extractFromNodes = (nodeList) => {
        let s = { d: 0, t: 0, e: 0 };
        const trafficRegex = /(\d+(?:\.\d+)?)\s*([GMK])B?\s*\|\s*(\d+(?:\.\d+)?)\s*([GMK])B?/i;
        const dateRegex = /Expire Date[:：]\s*(\d{4}[\/\-]\d{2}[\/\-]\d{2})/i;
        const units = { 'K': 1024, 'M': 1024 * 1024, 'G': 1024 * 1024 * 1024 };

        const toBytes = (v, u) => parseFloat(v) * (units[u?.toUpperCase()] || 1);

        nodeList.forEach(node => {
            const name = node.name || "";
            const tMatch = name.match(trafficRegex);
            if (tMatch) {
                s.d = toBytes(tMatch[1], tMatch[2]);
                s.t = toBytes(tMatch[3], tMatch[4]);
            }
            const dMatch = name.match(dateRegex);
            if (dMatch) {
                const dateStr = dMatch[1].replace(/-/g, '/');
                const ts = new Date(dateStr).getTime();
                if (!isNaN(ts)) s.e = Math.floor(ts / 1000);
            }
        });
        return s;
    };

    // --- Processing ---
    const subnames = new Set(collection.subscriptions);
    // Add tag-based subs if applicable (Legacy logic preserved)
    if (Array.isArray(collection.subscriptionTags) && collection.subscriptionTags.length > 0) {
        allSubs.forEach(sub => {
            if (sub.tag?.some(t => collection.subscriptionTags.includes(t)) && !subnames.has(sub.name)) {
                subnames.add(sub.name);
            }
        });
    }

    // Debug Environment
    log(`Environment Check: source=${collection.source}, getFlowHeaders=${typeof getFlowHeaders}`);
    if (proxies.length > 0) {
        log(`Sample Proxy: ${JSON.stringify(proxies[0], null, 2)}`);
    } else {
        warnLog("No proxies available in this collection!");
    }

    let dbModified = false;

    for await (const sub of allSubs) {
        if (!subnames.has(sub.name)) continue;

        let subTraffic = null;
        log(`Processing Sub: ${sub.name}, Source: ${sub.source}, URL: ${sub.url?.substring(0, 30)}...`);

        // 1. Try Remote Headers (Strategy A)
        if (sub.source !== 'local' && getFlowHeaders) {
            try {
                const url = sub.url.split('#')[0]; // Simple URL extraction
                // Inherit args from URL hash if needed (simplified for brevity)
                const headers = await getFlowHeaders(url, undefined, undefined, sub.proxy);
                if (headers) {
                    const parsed = parseFlowHeaders(normalizeFlowHeader(headers, true)['subscription-userinfo']);
                    if (parsed && parsed.total > 0) {
                        subTraffic = parsed;
                        successLog(`[Strategy A] Fetched headers for ${sub.name}: ${JSON.stringify(subTraffic)}`);

                        // --- Persistence (Cache Logic In-Memory) ---
                        try {
                            const subIdx = allSubs.findIndex(s => s.name === sub.name);
                            if (subIdx !== -1) {
                                const headerStr = normalizeFlowHeader(headers, true)['subscription-userinfo'];
                                // Only update if changed
                                if (allSubs[subIdx].subUserinfo !== headerStr) {
                                    allSubs[subIdx].subUserinfo = headerStr;
                                    dbModified = true;
                                    successLog(`[Strategy A] Updated memory cache for ${sub.name}`);
                                }
                            }
                        } catch (e) {
                            warnLog(`[Strategy A] Failed to update memory cache: ${e.message}`);
                        }
                    }
                }
            } catch (e) {
                warnLog(`[Strategy A] Failed for ${sub.name}: ${e.message || e}. Attempting fallback...`);
            }
        }

        // 2. Try Fallback: Download & Parse Nodes (Strategy B)
        // Only if headers failed OR it's a "local" sub that might have metadata
        if (!subTraffic) {
            warnLog(`[Strategy A] Skipped or failed for ${sub.name}. Trying Strategy B (Content parsing)...`);
            try {
                // We need to fetch the content. $substore.read currently reads *metadata* from DB.
                // We usually can't easily "download" the body here without a utility.
                // However, we can use $.http.get if available, or just rely on 'proxies' passed in?
                // Wait, 'proxies' passed to this operator are *all proxies in the collection*.
                // We can filter 'proxies' by sub name if Sub-Store tags them!
                // Sub-Store typically adds `_subName` property to proxies in a collection.

                const subProxies = proxies.filter(p => p._subName === sub.name);
                log(`[Strategy B] Filtering for subName="${sub.name}". Found ${subProxies.length} proxies.`);

                if (subProxies.length > 0) {
                    // Peek at first proxy name to see if it matches regex expectations
                    log(`[Strategy B] First proxy name: "${subProxies[0].name}"`);

                    const extracted = extractFromNodes(subProxies);
                    if (extracted.t > 0) {
                        subTraffic = {
                            usage: { upload: 0, download: extracted.d },
                            total: extracted.t,
                            expires: extracted.e
                        };
                        successLog(`[Strategy B] Extracted from nodes for ${sub.name}: ${JSON.stringify(subTraffic)}`);
                    } else {
                        warnLog(`[Strategy B] No traffic info found in nodes for ${sub.name}. (Regex failed?)`);
                    }
                } else {
                    warnLog(`[Strategy B] No proxies found in context for ${sub.name}. Check if proxies have _subName field.`);
                }
            } catch (e) {
                errLog(`[Strategy B] Failed for ${sub.name}: ${e}`);
            }
        }

        // 3. Try Strategy C: Local Persistence (DB)
        // If Adapter ran previously and saved info to the subscription
        if (!subTraffic && sub.subUserinfo) {
            successLog(`[Strategy C] Found persisted info for ${sub.name}: ${sub.subUserinfo}`);
            const parsed = parseFlowHeaders(normalizeFlowHeader({ 'subscription-userinfo': sub.subUserinfo }, true)['subscription-userinfo']);
            if (parsed && parsed.total > 0) {
                subTraffic = parsed;
            }
        }

        // 4. Aggregate
        if (subTraffic) {
            successLog(`[Aggregation] Adding stats from ${sub.name}: ${JSON.stringify(subTraffic)}`);
            if (subTraffic.usage?.upload) stats.upload += subTraffic.usage.upload;
            if (subTraffic.usage?.download) stats.download += subTraffic.usage.download;
            if (subTraffic.total) stats.total += subTraffic.total;

            if (subTraffic.expires) {
                // Expiry logic: Use the *earliest* expiry date of active subscriptions? 
                // Or latest? Usually standard is Earliest (service stops when one expires) 
                // OR Latest (max validity). sum.js used Min (Earliest).
                if (stats.expire === 0 || subTraffic.expires < stats.expire) {
                    stats.expire = subTraffic.expires;
                }
            }
        }
    }

    // Final Output
    const subUserInfo = `upload=${stats.upload}; download=${stats.download}; total=${stats.total}${stats.expire ? `; expire=${stats.expire}` : ''}`;

    log(`Final Aggregation: ${subUserInfo}`);

    // Write to Storage (Legacy/Persistence)
    const allCols = $.read(COLLECTIONS_KEY) || [];
    const colIdx = allCols.findIndex(c => c.name === collection.name);
    if (colIdx !== -1) {
        allCols[colIdx].subUserinfo = subUserInfo;
        $.write(allCols, COLLECTIONS_KEY);
    }

    // --- Finalize Persistence (For Strategy C Cache) ---
    if (dbModified) {
        log("Persisting updated sub headers to DB...");
        $.write(allSubs, SUBS_KEY);
        successLog("DB persistence complete.");
    }

    // Set Response Header (Modern)
    if (typeof $options !== 'undefined') {
        $options._res = { headers: { 'subscription-userinfo': subUserInfo } };
    }

    return proxies;
}

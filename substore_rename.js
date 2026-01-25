/**
 * Sub-Store Node Renaming Script - Flag Match Only Edition
 *
 * @description
 * Implemented with a focus on Separation of Concerns (SoC) and Strict Flag Matching.
 *
 * @architecture
 * 1. **Domain Layer**: Represents the core entities (ProxyNode, Region).
 * 2. **Service Layer**: Handles flag extraction and mapping.
 * 3. **Strategy Layer**: Encapsulates Sorting logic.
 * 4. **Pipeline**: Orchestrates the data flow.
 */

// ==========================================
// 1. Configuration & Constants
// ==========================================
const CONFIG = {
    DEFAULT_REGION: 'Unknown',
    PROVIDER_KEY: '_subDisplayName',

    // STRICT FLAG MAPPING (Generated from user data)
    FLAG_MAP: {
        "\uD83C\uDDE6\uD83C\uDDEA": "United Arab Emirates",
        "\uD83C\uDDE6\uD83C\uDDF1": "Albania",
        "\uD83C\uDDE6\uD83C\uDDF2": "Armenia",
        "\uD83C\uDDE6\uD83C\uDDF4": "Angola",
        "\uD83C\uDDE6\uD83C\uDDF7": "Argentina",
        "\uD83C\uDDE6\uD83C\uDDF9": "Austria",
        "\uD83C\uDDE6\uD83C\uDDFA": "Australia",
        "\uD83C\uDDE7\uD83C\uDDE9": "Bangladesh",
        "\uD83C\uDDE7\uD83C\uDDEA": "Belgium",
        "\uD83C\uDDE7\uD83C\uDDEC": "Bulgaria",
        "\uD83C\uDDE7\uD83C\uDDF4": "Bolivia",
        "\uD83C\uDDE7\uD83C\uDDF7": "Brazil",
        "\uD83C\uDDE8\uD83C\uDDE6": "Canada",
        "\uD83C\uDDE8\uD83C\uDDED": "Switzerland",
        "\uD83C\uDDE8\uD83C\uDDF1": "Chile",
        "\uD83C\uDDE8\uD83C\uDDF4": "Colombia",
        "\uD83C\uDDE8\uD83C\uDDF7": "Costa Rica",
        "\uD83C\uDDE8\uD83C\uDDFE": "Cyprus",
        "\uD83C\uDDE9\uD83C\uDDEA": "Germany",
        "\uD83C\uDDE9\uD83C\uDDF0": "Denmark",
        "\uD83C\uDDE9\uD83C\uDDFF": "Algeria",
        "\uD83C\uDDEA\uD83C\uDDE8": "Ecuador",
        "\uD83C\uDDEA\uD83C\uDDEA": "Estonia",
        "\uD83C\uDDEA\uD83C\uDDEC": "Egypt",
        "\uD83C\uDDEA\uD83C\uDDF8": "Spain",
        "\uD83C\uDDEB\uD83C\uDDEE": "Finland",
        "\uD83C\uDDEB\uD83C\uDDF7": "France",
        "\uD83C\uDDEC\uD83C\uDDE7": "United Kingdom",
        "\uD83C\uDDEC\uD83C\uDDEA": "Georgia",
        "\uD83C\uDDEC\uD83C\uDDF7": "Greece",
        "\uD83C\uDDEC\uD83C\uDDF9": "Guatemala",
        "\uD83C\uDDED\uD83C\uDDF0": "Hong Kong",
        "\uD83C\uDDED\uD83C\uDDF7": "Croatia",
        "\uD83C\uDDED\uD83C\uDDFA": "Hungary",
        "\uD83C\uDDEE\uD83C\uDDE9": "Indonesia",
        "\uD83C\uDDEE\uD83C\uDDEA": "Ireland",
        "\uD83C\uDDEE\uD83C\uDDF1": "Israel",
        "\uD83C\uDDEE\uD83C\uDDF3": "India",
        "\uD83C\uDDEE\uD83C\uDDF6": "Iraq",
        "\uD83C\uDDEE\uD83C\uDDF8": "Iceland",
        "\uD83C\uDDEE\uD83C\uDDF9": "Italy",
        "\uD83C\uDDEF\uD83C\uDDF5": "Japan",
        "\uD83C\uDDF0\uD83C\uDDED": "Cambodia",
        "\uD83C\uDDF0\uD83C\uDDF7": "South Korea",
        "\uD83C\uDDF0\uD83C\uDDFF": "Kazakhstan",
        "\uD83C\uDDF1\uD83C\uDDF9": "Lithuania",
        "\uD83C\uDDF1\uD83C\uDDFA": "Luxembourg",
        "\uD83C\uDDF1\uD83C\uDDFB": "Latvia",
        "\uD83C\uDDF2\uD83C\uDDE6": "Morocco",
        "\uD83C\uDDF2\uD83C\uDDE9": "Moldova",
        "\uD83C\uDDF2\uD83C\uDDF0": "North Macedonia",
        "\uD83C\uDDF2\uD83C\uDDFD": "Mexico",
        "\uD83C\uDDF2\uD83C\uDDFE": "Malaysia",
        "\uD83C\uDDF3\uD83C\uDDEC": "Nigeria",
        "\uD83C\uDDF3\uD83C\uDDF1": "Netherlands",
        "\uD83C\uDDF3\uD83C\uDDF4": "Norway",
        "\uD83C\uDDF3\uD83C\uDDF5": "Nepal",
        "\uD83C\uDDF3\uD83C\uDDFF": "New Zealand",
        "\uD83C\uDDF4\uD83C\uDDF2": "Oman",
        "\uD83C\uDDF5\uD83C\uDDEA": "Peru",
        "\uD83C\uDDF5\uD83C\uDDED": "Philippines",
        "\uD83C\uDDF5\uD83C\uDDF0": "Pakistan",
        "\uD83C\uDDF5\uD83C\uDDF1": "Poland",
        "\uD83C\uDDF5\uD83C\uDDF9": "Portugal",
        "\uD83C\uDDF6\uD83C\uDDE6": "Qatar",
        "\uD83C\uDDF7\uD83C\uDDF4": "Romania",
        "\uD83C\uDDF7\uD83C\uDDF8": "Serbia",
        "\uD83C\uDDF7\uD83C\uDDFA": "Russia",
        "\uD83C\uDDF8\uD83C\uDDE6": "Saudi Arabia",
        "\uD83C\uDDF8\uD83C\uDDEA": "Sweden",
        "\uD83C\uDDF8\uD83C\uDDEC": "Singapore",
        "\uD83C\uDDF8\uD83C\uDDEE": "Slovenia",
        "\uD83C\uDDF8\uD83C\uDDF0": "Slovakia",
        "\uD83C\uDDF9\uD83C\uDDED": "Thailand",
        "\uD83C\uDDF9\uD83C\uDDF7": "Turkey",
        "\uD83C\uDDFA\uD83C\uDDE6": "Ukraine",
        "\uD83C\uDDFA\uD83C\uDDF8": "United States",
        "\uD83C\uDDFA\uD83C\uDDFE": "Uruguay",
        "\uD83C\uDDFA\uD83C\uDDFF": "Uzbekistan",
        "\uD83C\uDDFB\uD83C\uDDF3": "Vietnam",
        "\uD83C\uDDFC\uD83C\uDDF8": "Samoa",
        "\uD83C\uDDFF\uD83C\uDDE6": "South Africa"
    }
};

// ==========================================
// 2. Domain Layer: Core Entities
// ==========================================

class ProxyNode {
    constructor(rawNode) {
        this.raw = rawNode;
        this.originalName = rawNode.name;
        this.provider = rawNode[CONFIG.PROVIDER_KEY] || 'Unknown';
        this.region = CONFIG.DEFAULT_REGION;
        this.flag = '';
    }

    setName(newName) {
        this.raw.name = newName;
    }
}

class NodeCollection {
    constructor(nodes) {
        this.nodes = nodes.map(n => new ProxyNode(n));
        this.regionCounts = {};
    }

    computeStatistics() {
        this.nodes.forEach(node => {
            const region = node.region;
            this.regionCounts[region] = (this.regionCounts[region] || 0) + 1;
        });
    }

    getRegionCount(region) {
        return this.regionCounts[region] || 0;
    }

    unwrap() {
        return this.nodes.map(n => n.raw);
    }
}

// ==========================================
// 3. Service Layer: Logic & Transformers
// ==========================================

class NameNormalizer {
    static extractFlag(name) {
        // Match standard Regional Indicator Sequence flags
        const match = name.match(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/);
        return match ? match[0] : null;
    }
}

class RegionResolver {
    constructor(flags) {
        this.flags = flags;
    }

    resolve(originalName) {
        const flag = NameNormalizer.extractFlag(originalName);
        if (flag && this.flags[flag]) {
            return this.flags[flag];
        }
        return CONFIG.DEFAULT_REGION;
    }
}

// ==========================================
// 4. Strategy Layer: Sorting Algorithms
// ==========================================

class PopularitySortingStrategy {
    sort(nodes, collection) {
        // 1. Rank Regions
        const allRegions = Object.keys(collection.regionCounts);

        allRegions.sort((a, b) => {
            const countA = collection.getRegionCount(a);
            const countB = collection.getRegionCount(b);
            // Descending Count
            if (countA !== countB) return countB - countA;
            // Alphabetical tie-break
            return a.localeCompare(b);
        });

        const regionRankMap = new Map();
        allRegions.forEach((region, index) => {
            regionRankMap.set(region, index);
        });

        // 2. Sort Nodes
        nodes.sort((nodeA, nodeB) => {
            // Major Sort: Region Rank
            const rankA = regionRankMap.get(nodeA.region);
            const rankB = regionRankMap.get(nodeB.region);
            if (rankA !== rankB) return rankA - rankB;

            // Minor Sort 1: Provider Name
            const provCompare = nodeA.provider.localeCompare(nodeB.provider);
            if (provCompare !== 0) return provCompare;

            // Minor Sort 2: Original Name (Stability)
            return nodeA.originalName.localeCompare(nodeB.originalName);
        });
    }
}

// ==========================================
// 5. Orchestrator / Main Pipeline
// ==========================================

function operator(proxies) {
    // A. Initialize Domain
    const collection = new NodeCollection(proxies);
    const resolver = new RegionResolver(CONFIG.FLAG_MAP);

    // B. Enrichment Phase (Map Flags)
    collection.nodes.forEach(node => {
        const flag = NameNormalizer.extractFlag(node.originalName);
        if (flag) node.flag = flag;
        node.region = resolver.resolve(node.originalName);
    });

    // C. Statistics Phase
    collection.computeStatistics();

    // D. Sorting Phase
    const strategy = new PopularitySortingStrategy();
    strategy.sort(collection.nodes, collection);

    // E. Renaming Phase
    const regionCounters = {};

    collection.nodes.forEach(node => {
        const region = node.region;
        if (!regionCounters[region]) regionCounters[region] = 0;
        regionCounters[region]++;

        const seq = String(regionCounters[region]).padStart(2, '0');

        // Format: Flag [Provider] Region NN
        const prefix = (node.provider && node.provider !== 'Unknown')
            ? `[${node.provider}] `
            : '';

        const flagPrefix = node.flag ? `${node.flag} ` : '';

        node.setName(`${flagPrefix}${prefix}${region} ${seq}`);
    });

    // F. Return raw objects
    return collection.unwrap();
}

if (typeof module !== 'undefined') {
    module.exports = { operator };
}

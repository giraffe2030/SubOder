/**
 * Sub-Store Script: Traffic Calculation
 * 从节点名称中提取流量信息（Used, Total, Expire）
 * 兼容格式: "51.69 G | 200.00 G" 和 "Expire Date：2026/02/16"
 * 输出方式与 sum.js 一致：写入 Sub-Store 存储 + 设置响应头
 */

async function operator(proxies = [], targetPlatform, context) {
    const SUBS_KEY = 'subs'
    const COLLECTIONS_KEY = 'collections'
    const $ = $substore

    console.log('[traffic_calc] 脚本开始执行, 节点数量:', proxies.length)

    const { source } = context
    const { _collection: collection } = source

    console.log('[traffic_calc] 组合订阅:', collection?.name || 'N/A')

    let uploadSum = 0
    let downloadSum = 0
    let totalSum = 0
    let expire = 0

    // 正则表达式
    // 匹配: 51.69 G | 200.00 G (支持 G/M，空格)
    const trafficRegex = /(\d+(?:\.\d+)?)\s*([GM])B?\s*\|\s*(\d+(?:\.\d+)?)\s*([GM])B?/i
    // 匹配: Expire Date：2026/02/16 (支持中英文冒号)
    const dateRegex = /Expire Date[:：]\s*(\d{4}[\/\-]\d{2}[\/\-]\d{2})/

    // 单位转换为字节
    const toBytes = (num, unit) => {
        const n = parseFloat(num)
        const u = unit.toUpperCase()
        if (u === 'G') return n * 1024 * 1024 * 1024
        if (u === 'M') return n * 1024 * 1024
        return n
    }

    // 遍历节点提取信息
    proxies.forEach(p => {
        const name = p.name || ""

        // 提取流量
        const trafficMatch = name.match(trafficRegex)
        if (trafficMatch) {
            downloadSum = toBytes(trafficMatch[1], trafficMatch[2])
            totalSum = toBytes(trafficMatch[3], trafficMatch[4])
        }

        // 提取过期时间
        const dateMatch = name.match(dateRegex)
        if (dateMatch) {
            const dateStr = dateMatch[1].replace(/-/g, '/')
            const ts = new Date(dateStr).getTime()
            if (!isNaN(ts)) {
                expire = Math.floor(ts / 1000)
            }
        }
    })

    // 构建 subscription-userinfo 字符串
    const subUserInfo = `upload=${Math.floor(uploadSum)}; download=${Math.floor(downloadSum)}; total=${Math.floor(totalSum)}${expire ? `; expire=${expire}` : ''}`

    console.log('[traffic_calc] 计算结果:', subUserInfo)

    // 写入 Sub-Store 存储（与 sum.js 一致）
    if (collection) {
        const allCols = $.read(COLLECTIONS_KEY) || []
        for (let index = 0; index < allCols.length; index++) {
            if (collection.name === allCols[index].name) {
                allCols[index].subUserinfo = subUserInfo
                break
            }
        }
        $.write(allCols, COLLECTIONS_KEY)
    }

    // 设置响应头（与 sum.js 一致）
    if (typeof $options !== 'undefined') {
        $options._res = {
            headers: {
                'subscription-userinfo': subUserInfo
            }
        }
    }

    return proxies
}

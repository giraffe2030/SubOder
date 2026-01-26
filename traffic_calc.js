/**
 * Sub-Store Script: Traffic Calculation (单订阅专用)
 * 从节点名称中提取流量信息（Used, Total, Expire）
 * 兼容格式: "51.69 G | 200.00 G" 和 "Expire Date：2026/02/16"
 */

async function operator(proxies = [], targetPlatform, context) {
    console.log('[traffic_calc] 脚本开始执行, 节点数量:', proxies.length)

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

    // 设置响应头
    if (typeof $options !== 'undefined') {
        $options._res = {
            headers: {
                'subscription-userinfo': subUserInfo
            }
        }
    }

    return proxies
}

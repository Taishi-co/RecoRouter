import Taro from '@tarojs/taro'

/**
 * 网络请求模块
 * 封装 Taro.request、Taro.uploadFile、Taro.downloadFile，自动添加项目域名前缀
 * 如果请求的 url 以 http:// 或 https:// 开头，则不会添加域名前缀
 *
 * IMPORTANT: 项目已经全局注入 PROJECT_DOMAIN
 * IMPORTANT: 除非你需要添加全局参数，如给所有请求加上 header，否则不能修改此文件
 */
export namespace Network {
    const createUrl = (url: string): string => {
        // 如果是完整 URL，直接返回
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url
        }

        // 如果 PROJECT_DOMAIN 为空或未定义，使用相对路径（开发环境）
        if (typeof PROJECT_DOMAIN !== 'string' || PROJECT_DOMAIN.length === 0) {
            return url
        }

        // 使用 PROJECT_DOMAIN 拼接 URL
        return `${PROJECT_DOMAIN}${url}`
    }

    const sanitizeGetQueryData = (data: unknown): unknown => {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return data
        }

        const sanitizedData: Record<string, unknown> = {}

        Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                sanitizedData[key] = value
            }
        })

        return sanitizedData
    }

    const authHeader = () => {
        const token = Taro.getStorageSync('token')
        if (typeof token === 'string' && token.trim().length > 0) {
            return { Authorization: `Bearer ${token}` }
        }
        return {}
    }

    export const request: typeof Taro.request = option => {
        const method = option.method ?? 'GET'

        return Taro.request({
            ...option,
            url: createUrl(option.url),
            data: method.toUpperCase() === 'GET' ? sanitizeGetQueryData(option.data) : option.data,
            header: {
                ...authHeader(),
                ...(option.header || {}),
            },
        })
    }

    export const uploadFile: typeof Taro.uploadFile = option => {
        return Taro.uploadFile({
            ...option,
            url: createUrl(option.url),
        })
    }

    export const downloadFile: typeof Taro.downloadFile = option => {
        return Taro.downloadFile({
            ...option,
            url: createUrl(option.url),
        })
    }
}

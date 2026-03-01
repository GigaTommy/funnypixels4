import request from '@/services/request'

// 导出request实例作为api
export const api = request

// 导出其他常用的API方法
export const get = request.get
export const post = request.post
export const put = request.put
export const del = request.delete
export const patch = request.patch

export default api
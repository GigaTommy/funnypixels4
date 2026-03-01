import request from './request'
import type { Role, Permission, CreateRoleRequest, UpdateRoleRequest, PaginationParams, PaginationResponse } from '@/types'

export const roleService = {
  // 获取角色列表
  getRoles: async (params?: PaginationParams): Promise<PaginationResponse<Role>> => {
    const response = await request.get('/admin/roles', { params })
    return response.data.data
  },

  // 获取角色详情
  getRoleById: async (id: number): Promise<Role> => {
    const response = await request.get(`/admin/roles/${id}`)
    return response.data.data
  },

  // 创建角色
  createRole: async (data: CreateRoleRequest): Promise<Role> => {
    const response = await request.post('/admin/roles', data)
    return response.data.data
  },

  // 更新角色
  updateRole: async (id: number, data: UpdateRoleRequest): Promise<Role> => {
    const response = await request.put(`/admin/roles/${id}`, data)
    return response.data.data
  },

  // 删除角色
  deleteRole: async (id: number): Promise<void> => {
    await request.delete(`/admin/roles/${id}`)
  },

  // 获取权限树
  getPermissionsTree: async (): Promise<Permission[]> => {
    const response = await request.get('/admin/permissions/tree')
    return response.data.data
  },

  // 获取所有权限
  getPermissions: async (): Promise<Permission[]> => {
    const response = await request.get('/admin/permissions')
    return response.data.data
  },
}

export default roleService
import { z } from 'zod'

// 创建角色 DTO
export const createRoleSchema = z.object({
  userId: z.string().min(1, '用户ID不能为空'),
  role: z.enum(['owner', 'merchant'], {
    message: '角色必须为 owner 或 merchant'
  })
})

export type CreateRoleDto = z.infer<typeof createRoleSchema>

// 切换角色 DTO
export const switchRoleSchema = z.object({
  userId: z.string().min(1, '用户ID不能为空'),
  roleId: z.string().min(1, '角色ID不能为空')
})

export type SwitchRoleDto = z.infer<typeof switchRoleSchema>

// 获取用户角色 DTO
export const getUserRolesSchema = z.object({
  userId: z.string().min(1, '用户ID不能为空')
})

export type GetUserRolesDto = z.infer<typeof getUserRolesSchema>

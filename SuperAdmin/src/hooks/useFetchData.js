import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'

// Dashboard
export const useDashboardData = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get('/api/founder/overview')
      return response.data
    },
  })
}

// Users
export const useUsers = (page = 1, limit = 10) => {
  return useQuery({
    queryKey: ['users', page, limit],
    queryFn: async () => {
      const response = await api.get(`/api/users?page=${page}&limit=${limit}`)
      return response.data
    },
  })
}

export const useUpdateUser = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ userId, data }) => {
      const response = await api.patch(`/api/users/${userId}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users'])
    },
  })
}

// Travel Content
export const useTravelContent = (page = 1, limit = 10) => {
  return useQuery({
    queryKey: ['travel-content', page, limit],
    queryFn: async () => {
      const response = await api.get(`/api/travel/content?page=${page}&limit=${limit}`)
      return response.data
    },
  })
}

export const useDeleteTravelContent = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (contentId) => {
      const response = await api.delete(`/api/travel/content/${contentId}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['travel-content'])
    },
  })
}

// Reports
export const useReports = (page = 1, limit = 10) => {
  return useQuery({
    queryKey: ['reports', page, limit],
    queryFn: async () => {
      const response = await api.get(`/api/reports?page=${page}&limit=${limit}`)
      return response.data
    },
  })
}

export const useUpdateReport = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ reportId, data }) => {
      const response = await api.patch(`/api/reports/${reportId}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reports'])
    },
  })
}

// Analytics
export const useAnalytics = (period = '30d') => {
  return useQuery({
    queryKey: ['analytics', period],
    queryFn: async () => {
      const response = await api.get(`/api/analytics?period=${period}`)
      return response.data
    },
  })
}

// Moderators
export const useModerators = () => {
  return useQuery({
    queryKey: ['moderators'],
    queryFn: async () => {
      const response = await api.get('/api/admins')
      return response.data
    },
  })
}

export const useCreateModerator = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/api/admins', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['moderators'])
    },
  })
}

export const useUpdateModerator = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ moderatorId, data }) => {
      const response = await api.patch(`/api/admins/${moderatorId}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['moderators'])
    },
  })
}

// Logs
export const useLogs = (page = 1, limit = 50) => {
  return useQuery({
    queryKey: ['logs', page, limit],
    queryFn: async () => {
      const response = await api.get(`/api/logs?page=${page}&limit=${limit}`)
      return response.data
    },
  })
}

// Settings
export const useSettings = () => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/api/settings')
      return response.data
    },
  })
}

export const useUpdateSettings = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data) => {
      const response = await api.patch('/api/settings', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['settings'])
    },
  })
}

import { appParams } from '@/lib/app-params';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const ACCESS_TOKEN_STORAGE_KEY = 'base44_access_token';

const getToken = () => appParams.token || window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || '';

const setToken = (token) => {
  if (token) {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  }
};

const buildHeaders = (extraHeaders = {}) => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders
  };
};

const apiRequest = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...buildHeaders(options.headers || {}),
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' })
    }
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const error = new Error(errorBody.message || `Request failed with ${response.status}`);
    error.status = response.status;
    error.data = errorBody;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
};

const createEntityClient = (entityName) => ({
  list: async (sort = '', limit = 0) => {
    const params = new URLSearchParams();
    if (sort) params.set('sort', sort);
    if (limit) params.set('limit', String(limit));
    return apiRequest(`/api/entities/${entityName}${params.toString() ? `?${params}` : ''}`);
  },
  filter: async (filter = {}, sort = '') => {
    const params = new URLSearchParams();
    params.set('filter', JSON.stringify(filter));
    if (sort) params.set('sort', sort);
    return apiRequest(`/api/entities/${entityName}?${params}`);
  },
  create: async (data) => apiRequest(`/api/entities/${entityName}`, { method: 'POST', body: JSON.stringify(data) }),
  update: async (id, data) => apiRequest(`/api/entities/${entityName}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: async (id) => apiRequest(`/api/entities/${entityName}/${id}`, { method: 'DELETE' })
});

const auth = {
  me: async () => apiRequest('/api/auth/me'),
  logout: () => {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem('base44_access_token');
  },
  redirectToLogin: async (preferredRole) => {
    const roleFromUrl = window.location.search.includes('role=admin') ? 'admin' : 'student';
    const role = preferredRole || roleFromUrl;
    const { token } = await apiRequest('/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ role })
    });
    setToken(token);
    window.location.reload();
  }
};

const integrations = {
  Core: {
    UploadFile: async ({ file }) => {
      const formData = new FormData();
      formData.append('file', file);

      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/api/integrations/core/upload-file`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });

      if (!response.ok) {
        throw new Error('File upload failed');
      }

      return response.json();
    },
    InvokeLLM: async (payload) => {
      const result = await apiRequest('/api/integrations/core/invoke-llm', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (payload?.response_json_schema) {
        try {
          return JSON.parse(result.response);
        } catch {
          return result.response;
        }
      }

      return result.response;
    }
  }
};

const appLogs = {
  logUserInApp: (pageName) =>
    apiRequest('/api/app-logs/in-app', {
      method: 'POST',
      body: JSON.stringify({ pageName })
    })
};

export const base44 = {
  auth,
  integrations,
  appLogs,
  entities: {
    Course: createEntityClient('Course'),
    CourseEnrollment: createEntityClient('CourseEnrollment'),
    ChatSession: createEntityClient('ChatSession'),
    Assignment: createEntityClient('Assignment'),
    Submission: createEntityClient('Submission'),
    Flashcard: createEntityClient('Flashcard')
  }
};

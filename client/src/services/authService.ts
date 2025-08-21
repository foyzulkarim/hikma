import axios from 'axios';
import Cookies from 'js-cookie';
import { API_BASE_URL, API_ENDPOINTS, AUTH_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME, TOKEN_REFRESH_THRESHOLD } from '../utils/constants';
import { LoginRequest, RegisterRequest, AuthResponse, User, UpdateProfileRequest, ChangePasswordRequest } from '../types';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for sending and receiving cookies
});

// Request interceptor to attach access token if available
apiClient.interceptors.request.use(
  (config) => {
    const accessToken = Cookies.get(AUTH_COOKIE_NAME);
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for automatic token refresh and error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // Avoid infinite loops for refresh token requests
    if (originalRequest.url === API_ENDPOINTS.AUTH.REFRESH) {
      return Promise.reject(error);
    }

    // Check for 401 Unauthorized and if it's not a refresh token request
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = Cookies.get(REFRESH_TOKEN_COOKIE_NAME);
        if (!refreshToken) {
          // No refresh token, redirect to login
          window.location.href = API_ENDPOINTS.AUTH.LOGIN; // Or use navigate from react-router-dom
          return Promise.reject(error);
        }

        // Attempt to refresh token
        const response = await axios.post<AuthResponse>(
          `${API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`,
          { refreshToken },
          { withCredentials: true }
        );

        // Update cookies with new tokens
        Cookies.set(AUTH_COOKIE_NAME, response.data.accessToken, { expires: 1/24/60 * 10 }); // Example: 10 minutes
        Cookies.set(REFRESH_TOKEN_COOKIE_NAME, response.data.refreshToken, { expires: 7 }); // Example: 7 days

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh token failed, clear tokens and redirect to login
        Cookies.remove(AUTH_COOKIE_NAME);
        Cookies.remove(REFRESH_TOKEN_COOKIE_NAME);
        window.location.href = API_ENDPOINTS.AUTH.LOGIN;
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

const authService = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(API_ENDPOINTS.AUTH.LOGIN, credentials);
    // Cookies are set by the backend with httpOnly and secure flags
    return response.data;
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(API_ENDPOINTS.AUTH.REGISTER, data);
    return response.data;
  },

  async logout(): Promise<void> {
    await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    Cookies.remove(AUTH_COOKIE_NAME);
    Cookies.remove(REFRESH_TOKEN_COOKIE_NAME);
  },

  async getProfile(): Promise<User> {
    const response = await apiClient.get<User>(API_ENDPOINTS.AUTH.PROFILE);
    return response.data;
  },

  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    const response = await apiClient.put<User>(API_ENDPOINTS.AUTH.PROFILE, data);
    return response.data;
  },

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await apiClient.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, data);
  },

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, { token, newPassword });
  },

  // This function can be used to check if a token refresh is needed before making a request
  // It's a client-side check to proactively refresh tokens
  async checkAndRefreshToken(): Promise<void> {
    const accessToken = Cookies.get(AUTH_COOKIE_NAME);
    const refreshToken = Cookies.get(REFRESH_TOKEN_COOKIE_NAME);

    if (!accessToken || !refreshToken) {
      return; // No tokens, nothing to refresh
    }

    // Decode access token to check expiration (simplified for example, usually done on backend or with jwt-decode lib)
    // For a real app, you'd parse the JWT to get expiry and check TOKEN_REFRESH_THRESHOLD
    // For now, we rely on the interceptor for 401 handling.
    // This function is more for proactive checks if needed.

    // If access token is close to expiry (e.g., within TOKEN_REFRESH_THRESHOLD)
    // and a refresh token exists, attempt to refresh.
    // This logic is mostly handled by the interceptor, but can be a manual trigger.
    // For simplicity, we'll let the interceptor handle it for now.
  },
};

export { authService };



import axios from 'axios';

const api = axios.create({
  baseURL:         import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  withCredentials: true, // envía cookies httpOnly en cada request
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // No redirige si ya estamos en /login (evita loop con la query de /me)
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;

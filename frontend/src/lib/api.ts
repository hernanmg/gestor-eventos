import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL:         `${BASE_URL}/api`,
  withCredentials: true,
  // No fijar Content-Type aquí — Axios lo detecta por request:
  //   objetos JSON → application/json automático
  //   FormData     → multipart/form-data con boundary automático (browser/Node)
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

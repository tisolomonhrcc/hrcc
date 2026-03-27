import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#091838] px-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white tracking-wider mb-2">
          HR CERTIFICATION CENTRE
        </h1>
        <p className="text-gray-300 text-sm tracking-[0.2em] uppercase">
          Professional Certification
        </p>
      </div>

      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-10">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-[#091838] mb-2">
            Admin Portal
          </h2>
          <p className="text-gray-500 text-sm">
            Enter your credentials to access the dashboard
          </p>
        </div>
        
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-[#091838] mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="admin@hrcc.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#e51836] focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-[#091838] mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e51836] focus:border-transparent transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-[#e51836] text-xs py-2 px-3 rounded-md text-center border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg text-white font-bold bg-[#e51836] hover:bg-[#d61632] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>

      <div className="mt-8 text-center">
        <p className="text-gray-500 text-xs">
          © {new Date().getFullYear()} HR Certification Centre. All rights reserved.
        </p>
      </div>
    </div>
  );
}

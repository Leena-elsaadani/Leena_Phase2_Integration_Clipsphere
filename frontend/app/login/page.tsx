// 'use client';

// import { useState } from 'react';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';
// import { api } from '../../services/api';
// import { refreshAuth } from '../../hooks/useAuth';

// export default function LoginPage() {
//   const router = useRouter();
//   const [form, setForm] = useState({ email: '', password: '' });
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     setForm({ ...form, [e.target.name]: e.target.value });
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError('');
//     setLoading(true);

//     try {
//       await api('/auth/login', {
//         method: 'POST',
//         body: JSON.stringify(form),
//       });
//       await refreshAuth();
//       router.push('/feed');
//       router.refresh();
//     } catch (err: any) {
//       setError(err.message || 'Login failed');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div style={{
//       minHeight: '100vh', backgroundColor: '#0d0d0d',
//       display: 'flex', alignItems: 'center', justifyContent: 'center',
//       padding: '1rem', fontFamily: "'DM Sans', sans-serif",
//     }}>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
//         input {
//           width: 100%;
//           padding: 0.875rem 1rem;
//           background: rgba(255,255,255,0.05);
//           border: 1px solid rgba(255,255,255,0.1);
//           border-radius: 10px;
//           color: #f9fafb;
//           font-size: 0.95rem;
//           font-family: 'DM Sans', sans-serif;
//           outline: none;
//           transition: all 0.3s ease;
//           box-sizing: border-box;
//         }
//         input:focus {
//           border-color: #8b5cf6;
//           box-shadow: 0 0 0 3px rgba(139,92,246,0.15);
//           background: rgba(139,92,246,0.05);
//         }
//         input::placeholder { color: #6b7280; }
//       `}</style>

//       <div style={{
//         position: 'fixed', top: '10%', right: '5%',
//         width: '300px', height: '300px', borderRadius: '50%',
//         background: 'radial-gradient(circle, rgba(139,92,246,0.1), transparent)',
//         filter: 'blur(40px)', pointerEvents: 'none',
//       }} />
//       <div style={{
//         position: 'fixed', bottom: '10%', left: '5%',
//         width: '300px', height: '300px', borderRadius: '50%',
//         background: 'radial-gradient(circle, rgba(236,72,153,0.08), transparent)',
//         filter: 'blur(40px)', pointerEvents: 'none',
//       }} />

//       <div style={{
//         width: '100%', maxWidth: '420px',
//         background: '#1a1a1a',
//         border: '1px solid rgba(139,92,246,0.2)',
//         borderRadius: '20px',
//         padding: '2.5rem',
//         boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
//         position: 'relative', zIndex: 10,
//       }}>
//         <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
//           <Link href="/" style={{ textDecoration: 'none' }}>
//             <span style={{
//               fontFamily: "'Syne', sans-serif", fontWeight: '800', fontSize: '1.5rem',
//               background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
//               WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
//               backgroundClip: 'text',
//             }}>ClipSphere</span>
//           </Link>
//           <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
//             Welcome back
//           </p>
//         </div>

//         {error && (
//           <div style={{
//             padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem',
//             background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.3)',
//             color: '#ec4899', fontSize: '0.875rem',
//           }}>
//             {error}
//           </div>
//         )}

//         <form onSubmit={handleSubmit}>
//           <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
//             <div>
//               <label style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: '500', display: 'block', marginBottom: '0.4rem' }}>
//                 Email
//               </label>
//               <input
//                 type="email"
//                 name="email"
//                 placeholder="you@example.com"
//                 value={form.email}
//                 onChange={handleChange}
//                 required
//               />
//             </div>

//             <div>
//               <label style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: '500', display: 'block', marginBottom: '0.4rem' }}>
//                 Password
//               </label>
//               <input
//                 type="password"
//                 name="password"
//                 placeholder="your password"
//                 value={form.password}
//                 onChange={handleChange}
//                 required
//               />
//             </div>

//             <button
//               type="submit"
//               disabled={loading}
//               style={{
//                 width: '100%', marginTop: '0.5rem', padding: '0.625rem',
//                 borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600',
//                 color: 'white', background: '#7c3aed', border: 'none',
//                 cursor: loading ? 'not-allowed' : 'pointer',
//                 opacity: loading ? 0.6 : 1, transition: 'background 0.2s',
//               }}
//             >
//               {loading ? 'Logging in...' : 'Login'}
//             </button>
//           </div>
//         </form>

//         <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
//           Don&apos;t have an account?{' '}
//           <Link href="/register" style={{ color: '#8b5cf6', textDecoration: 'none', fontWeight: '600' }}>
//             Register
//           </Link>
//         </p>
//       </div>
//     </div>
//   );
// }



// app/login/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../services/api';
import { refreshAuth } from '../../hooks/useAuth';
import { useForm } from '../../hooks/useForm';
import { loginSchema, LoginFormData } from '../../lib/validators';

// ── tiny inline error component ───────────────────────────────────────────────
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '4px', marginBottom: 0 }}>
      {message}
    </p>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const { values, errors, handleChange, validate } = useForm<LoginFormData>(
    loginSchema,
    { email: '', password: '' }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    // Client-side validation first
    if (!validate()) return;

    setLoading(true);
    try {
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      await refreshAuth();
      router.push('/feed');
      router.refresh();
    } catch (err: any) {
      setServerError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0d0d0d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        .auth-input {
          width: 100%;
          padding: 0.875rem 1rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: #f9fafb;
          font-size: 0.95rem;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }
        .auth-input:focus {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139,92,246,0.15);
          background: rgba(139,92,246,0.05);
        }
        .auth-input.error {
          border-color: #f87171;
          box-shadow: 0 0 0 3px rgba(248,113,113,0.12);
        }
        .auth-input::placeholder { color: #6b7280; }
      `}</style>

      {/* Background orbs */}
      <div style={{ position: 'fixed', top: '10%', right: '5%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1), transparent)', filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '10%', left: '5%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.08), transparent)', filter: 'blur(40px)', pointerEvents: 'none' }} />

      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(26,26,26,0.85)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: '20px',
          padding: '2.5rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: '800', fontSize: '1.5rem', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              ClipSphere
            </span>
          </Link>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Welcome back
          </p>
        </div>

        {/* Server error */}
        {serverError && (
          <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: '0.875rem' }}>
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Email */}
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: '500', display: 'block', marginBottom: '0.4rem' }}>
                Email
              </label>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                value={values.email}
                onChange={handleChange('email')}
                className={`auth-input${errors.email ? ' error' : ''}`}
                required
              />
              <FieldError message={errors.email} />
            </div>

            {/* Password */}
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: '500', display: 'block', marginBottom: '0.4rem' }}>
                Password
              </label>
              <input
                type="password"
                name="password"
                placeholder="your password"
                value={values.password}
                onChange={handleChange('password')}
                className={`auth-input${errors.password ? ' error' : ''}`}
                required
              />
              <FieldError message={errors.password} />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                marginTop: '0.5rem',
                padding: '0.75rem',
                borderRadius: '10px',
                fontSize: '0.9rem',
                fontWeight: '700',
                color: 'white',
                background: loading
                  ? 'rgba(139,92,246,0.5)'
                  : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
          Don&apos;t have an account?{' '}
          <Link href="/register" style={{ color: '#8b5cf6', textDecoration: 'none', fontWeight: '600' }}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
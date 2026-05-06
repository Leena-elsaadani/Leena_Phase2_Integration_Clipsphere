// 'use client';

// import { useState } from 'react';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';
// import { api } from '../../services/api';

// export default function RegisterPage() {
//   const router = useRouter();
//   const [form, setForm] = useState({ username: '', email: '', password: '' });
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
//       await api('/auth/register', {
//         method: 'POST',
//         body: JSON.stringify(form),
//       });
//       // After register, go to login
//       router.push('/login');
//     } catch (err: any) {
//       setError(err.message);
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
//         }
//         input:focus {
//           border-color: #8b5cf6;
//           box-shadow: 0 0 0 3px rgba(139,92,246,0.15);
//           background: rgba(139,92,246,0.05);
//         }
//         input::placeholder { color: #6b7280; }
//       `}</style>

//       {/* Background orbs */}
//       <div style={{
//         position: 'fixed', top: '10%', left: '5%',
//         width: '300px', height: '300px', borderRadius: '50%',
//         background: 'radial-gradient(circle, rgba(139,92,246,0.1), transparent)',
//         filter: 'blur(40px)', pointerEvents: 'none',
//       }} />
//       <div style={{
//         position: 'fixed', bottom: '10%', right: '5%',
//         width: '300px', height: '300px', borderRadius: '50%',
//         background: 'radial-gradient(circle, rgba(236,72,153,0.08), transparent)',
//         filter: 'blur(40px)', pointerEvents: 'none',
//       }} />

//       {/* Card */}
//       <div style={{
//         width: '100%', maxWidth: '420px',
//         background: '#1a1a1a',
//         border: '1px solid rgba(139,92,246,0.2)',
//         borderRadius: '20px',
//         padding: '2.5rem',
//         boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
//         position: 'relative', zIndex: 10,
//       }}>
//         {/* Logo */}
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
//             Create your account
//           </p>
//         </div>

//         {/* Error message */}
//         {error && (
//           <div style={{
//             padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem',
//             background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.3)',
//             color: '#ec4899', fontSize: '0.875rem',
//           }}>
//             {error}
//           </div>
//         )}

//         {/* Form */}
//         <form onSubmit={handleSubmit}>
//           <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

//             <div>
//               <label style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: '500', display: 'block', marginBottom: '0.4rem' }}>
//                 Username
//               </label>
//               <input
//                 type="text"
//                 name="username"
//                 placeholder="yourname"
//                 value={form.username}
//                 onChange={handleChange}
//                 required
//               />
//             </div>

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
//                 placeholder="min 8 characters"
//                 value={form.password}
//                 onChange={handleChange}
//                 required
//               />
//             </div>

//             <button
//               type="submit"
//               disabled={loading}
//               className="w-full mt-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
//             >
//               {loading ? 'Creating account...' : 'Create Account'}
//             </button>
//           </div>
//         </form>

//         {/* Login link */}
//         <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
//           Already have an account?{' '}
//           <Link href="/login" style={{ color: '#8b5cf6', textDecoration: 'none', fontWeight: '600' }}>
//             Login
//           </Link>
//         </p>
//       </div>
//     </div>
//   );
// }




// app/register/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../services/api';
import { useForm } from '../../hooks/useForm';
import { registerSchema, RegisterFormData } from '../../lib/validators';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '4px', marginBottom: 0 }}>
      {message}
    </p>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState('');
  const [loading, setLoading]         = useState(false);

  const { values, errors, handleChange, validate } = useForm<RegisterFormData>(
    registerSchema,
    { username: '', email: '', password: '' }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;

    setLoading(true);
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      router.push('/login');
    } catch (err: any) {
      setServerError(err.message || 'Registration failed. Please try again.');
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
      <div style={{ position: 'fixed', top: '10%', left: '5%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1), transparent)', filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '10%', right: '5%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.08), transparent)', filter: 'blur(40px)', pointerEvents: 'none' }} />

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
            Create your account
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

            {/* Username */}
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: '500', display: 'block', marginBottom: '0.4rem' }}>
                Username
              </label>
              <input
                type="text"
                name="username"
                placeholder="yourname"
                value={values.username}
                onChange={handleChange('username')}
                className={`auth-input${errors.username ? ' error' : ''}`}
                required
              />
              <FieldError message={errors.username} />
            </div>

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
                placeholder="min 8 characters"
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
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </div>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#8b5cf6', textDecoration: 'none', fontWeight: '600' }}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

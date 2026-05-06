// 'use client';

// import { useState, useEffect, useCallback } from 'react';
// import { api } from '../services/api';

// interface ReviewUser {
//   _id: string;
//   username: string;
//   avatarUrl?: string;
// }

// interface Review {
//   _id: string;
//   rating: number;
//   comment?: string;
//   user: ReviewUser;
//   createdAt: string;
// }

// interface Props {
//   videoId: string;
//   currentUserId?: string;
//   currentUserRole?: string;
// }

// export default function ReviewSection({ videoId, currentUserId, currentUserRole }: Props) {
//   const [reviews, setReviews] = useState<Review[]>([]);
//   const [avgRating, setAvgRating] = useState(0);
//   const [total, setTotal] = useState(0);
//   const [loading, setLoading] = useState(true);
//   const [rating, setRating] = useState(0);
//   const [hoverRating, setHoverRating] = useState(0);
//   const [comment, setComment] = useState('');
//   const [submitting, setSubmitting] = useState(false);

//   const loadReviews = useCallback(
//     () =>
//       api(`/videos/${videoId}/reviews`)
//         .then((res) => {
//           setReviews(res.data.reviews || []);
//           setAvgRating(res.data.avgRating ?? 0);
//           setTotal(res.data.total ?? 0);
//         })
//         .catch(() => {
//           setReviews([]);
//           setAvgRating(0);
//           setTotal(0);
//         }),
//     [videoId]
//   );

//   useEffect(() => {
//     setLoading(true);
//     loadReviews().finally(() => setLoading(false));
//   }, [loadReviews]);

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!currentUserId || rating < 1 || submitting) return;

//     setSubmitting(true);
//     try {
//       await api(`/videos/${videoId}/reviews`, {
//         method: 'POST',
//         body: JSON.stringify({
//           rating,
//           comment: comment.trim() || undefined,
//         }),
//       });
//       await loadReviews();
//       setComment('');
//       setRating(0);
//     } catch {
//       await loadReviews();
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const handleDelete = async (reviewId: string) => {
//     setReviews((prev) => prev.filter((r) => r._id !== reviewId));
//     try {
//       await api(`/videos/${videoId}/reviews/${reviewId}`, { method: 'DELETE' });
//       await loadReviews();
//     } catch {
//       await loadReviews();
//     }
//   };

//   const displayAvg = total > 0 ? avgRating.toFixed(1) : '—';

//   return (
//     <div style={{ marginTop: '0.5rem' }}>
//       <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: '700', fontSize: '1rem', color: '#f9fafb', marginBottom: '0.5rem' }}>
//         Reviews
//         <span style={{ color: '#6b7280', fontWeight: '500', fontSize: '0.85rem', marginLeft: '8px' }}>
//           {displayAvg} ★ · {total} {total === 1 ? 'review' : 'reviews'}
//         </span>
//       </h3>

//       {currentUserId && (
//         <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem', background: '#1a1a1a', borderRadius: '12px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)' }}>
//           <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: '0 0 8px', fontWeight: '600' }}>Your rating</p>
//           <div
//             style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}
//             onMouseLeave={() => setHoverRating(0)}
//           >
//             {[1, 2, 3, 4, 5].map((star) => {
//               const active = (hoverRating || rating) >= star;
//               return (
//                 <button
//                   key={star}
//                   type="button"
//                   onMouseEnter={() => setHoverRating(star)}
//                   onClick={() => setRating(star)}
//                   style={{
//                     background: 'none',
//                     border: 'none',
//                     cursor: 'pointer',
//                     fontSize: '1.35rem',
//                     lineHeight: 1,
//                     padding: '2px',
//                     color: active ? '#f59e0b' : '#4b5563',
//                     transition: 'color 0.15s ease',
//                   }}
//                   aria-label={`${star} stars`}
//                 >
//                   ★
//                 </button>
//               );
//             })}
//           </div>
//           <textarea
//             value={comment}
//             onChange={(e) => setComment(e.target.value)}
//             placeholder="Optional comment (max 500 chars)"
//             maxLength={500}
//             rows={3}
//             style={{
//               width: '100%',
//               boxSizing: 'border-box',
//               padding: '10px 12px',
//               borderRadius: '10px',
//               background: 'rgba(255,255,255,0.05)',
//               border: '1px solid rgba(255,255,255,0.1)',
//               color: '#f9fafb',
//               fontSize: '0.875rem',
//               outline: 'none',
//               resize: 'vertical',
//               fontFamily: "'DM Sans', sans-serif",
//               marginBottom: '10px',
//             }}
//           />
//           <button
//             type="submit"
//             disabled={submitting || rating < 1}
//             style={{
//               padding: '10px 18px',
//               borderRadius: '10px',
//               background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
//               border: 'none',
//               color: 'white',
//               fontWeight: '600',
//               cursor: rating < 1 ? 'not-allowed' : 'pointer',
//               opacity: submitting || rating < 1 ? 0.6 : 1,
//               fontFamily: "'DM Sans', sans-serif",
//               fontSize: '0.875rem',
//             }}
//           >
//             {submitting ? 'Submitting…' : 'Submit review'}
//           </button>
//         </form>
//       )}

//       {loading ? (
//         <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading reviews…</p>
//       ) : reviews.length === 0 ? (
//         <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No reviews yet. Be the first to rate this video.</p>
//       ) : (
//         <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
//           {reviews.map((r) => (
//             <div
//               key={r._id}
//               style={{
//                 background: '#1a1a1a',
//                 borderRadius: '12px',
//                 padding: '14px 16px',
//                 border: '1px solid rgba(255,255,255,0.06)',
//                 display: 'flex',
//                 justifyContent: 'space-between',
//                 alignItems: 'flex-start',
//                 gap: '10px',
//               }}
//             >
//               <div style={{ flex: 1 }}>
//                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
//                   <span style={{ color: '#f59e0b', fontSize: '0.9rem', letterSpacing: '1px' }}>
//                     {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
//                   </span>
//                   <span style={{ color: '#a78bfa', fontWeight: '600', fontSize: '0.8rem' }}>@{r.user.username}</span>
//                   <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>{new Date(r.createdAt).toLocaleDateString()}</span>
//                 </div>
//                 {r.comment && (
//                   <p style={{ color: '#d1d5db', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>{r.comment}</p>
//                 )}
//               </div>
//               {currentUserId &&
//                 (String(r.user._id) === String(currentUserId) || currentUserRole === 'admin') && (
//                   <button
//                     type="button"
//                     onClick={() => handleDelete(r._id)}
//                     style={{
//                       background: 'none',
//                       border: 'none',
//                       cursor: 'pointer',
//                       color: '#6b7280',
//                       fontSize: '0.75rem',
//                       padding: '2px 6px',
//                       borderRadius: '4px',
//                       flexShrink: 0,
//                     }}
//                   >
//                     Delete
//                   </button>
//                 )}
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }





// components/ReviewSection.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { reviewSchema } from '../lib/validators';

interface ReviewUser {
  _id: string;
  username: string;
  avatarUrl?: string;
}

interface Review {
  _id: string;
  rating: number;
  comment?: string;
  user: ReviewUser;
  createdAt: string;
}

interface Props {
  videoId: string;
  currentUserId?: string;
  currentUserRole?: string;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '4px', marginBottom: 0 }}>
      {message}
    </p>
  );
}

export default function ReviewSection({ videoId, currentUserId, currentUserRole }: Props) {
  const [reviews, setReviews]   = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);

  // Form state
  const [rating, setRating]     = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<{ rating?: string; comment?: string }>({});

  const loadReviews = useCallback(
    () =>
      api(`/videos/${videoId}/reviews`)
        .then((res) => {
          setReviews(res.data.reviews || []);
          setAvgRating(res.data.avgRating ?? 0);
          setTotal(res.data.total ?? 0);
        })
        .catch(() => {
          setReviews([]);
          setAvgRating(0);
          setTotal(0);
        }),
    [videoId]
  );

  useEffect(() => {
    setLoading(true);
    loadReviews().finally(() => setLoading(false));
  }, [loadReviews]);

  // Validate the review form
  const validateReview = (): boolean => {
    const result = reviewSchema.safeParse({ rating, comment: comment || undefined });
    if (result.success) {
      setFieldErrors({});
      return true;
    }
    const errs: { rating?: string; comment?: string } = {};
    result.error.issues.forEach((issue) => {
      const field = issue.path[0] as 'rating' | 'comment';
      if (!errs[field]) errs[field] = issue.message;
    });
    setFieldErrors(errs);
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || submitting) return;

    if (!validateReview()) return;

    setSubmitting(true);
    try {
      await api(`/videos/${videoId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      await loadReviews();
      setComment('');
      setRating(0);
      setFieldErrors({});
    } catch {
      await loadReviews();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    setReviews((prev) => prev.filter((r) => r._id !== reviewId));
    try {
      await api(`/videos/${videoId}/reviews/${reviewId}`, { method: 'DELETE' });
      await loadReviews();
    } catch {
      await loadReviews();
    }
  };

  const displayAvg = total > 0 ? avgRating.toFixed(1) : '—';

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: '700', fontSize: '1rem', color: '#f9fafb', marginBottom: '0.5rem' }}>
        Reviews
        <span style={{ color: '#6b7280', fontWeight: '500', fontSize: '0.85rem', marginLeft: '8px' }}>
          {displayAvg} ★ · {total} {total === 1 ? 'review' : 'reviews'}
        </span>
      </h3>

      {/* Review form */}
      {currentUserId && (
        <form
          onSubmit={handleSubmit}
          noValidate
          style={{ marginBottom: '1.5rem', background: '#1a1a1a', borderRadius: '12px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: '0 0 8px', fontWeight: '600' }}>
            Your rating <span style={{ color: '#f87171' }}>*</span>
          </p>

          {/* Star picker */}
          <div
            style={{ display: 'flex', gap: '4px', marginBottom: fieldErrors.rating ? '4px' : '10px' }}
            onMouseLeave={() => setHoverRating(0)}
          >
            {[1, 2, 3, 4, 5].map((star) => {
              const active = (hoverRating || rating) >= star;
              return (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onClick={() => {
                    setRating(star);
                    setFieldErrors((prev) => ({ ...prev, rating: undefined }));
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.35rem',
                    lineHeight: 1,
                    padding: '2px',
                    color: active ? '#f59e0b' : '#4b5563',
                    transition: 'color 0.15s ease',
                  }}
                  aria-label={`${star} stars`}
                >
                  ★
                </button>
              );
            })}
          </div>
          <FieldError message={fieldErrors.rating} />

          {/* Comment */}
          <textarea
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (e.target.value.length > 500) {
                setFieldErrors((prev) => ({ ...prev, comment: 'Comment cannot exceed 500 characters' }));
              } else {
                setFieldErrors((prev) => ({ ...prev, comment: undefined }));
              }
            }}
            placeholder="Optional comment (max 500 chars)"
            maxLength={500}
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.05)',
              border: fieldErrors.comment ? '1px solid #f87171' : '1px solid rgba(255,255,255,0.1)',
              color: '#f9fafb',
              fontSize: '0.875rem',
              outline: 'none',
              resize: 'vertical',
              fontFamily: "'DM Sans', sans-serif",
              marginBottom: fieldErrors.comment ? '4px' : '10px',
              marginTop: '10px',
            }}
          />
          <FieldError message={fieldErrors.comment} />

          {/* Character count */}
          <p style={{ color: comment.length > 450 ? '#f59e0b' : '#6b7280', fontSize: '0.7rem', textAlign: 'right', margin: '0 0 10px' }}>
            {comment.length}/500
          </p>

          <button
            type="submit"
            disabled={submitting || rating < 1}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              border: 'none',
              color: 'white',
              fontWeight: '600',
              cursor: rating < 1 ? 'not-allowed' : 'pointer',
              opacity: submitting || rating < 1 ? 0.6 : 1,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.875rem',
            }}
          >
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
        </form>
      )}

      {/* Reviews list */}
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No reviews yet. Be the first to rate this video.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {reviews.map((r) => (
            <div
              key={r._id}
              style={{
                background: '#1a1a1a',
                borderRadius: '12px',
                padding: '14px 16px',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#f59e0b', fontSize: '0.9rem', letterSpacing: '1px' }}>
                    {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                  </span>
                  <span style={{ color: '#a78bfa', fontWeight: '600', fontSize: '0.8rem' }}>
                    @{r.user.username}
                  </span>
                  <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {r.comment && (
                  <p style={{ color: '#d1d5db', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>
                    {r.comment}
                  </p>
                )}
              </div>
              {currentUserId &&
                (String(r.user._id) === String(currentUserId) || currentUserRole === 'admin') && (
                  <button
                    type="button"
                    onClick={() => handleDelete(r._id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#6b7280',
                      fontSize: '0.75rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#ec4899';
                      e.currentTarget.style.background = 'rgba(236,72,153,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#6b7280';
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    Delete
                  </button>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

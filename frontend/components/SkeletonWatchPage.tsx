// components/SkeletonWatchPage.tsx
export default function SkeletonWatchPage() {
  return (
    <div
      style={{
        maxWidth: '980px',
        margin: '0 auto',
        padding: '1rem 1rem 2rem',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Back button skeleton */}
      <div
        className="skeleton-shimmer"
        style={{
          height: '32px',
          width: '80px',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
      />

      {/* Video player skeleton — matches height: min(78vh, 560px) */}
      <div
        className="skeleton-shimmer"
        style={{
          width: '100%',
          height: 'min(78vh, 560px)',
          borderRadius: '16px',
          marginBottom: '1.5rem',
        }}
      />

      {/* Title skeleton — matches h1 Syne 1.5rem */}
      <div
        className="skeleton-shimmer"
        style={{
          height: '28px',
          borderRadius: '6px',
          width: '70%',
          marginBottom: '12px',
        }}
      />

      {/* Meta row — avatar + username + date + views */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div className="skeleton-shimmer" style={{ width: '30px', height: '30px', borderRadius: '50%' }} />
        <div className="skeleton-shimmer" style={{ height: '14px', width: '100px', borderRadius: '4px' }} />
        <div className="skeleton-shimmer" style={{ height: '12px', width: '70px', borderRadius: '4px' }} />
        <div className="skeleton-shimmer" style={{ height: '12px', width: '90px', borderRadius: '4px' }} />
      </div>

      {/* Description box skeleton */}
      <div
        className="skeleton-shimmer"
        style={{
          height: '64px',
          borderRadius: '10px',
          marginBottom: '1.5rem',
          width: '100%',
        }}
      />

      {/* Action buttons row — Like | Share */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem' }}>
        {[120, 100].map((w, i) => (
          <div
            key={i}
            className="skeleton-shimmer"
            style={{ height: '38px', width: `${w}px`, borderRadius: '100px' }}
          />
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '2rem' }} />

      {/* Reviews section skeleton */}
      <div className="skeleton-shimmer" style={{ height: '18px', width: '120px', borderRadius: '4px', marginBottom: '16px' }} />
      {[1, 2].map((i) => (
        <div
          key={i}
          className="skeleton-shimmer"
          style={{
            height: '80px',
            borderRadius: '12px',
            marginBottom: '10px',
            width: '100%',
          }}
        />
      ))}

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '2rem 0' }} />

      {/* Comments section skeleton */}
      <div className="skeleton-shimmer" style={{ height: '18px', width: '100px', borderRadius: '4px', marginBottom: '16px' }} />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="skeleton-shimmer"
          style={{
            height: '70px',
            borderRadius: '12px',
            marginBottom: '10px',
            width: '100%',
          }}
        />
      ))}
    </div>
  );
}
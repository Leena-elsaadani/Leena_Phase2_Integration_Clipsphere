export default function SkeletonVideoCard() {
  return (
    <div>
      <div style={{
        position: 'relative', paddingTop: '56.25%', borderRadius: '12px',
        overflow: 'hidden', background: '#1a1a1a',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmerSkeleton 1.5s infinite',
        }} />
      </div>
      <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%',
          background: '#1a1a1a', animation: 'shimmerSkeleton 1.5s infinite',
          flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: '12px', borderRadius: '4px', background: '#1a1a1a',
            marginBottom: '8px', width: '80%', animation: 'shimmerSkeleton 1.5s infinite' }} />
          <div style={{ height: '10px', borderRadius: '4px', background: '#1a1a1a',
            width: '50%', animation: 'shimmerSkeleton 1.5s infinite' }} />
        </div>
      </div>
      <style>{`
        @keyframes shimmerSkeleton {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </div>
  );
}
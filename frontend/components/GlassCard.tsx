interface Props {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export default function GlassCard({ children, style, className }: Props) {
  return (
    <div
      className={className}
      style={{
        background: 'rgba(26,26,26,0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(139,92,246,0.2)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
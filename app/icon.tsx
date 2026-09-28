import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFDF9',
          borderRadius: '50%',
          border: '2px solid #1E1B18',
          position: 'relative',
        }}
      >
        {/* Orange compass ring */}
        <div
          style={{
            position: 'absolute',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            border: '1.5px solid #FF6B35',
          }}
        />
        {/* Charcoal H */}
        <span
          style={{
            fontSize: '15px',
            fontWeight: 900,
            fontFamily: 'serif',
            color: '#1E1B18',
            lineHeight: 1,
            zIndex: 1,
          }}
        >
          H
        </span>
        {/* Orange diagonal slash indicator */}
        <div
          style={{
            position: 'absolute',
            width: '2px',
            height: '26px',
            backgroundColor: '#FF6B35',
            transform: 'rotate(45deg)',
            zIndex: 2,
            opacity: 0.9,
          }}
        />
        {/* Center pin */}
        <div
          style={{
            position: 'absolute',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: '#FF6B35',
            border: '1px solid #FFFDF9',
            zIndex: 3,
          }}
        />
      </div>
    ),
    { ...size }
  );
}

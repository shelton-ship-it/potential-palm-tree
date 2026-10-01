'use client';
import { canHover } from '@/lib/hover';
import React, { useRef, useEffect, useState } from 'react';
import StopIcon from '@mui/icons-material/Stop';

interface Props {
  url: string;
  channel: { name: string; logo?: string };
  onStop: () => void;
}

export default function ChannelPlayer({ url, channel, onStop }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url || !videoRef.current) return;

    let player: any;
    let destroyed = false;

    setError(false);

    (async () => {
      try {
        const shaka = await import('shaka-player');
        shaka.default.polyfill.installAll();

        if (!shaka.default.Player.isBrowserSupported()) {
          throw new Error('Browser not supported');
        }

        player = new shaka.default.Player();
        await player.attach(videoRef.current!);

        player.configure({
          streaming: {
            bufferingGoal: 8,
            rebufferingGoal: 2,
            retryParameters: { maxAttempts: 5 },
          },
        });

        player.addEventListener('error', (event: any) => {
          if (!destroyed) {
            console.error('Shaka error:', event.detail);
            setError(true);
          }
        });

        await player.load(url);

        if (!destroyed) {
          await videoRef.current?.play().catch(() => {});
        }
      } catch (err) {
        console.error('Error loading video:', err);
        if (!destroyed && videoRef.current) {
          videoRef.current.src = url;
          videoRef.current.play().catch(() => {});
        }
      }
    })();

    return () => {
      destroyed = true;
      if (player) {
        player.destroy().catch(() => {});
      }
    };
  }, [url]);

  return (
    // data-tv-player — marcador para o tv-navigation detectar este player
    <div
      data-tv-player
      style={{
        background: '#000',
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '24px',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
          margin: '0 auto',
          aspectRatio: '16 / 9',
          maxHeight: '70vh',
          background: '#000',
          overflow: 'hidden',
        }}
      >
        <video
          ref={videoRef}
          controls
          playsInline
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: 'contain',
            background: '#000',
          }}
        />

        {/* Channel info overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            pointerEvents: 'none',
            zIndex: 10,
            background:
              'linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
            padding: '8px 16px 8px 12px',
            borderRadius: '8px',
          }}
        >
          {channel.logo && (
            <img
              src={channel.logo}
              alt=""
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid rgba(255,255,255,0.2)',
              }}
            />
          )}
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: '0.95rem',
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}
            >
              {channel.name}
            </div>
            <span
              style={{
                background: '#ff0000',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                display: 'inline-block',
                letterSpacing: '0.5px',
              }}
            >
              AO VIVO
            </span>
          </div>
        </div>

        {/* data-modal-close — tv-navigation usa este atributo para fechar com Escape */}
        <button
          onClick={onStop}
          data-modal-close
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            background: 'rgba(0,0,0,0.75)',
            border: 'none',
            color: '#fff',
            borderRadius: '8px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
            zIndex: 10,
            transition: 'all 0.2s',
            backdropFilter: 'blur(8px)',
          }}
          onMouseEnter={(e) => {
            if (!canHover()) return;
            e.currentTarget.style.background = '#ff0000';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.75)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <StopIcon style={{ fontSize: 18 }} />
          Parar
        </button>

        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.9)',
              color: '#999',
              fontSize: '0.875rem',
              zIndex: 20,
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <span>Falha ao carregar canal. Tente outro.</span>
          </div>
        )}
      </div>
    </div>
  );
}
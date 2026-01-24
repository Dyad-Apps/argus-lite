import { useEffect, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadLinksPreset } from '@tsparticles/preset-links';
import type { Container, Engine, ISourceOptions } from '@tsparticles/engine';

export function ParticlesBackground() {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine: Engine) => {
      await loadLinksPreset(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  const particlesLoaded = async (_container?: Container): Promise<void> => {
    // Particles loaded
  };

  if (!init) return null;

  // Particle options with links preset customization
  const options: ISourceOptions = {
    fullScreen: { enable: false },
    preset: 'links',
    background: {
      color: 'transparent',
    },
    particles: {
      color: {
        value: ['#3b82f6', '#94a3b8', '#1e293b'],
      },
      links: {
        color: '#3b82f6',
        distance: 150,
        enable: true,
        opacity: 0.2,
        width: 1,
      },
      move: {
        enable: true,
        speed: 1.2,
        direction: 'none',
        random: false,
        straight: false,
        outModes: {
          default: 'out',
        },
      },
      number: {
        density: {
          enable: true,
        },
        value: 200,
      },
      opacity: {
        value: { min: 0.3, max: 0.7 },
      },
      shape: {
        type: 'circle',
      },
      size: {
        value: { min: 1, max: 3 },
      },
    },
    interactivity: {
      detectsOn: 'window',
      events: {
        onHover: {
          enable: true,
          mode: 'repulse',
        },
      },
      modes: {
        repulse: {
          distance: 180,
          duration: 0.4,
          factor: 100,
          speed: 1,
          maxSpeed: 50,
        },
      },
    },
    detectRetina: true,
  };

  return (
    <Particles
      id="tsparticles"
      particlesLoaded={particlesLoaded}
      className="absolute inset-0 w-full h-full"
      options={options}
    />
  );
}

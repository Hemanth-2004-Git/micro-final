import { motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';

const SLUGS  = ['decide', 'design', 'accelerate', 'govern', 'reuse'] as const;
const LABELS = ['Decide', 'Design', 'Accelerate', 'Govern', 'Reuse'] as const;

type Props = {
  scrollToSection: (id: string, behavior?: ScrollBehavior) => void;
};

export function PlatformRail({ scrollToSection }: Props) {
  const reduce = useReducedMotion() === true;
  const [active, setActive] = useState(0);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const pickActive = useCallback(() => {
    const focusY = window.innerHeight * 0.38;
    let bestI = 0;
    let bestD = Infinity;
    SLUGS.forEach((id, i) => {
      const el = document.getElementById(id);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 120 || r.top > window.innerHeight - 80) return;
      const c = (r.top + r.bottom) / 2;
      const d = Math.abs(c - focusY);
      if (d < bestD) { bestD = d; bestI = i; }
    });
    setActive(bestI);
  }, []);

  useEffect(() => {
    pickActive();
    window.addEventListener('scroll', pickActive, { passive: true });
    window.addEventListener('resize', pickActive);
    return () => {
      window.removeEventListener('scroll', pickActive);
      window.removeEventListener('resize', pickActive);
    };
  }, [pickActive]);

  /* ── Mobile: horizontal pill bar ── */
  if (narrow) {
    return (
      <nav className="pnav pnav--horiz" aria-label="Platform stages">
        {SLUGS.map((id, i) => (
          <a
            key={id}
            className={`pnav__link${i === active ? ' is-active' : ''}`}
            href={`#${id}`}
            onClick={(e) => { e.preventDefault(); scrollToSection(id, 'smooth'); }}
          >
            {LABELS[i]}
          </a>
        ))}
      </nav>
    );
  }

  /* ── Desktop: sticky vertical sidebar ── */
  return (
    <aside className="pnav pnav--vert" aria-label="Platform stages">
      <nav className="pnav__list">
        {SLUGS.map((id, i) => {
          const isActive = i === active;
          return (
            <a
              key={id}
              className={`pnav__link${isActive ? ' is-active' : ''}`}
              href={`#${id}`}
              aria-current={isActive ? 'step' : undefined}
              onClick={(e) => { e.preventDefault(); scrollToSection(id, 'smooth'); }}
            >
              {/* Animated bullet dot for active item */}
              <span className="pnav__dot-wrap" aria-hidden="true">
                {isActive && (
                  <motion.span
                    className="pnav__dot"
                    layoutId="pnav-dot"
                    transition={reduce
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 400, damping: 32 }
                    }
                  />
                )}
              </span>
              <span className="pnav__label">{LABELS[i]}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

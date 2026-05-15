import { motion, useReducedMotion } from 'framer-motion';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { PIPELINE_CONVERGENCE_OFFSET_FROM_BOTTOM } from '../pipelineConstants';

type Point = { x: number; y: number };

const STAGE_ANCHOR_IDS = ['decide', 'design', 'accelerate', 'govern', 'reuse'] as const;

function pathLengthFromD(d: string): number {
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  return p.getTotalLength();
}

/** Single vertical segment (center spine). */
function verticalSpinePath(cx: number, yTop: number, yBottom: number): string {
  if (yBottom <= yTop + 1) return '';
  return `M ${cx} ${yTop} L ${cx} ${yBottom}`;
}

type Geom = {
  w: number;
  h: number;
  d: string;
  len: number;
  rootY: number;
  nodePoints: Point[];
};

type Props = {
  containerRef: React.RefObject<HTMLDivElement | null>;
};

export function AiEnergyFlowOverlay({ containerRef }: Props) {
  const reduce = useReducedMotion() === true;
  const rafMeasureRef = useRef<number>(0);
  const spinePathRef = useRef<SVGPathElement>(null);
  const [geom, setGeom] = useState<Geom | null>(null);
  const [scrollT, setScrollT] = useState(0);
  const [traveler, setTraveler] = useState<Point | null>(null);

  const readScrollProgress = useCallback(() => {
    const scrollEl = document.scrollingElement ?? document.documentElement;
    const maxScroll = Math.max(1, scrollEl.scrollHeight - window.innerHeight);
    return Math.min(1, Math.max(0, window.scrollY / maxScroll));
  }, []);

  const measure = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;

    const w = Math.max(1, root.offsetWidth);
    const h = Math.max(1, root.offsetHeight);
    const rootRect = root.getBoundingClientRect();
    const cx = w * 0.5;

    const relY = (el: Element | null, yBias: number): number | null => {
      if (!(el instanceof HTMLElement)) return null;
      const r = el.getBoundingClientRect();
      return r.top - rootRect.top + r.height * yBias;
    };

    const canvas = root.querySelector('.pipeline-canvas');
    let rootY: number | null = null;

    if (canvas instanceof HTMLCanvasElement) {
      const cRect = canvas.getBoundingClientRect();
      rootY = cRect.top - rootRect.top + cRect.height - PIPELINE_CONVERGENCE_OFFSET_FROM_BOTTOM;
    }

    if (rootY == null) {
      const pipeline = root.querySelector('.hero-pipeline');
      const py = relY(pipeline, 0.88);
      if (py != null) rootY = py;
    }

    if (rootY == null) {
      setGeom(null);
      return;
    }

    const foot = root.querySelector('.site-foot');
    let bottomY =
      foot instanceof HTMLElement
        ? foot.getBoundingClientRect().bottom - rootRect.top
        : h - 12;

    bottomY = Math.min(h, Math.max(bottomY, rootY + 80));

    const d = verticalSpinePath(cx, rootY, bottomY);
    const len = d ? pathLengthFromD(d) : 0;

    if (len <= 0) {
      setGeom(null);
      return;
    }

    const nodePoints: Point[] = [{ x: cx, y: rootY }];
    for (const id of STAGE_ANCHOR_IDS) {
      const el = document.getElementById(id);
      const y = relY(el, 0.5);
      if (y != null && y > rootY + 24 && y < bottomY - 8) {
        nodePoints.push({ x: cx, y });
      }
    }

    setGeom({ w, h, d, len, rootY, nodePoints });
  }, [containerRef]);

  const syncTravelerToPath = useCallback((t: number, dPath: string, lenHint: number) => {
    const pathEl = spinePathRef.current;
    if (!pathEl || lenHint <= 0) {
      setTraveler(null);
      return;
    }
    pathEl.setAttribute('d', dPath);
    const L = pathEl.getTotalLength();
    if (L <= 0) {
      setTraveler(null);
      return;
    }
    const dist = Math.min(L, Math.max(0, t * L));
    const pt = pathEl.getPointAtLength(dist);
    setTraveler({ x: pt.x, y: pt.y });
  }, []);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const scheduleMeasure = () => {
      if (rafMeasureRef.current) cancelAnimationFrame(rafMeasureRef.current);
      rafMeasureRef.current = requestAnimationFrame(() => {
        rafMeasureRef.current = 0;
        measure();
      });
    };

    scheduleMeasure();
    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(root);
    window.addEventListener('resize', scheduleMeasure);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      if (rafMeasureRef.current) cancelAnimationFrame(rafMeasureRef.current);
    };
  }, [measure]);

  useLayoutEffect(() => {
    const onScroll = () => setScrollT(readScrollProgress());
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [readScrollProgress]);

  useLayoutEffect(() => {
    if (!geom) {
      setTraveler(null);
      return;
    }
    syncTravelerToPath(scrollT, geom.d, geom.len);
  }, [geom, scrollT, syncTravelerToPath]);

  if (!geom) {
    return <div className="ai-energy-flow" aria-hidden="true" />;
  }

  const { w, h, d, len, nodePoints } = geom;

  const dashSeg = Math.max(30, len * 0.04);
  const dashGap = Math.max(60, len * 0.12);
  const dashPattern = `${dashSeg} ${dashGap}`;

  return (
    <div className="ai-energy-flow" aria-hidden="true">
      <svg
        className="ai-energy-flow__svg"
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="ai-spine-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7ecde9" stopOpacity="0.0" />
            <stop offset="8%" stopColor="#7ecde9" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#a8e8ff" stopOpacity="0.70" />
            <stop offset="80%" stopColor="#7ecde9" stopOpacity="0.60" />
            <stop offset="100%" stopColor="#7ecde9" stopOpacity="0.20" />
          </linearGradient>

          <linearGradient id="ai-trail-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c8f0ff" stopOpacity="0" />
            <stop offset="40%" stopColor="#c8f0ff" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="70%" stopColor="#c8f0ff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#c8f0ff" stopOpacity="0" />
          </linearGradient>

          <radialGradient id="ai-traveler-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c8f0ff" stopOpacity="0.80" />
            <stop offset="35%" stopColor="#7ecde9" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#4aa8c8" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#4aa8c8" stopOpacity="0" />
          </radialGradient>

          <filter id="ai-spine-glow" x="-60%" y="-2%" width="220%" height="104%">
            <feGaussianBlur stdDeviation="5" result="blur1" />
            <feGaussianBlur stdDeviation="2" result="blur2" in="SourceGraphic" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="ai-traveler-glow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="8" result="tg" />
            <feMerge>
              <feMergeNode in="tg" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="ai-node-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="nb" />
            <feMerge>
              <feMergeNode in="nb" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path ref={spinePathRef} d={d} fill="none" stroke="none" opacity={0} aria-hidden />

        <motion.g
          animate={reduce ? undefined : { opacity: [0.75, 1, 0.75] }}
          transition={reduce ? undefined : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path
            d={d}
            fill="none"
            stroke="url(#ai-spine-grad)"
            strokeWidth={8}
            strokeLinecap="round"
            filter="url(#ai-spine-glow)"
            opacity={0.35}
          />
          <path
            d={d}
            fill="none"
            stroke="url(#ai-spine-grad)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
          <path
            d={d}
            fill="none"
            stroke="rgba(220, 248, 255, 0.65)"
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
          />

          {!reduce && len > 0 && (
            <>
              <motion.path
                d={d}
                fill="none"
                stroke="url(#ai-trail-grad)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray={dashPattern}
                initial={{ strokeDashoffset: 0 }}
                animate={{ strokeDashoffset: -len * 1.3 }}
                transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
                opacity={0.7}
              />
              <motion.path
                d={d}
                fill="none"
                stroke="rgba(210, 245, 255, 0.30)"
                strokeWidth={1}
                strokeLinecap="round"
                strokeDasharray={`${Math.max(8, len * 0.006)} ${Math.max(35, len * 0.06)}`}
                initial={{ strokeDashoffset: 0 }}
                animate={{ strokeDashoffset: -len }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              />
            </>
          )}
        </motion.g>

        {nodePoints.map((n, i) => (
          <g key={i} transform={`translate(${n.x} ${n.y})`}>
            <circle r={18} fill="rgba(74, 168, 200, 0.06)" filter="url(#ai-node-glow)" />
            <circle r={5} fill="rgba(180, 230, 255, 0.18)" />
            <circle r={2.2} fill="rgba(220, 248, 255, 0.70)" />
            <circle r={1.0} fill="rgba(255, 255, 255, 0.90)" />
            {!reduce && (
              <motion.circle
                r={8}
                fill="none"
                stroke="rgba(120, 200, 230, 0.28)"
                strokeWidth={0.7}
                initial={{ opacity: 0.28 }}
                animate={{ opacity: [0.28, 0.60, 0.28] }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.4,
                }}
              />
            )}
          </g>
        ))}

        {traveler && (
          <g transform={`translate(${traveler.x} ${traveler.y})`} className="ai-energy-flow__traveler">
            <circle r={42} fill="url(#ai-traveler-halo)" opacity={0.5} />
            <circle r={18} fill="rgba(126, 200, 227, 0.22)" filter="url(#ai-traveler-glow)" />
            <circle r={7} fill="rgba(180, 235, 255, 0.55)" filter="url(#ai-traveler-glow)" />
            <circle r={3.5} fill="#f0faff" />
            <circle r={1.5} fill="#ffffff" />
            {!reduce && (
              <motion.circle
                r={16}
                fill="none"
                stroke="rgba(160, 230, 255, 0.50)"
                strokeWidth={0.9}
                animate={{ opacity: [0.5, 0.1, 0.5], r: [14, 22, 14] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </g>
        )}
      </svg>
    </div>
  );
}

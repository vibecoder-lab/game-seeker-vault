import React from 'react';
import ReactDOM from 'react-dom';
import { t } from '../i18n/index.js';

// Geometry constants (deliberately simple/tunable — visuals are expected to
// be revised later; this is the functional skeleton).
const DEAD_ZONE_RADIUS = 32;
const INNER_RADIUS = 40;
const OUTER_RADIUS = 140;
const PADDING = 20;
const SIZE = (OUTER_RADIUS + PADDING) * 2;
const CENTER = SIZE / 2;

// Angle convention: 0deg = right, 90deg = down (matches screen coordinates,
// where atan2(dy, dx) grows clockwise since Y increases downward).
// Upper half (180-360) = the 3 always-available actions, left-to-right.
// Lower half (0-180) = the 3 card-only actions, left-to-right.
const SEGMENTS = [
  { start: 180, end: 240, action: 'scrollTop', row: 'upper', labelKey: 'radialMenu.scrollTop' },
  { start: 240, end: 300, action: 'openCollection', row: 'upper', labelKey: 'radialMenu.openCollection' },
  { start: 300, end: 360, action: 'changeFolderTarget', row: 'upper', labelKey: 'radialMenu.changeFolderTarget' },
  { start: 120, end: 180, action: 'showDetail', row: 'lower', labelKey: 'radialMenu.showDetail' },
  { start: 60, end: 120, action: 'playTrailer', row: 'lower', labelKey: 'radialMenu.playTrailer' },
  { start: 0, end: 60, action: 'addToCollection', row: 'lower', labelKey: 'radialMenu.addToCollection' },
];

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(cx, cy, innerR, outerR, startAngle, endAngle) {
  const p1 = polarToCartesian(cx, cy, outerR, startAngle);
  const p2 = polarToCartesian(cx, cy, outerR, endAngle);
  const p3 = polarToCartesian(cx, cy, innerR, endAngle);
  const p4 = polarToCartesian(cx, cy, innerR, startAngle);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerR} ${outerR} 0 0 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerR} ${innerR} 0 0 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

function resolveSegment(dx, dy) {
  const dist = Math.hypot(dx, dy);
  if (dist < DEAD_ZONE_RADIUS || dist > OUTER_RADIUS) return null;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  deg = (deg + 360) % 360;
  return SEGMENTS.find((s) => deg >= s.start && deg < s.end) ?? null;
}

/**
 * Self-contained radial right-click menu. Knows nothing about
 * dbHelper/collectionMap/games — it only tracks pointer geometry and, for
 * card-scoped actions, the `data-game-id` of whatever was under the cursor
 * when the right button went down. Callers resolve ids to actual game
 * objects and own all the real side effects.
 */
export function RadialMenu({
  currentTheme,
  currentLocale,
  enabled,
  suppressed,
  onScrollTop,
  onOpenCollection,
  onChangeFolderTarget,
  onShowDetail,
  onAddToCollection,
  onPlayTrailer,
  isGameFavorited,
}) {
  const menuRef = React.useRef(null); // { anchor: {x,y}, targetGameId, hoverAction } | null
  const [, forceRender] = React.useReducer((x) => x + 1, 0);

  // Latest callbacks/flags, read by the stable event handlers below so they
  // never see stale closures without needing to re-register on every render.
  const latestRef = React.useRef({});
  latestRef.current = {
    suppressed,
    onScrollTop,
    onOpenCollection,
    onChangeFolderTarget,
    onShowDetail,
    onAddToCollection,
    onPlayTrailer,
  };

  React.useEffect(() => {
    if (!enabled) return undefined;

    const closeMenu = () => {
      if (menuRef.current) {
        menuRef.current = null;
        forceRender();
      }
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    const handleMouseDown = (e) => {
      if (e.button !== 2 || latestRef.current.suppressed) return;
      const card = e.target.closest?.('[data-game-id]');
      menuRef.current = {
        anchor: { x: e.clientX, y: e.clientY },
        targetGameId: card ? card.getAttribute('data-game-id') : null,
        hoverAction: null,
      };
      forceRender();
    };

    const handleMouseMove = (e) => {
      const m = menuRef.current;
      if (!m) return;
      const seg = resolveSegment(e.clientX - m.anchor.x, e.clientY - m.anchor.y);
      const hoverAction = seg ? seg.action : null;
      if (hoverAction === m.hoverAction) return;
      menuRef.current = { ...m, hoverAction };
      forceRender();
    };

    const handleMouseUp = (e) => {
      if (e.button !== 2) return;
      const m = menuRef.current;
      if (!m) return;
      const seg = resolveSegment(e.clientX - m.anchor.x, e.clientY - m.anchor.y);
      menuRef.current = null;
      if (seg) {
        const disabled = seg.row === 'lower' && m.targetGameId == null;
        if (!disabled) {
          const cb = latestRef.current;
          switch (seg.action) {
            case 'scrollTop': cb.onScrollTop(); break;
            case 'openCollection': cb.onOpenCollection(); break;
            case 'changeFolderTarget': cb.onChangeFolderTarget(e.clientX, e.clientY); break;
            case 'showDetail': cb.onShowDetail(m.targetGameId); break;
            case 'addToCollection': cb.onAddToCollection(m.targetGameId); break;
            case 'playTrailer': cb.onPlayTrailer(m.targetGameId); break;
            default: break;
          }
        }
      }
      forceRender();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', closeMenu);
    document.addEventListener('visibilitychange', closeMenu);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', closeMenu);
      document.removeEventListener('visibilitychange', closeMenu);
      menuRef.current = null;
    };
  }, [enabled]);

  if (!enabled) return null;
  const menu = menuRef.current;
  if (!menu) return null;

  const { anchor, targetGameId, hoverAction } = menu;
  const isDark = currentTheme === 'steam';
  const baseFill = isDark ? 'rgba(51,65,85,0.95)' : 'rgba(255,255,255,0.95)';
  const hoverFill = isDark ? 'rgba(71,85,105,0.98)' : 'rgba(229,231,235,0.98)';
  const textColor = isDark ? '#e2e8f0' : '#374151';
  const strokeColor = isDark ? 'rgba(226,232,240,0.25)' : 'rgba(55,65,81,0.2)';

  return ReactDOM.createPortal(
    <div
      className="fixed pointer-events-none z-[70]"
      style={{ left: anchor.x - CENTER, top: anchor.y - CENTER, width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} className="overflow-visible">
        {SEGMENTS.map((seg) => {
          const disabled = seg.row === 'lower' && targetGameId == null;
          const isHover = hoverAction === seg.action && !disabled;
          const mid = (seg.start + seg.end) / 2;
          const labelPos = polarToCartesian(CENTER, CENTER, (INNER_RADIUS + OUTER_RADIUS) / 2, mid);
          const isFavorited = seg.action === 'addToCollection' && targetGameId != null && isGameFavorited?.(targetGameId);
          const labelKey = isFavorited ? 'radialMenu.removeFromCollection' : seg.labelKey;
          return (
            <g key={seg.action} opacity={disabled ? 0.35 : 1}>
              <path
                d={wedgePath(CENTER, CENTER, INNER_RADIUS, OUTER_RADIUS, seg.start, seg.end)}
                fill={isHover ? hoverFill : baseFill}
                stroke={strokeColor}
                strokeWidth={1}
              />
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={textColor}
                fontSize={11}
                fontWeight={500}
                style={{ userSelect: 'none' }}
              >
                {t(labelKey, currentLocale)}
              </text>
            </g>
          );
        })}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={DEAD_ZONE_RADIUS}
          fill={baseFill}
          stroke={strokeColor}
          strokeWidth={1}
        />
      </svg>
    </div>,
    document.body,
  );
}

/*
 * Vietnamese dishes drawn for the seasonal backdrops: a bowl of phở, a plate
 * of chả giò with nước chấm and a pot of lẩu on its burner (the shared
 * `FoodLayer`, so winter and Halloween), plus gà luộc, the boiled whole chicken
 * of the Tết altar tray (Tết Nguyên Đán, alongside phở and chả giò). Drawn
 * rather than emoji because emoji has no spring roll or gà luộc, and at
 * backdrop size the 🍜 / 🍲 glyphs read as generic noodles and stew.
 *
 * Each fills whatever box it is given (width via className) and keeps its own
 * aspect ratio. Steam wisps use `currentColor` and the `.winter-steam`
 * animation from globals.css, so they rise like the cacao mug's.
 */

type DishProps = { className?: string };

function Steam({ paths }: { paths: string[] }) {
  return (
    <>
      {paths.map((d, i) => (
        <path
          key={i}
          className="winter-steam"
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ animationDelay: `${-i * 1.3}s` }}
        />
      ))}
    </>
  );
}

export function PhoBowl({ className }: DishProps) {
  return (
    <svg className={className} viewBox="0 0 120 104">
      <Steam
        paths={[
          "M44 34 C38 26 50 20 44 12 C39 6 46 2 44 -4",
          "M60 32 C66 24 54 16 60 8 C65 2 58 -2 60 -8",
          "M76 34 C70 27 82 21 76 13 C72 7 78 3 76 -3",
        ]}
      />
      {/* Bowl: white porcelain, blue rim band, a foot underneath. */}
      <rect x="42" y="90" width="36" height="8" rx="3" fill="#cbd5e1" />
      <path
        d="M8 48 H112 C110 76 88 94 60 94 C32 94 10 76 8 48 Z"
        fill="#f8fafc"
        stroke="#cbd5e1"
        strokeWidth="1.5"
      />
      <path d="M13 60 C30 66 90 66 107 60" fill="none" stroke="#3b82f6" strokeWidth="3" />
      <path
        d="M20 72 C36 78 84 78 100 72"
        fill="none"
        stroke="#93c5fd"
        strokeWidth="2"
        strokeDasharray="5 4"
      />
      {/* Broth, noodles, then what sits on top. */}
      <ellipse cx="60" cy="48" rx="52" ry="11" fill="#e0a43a" />
      <ellipse cx="60" cy="47" rx="44" ry="7" fill="#f2c265" />
      <path
        d="M22 50 C32 44 40 54 50 48 C58 43 66 54 76 48 C86 43 92 52 100 47"
        fill="none"
        stroke="#fff7e0"
        strokeWidth="2"
      />
      <path
        d="M28 45 C38 50 46 42 56 46 C66 50 74 42 86 46"
        fill="none"
        stroke="#fff7e0"
        strokeWidth="1.6"
      />
      {/* Tái beef slices. */}
      <ellipse cx="44" cy="46" rx="9" ry="4" fill="#b4534a" transform="rotate(-12 44 46)" />
      <ellipse cx="66" cy="44" rx="10" ry="4" fill="#9f4a3f" transform="rotate(8 66 44)" />
      {/* Herbs, spring onion, chili. */}
      <ellipse cx="56" cy="50" rx="5" ry="2.2" fill="#22c55e" transform="rotate(30 56 50)" />
      <ellipse cx="80" cy="49" rx="5" ry="2.2" fill="#16a34a" transform="rotate(-25 80 49)" />
      <ellipse cx="32" cy="49" rx="4.5" ry="2" fill="#4ade80" transform="rotate(15 32 49)" />
      <circle cx="72" cy="50" r="2.2" fill="none" stroke="#86efac" strokeWidth="1.2" />
      <circle cx="50" cy="42" r="2" fill="none" stroke="#86efac" strokeWidth="1.2" />
      <circle cx="88" cy="45" r="2" fill="#ef4444" />
      <circle cx="38" cy="43" r="1.8" fill="#ef4444" />
      {/* Chopsticks resting across the rim. */}
      <line x1="92" y1="6" x2="54" y2="58" stroke="#a16207" strokeWidth="3" strokeLinecap="round" />
      <line
        x1="102"
        y1="10"
        x2="64"
        y2="60"
        stroke="#854d0e"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SpringRolls({ className }: DishProps) {
  return (
    <svg className={className} viewBox="0 0 130 90">
      {/* Plate and a lettuce leaf. */}
      <ellipse cx="60" cy="68" rx="56" ry="15" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
      <ellipse cx="60" cy="67" rx="44" ry="10" fill="none" stroke="#bfdbfe" strokeWidth="1.5" />
      <path
        d="M14 62 C18 50 30 48 38 52 C44 44 58 44 64 50 C72 44 86 46 90 56 C80 64 30 68 14 62 Z"
        fill="#4ade80"
        opacity="0.85"
      />
      {/* Chả giò: three fried rolls, golden with blistered skin. */}
      <defs>
        <linearGradient id="winter-roll" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="55%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
      </defs>
      {[
        { x: 16, y: 46, rotate: -6 },
        { x: 30, y: 36, rotate: 4 },
        { x: 22, y: 26, rotate: -3 },
      ].map((roll, i) => (
        <g key={i} transform={`rotate(${roll.rotate} ${roll.x + 32} ${roll.y + 9})`}>
          <rect x={roll.x} y={roll.y} width="64" height="18" rx="9" fill="url(#winter-roll)" />
          <ellipse cx={roll.x + 60} cy={roll.y + 9} rx="4" ry="8" fill="#fcd34d" opacity="0.8" />
          {[10, 20, 30, 40, 50].map((dx) => (
            <path
              key={dx}
              d={`M${roll.x + dx} ${roll.y + 4} q3 3 0 6`}
              fill="none"
              stroke="#78350f"
              strokeOpacity="0.45"
              strokeWidth="1.2"
            />
          ))}
        </g>
      ))}
      {/* Nước chấm in a little bowl: garlic and chili floating in it. */}
      <path
        d="M92 58 H126 C125 70 118 76 109 76 C100 76 93 70 92 58 Z"
        fill="#f8fafc"
        stroke="#cbd5e1"
        strokeWidth="1.5"
      />
      <ellipse cx="109" cy="58" rx="17" ry="5" fill="#fb923c" opacity="0.9" />
      <circle cx="103" cy="57" r="1.6" fill="#dc2626" />
      <circle cx="112" cy="59" r="1.4" fill="#dc2626" />
      <circle cx="116" cy="56" r="1.3" fill="#fef3c7" />
      <circle cx="107" cy="60" r="1.2" fill="#fef3c7" />
    </svg>
  );
}

export function Hotpot({ className }: DishProps) {
  return (
    <svg className={className} viewBox="0 0 120 112">
      <Steam
        paths={[
          "M40 30 C34 22 46 16 40 8 C35 2 42 -2 40 -8",
          "M60 28 C66 20 54 12 60 4 C65 -2 58 -6 60 -12",
          "M80 30 C74 23 86 17 80 9 C76 3 82 -1 80 -7",
        ]}
      />
      {/* Portable gas burner and its blue flame. */}
      <rect x="18" y="92" width="84" height="16" rx="4" fill="#475569" />
      <circle cx="92" cy="100" r="3.5" fill="#94a3b8" />
      <rect x="26" y="97" width="30" height="5" rx="2" fill="#334155" />
      {[36, 48, 60, 72, 84].map((x) => (
        <path key={x} d={`M${x - 4} 92 Q${x} 80 ${x + 4} 92 Z`} fill="#60a5fa" opacity="0.9" />
      ))}
      {/* Pot: brushed steel with dark handles. */}
      <defs>
        <linearGradient id="winter-pot" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="45%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>
      <rect x="2" y="46" width="14" height="7" rx="3.5" fill="#334155" />
      <rect x="104" y="46" width="14" height="7" rx="3.5" fill="#334155" />
      <path
        d="M12 42 H108 V70 C108 80 98 86 88 86 H32 C22 86 12 80 12 70 Z"
        fill="url(#winter-pot)"
      />
      {/* Spicy red broth, and what is cooking in it. */}
      <ellipse cx="60" cy="42" rx="48" ry="10" fill="#dc2626" />
      <ellipse cx="60" cy="41" rx="40" ry="6.5" fill="#f87171" opacity="0.7" />
      {/* Shrimp. */}
      <path d="M26 42 C26 34 38 34 38 41 C36 38 30 38 30 43 Z" fill="#fb923c" />
      <path d="M78 40 C78 32 90 32 90 39 C88 36 82 36 82 41 Z" fill="#fb923c" />
      {/* Shiitake, enoki, tofu, greens. */}
      <ellipse cx="50" cy="39" rx="6" ry="3.5" fill="#78350f" />
      <ellipse cx="50" cy="38" rx="3" ry="1.4" fill="#a16207" />
      {[62, 65, 68].map((x) => (
        <line
          key={x}
          x1={x}
          y1="46"
          x2={x + 2}
          y2="36"
          stroke="#fefce8"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
      <rect x="70" y="43" width="7" height="6" rx="1" fill="#fef9c3" />
      <ellipse cx="96" cy="44" rx="6" ry="2.5" fill="#22c55e" transform="rotate(-20 96 44)" />
      <ellipse cx="40" cy="46" rx="6" ry="2.5" fill="#16a34a" transform="rotate(18 40 46)" />
    </svg>
  );
}

/**
 * Gà luộc for the Tết tray: a whole boiled chicken, sitting up, golden-skinned,
 * with a red rose in its beak and shredded lime leaf over its back, on a plate
 * with a red-and-gold rim.
 */
export function BoiledChicken({ className }: DishProps) {
  return (
    <svg className={className} viewBox="0 0 130 100">
      <defs>
        <linearGradient id="dish-chicken-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="55%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* Plate, rimmed in Tết red and gold. */}
      <ellipse cx="66" cy="84" rx="60" ry="13" fill="#f8fafc" stroke="#dc2626" strokeWidth="3" />
      <ellipse cx="66" cy="83" rx="50" ry="9" fill="none" stroke="#fbbf24" strokeWidth="1.5" />
      {/* Body, then the thigh and wing laid over it. */}
      <ellipse cx="72" cy="62" rx="42" ry="22" fill="url(#dish-chicken-skin)" />
      <ellipse cx="96" cy="68" rx="15" ry="11" fill="#f59e0b" transform="rotate(-18 96 68)" />
      <path
        d="M104 74 C110 78 114 80 118 78"
        fill="none"
        stroke="#fde68a"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M58 54 C68 44 88 44 98 54 C88 60 70 62 58 54 Z" fill="#f59e0b" opacity="0.8" />
      {/* Neck curving up to the head. */}
      <path
        d="M44 64 C34 56 28 46 30 34"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <circle cx="30" cy="28" r="10" fill="#fcd34d" />
      {/* Comb and wattle. */}
      <path d="M24 20 L26 12 L29 18 L32 10 L34 18 L37 14 L37 22 Z" fill="#dc2626" />
      <ellipse cx="24" cy="38" rx="3" ry="4.5" fill="#dc2626" />
      {/* Closed eye and beak. */}
      <path
        d="M31 26 q3 2 5 0"
        fill="none"
        stroke="#78350f"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M21 28 L12 31 L21 33 Z" fill="#ea580c" />
      {/* The rose in its beak. */}
      <line x1="12" y1="31" x2="6" y2="42" stroke="#15803d" strokeWidth="1.6" />
      <ellipse cx="8" cy="41" rx="3" ry="1.6" fill="#22c55e" transform="rotate(-30 8 41)" />
      <circle cx="10" cy="29" r="5" fill="#e11d48" />
      <path d="M8 28 q2 -3 4 0 q-2 3 -4 0" fill="none" stroke="#9f1239" strokeWidth="1" />
      {/* Shredded lime leaf over its back, and the shine on the skin. */}
      <g stroke="#16a34a" strokeWidth="1.4" strokeLinecap="round">
        <line x1="66" y1="46" x2="72" y2="44" />
        <line x1="78" y1="43" x2="84" y2="45" />
        <line x1="88" y1="47" x2="93" y2="50" />
        <line x1="72" y1="49" x2="77" y2="48" />
      </g>
      <ellipse cx="62" cy="56" rx="10" ry="4" fill="#fff" opacity="0.35" />
    </svg>
  );
}

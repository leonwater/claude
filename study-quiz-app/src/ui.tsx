import type { ReactNode } from "react";

export function Screen({ title, onBack, actions, children }: { title: string; onBack?: () => void; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="screen">
      <header className="topbar">
        {onBack ? (
          <button className="icon-btn" onClick={onBack} aria-label="뒤로">
            ‹
          </button>
        ) : (
          <span className="icon-spacer" />
        )}
        <h1>{title}</h1>
        <div className="topbar-actions">{actions}</div>
      </header>
      <main>{children}</main>
    </div>
  );
}

export function ProgressBar({ value, max, tone }: { value: number; max: number; tone?: "good" | "warn" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`bar ${tone ?? ""}`} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SizePicker({
  value,
  options,
  onChange,
  label = String,
}: {
  value: number;
  options: readonly number[];
  onChange: (n: number) => void;
  label?: (n: number) => string;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((n) => (
        <button key={n} role="radio" aria-checked={value === n} className={value === n ? "on" : ""} onClick={() => onChange(n)}>
          {label(n)}
        </button>
      ))}
    </div>
  );
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

export function formatUsd(n: number): string {
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** 끝내지 않은 퀴즈가 있으면 이어 풀기 안내를 보여 준다. 새 퀴즈 시작 버튼은 이 값으로 막는다 */
export function ActiveQuizNotice({ onResume }: { onResume: () => void }) {
  return (
    <div className="notice">
      <div>진행 중인 퀴즈가 있습니다. 끝내기를 눌러야 새 퀴즈를 시작할 수 있어요.</div>
      <button className="primary block resume" onClick={onResume}>
        이어 풀기
      </button>
    </div>
  );
}

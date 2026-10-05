import { useEffect, useRef, useState } from "react";
import { geocodeSuggest } from "../api";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export default function LocationInput({ id, label, value, onChange, placeholder, className }: Props) {
  const [items, setItems] = useState<{ label: string; short: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<number>();
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    window.clearTimeout(timer.current);
    if (value.trim().length < 3) { setItems([]); return; }
    timer.current = window.setTimeout(async () => {
      try {
        const r = await geocodeSuggest(value);
        setItems(r);
        setOpen(true);
        setActive(-1);
      } catch { setItems([]); }
    }, 450);
    return () => window.clearTimeout(timer.current);
  }, [value]);

  const pick = (i: number) => {
    const it = items[i];
    if (!it) return;
    skipNext.current = true;
    onChange(it.label);
    setOpen(false);
  };

  return (
    <div className={`field waypoint ${className ?? ""}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(active); }
          if (e.key === "Escape") setOpen(false);
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
      />
      {open && items.length > 0 && (
        <ul className="suggest" id={`${id}-list`} role="listbox">
          {items.map((it, i) => (
            <li key={it.label} role="option" aria-selected={i === active} onMouseDown={() => pick(i)}>
              {it.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

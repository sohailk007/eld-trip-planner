import type { DailyLog, Status } from "../types";

/**
 * Draws one "Driver's Daily Log (24 hours)" sheet as SVG, following the layout of the
 * standard paper form: header fields, 24-hour graph grid with four duty rows, Remarks,
 * shipping documents and the 70-hour recap.
 */

const W = 1000;
const H = 690;

// Grid geometry
const GX0 = 118; // midnight (left)
const GX1 = 888; // midnight (right)
const PX_PER_HOUR = (GX1 - GX0) / 24;
const GY0 = 232;
const ROW_H = 30;
const ROWS: { status: Status; label: string[] }[] = [
  { status: "off_duty", label: ["1. Off Duty"] },
  { status: "sleeper", label: ["2. Sleeper", "Berth"] },
  { status: "driving", label: ["3. Driving"] },
  { status: "on_duty", label: ["4. On Duty", "(not driving)"] },
];
const ROW_INDEX: Record<Status, number> = { off_duty: 0, sleeper: 1, driving: 2, on_duty: 3 };
const COLOR: Record<Status, string> = {
  off_duty: "#8a94a6",
  sleeper: "#1e6fd1",
  driving: "#e9a500",
  on_duty: "#15325c",
};

const INK = "#15325c";
const RULE = "#9aa7b8";
const TEXT = "#1b2430";
const MUTED = "#5b6878";

const x = (hour: number) => GX0 + Math.min(24, Math.max(0, hour)) * PX_PER_HOUR;
const rowY = (status: Status) => GY0 + ROW_INDEX[status] * ROW_H + ROW_H / 2;

const hourLabel = (h: number) => (h === 0 || h === 24 ? "Mid-\nnight" : h === 12 ? "Noon" : String(h > 12 ? h - 12 : h));

function Field({ x: fx, y, w, label, value, align = "start" }: { x: number; y: number; w: number; label: string; value?: string; align?: "start" | "middle" }) {
  return (
    <g>
      <line x1={fx} y1={y} x2={fx + w} y2={y} stroke={INK} strokeWidth={1} />
      {value && (
        <text x={align === "middle" ? fx + w / 2 : fx + 4} y={y - 5} fontSize={14} fontWeight={600} fill={TEXT} textAnchor={align} fontFamily="Barlow Semi Condensed, Barlow, sans-serif">
          {value}
        </text>
      )}
      <text x={align === "middle" ? fx + w / 2 : fx} y={y + 12} fontSize={9} fill={MUTED} textAnchor={align}>{label}</text>
    </g>
  );
}

function Box({ x: bx, y, w, h, label, value }: { x: number; y: number; w: number; h: number; label: string; value?: string }) {
  return (
    <g>
      <rect x={bx} y={y} width={w} height={h} fill="none" stroke={INK} strokeWidth={1.5} />
      {value && (
        <text x={bx + w / 2} y={y + h / 2 + 7} fontSize={20} fontWeight={700} fill={TEXT} textAnchor="middle" fontFamily="Barlow Semi Condensed, Barlow, sans-serif">
          {value}
        </text>
      )}
      <text x={bx + w / 2} y={y + h + 12} fontSize={9} fill={MUTED} textAnchor="middle">{label}</text>
    </g>
  );
}

export default function LogSheet({ log }: { log: DailyLog }) {
  const d = new Date(log.date + "T00:00:00");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = String(d.getFullYear());
  const totalHours = Object.values(log.totals).reduce((a, b) => a + b, 0);
  const onDutyToday = (log.totals.driving + log.totals.on_duty).toFixed(2);

  // Build the duty-status polyline through the grid
  const segs = [...log.segments].sort((a, b) => a.start_hour - b.start_hour);
  let path = "";
  segs.forEach((s, i) => {
    const y = rowY(s.status);
    const xs = x(s.start_hour);
    const xe = x(s.end_hour);
    if (i === 0) path += `M ${xs} ${y} `;
    else path += `L ${xs} ${y} `; // vertical connector from previous row
    path += `L ${xe} ${y} `;
  });

  const remarkYTop = GY0 + ROWS.length * ROW_H + 8;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Driver's daily log for ${log.date}`} fontFamily="Barlow, system-ui, sans-serif" fill={TEXT}>
      <rect width={W} height={H} fill="#fff" />

      {/* ---- Header ---- */}
      <text x={20} y={34} fontSize={26} fontWeight={700} fontFamily="Barlow Semi Condensed, Barlow, sans-serif">Drivers Daily Log</text>
      <text x={20} y={50} fontSize={11} fill={MUTED}>(24 hours)</text>
      <Field x={320} y={38} w={60} label="(month)" value={month} align="middle" />
      <text x={386} y={36} fontSize={16}>/</text>
      <Field x={396} y={38} w={60} label="(day)" value={day} align="middle" />
      <text x={462} y={36} fontSize={16}>/</text>
      <Field x={472} y={38} w={70} label="(year)" value={year} align="middle" />
      <text x={600} y={28} fontSize={10} fill={MUTED}>Original - File at home terminal.</text>
      <text x={600} y={42} fontSize={10} fill={MUTED}>Duplicate - Driver retains in his/her possession for 8 days.</text>
      <text x={600} y={60} fontSize={10} fill={MUTED}>Day {log.day_index} of trip</text>

      <text x={20} y={80} fontSize={13} fontWeight={700}>From:</text>
      <Field x={64} y={82} w={330} label="" value={log.from} />
      <text x={420} y={80} fontSize={13} fontWeight={700}>To:</text>
      <Field x={446} y={82} w={534} label="" value={log.to} />

      <Box x={20} y={100} w={150} h={38} label="Total Miles Driving Today" value={log.total_miles.toLocaleString()} />
      <Box x={180} y={100} w={150} h={38} label="Total Mileage Today" value={log.total_miles.toLocaleString()} />
      <Field x={20} y={178} w={310} label="Truck/Tractor and Trailer Numbers or License Plate(s)/State (show each unit)" value={log.header.truck_number || undefined} />

      <Field x={520} y={118} w={460} label="Name of Carrier or Carriers" value={log.header.carrier_name || undefined} align="middle" />
      <Field x={520} y={152} w={460} label="Main Office Address" align="middle" />
      <Field x={520} y={186} w={460} label="Home Terminal Address" align="middle" />

      {/* ---- Graph grid ---- */}
      <rect x={GX0 - 60} y={GY0 - 26} width={GX1 - GX0 + 60 + 84} height={26} fill={INK} />
      {Array.from({ length: 25 }, (_, h) => (
        <text key={h} x={x(h)} y={GY0 - 9} fontSize={9} fontWeight={600} fill="#fff" textAnchor="middle">
          {hourLabel(h).split("\n").map((l, i, arr) => (
            <tspan key={i} x={x(h)} dy={i === 0 ? (arr.length > 1 ? -8 : 0) : 9}>{l}</tspan>
          ))}
        </text>
      ))}
      <text x={GX1 + 50} y={GY0 - 14} fontSize={9} fontWeight={600} fill="#fff" textAnchor="middle">Total</text>
      <text x={GX1 + 50} y={GY0 - 4} fontSize={9} fontWeight={600} fill="#fff" textAnchor="middle">Hours</text>

      {ROWS.map((r, i) => {
        const top = GY0 + i * ROW_H;
        return (
          <g key={r.status}>
            <rect x={GX0} y={top} width={GX1 - GX0} height={ROW_H} fill="none" stroke={INK} strokeWidth={1.2} />
            {r.label.map((l, li) => (
              <text key={li} x={20} y={top + 13 + li * 11} fontSize={10} fontWeight={600}>{l}</text>
            ))}
            {/* hour lines and quarter ticks */}
            {Array.from({ length: 96 }, (_, q) => {
              const xx = GX0 + q * (PX_PER_HOUR / 4);
              const isHour = q % 4 === 0;
              const isHalf = q % 4 === 2;
              const len = isHour ? ROW_H : isHalf ? 10 : 6;
              return <line key={q} x1={xx} y1={isHour ? top : top} x2={xx} y2={top + len} stroke={isHour ? INK : RULE} strokeWidth={isHour ? 1 : 0.8} />;
            })}
            {/* totals column */}
            <rect x={GX1 + 10} y={top} width={72} height={ROW_H} fill="none" stroke={INK} strokeWidth={1.2} />
            <text x={GX1 + 46} y={top + 20} fontSize={15} fontWeight={700} textAnchor="middle" fontFamily="Barlow Semi Condensed, Barlow, sans-serif">
              {log.totals[r.status].toFixed(2).replace(/\.?0+$/, "")}
            </text>
          </g>
        );
      })}

      {/* ---- Duty status line ---- */}
      <path d={path} fill="none" stroke="#1b2430" strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.18} transform="translate(0,1.5)" />
      {segs.map((s, i) => (
        <line key={i} x1={x(s.start_hour)} y1={rowY(s.status)} x2={x(s.end_hour)} y2={rowY(s.status)} stroke={COLOR[s.status]} strokeWidth={4.5} strokeLinecap="butt">
          <title>{`${s.label}${s.location ? " — " + s.location : ""} (${(s.end_hour - s.start_hour).toFixed(2)} h)`}</title>
        </line>
      ))}
      {segs.map((s, i) =>
        i === 0 ? null : (
          <line key={`v${i}`} x1={x(s.start_hour)} y1={rowY(segs[i - 1].status)} x2={x(s.start_hour)} y2={rowY(s.status)} stroke="#1b2430" strokeWidth={2.5} />
        )
      )}

      {/* grand total */}
      <text x={GX1 + 46} y={GY0 + ROWS.length * ROW_H + 18} fontSize={13} fontWeight={700} textAnchor="middle" fontFamily="Barlow Semi Condensed, Barlow, sans-serif">
        = {totalHours.toFixed(2).replace(/\.?0+$/, "")}
      </text>

      {/* ---- Remarks ---- */}
      <line x1={20} y1={remarkYTop} x2={20} y2={remarkYTop + 170} stroke={INK} strokeWidth={3} />
      <text x={30} y={remarkYTop + 16} fontSize={13} fontWeight={700}>Remarks</text>
      {log.remarks.map((r, i) => (
        <g key={i} transform={`translate(${x(r.hour)}, ${remarkYTop + 4})`}>
          <line x1={0} y1={0} x2={0} y2={10} stroke={INK} strokeWidth={1} />
          <text transform="translate(3, 14) rotate(55)" fontSize={9} fill={TEXT}>{r.text}</text>
        </g>
      ))}

      {/* ---- Shipping documents ---- */}
      <text x={30} y={remarkYTop + 120} fontSize={11} fontWeight={700}>Shipping</text>
      <text x={30} y={remarkYTop + 133} fontSize={11} fontWeight={700}>Documents:</text>
      <Field x={30} y={remarkYTop + 150} w={260} label="DVL or Manifest No. or" />
      <Field x={30} y={remarkYTop + 180} w={260} label="Shipper &amp; Commodity" />
      <text x={520} y={remarkYTop + 165} fontSize={10} fill={MUTED} textAnchor="middle">
        Enter name of place you reported and where released from work and when and where each change of duty occurred.
      </text>
      <text x={520} y={remarkYTop + 178} fontSize={10} fill={MUTED} textAnchor="middle">Use time standard of home terminal.</text>

      {/* ---- Recap ---- */}
      <line x1={20} y1={H - 100} x2={W - 20} y2={H - 100} stroke={RULE} />
      <text x={20} y={H - 80} fontSize={11} fontWeight={700}>Recap:</text>
      <text x={20} y={H - 66} fontSize={9} fill={MUTED}>Complete at</text>
      <text x={20} y={H - 56} fontSize={9} fill={MUTED}>end of day</text>

      <text x={120} y={H - 80} fontSize={9} fill={MUTED}>On duty hours</text>
      <text x={120} y={H - 70} fontSize={9} fill={MUTED}>today, Total</text>
      <text x={120} y={H - 60} fontSize={9} fill={MUTED}>lines 3 &amp; 4</text>
      <text x={200} y={H - 64} fontSize={20} fontWeight={700} fontFamily="Barlow Semi Condensed, Barlow, sans-serif">{onDutyToday}</text>

      <text x={300} y={H - 86} fontSize={10} fontWeight={700}>70 Hour / 8 Day Drivers</text>
      <text x={300} y={H - 72} fontSize={9} fill={MUTED}>A. Total hours on duty</text>
      <text x={300} y={H - 62} fontSize={9} fill={MUTED}>last 8 days including today.</text>
      <text x={300} y={H - 40} fontSize={20} fontWeight={700} fontFamily="Barlow Semi Condensed, Barlow, sans-serif">{log.cycle_used_end}</text>

      <text x={470} y={H - 72} fontSize={9} fill={MUTED}>B. Total hours available</text>
      <text x={470} y={H - 62} fontSize={9} fill={MUTED}>tomorrow 70 hr. minus A*</text>
      <text x={470} y={H - 40} fontSize={20} fontWeight={700} fontFamily="Barlow Semi Condensed, Barlow, sans-serif">{log.cycle_available_tomorrow}</text>

      <text x={640} y={H - 72} fontSize={9} fill={MUTED}>*If you took 34 consecutive hours off duty</text>
      <text x={640} y={H - 62} fontSize={9} fill={MUTED}>you have 70 hours available.</text>
      {log.header.driver_name && (
        <g>
          <text x={840} y={H - 40} fontSize={16} fontStyle="italic" textAnchor="middle" fontFamily="Barlow Semi Condensed, Barlow, sans-serif">{log.header.driver_name}</text>
          <line x1={740} y1={H - 34} x2={940} y2={H - 34} stroke={INK} />
          <text x={840} y={H - 22} fontSize={9} fill={MUTED} textAnchor="middle">Driver's signature in full</text>
        </g>
      )}
    </svg>
  );
}

const STEPS = [
  { title: "Battery", body: "Simulated laptop and phone cells: load, CC-CV charging, heating, wear.", code: "step(state, dt)" },
  { title: "SMBus", body: "Sixteen-bit register words read from the gas gauge at address 0x0B.", code: "read_word_data(0x0B, 0x09)" },
  { title: "Flask API", body: "Decodes each register, stores the reading, serves REST and JSON-RPC 2.0.", code: "POST /api/poll" },
  { title: "PostgreSQL", body: "Time-series readings per pack, indexed on (battery_id, ts).", code: "Battery 1 ── * Reading" },
  { title: "Dashboard", body: "React and TypeScript, polling every two seconds with Zustand.", code: "useTelemetry()" },
];

export function HowItWorks({ repo }: { repo: string }) {
  return (
    <section className="about" id="how-it-works" aria-labelledby="about-title">
      <div className="about-intro">
        <div className="eyebrow">How it works</div>
        <h2 id="about-title">The tool behind the battery in your laptop and phone.</h2>
        <p>
          Every laptop and phone battery has a gas-gauge chip that reports voltage, current, temperature and charge
          over SMBus. Hardware teams build tools around that data to catch a cell running hot, capacity fading too fast,
          or firmware reporting a value wrong. CellScope is a working model of one. The bus is simulated behind the same
          interface as smbus2, so real hardware replaces a single class.
        </p>
      </div>

      <ol className="pipeline">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="step-num mono">{String(i + 1).padStart(2, "0")}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
            <code className="mono">{s.code}</code>
          </li>
        ))}
      </ol>

      <div className="about-links">
        <a href={repo}>Source code</a>
        <a href={`${repo}#api`}>API reference</a>
        <a href={`${repo}#connecting-real-hardware`}>Connecting real hardware</a>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { glossary, lessons, modules, type Lesson } from "./course-data";

type View = "course" | "lab" | "atlas" | "roadmap";
type Lab = "collective" | "performance" | "topology" | "training";
type Collective =
  | "broadcast" | "reduce" | "allreduce" | "scatter" | "gather"
  | "allgather" | "reduce-scatter" | "scan" | "all-to-all"
  | "neighbor" | "barrier";

const input = ["[1, 2]", "[3, 4]", "[5, 6]", "[7, 8]"];

type Frame = {
  title: string;
  values: string[];
  messages: string[];
  explanation: string;
};

const collectiveFrames: Record<Collective, Frame[]> = {
  broadcast: [
    { title: "Initial ownership", values: ["[1, 2]", "—", "—", "—"], messages: [], explanation: "GPU0 is the root and owns the value." },
    { title: "Round 1", values: ["[1, 2]", "[1, 2]", "—", "—"], messages: ["GPU0 → GPU1 · [1, 2]"], explanation: "One informed rank creates a second informed rank." },
    { title: "Round 2", values: ["[1, 2]", "[1, 2]", "[1, 2]", "[1, 2]"], messages: ["GPU0 → GPU2 · [1, 2]", "GPU1 → GPU3 · [1, 2]"], explanation: "Two transfers run in parallel. A binomial tree finishes in log₂4=2 rounds." },
  ],
  reduce: [
    { title: "Initial ownership", values: input, messages: [], explanation: "Corresponding positions will be summed." },
    { title: "Pairwise reduction", values: ["[4, 6]", "sent", "[12, 14]", "sent"], messages: ["GPU1 → GPU0", "GPU3 → GPU2"], explanation: "Two independent reductions happen in parallel." },
    { title: "Root result", values: ["[16, 20]", "—", "sent", "—"], messages: ["GPU2 → GPU0 · [12, 14]"], explanation: "Only the root has a defined result after Reduce." },
  ],
  allreduce: [
    { title: "Initial accumulators", values: input, messages: [], explanation: "This educational ring circulates complete original vectors." },
    { title: "Ring round 1", values: ["[8, 10]", "[4, 6]", "[8, 10]", "[12, 14]"], messages: ["0→1", "1→2", "2→3", "3→0"], explanation: "Each rank adds the original vector received from its left neighbor." },
    { title: "Ring round 2", values: ["[13, 16]", "[11, 14]", "[9, 12]", "[15, 18]"], messages: ["2→0", "3→1", "0→2", "1→3"], explanation: "Forward the original contribution, not the growing accumulator." },
    { title: "Ring round 3", values: ["[16, 20]", "[16, 20]", "[16, 20]", "[16, 20]"], messages: ["1→0", "2→1", "3→2", "0→3"], explanation: "Every rank now contains every contribution. Production rings reduce traffic using ReduceScatter + AllGather." },
  ],
  scatter: [
    { title: "Root owns all shards", values: ["[1,2 | 3,4 | 5,6 | 7,8]", "—", "—", "—"], messages: [], explanation: "Scatter begins with the concatenated buffer at the root." },
    { title: "Distribute shards", values: input, messages: ["GPU0 → GPU1 · [3,4]", "GPU0 → GPU2 · [5,6]", "GPU0 → GPU3 · [7,8]"], explanation: "Every rank receives the shard associated with its rank index." },
  ],
  gather: [
    { title: "Distributed shards", values: input, messages: [], explanation: "Each rank begins with one distinct shard." },
    { title: "Collect at root", values: ["[1,2,3,4,5,6,7,8]", "sent", "sent", "sent"], messages: ["GPU1 → GPU0", "GPU2 → GPU0", "GPU3 → GPU0"], explanation: "Rank order determines placement in the root output." },
  ],
  allgather: [
    { title: "Distributed shards", values: input, messages: [], explanation: "Each rank owns one unique shard." },
    { title: "Ring round 1", values: ["{0,3}", "{1,0}", "{2,1}", "{3,2}"], messages: ["0→1", "1→2", "2→3", "3→0"], explanation: "Braces show shard-owner IDs known at each rank." },
    { title: "Ring round 2", values: ["{0,2,3}", "{0,1,3}", "{0,1,2}", "{1,2,3}"], messages: ["3→1", "0→2", "1→3", "2→0"], explanation: "Forward the shard received in the previous round." },
    { title: "Complete replication", values: Array(4).fill("[1,2,3,4,5,6,7,8]"), messages: ["2→1", "3→2", "0→3", "1→0"], explanation: "After P−1 rounds every rank owns the concatenation." },
  ],
  "reduce-scatter": [
    { title: "Shape-adjusted input", values: ["[1,2,3,4]", "[5,6,7,8]", "[9,10,11,12]", "[13,14,15,16]"], messages: [], explanation: "Equal-count ReduceScatter across four ranks needs a vector length divisible by four." },
    { title: "Global reduction (semantic view)", values: Array(4).fill("[28,32,36,40] partial"), messages: ["Chunks reduce while circulating"], explanation: "Production algorithms fuse this reduction with chunk movement; they do not materialize four complete copies." },
    { title: "Scattered reduced ownership", values: ["[28]", "[32]", "[36]", "[40]"], messages: ["One final chunk per rank"], explanation: "Each rank owns exactly one fully reduced result shard." },
  ],
  scan: [
    { title: "Initial values", values: input, messages: [], explanation: "Inclusive scan preserves rank order." },
    { title: "Prefix results", values: ["[1,2]", "[4,6]", "[9,12]", "[16,20]"], messages: ["0 influences 1,2,3", "1 influences 2,3", "2 influences 3"], explanation: "Rank r receives the reduction of ranks 0 through r." },
  ],
  "all-to-all": [
    { title: "Destination-addressed chunks", values: ["[a₀ a₁ a₂ a₃]", "[b₀ b₁ b₂ b₃]", "[c₀ c₁ c₂ c₃]", "[d₀ d₁ d₂ d₃]"], messages: [], explanation: "Subscript j marks the destination rank." },
    { title: "Personalized exchange", values: ["[a₀ b₀ c₀ d₀]", "[a₁ b₁ c₁ d₁]", "[a₂ b₂ c₂ d₂]", "[a₃ b₃ c₃ d₃]"], messages: ["Every rank → every rank"], explanation: "Every output contains one differently addressed chunk from every source." },
  ],
  neighbor: [
    { title: "Ring neighborhood", values: input, messages: [], explanation: "Each rank communicates only with its two logical neighbors." },
    { title: "Halo exchange", values: ["left:[7,8] right:[3,4]", "left:[1,2] right:[5,6]", "left:[3,4] right:[7,8]", "left:[5,6] right:[1,2]"], messages: ["0↔1", "1↔2", "2↔3", "3↔0"], explanation: "Traffic depends on graph degree rather than all P ranks." },
  ],
  barrier: [
    { title: "Independent arrival", values: ["arrived", "working", "arrived", "working"], messages: [], explanation: "Early ranks cannot safely pass the barrier." },
    { title: "Last arrival", values: ["waiting", "arrived", "waiting", "arrived"], messages: ["Arrival information converges"], explanation: "A barrier needs a globally visible arrival condition." },
    { title: "Release", values: Array(4).fill("continue"), messages: ["Release information disperses"], explanation: "No payload changes, but subsequent work is ordered after group arrival." },
  ],
};

const codeLadder = [
  ["Python model", `def allreduce_sum(vectors):\n    total = [sum(col) for col in zip(*vectors)]\n    return [total.copy() for _ in vectors]`],
  ["NumPy", `x = np.array([[1,2], [3,4], [5,6], [7,8]])\ny = x.sum(axis=0)          # [16, 20]\nout = np.broadcast_to(y, x.shape).copy()`],
  ["PyTorch CPU", `x = torch.tensor([[1,2], [3,4], [5,6], [7,8]])\nresult = x.sum(dim=0)`],
  ["PyTorch Distributed", `dist.init_process_group("nccl")\nt = torch.tensor([2*rank+1, 2*rank+2], device=rank)\ndist.all_reduce(t, op=dist.ReduceOp.SUM)`],
  ["CUDA primitive", `__global__ void add(float* dst, const float* src, int n) {\n  int i = blockIdx.x * blockDim.x + threadIdx.x;\n  if (i < n) dst[i] += src[i];\n}`],
  ["NCCL-like schedule", `for phase in [REDUCE_SCATTER, ALLGATHER]:\n  for step in range(world_size - 1):\n    chunk = schedule(rank, phase, step)\n    recv_reduce_or_copy_send(prev, next, chunk)`],
  ["C++ transport shape", `post_recv(prev, recv_buffer, bytes);\npost_send(next, send_buffer, bytes);\nwait(recv_completion);\nreduce_in_place(local, recv_buffer, count);`],
];

function formatBytes(value: number) {
  if (value >= 1 << 30) return `${(value / (1 << 30)).toFixed(1)} GiB`;
  if (value >= 1 << 20) return `${(value / (1 << 20)).toFixed(1)} MiB`;
  if (value >= 1 << 10) return `${(value / (1 << 10)).toFixed(1)} KiB`;
  return `${value} B`;
}

function LessonSection({ title, items, tone }: { title: string; items: string[]; tone?: string }) {
  return (
    <section className={`lesson-section ${tone ?? ""}`}>
      <h3>{title}</h3>
      <ol>{items.map((item, i) => <li key={i}>{item}</li>)}</ol>
    </section>
  );
}

function CourseLesson({
  lesson,
  complete,
  onToggle,
}: {
  lesson: Lesson;
  complete: boolean;
  onToggle: () => void;
}) {
  const [codeIndex, setCodeIndex] = useState(0);
  return (
    <article className="lesson" key={lesson.id}>
      <header className="lesson-hero">
        <div className="eyebrow">Lesson {String(lesson.number).padStart(2, "0")} · {lesson.level} · {lesson.duration}</div>
        <h1>{lesson.title}</h1>
        <p className="thesis">{lesson.thesis}</p>
        <button className={complete ? "complete-button done" : "complete-button"} onClick={onToggle}>
          {complete ? "✓ Lesson completed" : "Mark lesson complete"}
        </button>
      </header>

      <section className="intuition-card">
        <span>INTUITION FIRST</span>
        <p>{lesson.intuition}</p>
      </section>

      {lesson.number === 1 && (
        <section className="running-example">
          <div>
            <span className="mini-label">THE RUNNING SYSTEM</span>
            <h2>Four GPUs. One evolving mental model.</h2>
            <p>The same values return throughout the course. Reduction treats positions as corresponding quantities; gathering treats each vector as a distinct shard.</p>
          </div>
          <div className="gpu-grid compact">
            {input.map((v, i) => <div className="gpu-card" key={i}><b>GPU{i}</b><code>{v}</code></div>)}
          </div>
        </section>
      )}

      <div className="lesson-grid">
        <LessonSection title="Mathematical model" items={lesson.math} />
        <LessonSection title="Algorithmic reasoning" items={lesson.algorithm} />
        <LessonSection title="Implementation path" items={lesson.implementation} />
        <LessonSection title="Performance model" items={lesson.performance} />
        <LessonSection title="How real systems use it" items={lesson.systems} />
        <LessonSection title="Failure modes & misconceptions" items={lesson.pitfalls} tone="warning" />
      </div>

      <section className="code-ladder">
        <div className="section-heading">
          <div>
            <span className="mini-label">IMPLEMENTATION LADDER</span>
            <h2>From semantics to production</h2>
          </div>
          <div className="step-pills" role="tablist" aria-label="Implementation levels">
            {codeLadder.map(([name], i) => (
              <button role="tab" aria-selected={codeIndex === i} className={codeIndex === i ? "active" : ""} onClick={() => setCodeIndex(i)} key={name}>{i + 1}</button>
            ))}
          </div>
        </div>
        <div className="code-stage">
          <div className="code-caption">{codeLadder[codeIndex][0]}</div>
          <pre><code>{codeLadder[codeIndex][1]}</code></pre>
          <p>{[
            "This models the semantic result in one address space. There is no real communication yet.",
            "The rank dimension is explicit, making elementwise ownership visible.",
            "Tensor computation is still local; a tensor reduction is not a distributed collective.",
            "Each process owns only its local tensor. The backend now coordinates real participants.",
            "A GPU kernel performs local reduction; a transport must still make remote data visible.",
            "Production schedules pipeline chunks and fuse receive, reduction, copy, and forwarding.",
            "A transport implementation must define posting, completion, buffer ownership, and errors.",
          ][codeIndex]}</p>
        </div>
      </section>

      <section className="exercise-block">
        <div className="section-heading">
          <div><span className="mini-label">ACTIVE RECALL</span><h2>Exercises</h2></div>
        </div>
        <div className="exercise-grid">
          {Object.entries(lesson.exercises).map(([difficulty, prompt]) => (
            <details key={difficulty}>
              <summary>{difficulty}</summary>
              <p>{prompt}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="video-mode">
        <span className="mini-label">VIDEO CREATOR MODE</span>
        <h2>“{lesson.title}: The Visual Systems Explanation”</h2>
        <div className="storyboard">
          {[
            ["00:00", "Cold open", "Show the failure or bottleneck before naming the concept."],
            ["01:15", "Physical analogy", lesson.intuition],
            ["03:30", "Running example", "Animate four GPUs, ownership, arrows, and exact intermediate values."],
            ["07:00", "Mathematics", lesson.math[0]],
            ["10:00", "Implementation", lesson.implementation[0]],
            ["13:30", "Performance", lesson.performance[0]],
            ["16:30", "Production", lesson.systems[0]],
            ["18:00", "Recall", `Ask: ${lesson.exercises.easy}`],
          ].map(([time, name, copy]) => (
            <div className="story-row" key={time}><time>{time}</time><b>{name}</b><p>{copy}</p></div>
          ))}
        </div>
        <div className="video-notes">
          <div><b>Whiteboard</b><p>Ownership → messages → intermediate state → final state → cost equation → physical path.</p></div>
          <div><b>Animation</b><p>Keep chunks color-stable. Move them one dependency step per frame. Show stalls as empty time, never as unexplained pauses.</p></div>
          <div><b>Live demo</b><p>Run a size sweep, force one algorithm or perturb one rank, and predict the curve before revealing it.</p></div>
        </div>
      </section>
    </article>
  );
}

function CollectiveLab() {
  const [kind, setKind] = useState<Collective>("allreduce");
  const [step, setStep] = useState(0);
  const frames = collectiveFrames[kind];
  const frame = frames[Math.min(step, frames.length - 1)];
  return (
    <div className="lab-panel">
      <div className="lab-controls">
        <label>Collective
          <select value={kind} onChange={(e) => { setKind(e.target.value as Collective); setStep(0); }}>
            {Object.keys(collectiveFrames).map(k => <option value={k} key={k}>{k.replace("-", " ")}</option>)}
          </select>
        </label>
        <div className="frame-controls">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← Previous</button>
          <span>{step + 1} / {frames.length}</span>
          <button onClick={() => setStep(Math.min(frames.length - 1, step + 1))} disabled={step === frames.length - 1}>Next →</button>
        </div>
      </div>
      <div className="sim-title"><span>FRAME {step}</span><h2>{frame.title}</h2><p>{frame.explanation}</p></div>
      <div className="network-stage">
        <div className="ring-line" />
        <div className="gpu-grid">
          {frame.values.map((v, i) => <div className="gpu-card live" key={i}><span>rank {i}</span><b>GPU{i}</b><code>{v}</code></div>)}
        </div>
        <div className="message-tray">
          {frame.messages.length ? frame.messages.map((m, i) => <span key={i}>{m}</span>) : <span>No messages yet</span>}
        </div>
      </div>
    </div>
  );
}

function PerformanceLab() {
  const [ranks, setRanks] = useState(8);
  const [power, setPower] = useState(20);
  const [alpha, setAlpha] = useState(2);
  const [bw, setBw] = useState(50);
  const bytes = 2 ** power;
  const beta = 1 / (bw * 1e9);
  const ring = 2 * (ranks - 1) * alpha * 1e-6 + 2 * ((ranks - 1) / ranks) * bytes * beta;
  const tree = 2 * Math.ceil(Math.log2(ranks)) * (alpha * 1e-6 + bytes * beta);
  const recursive = Math.ceil(Math.log2(ranks)) * alpha * 1e-6 + 2 * ((ranks - 1) / ranks) * bytes * beta;
  const values = [
    ["Ring", ring, "2(P−1) startup steps; near-optimal bulk bytes"],
    ["Tree", tree, "log₂P depth; full buffer on each tree stage"],
    ["Recursive exchange", recursive, "log₂P startups; topology-sensitive partners"],
  ];
  const max = Math.max(...values.map(v => Number(v[1])));
  return (
    <div className="lab-panel">
      <div className="control-grid">
        <label>Ranks <output>{ranks}</output><input type="range" min="2" max="128" step="2" value={ranks} onChange={e => setRanks(Number(e.target.value))} /></label>
        <label>Message <output>{formatBytes(bytes)}</output><input type="range" min="0" max="30" value={power} onChange={e => setPower(Number(e.target.value))} /></label>
        <label>Startup α <output>{alpha} µs</output><input type="range" min="0.5" max="20" step="0.5" value={alpha} onChange={e => setAlpha(Number(e.target.value))} /></label>
        <label>Link bandwidth <output>{bw} GB/s</output><input type="range" min="10" max="900" step="10" value={bw} onChange={e => setBw(Number(e.target.value))} /></label>
      </div>
      <div className="chart" aria-label="Estimated collective completion time">
        {values.map(([name, value, note]) => (
          <div className="bar-row" key={String(name)}>
            <div className="bar-label"><b>{name}</b><span>{(Number(value) * 1e6).toFixed(1)} µs</span></div>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(1.5, Number(value) / max * 100)}%` }} /></div>
            <p>{note}</p>
          </div>
        ))}
      </div>
      <p className="model-note">This is an intentionally transparent α–β model, not a hardware prediction. It omits reduction throughput, protocol overhead, contention, and topology sharing so you can see exactly why its answer changes.</p>
    </div>
  );
}

function TopologyLab() {
  const [topology, setTopology] = useState("node");
  const info: Record<string, { title: string; nodes: string[]; links: string[]; note: string }> = {
    node: { title: "Single node · NVSwitch domain", nodes: ["GPU0", "GPU1", "GPU2", "GPU3", "NVSwitch", "NIC0"], links: ["GPU0—NVSwitch", "GPU1—NVSwitch", "GPU2—NVSwitch", "GPU3—NVSwitch", "NVSwitch—NIC0"], note: "Keep intra-node phases inside the high-bandwidth switch domain; choose a NIC-local path for inter-node traffic." },
    dual: { title: "Dual socket · two PCIe roots", nodes: ["GPU0", "GPU1", "CPU0", "NIC0", "GPU2", "GPU3", "CPU1", "NIC1"], links: ["GPU0—CPU0", "GPU1—CPU0", "CPU0—NIC0", "GPU2—CPU1", "GPU3—CPU1", "CPU1—NIC1", "CPU0⋯CPU1"], note: "Cross-socket transfers consume the CPU interconnect. Bind proxy threads and network traffic to local NUMA domains." },
    cluster: { title: "Four nodes · leaf/spine fabric", nodes: ["Node0", "Node1", "Leaf0", "Spine", "Leaf1", "Node2", "Node3"], links: ["Node0—Leaf0", "Node1—Leaf0", "Leaf0—Spine", "Spine—Leaf1", "Leaf1—Node2", "Leaf1—Node3"], note: "A synchronized all-to-all can collide at leaf uplinks. Hierarchical aggregation reduces expensive cross-fabric bytes." },
  };
  const selected = info[topology];
  return (
    <div className="lab-panel">
      <div className="lab-controls">
        <label>Physical system
          <select value={topology} onChange={e => setTopology(e.target.value)}>
            <option value="node">NVSwitch node</option>
            <option value="dual">Dual-socket PCIe</option>
            <option value="cluster">Leaf/spine cluster</option>
          </select>
        </label>
      </div>
      <div className={`topology-map ${topology}`}>
        <h2>{selected.title}</h2>
        <div className="topo-nodes">{selected.nodes.map((n, i) => <div className={n.includes("GPU") || n.includes("Node") ? "compute-node" : "fabric-node"} key={n}><span>{i + 1}</span>{n}</div>)}</div>
        <div className="link-list">{selected.links.map(l => <code key={l}>{l}</code>)}</div>
      </div>
      <div className="topology-advice"><b>Engineering readout</b><p>{selected.note}</p></div>
    </div>
  );
}

function TrainingLab() {
  const [mode, setMode] = useState("ddp");
  const tracks: Record<string, { stages: string[][]; collective: string; why: string }> = {
    ddp: { stages: [["Forward", "Backward", "Update"], ["Forward", "Backward", "Update"], ["Forward", "Backward", "Update"], ["Forward", "Backward", "Update"]], collective: "AllReduce gradients", why: "Every replica needs the same complete gradient before applying an identical optimizer update." },
    fsdp: { stages: [["AllGather", "Fwd", "ReduceScatter"], ["AllGather", "Fwd", "ReduceScatter"], ["AllGather", "Fwd", "ReduceScatter"], ["AllGather", "Fwd", "ReduceScatter"]], collective: "AllGather parameters + ReduceScatter gradients", why: "Parameters exist temporarily where used; gradients end at their sharded owners." },
    tp: { stages: [["GEMM", "AllReduce", "GEMM"], ["GEMM", "AllReduce", "GEMM"], ["GEMM", "AllReduce", "GEMM"], ["GEMM", "AllReduce", "GEMM"]], collective: "Layer-wise AllReduce / ReduceScatter", why: "Each rank computes a partial activation that must be reconciled before dependent layer work." },
    moe: { stages: [["Route", "AllToAll", "Expert", "AllToAll"], ["Route", "AllToAll", "Expert", "AllToAll"], ["Route", "AllToAll", "Expert", "AllToAll"], ["Route", "AllToAll", "Expert", "AllToAll"]], collective: "AllToAll token dispatch and combine", why: "Each token travels to its selected expert owner and returns to its original ordering." },
  };
  const selected = tracks[mode];
  return (
    <div className="lab-panel">
      <div className="lab-controls"><label>Parallel strategy
        <select value={mode} onChange={e => setMode(e.target.value)}>
          <option value="ddp">Data parallel</option><option value="fsdp">FSDP / ZeRO-3</option><option value="tp">Tensor parallel</option><option value="moe">Expert parallel</option>
        </select>
      </label></div>
      <div className="timeline">
        {selected.stages.map((stages, rank) => <div className="timeline-row" key={rank}><b>GPU{rank}</b><div>{stages.map((s, i) => <span className={s.toLowerCase().includes("all") || s.toLowerCase().includes("reduce") ? "comm" : ""} key={i}>{s}</span>)}</div></div>)}
      </div>
      <div className="topology-advice"><b>{selected.collective}</b><p>{selected.why}</p></div>
    </div>
  );
}

function Labs() {
  const [lab, setLab] = useState<Lab>("collective");
  return (
    <main className="main-content standalone">
      <header className="page-hero"><span className="eyebrow">INTERACTIVE LABORATORY</span><h1>Change the system. Predict the outcome.</h1><p>Step through exact data movement, test performance assumptions, inspect physical topology, and connect model parallelism to communication.</p></header>
      <div className="lab-tabs">
        {([["collective", "Collective animator"], ["performance", "Performance model"], ["topology", "Topology explorer"], ["training", "Training timeline"]] as [Lab, string][]).map(([id, label]) => <button className={lab === id ? "active" : ""} onClick={() => setLab(id)} key={id}>{label}</button>)}
      </div>
      {lab === "collective" && <CollectiveLab />}
      {lab === "performance" && <PerformanceLab />}
      {lab === "topology" && <TopologyLab />}
      {lab === "training" && <TrainingLab />}
    </main>
  );
}

function Atlas() {
  const [query, setQuery] = useState("");
  const filtered = glossary.filter(([term, definition]) => `${term} ${definition}`.toLowerCase().includes(query.toLowerCase()));
  const collectives = ["Broadcast", "Reduce", "AllReduce", "Scatter", "Gather", "AllGather", "ReduceScatter", "Scan", "All-to-All", "Neighbor", "Barrier"];
  const algorithms = ["Linear", "Ring", "Pipeline Ring", "Binary Tree", "Binomial Tree", "Double Binary Tree", "Recursive Doubling", "Recursive Halving", "Butterfly", "Hypercube", "2D/3D", "Hierarchical", "SHARP"];
  return (
    <main className="main-content standalone">
      <header className="page-hero"><span className="eyebrow">REFERENCE ATLAS</span><h1>The map behind the machinery.</h1><p>Use this compact index while studying, debugging, preparing interviews, or storyboarding a video.</p></header>
      <div className="atlas-strip"><div><span>11</span>collectives</div><div><span>13</span>algorithm families</div><div><span>46</span>lessons</div><div><span>4</span>interactive labs</div></div>
      <section className="atlas-section"><h2>Collective families</h2><div className="tag-cloud">{collectives.map(x => <span key={x}>{x}</span>)}</div></section>
      <section className="atlas-section"><h2>Algorithm families</h2><div className="tag-cloud warm">{algorithms.map(x => <span key={x}>{x}</span>)}</div></section>
      <section className="atlas-section"><div className="section-heading"><h2>Glossary</h2><input aria-label="Search glossary" placeholder="Search terms…" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="glossary">{filtered.map(([term, definition]) => <div key={term}><b>{term}</b><p>{definition}</p></div>)}</div></section>
    </main>
  );
}

function Roadmap({ completed }: { completed: Set<string> }) {
  return (
    <main className="main-content standalone">
      <header className="page-hero"><span className="eyebrow">SEMESTER ROADMAP</span><h1>From one message to a thousand-GPU system.</h1><p>Eight modules form one dependency chain. Finish the capstone able to explain, implement, optimize, debug, and teach collective systems.</p></header>
      <div className="roadmap">
        {modules.map((module, m) => {
          const group = lessons.filter(l => l.module === module.id);
          const done = group.filter(l => completed.has(l.id)).length;
          return <section key={module.id} className="roadmap-module">
            <div className="module-index">{String(m + 1).padStart(2, "0")}</div>
            <div className="module-body"><div className="module-title-row"><div><h2>{module.title}</h2><p>{module.subtitle}</p></div><span>{done}/{group.length}</span></div>
              <div className="module-progress"><i style={{ width: `${done / group.length * 100}%` }} /></div>
              <div className="roadmap-lessons">{group.map(l => <div className={completed.has(l.id) ? "complete" : ""} key={l.id}><span>{l.number}</span><b>{l.title}</b><small>{l.level}</small></div>)}</div>
            </div>
          </section>;
        })}
      </div>
      <section className="capstone"><span>CAPSTONE OUTPUT</span><h2>Design review: a 1,024-GPU training and inference fabric</h2><p>Derive tensor traffic, choose parallel dimensions, map groups to topology, select algorithms, model failure domains, define benchmarks, and defend every assumption.</p></section>
    </main>
  );
}

export function CourseApp() {
  const [view, setView] = useState<View>("course");
  const [lessonId, setLessonId] = useState("why-collectives");
  const [query, setQuery] = useState("");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [sidebar, setSidebar] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("collective-course-progress") || "[]");
      setCompleted(new Set(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("collective-course-progress", JSON.stringify([...completed])); } catch {}
  }, [completed]);

  const lesson = lessons.find(l => l.id === lessonId) ?? lessons[0];
  const visibleLessons = useMemo(() => lessons.filter(l => `${l.title} ${l.thesis}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const progress = Math.round(completed.size / lessons.length * 100);

  const selectLesson = (id: string) => {
    setLessonId(id);
    setView("course");
    setSidebar(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setSidebar(!sidebar)} aria-label="Toggle course navigation">☰</button>
        <button className="brand" onClick={() => setView("course")}><span className="brand-mark">∑</span><span><b>COLLECTIVE</b><small>SYSTEMS LAB</small></span></button>
        <nav aria-label="Primary navigation">
          {([["course", "Course"], ["lab", "Labs"], ["atlas", "Atlas"], ["roadmap", "Roadmap"]] as [View, string][]).map(([id, label]) => <button className={view === id ? "active" : ""} onClick={() => setView(id)} key={id}>{label}</button>)}
        </nav>
        <div className="top-progress"><span>{progress}%</span><i><b style={{ width: `${progress}%` }} /></i></div>
      </header>

      {view === "course" && (
        <>
          <aside className={sidebar ? "sidebar open" : "sidebar"}>
            <div className="search-box"><span>⌕</span><input aria-label="Search lessons" placeholder="Search 46 lessons" value={query} onChange={e => setQuery(e.target.value)} /></div>
            <div className="module-list">
              {modules.map(module => {
                const group = visibleLessons.filter(l => l.module === module.id);
                if (!group.length) return null;
                return <section key={module.id}><div className="module-heading"><b>{module.title}</b><span>{group.filter(l => completed.has(l.id)).length}/{group.length}</span></div>
                  {group.map(l => <button className={`${lesson.id === l.id ? "selected" : ""} ${completed.has(l.id) ? "completed" : ""}`} onClick={() => selectLesson(l.id)} key={l.id}><span>{completed.has(l.id) ? "✓" : l.number}</span><div><b>{l.title}</b><small>{l.duration}</small></div></button>)}
                </section>;
              })}
            </div>
          </aside>
          <main className="main-content lesson-main">
            <CourseLesson lesson={lesson} complete={completed.has(lesson.id)} onToggle={() => setCompleted(prev => { const next = new Set(prev); next.has(lesson.id) ? next.delete(lesson.id) : next.add(lesson.id); return next; })} />
            <nav className="lesson-nav" aria-label="Lesson navigation">
              <button disabled={lesson.number === 1} onClick={() => selectLesson(lessons[lesson.number - 2].id)}>← Previous lesson</button>
              <button disabled={lesson.number === lessons.length} onClick={() => selectLesson(lessons[lesson.number].id)}>Next lesson →</button>
            </nav>
          </main>
        </>
      )}
      {view === "lab" && <Labs />}
      {view === "atlas" && <Atlas />}
      {view === "roadmap" && <Roadmap completed={completed} />}
    </div>
  );
}

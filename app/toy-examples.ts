export type ToyFrame = {
  title: string;
  state: string[];
  messages: string[];
  explanation: string;
};

export type ToyExample = {
  title: string;
  question: string;
  setup: string;
  before: string[];
  frames: ToyFrame[];
  after: string[];
  takeaway: string;
};

const g = (a: string, b: string, c: string, d: string) => [a, b, c, d];

export const toyExamples: Record<string, ToyExample> = {
  "why-collectives": {
    title: "Four GPUs computed four partial answers",
    question: "How can every GPU obtain the elementwise sum [16,20]?",
    setup: "GPU0=[1,2], GPU1=[3,4], GPU2=[5,6], GPU3=[7,8]. Each vector has the same two logical positions. Position 0 values belong together; position 1 values belong together.",
    before: g("[1,2]", "[3,4]", "[5,6]", "[7,8]"),
    frames: [
      { title: "Pair the GPUs", state: g("[4,6]", "sent", "[12,14]", "sent"), messages: ["GPU1 → GPU0: [3,4]", "GPU3 → GPU2: [7,8]"], explanation: "GPU0 adds [1,2]+[3,4]=[4,6]. At the same time GPU2 adds [5,6]+[7,8]=[12,14]. We now have two partial sums." },
      { title: "Combine the two partial sums", state: g("[16,20]", "—", "sent", "—"), messages: ["GPU2 → GPU0: [12,14]"], explanation: "GPU0 adds [4,6]+[12,14]=[16,20]. This is a Reduce result: only GPU0 owns the answer." },
      { title: "Distribute the result", state: g("[16,20]", "[16,20]", "[16,20]", "[16,20]"), messages: ["GPU0 → GPU1", "GPU0 → GPU2", "GPU1 → GPU3"], explanation: "The result is copied to every GPU. Reduce followed by Broadcast explains AllReduce semantics, although optimized implementations use better schedules." },
    ],
    after: g("[16,20]", "[16,20]", "[16,20]", "[16,20]"),
    takeaway: "A collective specifies the final ownership and transformation. The tree above is one possible algorithm for producing it.",
  },
  "execution-model": {
    title: "Four processes control four GPUs",
    question: "How do all participants agree that they are executing the same collective?",
    setup: "Process 0 controls GPU0, process 1 controls GPU1, and so on. They form one ordered group with ranks [0,1,2,3].",
    before: g("rank0 · seq41", "rank1 · seq41", "rank2 · seq41", "rank3 · seq41"),
    frames: [
      { title: "Match the communicator", state: g("group A", "group A", "group A", "group A"), messages: ["bootstrap exchanges rank and endpoint identity"], explanation: "The same numeric rank is meaningful only inside the same ordered communicator. All four processes must agree on membership and order." },
      { title: "Match the sequence position", state: g("#42 AllReduce", "#42 AllReduce", "#42 AllReduce", "#42 AllReduce"), messages: ["no payload yet"], explanation: "Libraries generally match collective calls by order. If rank 2 calls Broadcast at position 42, peers wait for an AllReduce partner that never arrives." },
      { title: "Enqueue on GPU streams", state: g("stream waits", "stream waits", "stream waits", "stream waits"), messages: ["CUDA event → collective → next kernel"], explanation: "The CPU may return after enqueueing. Correctness requires the producing kernel to finish before communication and the consuming kernel to wait for collective completion." },
    ],
    after: g("seq42 done", "seq42 done", "seq42 done", "seq42 done"),
    takeaway: "Correct collective execution requires matching group, order, count, datatype, operation, and stream dependencies.",
  },
  "cost-model": {
    title: "Send the same 1 MiB tensor in two ways",
    question: "Why can a four-step ring beat a two-step tree?",
    setup: "Assume startup α=2 µs and effective bandwidth=25 GB/s. A 1 MiB transfer takes about 2 µs startup plus 42 µs of serialization.",
    before: g("1 MiB", "1 MiB", "1 MiB", "1 MiB"),
    frames: [
      { title: "Count startups", state: g("ring: 6", "tree: 4", "—", "—"), messages: ["AllReduce has reduction and distribution phases"], explanation: "For four ranks, a ring AllReduce has 2(P−1)=6 dependent steps. A reduce tree plus broadcast has 2log₂P=4 levels. For tiny messages, fewer startups usually wins." },
      { title: "Count critical-path bytes", state: g("ring: 1.5 MiB", "tree: 4 MiB", "—", "—"), messages: ["ring sends 1/4 tensor per step"], explanation: "The ring sends only one quarter of the tensor in each step. The simple tree sends the full tensor on each level. For large messages, bytes dominate." },
      { title: "Apply T=kα+V/B", state: g("ring ≈75 µs", "tree ≈176 µs", "model only", "measure next"), messages: [], explanation: "This transparent estimate ignores protocol overhead, reduction cost, and contention, but it shows why step count alone is insufficient." },
    ],
    after: g("latency model", "bandwidth model", "critical path", "measurement"),
    takeaway: "Count both dependent startups and bytes on the bottleneck path. The smaller value changes with message size.",
  },
  "point-to-point": {
    title: "Move [1,2] from GPU0 to GPU1",
    question: "What actually has to happen below a send/receive call?",
    setup: "GPU0 owns a two-element buffer. GPU1 has allocated a receive buffer. The path is GPU0 HBM → PCIe/NVLink or NIC → GPU1 HBM.",
    before: g("[1,2] ready", "recv empty", "idle", "idle"),
    frames: [
      { title: "Publish a destination", state: g("source ready", "recv posted", "idle", "idle"), messages: ["GPU1/transport advertises buffer or posts receive"], explanation: "The receiver must make storage available. In RDMA this also involves memory registration and access keys; in TCP it means a socket and application framing." },
      { title: "Submit transport work", state: g("send WQE", "recv waiting", "idle", "idle"), messages: ["doorbell → NIC or peer engine"], explanation: "A work descriptor states the address, length, and destination. Ringing a doorbell tells hardware that new work is ready." },
      { title: "Observe completion", state: g("local complete", "[1,2]", "idle", "idle"), messages: ["completion queue entry"], explanation: "Local completion means the source buffer is reusable under the transport contract. It does not necessarily mean GPU1's application has consumed the data." },
    ],
    after: g("source reusable", "[1,2] visible", "idle", "idle"),
    takeaway: "Collective algorithms are built from transfers whose posting, visibility, ordering, and completion semantics must be understood precisely.",
  },
  "semantic-contracts": {
    title: "Describe AllReduce before implementing it",
    question: "What must all four ranks agree on?",
    setup: "All ranks call SUM AllReduce over two float32 elements in communicator A, using compatible input and output buffers.",
    before: g("2×f32 [1,2]", "2×f32 [3,4]", "2×f32 [5,6]", "2×f32 [7,8]"),
    frames: [
      { title: "Validate metadata", state: g("count=2 SUM", "count=2 SUM", "count=2 SUM", "count=2 SUM"), messages: [], explanation: "The collective name is not enough. Count, datatype, operator, communicator, root where applicable, and in-place rules are part of the contract." },
      { title: "Apply the operator by position", state: g("Σ position 0", "Σ position 1", "associative", "commutative"), messages: ["(1+3)+(5+7)", "(2+4)+(6+8)"], explanation: "Associativity allows a tree to regroup additions. Commutativity allows rank order to change. Floating-point addition is only approximately associative." },
      { title: "Write defined outputs", state: g("[16,20]", "[16,20]", "[16,20]", "[16,20]"), messages: [], explanation: "AllReduce defines output on every rank. Reduce would define it only on the root. That ownership difference is semantic, not an optimization detail." },
    ],
    after: g("[16,20]", "[16,20]", "[16,20]", "[16,20]"),
    takeaway: "Write a before/after ownership table before writing messages. It prevents many API and implementation mistakes.",
  },
  "broadcast-barrier": {
    title: "Broadcast [1,2], then wait at a barrier",
    question: "How does information spread, and how is that different from synchronization?",
    setup: "GPU0 is the Broadcast root. GPUs1–3 have empty destination buffers. Afterward, every process reaches a Barrier at a different time.",
    before: g("[1,2]", "—", "—", "—"),
    frames: [
      { title: "Broadcast round 1", state: g("[1,2]", "[1,2]", "—", "—"), messages: ["GPU0 → GPU1"], explanation: "One informed participant creates a second informed participant." },
      { title: "Broadcast round 2", state: g("[1,2]", "[1,2]", "[1,2]", "[1,2]"), messages: ["GPU0 → GPU2", "GPU1 → GPU3"], explanation: "Two sends occur in parallel. Four ranks need only two tree levels." },
      { title: "Barrier arrival and release", state: g("wait", "wait", "last arrival", "wait"), messages: ["arrival converges", "release disperses"], explanation: "A Barrier transforms no payload. It establishes that everyone arrived before anyone continues. Using it casually can expose or create performance stalls." },
    ],
    after: g("[1,2] continue", "[1,2] continue", "[1,2] continue", "[1,2] continue"),
    takeaway: "Broadcast moves root data. Barrier moves only synchronization information.",
  },
  "reduce": {
    title: "Reduce four vectors to GPU0",
    question: "How can a tree combine data without overloading the root?",
    setup: "Use elementwise SUM. Only GPU0 needs the final vector.",
    before: g("[1,2]", "[3,4]", "[5,6]", "[7,8]"),
    frames: [
      { title: "First tree level", state: g("[4,6]", "sent", "[12,14]", "sent"), messages: ["1→0: [3,4]", "3→2: [7,8]"], explanation: "Two independent pairwise reductions execute concurrently." },
      { title: "Second tree level", state: g("[16,20]", "—", "sent", "—"), messages: ["2→0: [12,14]"], explanation: "GPU0 combines the two half-group sums. The tree has logarithmic depth." },
      { title: "Respect output ownership", state: g("valid [16,20]", "undefined", "undefined", "undefined"), messages: [], explanation: "The non-root buffers are not promised to contain a useful result. Reading them is an application bug." },
    ],
    after: g("[16,20]", "undefined", "undefined", "undefined"),
    takeaway: "Reduce is appropriate when one root consumes the result. If every rank needs it, use AllReduce.",
  },
  "scatter-gather": {
    title: "Deal and recollect four two-element shards",
    question: "How are offsets and ownership different from reduction?",
    setup: "GPU0 initially owns [1,2 | 3,4 | 5,6 | 7,8]. Each vertical bar marks a rank-sized shard.",
    before: g("[1,2|3,4|5,6|7,8]", "—", "—", "—"),
    frames: [
      { title: "Scatter by rank offset", state: g("[1,2]", "[3,4]", "[5,6]", "[7,8]"), messages: ["root bytes 0–7 stay", "8–15→GPU1", "16–23→GPU2", "24–31→GPU3"], explanation: "No arithmetic occurs. The root partitions one buffer and places shard r at rank r." },
      { title: "Each rank modifies its shard", state: g("[10,20]", "[30,40]", "[50,60]", "[70,80]"), messages: ["local multiply by 10"], explanation: "Ranks work independently after Scatter." },
      { title: "Gather by source rank", state: g("[10,20,30,40,50,60,70,80]", "sent", "sent", "sent"), messages: ["GPU1→0", "GPU2→0", "GPU3→0"], explanation: "Gather concatenates shards in rank order. It does not sum corresponding positions." },
    ],
    after: g("[10,20,30,40,50,60,70,80]", "undefined", "undefined", "undefined"),
    takeaway: "Scatter/Gather changes ownership through partitioning and concatenation; Reduce changes values through an operator.",
  },
  "allgather": {
    title: "Make every GPU own [1…8]",
    question: "How does a ring circulate unique shards without resending the wrong one?",
    setup: "Each GPU owns one unique shard: GPU0=[1,2], GPU1=[3,4], GPU2=[5,6], GPU3=[7,8].",
    before: g("{0:[1,2]}", "{1:[3,4]}", "{2:[5,6]}", "{3:[7,8]}"),
    frames: [
      { title: "Ring round 1", state: g("{0,3}", "{1,0}", "{2,1}", "{3,2}"), messages: ["0→1", "1→2", "2→3", "3→0"], explanation: "Each rank sends its own shard clockwise. Curly braces list shard-owner IDs now stored locally." },
      { title: "Ring round 2", state: g("{0,2,3}", "{0,1,3}", "{0,1,2}", "{1,2,3}"), messages: ["forward the shard just received"], explanation: "GPU0 forwards shard 3, not shard 0 again. Tracking the original owner prevents duplication." },
      { title: "Ring round 3", state: g("{0,1,2,3}", "{0,1,2,3}", "{0,1,2,3}", "{0,1,2,3}"), messages: ["one final missing shard per rank"], explanation: "After P−1 rounds, every shard has visited every other rank." },
    ],
    after: g("[1,2,3,4,5,6,7,8]", "[1,2,3,4,5,6,7,8]", "[1,2,3,4,5,6,7,8]", "[1,2,3,4,5,6,7,8]"),
    takeaway: "AllGather replicates distinct shards. The output is P times each local input size.",
  },
  "reduce-scatter": {
    title: "Reduce four four-element vectors, then shard the result",
    question: "How can we avoid constructing a full reduced vector on every GPU?",
    setup: "Use four elements so equal-count ReduceScatter can return one element per GPU: [1,2,3,4], [5,6,7,8], [9,10,11,12], [13,14,15,16].",
    before: g("[1,2,3,4]", "[5,6,7,8]", "[9,10,11,12]", "[13,14,15,16]"),
    frames: [
      { title: "Partition by final owner", state: g("chunks 0|1|2|3", "chunks 0|1|2|3", "chunks 0|1|2|3", "chunks 0|1|2|3"), messages: ["each one-element chunk has a final owner"], explanation: "Chunk 0 will end at GPU0, chunk 1 at GPU1, and so on." },
      { title: "Reduce while chunks circulate", state: g("partial c0", "partial c1", "partial c2", "partial c3"), messages: ["receive → add → forward"], explanation: "A rank does not need to retain chunks owned by others. Each step combines one incoming contribution with the current partial chunk." },
      { title: "Final chunk ownership", state: g("[28]", "[32]", "[36]", "[40]"), messages: [], explanation: "These are the four positions of [28,32,36,40], distributed one per rank." },
    ],
    after: g("[28]", "[32]", "[36]", "[40]"),
    takeaway: "ReduceScatter combines arithmetic with final sharded ownership, saving memory and half the traffic of ring AllReduce.",
  },
  "allreduce": {
    title: "Build bandwidth-optimal AllReduce from two collectives",
    question: "Why is ReduceScatter + AllGather better than circulating full vectors?",
    setup: "Use a four-element vector on each GPU so the tensor divides into four chunks. The globally reduced vector is [28,32,36,40].",
    before: g("[1,2,3,4]", "[5,6,7,8]", "[9,10,11,12]", "[13,14,15,16]"),
    frames: [
      { title: "ReduceScatter phase", state: g("[28]", "[32]", "[36]", "[40]"), messages: ["3 rounds · one chunk per round"], explanation: "Every chunk is fully reduced exactly once at its final owner. Each rank sends only one quarter of the vector per round." },
      { title: "AllGather round 1", state: g("{28,40}", "{32,28}", "{36,32}", "{40,36}"), messages: ["0→1", "1→2", "2→3", "3→0"], explanation: "The finished reduced chunks now circulate without further arithmetic." },
      { title: "AllGather completes", state: g("[28,32,36,40]", "[28,32,36,40]", "[28,32,36,40]", "[28,32,36,40]"), messages: ["two more ring rounds"], explanation: "Every rank reconstructs the full reduced vector." },
    ],
    after: g("[28,32,36,40]", "[28,32,36,40]", "[28,32,36,40]", "[28,32,36,40]"),
    takeaway: "Ring AllReduce sends about 2(P−1)n/P bytes per rank instead of (P−1)n full-vector bytes.",
  },
  "scan-neighbor": {
    title: "Compute running totals by rank",
    question: "How is a prefix result different from a global result?",
    setup: "Use inclusive SUM scan on [1,2], [3,4], [5,6], [7,8]. Rank r should include only ranks 0 through r.",
    before: g("[1,2]", "[3,4]", "[5,6]", "[7,8]"),
    frames: [
      { title: "Distance 1 exchange", state: g("[1,2]", "[4,6]", "[8,10]", "[12,14]"), messages: ["0→1", "1→2", "2→3"], explanation: "Each rank adds its immediate predecessor. This alone is not enough: GPU2 still lacks GPU0 and GPU3 lacks GPUs0–1." },
      { title: "Distance 2 exchange", state: g("[1,2]", "[4,6]", "[9,12]", "[16,20]"), messages: ["0→2", "1→3"], explanation: "Now each receiving rank adds a prefix covering two earlier ranks." },
      { title: "Compare ownership", state: g("prefix 0", "prefix 0..1", "prefix 0..2", "prefix 0..3"), messages: [], explanation: "Only GPU3 holds the global total. Earlier ranks intentionally hold shorter prefixes." },
    ],
    after: g("[1,2]", "[4,6]", "[9,12]", "[16,20]"),
    takeaway: "Scan preserves rank order and produces a different, progressively larger prefix at every rank.",
  },
  "all-to-all": {
    title: "Every GPU sends a different token to every GPU",
    question: "How does personalized exchange differ from AllGather?",
    setup: "GPU0 owns [a0,a1,a2,a3], where aj is destined for GPUj. GPU1 owns [b0…b3], and similarly for c and d.",
    before: g("[a0,a1,a2,a3]", "[b0,b1,b2,b3]", "[c0,c1,c2,c3]", "[d0,d1,d2,d3]"),
    frames: [
      { title: "Keep local chunks", state: g("[a0]", "[b1]", "[c2]", "[d3]"), messages: [], explanation: "Each rank already owns the chunk whose destination equals its own rank." },
      { title: "Pairwise rounds", state: g("[a0,b0,c0,d0]", "[a1,b1,c1,d1]", "[a2,b2,c2,d2]", "[a3,b3,c3,d3]"), messages: ["round1: distance1", "round2: distance2", "round3: distance3"], explanation: "Each source sends a different payload to each destination. Production code batches these chunks to avoid P² tiny launches." },
      { title: "Place by source index", state: g("from 0,1,2,3", "from 0,1,2,3", "from 0,1,2,3", "from 0,1,2,3"), messages: [], explanation: "Output position identifies the source. AllGather would have copied every full source buffer; All-to-All selects one destination-specific chunk from each." },
    ],
    after: g("[a0,b0,c0,d0]", "[a1,b1,c1,d1]", "[a2,b2,c2,d2]", "[a3,b3,c3,d3]"),
    takeaway: "All-to-All implements a traffic matrix. MoE uses it because different tokens are routed to different expert owners.",
  },
};

const advancedExamples: Record<string, [string, string, string, string, string, string]> = {
  "ring-pipeline": ["Pipeline a 1 MiB gradient around four GPUs", "Split the gradient into four 256 KiB chunks.", "Fill: GPU0 starts chunk A while others wait.", "Steady state: all four links carry different chunks.", "Drain: the final chunks complete after the last injection.", "Chunking overlaps links, but too-small chunks pay excessive startup cost."],
  "trees": ["Broadcast a 1 MiB model state through two tree levels", "GPU0 is root; GPUs1–3 need the state.", "Level 1: GPU0 sends to GPU1.", "Level 2: GPU0→GPU2 and GPU1→GPU3 run together.", "A second complementary tree carries the other half in the opposite pattern.", "Trees reduce startup depth; double trees improve link use for larger data."],
  "recursive-exchange": ["AllGather four 256 KiB shards with XOR partners", "Ranks are 00,01,10,11 in binary.", "Round 0: partner rank XOR 1; exchange one shard.", "Round 1: partner rank XOR 2; exchange the two-shard block.", "Every rank now knows all four shards.", "Knowledge doubles each round, giving log₂P startup depth."],
  "topologies": ["Map four GPUs onto two physical groups", "GPU0–1 share fast group A; GPU2–3 share fast group B.", "First communicate inside each group.", "Only consolidated or selected chunks cross the slow group link.", "Finish locally inside each group.", "Hierarchical algorithms spend fewer bytes on scarce global links."],
  "algorithm-selection": ["Choose Ring or Tree for 1 KiB and 1 GiB", "Use four ranks, α=2 µs, bandwidth=25 GB/s.", "For 1 KiB, startup terms dominate; Tree wins.", "For 1 GiB, byte terms dominate; Ring wins.", "Store the measured crossover instead of assuming it.", "Selection is conditional on size, ranks, topology, protocol, and contention."],
  "gpu-memory": ["Reduce one 256 KiB chunk on GPU0", "The chunk arrives in a protocol buffer in HBM.", "A CUDA block loads vectorized source and destination values.", "Threads add corresponding elements and store the result.", "A system-visible signal marks the slice ready to forward.", "HBM traffic and synchronization can bottleneck even when the link is fast."],
  "pcie-numa": ["Send GPU0 data through the correct NIC", "GPU0–1 are near CPU0/NIC0; GPU2–3 near CPU1/NIC1.", "Good path: GPU0→local PCIe switch→NIC0.", "Bad path: GPU0→CPU interconnect→NIC1.", "Pin the network proxy near CPU0 and select NIC0.", "Topology placement prevents hidden cross-socket traffic."],
  "nvlink": ["AllReduce inside one four-GPU NVSwitch domain", "All GPUs reach the NVSwitch at high bandwidth.", "Construct multiple logical channels across independent switch capacity.", "Move different tensor chunks concurrently.", "Reduce in GPU kernels while the switch forwards other chunks.", "The bottleneck may move from the fabric to HBM or reduction throughput."],
  "rdma": ["RDMA-write a chunk from GPU0 to remote GPU2", "GPU2 registers destination GPU memory and shares an rkey.", "GPU0 posts a WQE containing local address, remote address, length, and rkey.", "The NIC DMA-reads GPU0 memory and sends packets.", "Remote NIC DMA-writes GPU2 memory; completion and readiness are signaled.", "GPUDirect RDMA removes application host copies, not ordering requirements."],
  "network-control": ["Four senders incast into one uplink", "Each GPU sends at 100 Gb/s; the shared uplink serves 200 Gb/s.", "Input arrives at 400 Gb/s while output drains at 200 Gb/s.", "The queue grows at 200 Gb/s until ECN marks or PFC pause occurs.", "Endpoints reduce rate or reroute flows.", "Average link utilization hides the short queue spike that hurts the collective."],
  "offload": ["Reduce four integers inside a switch", "Each GPU sends one partial counter toward a common aggregation switch.", "The switch receives 1 and 3, emits partial 4.", "Another branch combines 5 and 7 into 12.", "The root switch combines 4+12=16 and distributes it.", "In-network reduction saves core-link bytes only for supported operations and datatypes."],
  "ecosystem": ["Run the same [1,2] AllReduce through four stacks", "Compare sockets, MPI, Gloo, and NCCL.", "Sockets require manual rank, framing, and schedule logic.", "MPI supplies broad collective semantics and transport selection.", "NCCL specializes GPU buffers, CUDA ordering, and accelerator topology.", "Similar API names hide different progress, memory, and completion models."],
  "nccl-topology": ["Construct a ring on four GPUs and two NICs", "GPU0–1 are closest to NIC0; GPU2–3 closest to NIC1.", "NCCL discovers NVLink, PCIe, CPU, and NIC path types.", "It scores candidate logical edges and resource reuse.", "It emits one or more channel graphs with peer and transport choices.", "Rank order alone does not reveal the constructed physical communication graph."],
  "nccl-protocols": ["Send one 64 KiB chunk with three protocols", "Simple uses bulk protocol buffers; LL uses fine-grained flag/data units; LL128 uses larger lines.", "LL forwards small ready units quickly but spends more bytes on metadata.", "Simple waits for larger units and achieves better payload efficiency.", "The selector chooses protocol jointly with algorithm and topology.", "There is no universal message-size threshold independent of path and system."],
  "nccl-runtime": ["Launch one AllReduce from a CUDA stream", "A training kernel produces a gradient on stream S.", "NCCL enqueues a work descriptor after the producer dependency.", "A GPU kernel handles local copy/reduction while a CPU proxy posts network work.", "Protocol buffers exchange readiness; the next training kernel waits on S.", "CPU return, GPU enqueue, local transport completion, and collective completion are distinct events."],
  "programmable-collectives": ["Program a topology-specific four-GPU schedule", "GPU0–1 have a fast direct link; GPU2–3 have another.", "A schedule names chunks, buffers, sends, reductions, and dependencies.", "NVSHMEM-style put writes remote symmetric memory, then signals readiness.", "A DeepEP-style path packs tokens, dispatches them, and later combines results.", "Programmability exposes optimization but transfers correctness responsibility to the schedule."],
  "data-parallel": ["Train one model replica on each of four GPUs", "Each GPU processes a different mini-batch and computes local gradients g0…g3.", "Backward computes the last layer first; its gradient bucket becomes ready.", "AllReduce starts while earlier layers continue backward.", "Every replica receives the averaged gradient and applies the same update.", "Bucket order and overlap determine how much communication remains exposed."],
  "zero-fsdp": ["Train a four-layer model with one parameter shard per GPU", "GPU0 owns layer shard A, GPU1 B, GPU2 C, GPU3 D.", "Before a layer runs, AllGather materializes its full parameters.", "Forward/backward use the materialized layer, then free or reshard it.", "ReduceScatter sends each gradient shard to its optimizer owner.", "FSDP trades temporary communication and scheduling complexity for much lower persistent memory."],
  "tensor-sequence": ["Split one matrix multiplication across four GPUs", "Each GPU owns one column partition of a weight matrix.", "All GPUs multiply the same activation by different weight columns.", "The outputs are distinct feature shards; AllGather only if the next operation needs them together.", "A row-parallel layer instead produces partial sums that need AllReduce.", "The correct collective follows from tensor layout, not from the layer name alone."],
  "pipeline-context": ["Run four transformer stages on four GPUs", "GPU0 owns stage0, GPU1 stage1, GPU2 stage2, GPU3 stage3.", "Microbatch 0 moves 0→1→2→3 during forward.", "More microbatches fill all stages; gradients later move backward.", "A context-parallel variant exchanges sequence blocks or attention summaries.", "Pipeline bubbles and activation transfer are visible only on a time-by-stage diagram."],
  "expert-parallel": ["Route eight tokens to four experts", "Experts E0…E3 live on GPUs0…3; each token selects one expert.", "Count tokens per destination and compute packing offsets.", "AllToAll sends token vectors to expert owners.", "Experts run grouped GEMMs; a second AllToAll returns outputs for unpermutation.", "The hottest expert, not average traffic, determines the step tail."],
  "frameworks": ["Map a 4×4 tensor onto a 2×2 device mesh", "Mesh axis data={GPU0,1}/{GPU2,3}; model={GPU0,2}/{GPU1,3}.", "A sharding rule assigns tensor dimensions to mesh axes.", "Changing from sharded to replicated induces AllGather.", "Changing ownership between axes may induce AllToAll.", "Compiler-generated collectives are consequences of layout transitions."],
  "tp-inference": ["Generate one token with four-way tensor parallelism", "Each GPU owns a weight shard and the KV cache portion for its heads.", "All GPUs run a partial GEMM for transformer layer 0.", "An AllReduce or ReduceScatter reconciles partial activation before the next dependency.", "Repeat for every layer, then sample one token.", "Decode exposes small-message collective latency once per layer per token."],
  "serving-scheduling": ["Serve one long prefill and three decode requests", "Request A has 2,000 prompt tokens; B,C,D each need one next token.", "A throughput-first batch runs A alone and delays B–D.", "Chunked prefill runs part of A, then a mixed decode batch.", "All TP ranks must agree on the same batch membership and token positions.", "Scheduling changes communication sizes and tail latency even when the model is unchanged."],
  "kv-disaggregation": ["Move a 2 GiB KV cache from prefill GPU0 to decode GPU2", "GPU0 has completed a long prompt; GPU2 will generate future tokens.", "GPU2 reserves destination KV blocks and sends layout metadata.", "GPU0 streams layer-aligned chunks through RDMA while later prefill work can overlap.", "GPU2 starts decode only after required layers are visible.", "Disaggregation saves resource coupling but makes cache transfer a critical distributed protocol."],
  "speculative-moe-serving": ["Draft four tokens, then verify them together", "A small draft model proposes tokens t1…t4.", "The target model evaluates all four positions as one verification batch.", "Accepted prefix length determines how many tokens advance.", "If the target is MoE, verification tokens are packed and dispatched to experts together.", "Higher verification batches can improve collective efficiency, but rejected work is wasted."],
  "failures": ["Make GPU2 call Broadcast while peers call AllReduce", "Ranks0,1,3 wait at collective sequence 42 AllReduce; rank2 waits at sequence 42 Broadcast.", "Each local call is valid in isolation.", "No matching global schedule exists, so progress stops.", "Per-rank sequence logs reveal the first divergent call.", "Increasing the timeout hides the symptom longer but does not repair the contract violation."],
  "stragglers": ["Delay GPU3 by 50 ms before AllReduce", "GPUs0–2 finish backward at t=100 ms; GPU3 finishes at t=150 ms.", "Early ranks enter the collective and appear to spend 50 ms inside it waiting.", "Actual data transfer may still take only 2 ms after GPU3 arrives.", "Arrival timestamps separate compute skew from network transfer time.", "Collective duration observed by one rank is not automatically network latency."],
  "debugging": ["Debug an AllReduce that hangs at iteration 17", "Collect rank logs, topology, versions, and last completed sequence.", "Align logs by communicator and collective sequence, not only wall clock.", "Find rank2 entered Broadcast #812 while peers entered AllReduce #812.", "Reproduce with the smallest tensor and two ranks, then fix call ordering.", "Layer-by-layer isolation beats enabling every debug option at once."],
  "profiling": ["Explain a 12 ms AllReduce bar in a training trace", "Backward bucket becomes ready at different times on four GPUs.", "Measure 7 ms of arrival skew before transport starts.", "Measure 3 ms of active transfer and 2 ms of exposed tail.", "Correlate expected bytes with NIC and NVLink counters.", "Kernel duration, active communication, and iteration-critical exposed time are different quantities."],
  "scale-simulator": ["Simulate a ring before using 1,024 GPUs", "Start with four ranks, four links, α, bandwidth, and four chunks.", "Create events for send start, link reservation, receive completion, and reduction.", "Validate predicted four-rank time against a real measurement.", "Aggregate equivalent flows, then scale topology and rank count.", "A simulator becomes useful only after calibration and small-system validation."],
  "mini-nccl": ["Build AllReduce in five increasingly real versions", "Begin with four CPU processes and two integers each.", "Version1 central TCP; version2 ring TCP; version3 chunked ring.", "Version4 moves CUDA buffers with local reduction kernels.", "Version5 adds RDMA, channels, topology selection, traces, and failure injection.", "Correct semantics and buffer ownership come before performance optimization."],
  "cluster-design": ["Design a 1,024-GPU training job from tensor flows", "Assume 128 nodes × 8 GPUs, with DP=128 and TP=8.", "Derive per-layer TP activation traffic inside each node.", "Derive DP gradient or ReduceScatter traffic across nodes.", "Map groups to NVSwitch, NIC rails, racks, and failure domains.", "A defensible cluster starts from workload bytes and dependencies, not peak-link marketing numbers."],
};

for (const [id, values] of Object.entries(advancedExamples)) {
  const [title, setup, step1, step2, step3, takeaway] = values;
  toyExamples[id] = {
    title,
    question: `What happens, step by step, in this concrete four-GPU case?`,
    setup,
    before: g("GPU0 ready", "GPU1 ready", "GPU2 ready", "GPU3 ready"),
    frames: [
      { title: "Step 1", state: g("stage 1", "stage 1", "stage 1", "stage 1"), messages: ["follow the first dependency"], explanation: step1 },
      { title: "Step 2", state: g("stage 2", "stage 2", "stage 2", "stage 2"), messages: ["observe ownership and traffic"], explanation: step2 },
      { title: "Step 3", state: g("complete", "complete", "complete", "complete"), messages: ["identify the bottleneck"], explanation: step3 },
    ],
    after: g("result", "result", "result", "result"),
    takeaway,
  };
}

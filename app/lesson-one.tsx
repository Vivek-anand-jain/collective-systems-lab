import type { ReactNode } from "react";

const GradientCard = ({
  gpu,
  x,
  target,
  prediction,
  error,
  gradient,
}: {
  gpu: number;
  x: number;
  target: number;
  prediction: number;
  error: number;
  gradient: number;
}) => (
  <div className="gradient-card">
    <span>GPU{gpu}</span>
    <code>x = {x}, target = {target}</code>
    <div><small>prediction</small><b>2 × {x} = {prediction}</b></div>
    <div><small>error</small><b>{prediction} − {target} = {error}</b></div>
    <div><small>gradient</small><b>{error} × {x} = {gradient}</b></div>
  </div>
);

const Chapter = ({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) => (
  <section className="primer-chapter">
    <div className="primer-number">{number}</div>
    <div className="primer-content">
      <h2>{title}</h2>
      {children}
    </div>
  </section>
);

export function LessonOneTutorial() {
  return (
    <div className="primer">
      <section className="primer-intro">
        <span>THE QUESTION WE WILL ANSWER</span>
        <h2>Why does distributed training need collective communication?</h2>
        <p>
          We will not begin with rings, trees, NCCL, or RDMA. We will begin with
          one weight, one training example, and one GPU. Then we will place the
          same model on four GPUs and watch the problem appear.
        </p>
        <div className="primer-promise">
          By the end, you will derive an AllReduce yourself instead of memorizing
          its definition.
        </div>
      </section>

      <Chapter number="01" title="Start with the smallest possible model">
        <p>
          Imagine a model that predicts a house price from its size. It has only
          one learned number: a weight named <code>w</code>.
        </p>
        <div className="simple-flow">
          <div><span>INPUT</span><b>house size x</b></div>
          <strong>×</strong>
          <div><span>LEARNED WEIGHT</span><b>w</b></div>
          <strong>→</strong>
          <div><span>PREDICTION</span><b>ŷ = w × x</b></div>
        </div>
        <p>Set the initial weight to:</p>
        <div className="single-equation"><code>w = 2</code></div>
        <p>For a house with size <code>x=5</code>, the forward pass is:</p>
        <div className="calculation-stack">
          <code>prediction = w × x</code>
          <code>prediction = 2 × 5</code>
          <code>prediction = 10</code>
        </div>
        <p>
          Nothing has been learned yet. The model only used its current weight
          to make a prediction. A real transformer performs billions of these
          multiply-accumulate operations using matrices, but the training logic
          starts here.
        </p>
      </Chapter>

      <Chapter number="02" title="What exactly is a weight?">
        <p>
          A weight is a number the training process is allowed to change. The
          program structure is written by the model designer; the useful values
          of its weights are learned from data.
        </p>
        <div className="weight-timeline">
          <code>2.00</code><span>→</span><code>2.18</code><span>→</span>
          <code>2.41</code><span>→</span><code>2.76</code><span>→</span>
          <code>better predictions</code>
        </div>
        <p>
          Our toy model stores one weight. A large language model stores
          embedding matrices, attention projection matrices, MLP matrices,
          normalization parameters, and other learned tensors. “A 70-billion
          parameter model” means roughly 70 billion learned scalar weights.
        </p>
        <div className="memory-box">
          <b>GPU HBM during the forward pass</b>
          <div><span>address 0x…00</span><code>weight w = 2.0</code></div>
          <p>The GPU kernel reads the weight from device memory and uses it in arithmetic.</p>
        </div>
      </Chapter>

      <Chapter number="03" title="A prediction is useful only when we can measure its error">
        <p>
          Suppose the correct answer for <code>x=5</code> is <code>15</code>,
          while the model predicts <code>10</code>. We need a loss function that
          converts this mismatch into one number.
        </p>
        <p>Use half squared error:</p>
        <div className="single-equation">
          <code>L = ½(ŷ − y)²</code>
        </div>
        <div className="calculation-stack">
          <code>error = prediction − target = 10 − 15 = −5</code>
          <code>loss = ½ × (−5)² = 12.5</code>
        </div>
        <p>
          The loss says how wrong the prediction is. It does not yet tell us how
          to change <code>w</code>. For that we need a gradient.
        </p>
      </Chapter>

      <Chapter number="04" title="Derive the gradient instead of treating it as magic">
        <p>
          A gradient answers: “If I increase this weight slightly, how does the
          loss change?” For our model:
        </p>
        <div className="derivation">
          <div><span>MODEL</span><code>ŷ = wx</code></div>
          <div><span>LOSS</span><code>L = ½(ŷ − y)²</code></div>
          <div><span>CHAIN RULE</span><code>∂L/∂w = ∂L/∂ŷ × ∂ŷ/∂w</code></div>
          <div><span>DERIVATIVES</span><code>∂L/∂ŷ = ŷ − y &nbsp;&nbsp; and &nbsp;&nbsp; ∂ŷ/∂w = x</code></div>
          <div className="result"><span>RESULT</span><code>∂L/∂w = (ŷ − y)x</code></div>
        </div>
        <p>For <code>x=5</code>, <code>ŷ=10</code>, and <code>y=15</code>:</p>
        <div className="single-equation"><code>gradient = (10 − 15) × 5 = −25</code></div>
        <p>
          The gradient is negative. Gradient descent subtracts the gradient, so
          a negative gradient makes the weight increase. That is sensible:
          increasing <code>w</code> raises the prediction toward 15.
        </p>
      </Chapter>

      <Chapter number="05" title="One GPU can update the weight by itself">
        <p>Gradient descent performs:</p>
        <div className="single-equation"><code>w_new = w_old − learning_rate × gradient</code></div>
        <p>Choose a small learning rate of <code>0.01</code>:</p>
        <div className="calculation-stack">
          <code>w_new = 2 − 0.01 × (−25)</code>
          <code>w_new = 2.25</code>
        </div>
        <p>
          One complete training step is now visible:
        </p>
        <div className="training-timeline">
          <div><span>1</span><b>Forward</b><small>read w, compute prediction</small></div>
          <div><span>2</span><b>Loss</b><small>compare prediction with target</small></div>
          <div><span>3</span><b>Backward</b><small>compute gradient for w</small></div>
          <div><span>4</span><b>Optimizer</b><small>use gradient to update w</small></div>
        </div>
      </Chapter>

      <Chapter number="06" title="Now place an identical model on four GPUs">
        <p>
          Data parallel training copies the same model to every GPU. Each GPU
          processes a different part of the training batch.
        </p>
        <div className="replica-grid">
          {[0, 1, 2, 3].map((gpu) => (
            <div key={gpu}>
              <span>GPU{gpu}</span>
              <b>model replica</b>
              <code>w = 2.0</code>
              <small>different training sample</small>
            </div>
          ))}
        </div>
        <p>Use these four samples:</p>
        <div className="sample-table">
          <div><b>GPU</b><b>x</b><b>target y</b><b>relationship</b></div>
          <div><span>0</span><code>1</code><code>4</code><span>y = 4x</span></div>
          <div><span>1</span><code>2</code><code>8</code><span>y = 4x</span></div>
          <div><span>2</span><code>3</code><code>12</code><span>y = 4x</span></div>
          <div><span>3</span><code>4</code><code>16</code><span>y = 4x</span></div>
        </div>
        <p>
          All replicas begin with the same <code>w=2</code>, but because their
          samples differ, they compute different local gradients.
        </p>
      </Chapter>

      <Chapter number="07" title="Compute every local gradient—no skipped arithmetic">
        <p>For every GPU, use the same formula:</p>
        <div className="single-equation"><code>local gradient = (prediction − target) × x</code></div>
        <div className="gradient-grid">
          <GradientCard gpu={0} x={1} target={4} prediction={2} error={-2} gradient={-2} />
          <GradientCard gpu={1} x={2} target={8} prediction={4} error={-4} gradient={-8} />
          <GradientCard gpu={2} x={3} target={12} prediction={6} error={-6} gradient={-18} />
          <GradientCard gpu={3} x={4} target={16} prediction={8} error={-8} gradient={-32} />
        </div>
        <p>
          These gradients are not contradictory. Each is correct for its local
          sample. Together, the four samples form one global batch. The update
          should use the gradient of that complete batch.
        </p>
      </Chapter>

      <Chapter number="08" title="Watch the model break if GPUs do not communicate">
        <p>
          Suppose every GPU applies its own local gradient with learning rate
          <code>0.01</code>:
        </p>
        <div className="divergence-grid">
          <div><span>GPU0</span><code>2 − .01(−2) = 2.02</code></div>
          <div><span>GPU1</span><code>2 − .01(−8) = 2.08</code></div>
          <div><span>GPU2</span><code>2 − .01(−18) = 2.18</code></div>
          <div><span>GPU3</span><code>2 − .01(−32) = 2.32</code></div>
        </div>
        <div className="warning-box">
          <b>The replicas have diverged.</b>
          <p>
            The next forward pass no longer runs the same model on each GPU.
            After many steps, every rank trains a different parameter set.
            Synchronous data parallelism requires one shared global gradient.
          </p>
        </div>
      </Chapter>

      <Chapter number="09" title="Construct the global gradient">
        <p>
          The loss of the global batch is the average of the four sample losses.
          Therefore its gradient is the average of the four local gradients:
        </p>
        <div className="calculation-stack emphasized">
          <code>sum = −2 + (−8) + (−18) + (−32)</code>
          <code>sum = −60</code>
          <code>average = −60 / 4 = −15</code>
        </div>
        <p>
          Every GPU needs <code>−15</code> before it applies the optimizer. This
          gives us an exact communication requirement:
        </p>
        <div className="before-after">
          <div>
            <span>BEFORE COMMUNICATION</span>
            <code>GPU0 = −2</code><code>GPU1 = −8</code>
            <code>GPU2 = −18</code><code>GPU3 = −32</code>
          </div>
          <strong>→</strong>
          <div>
            <span>AFTER COMMUNICATION</span>
            <code>GPU0 = −15</code><code>GPU1 = −15</code>
            <code>GPU2 = −15</code><code>GPU3 = −15</code>
          </div>
        </div>
      </Chapter>

      <Chapter number="10" title="This required transformation is AllReduce">
        <p>
          Break the word into two parts:
        </p>
        <div className="word-definition">
          <div><b>Reduce</b><p>Combine values using an operator such as SUM.</p></div>
          <div><b>All</b><p>Deliver the combined result to every participating rank.</p></div>
        </div>
        <p>
          An AllReduce with SUM can produce <code>−60</code> on every rank.
          Dividing by four locally produces the average <code>−15</code>.
          Some training systems scale before or during reduction; what matters
          is that all replicas apply the same mathematically intended gradient.
        </p>
        <div className="collective-contract">
          <div><span>INPUT</span><p>one same-shaped gradient tensor per rank</p></div>
          <div><span>OPERATOR</span><p>elementwise SUM</p></div>
          <div><span>OUTPUT</span><p>complete summed tensor on every rank</p></div>
          <div><span>ORDER</span><p>all ranks call matching collectives</p></div>
        </div>
      </Chapter>

      <Chapter number="11" title="One correct message schedule: reduce, then broadcast">
        <p>
          AllReduce describes the result, not a specific set of messages. For
          four scalar gradients, a binary tree can implement it.
        </p>
        <div className="message-round">
          <span>REDUCE · ROUND 1</span>
          <div><code>GPU1 → GPU0: −8</code><code>GPU3 → GPU2: −32</code></div>
          <p>GPU0 stores −2+(−8)=−10. GPU2 stores −18+(−32)=−50.</p>
        </div>
        <div className="message-round">
          <span>REDUCE · ROUND 2</span>
          <div><code>GPU2 → GPU0: −50</code></div>
          <p>GPU0 stores −10+(−50)=−60. The reduction is complete at the root.</p>
        </div>
        <div className="message-round">
          <span>BROADCAST · ROUND 1</span>
          <div><code>GPU0 → GPU2: −60</code></div>
          <p>Two ranks now know the complete sum.</p>
        </div>
        <div className="message-round">
          <span>BROADCAST · ROUND 2</span>
          <div><code>GPU0 → GPU1: −60</code><code>GPU2 → GPU3: −60</code></div>
          <p>All four ranks know −60; each divides by four to obtain −15.</p>
        </div>
        <p>
          This tree has a clear explanation and logarithmic depth. It is not
          always the fastest schedule. Large GPU tensors often use
          ReduceScatter followed by AllGather so that no rank repeatedly sends
          the full tensor.
        </p>
      </Chapter>

      <Chapter number="12" title="All replicas now make one identical update">
        <div className="calculation-stack emphasized">
          <code>global gradient = −15</code>
          <code>w_new = 2 − 0.01 × (−15)</code>
          <code>w_new = 2.15</code>
        </div>
        <div className="replica-grid updated">
          {[0, 1, 2, 3].map((gpu) => (
            <div key={gpu}><span>GPU{gpu}</span><b>same replica</b><code>w = 2.15</code></div>
          ))}
        </div>
        <p>
          The next iteration begins with identical model weights on every rank.
          Each GPU can again process different samples, compute local gradients,
          combine them, and make one synchronized update.
        </p>
      </Chapter>

      <Chapter number="13" title="A complete toy implementation">
        <p>
          First implement the semantics in one Python process. We intentionally
          avoid a distributed library so every operation remains visible.
        </p>
        <pre className="primer-code"><code>{`weight = 2.0
learning_rate = 0.01

# One (x, target) sample per simulated GPU.
samples = [(1, 4), (2, 8), (3, 12), (4, 16)]

local_gradients = []

for rank, (x, target) in enumerate(samples):
    prediction = weight * x
    error = prediction - target
    gradient = error * x
    local_gradients.append(gradient)

    print(
        f"GPU{rank}: prediction={prediction}, "
        f"error={error}, gradient={gradient}"
    )

# These two lines model SUM AllReduce followed by local scaling.
gradient_sum = sum(local_gradients)
global_gradient = gradient_sum / len(local_gradients)

new_weight = weight - learning_rate * global_gradient

print("gradient sum:", gradient_sum)        # -60.0
print("global gradient:", global_gradient)  # -15.0
print("new weight on every GPU:", new_weight)  # 2.15`}</code></pre>
        <p>
          A real distributed program has one process per GPU. Each process sees
          only its local gradient. The line <code>sum(local_gradients)</code>
          must therefore become a communication operation:
        </p>
        <pre className="primer-code"><code>{`# Executed independently by every rank.
local_gradient = compute_gradient(local_sample)

# SUM modifies the tensor so every rank receives the global sum.
torch.distributed.all_reduce(
    local_gradient,
    op=torch.distributed.ReduceOp.SUM,
)

global_gradient = local_gradient / world_size
optimizer_step(global_gradient)`}</code></pre>
        <p>
          The API is short because the library owns the difficult machinery:
          rank discovery, topology selection, chunking, message ordering,
          transport progress, CUDA synchronization, and failure reporting.
        </p>
      </Chapter>

      <Chapter number="14" title="Where the bytes physically travel">
        <p>
          In real training, a gradient is not one number. It may be a tensor
          containing millions of bf16 or fp32 elements in GPU HBM.
        </p>
        <div className="physical-path">
          <div><span>GPU SM</span><small>backward kernel produces gradient</small></div>
          <strong>→</strong>
          <div><span>GPU HBM</span><small>gradient tensor becomes ready</small></div>
          <strong>→</strong>
          <div><span>NVLink / PCIe</span><small>local peer or NIC path</small></div>
          <strong>→</strong>
          <div><span>NIC + network</span><small>for another host</small></div>
          <strong>→</strong>
          <div><span>remote HBM</span><small>reduce or copy received chunk</small></div>
        </div>
        <p>
          A collective runtime must keep the CUDA stream ordered: backward must
          finish producing a chunk before communication reads it, and the
          optimizer must wait until the global gradient is ready.
        </p>
      </Chapter>

      <Chapter number="15" title="Why performance becomes an algorithm problem">
        <p>
          Our scalar example is latency dominated. Sending one number spends
          almost all its time starting communication. Real gradients can be
          gigabytes, so byte movement becomes dominant.
        </p>
        <div className="alpha-beta">
          <div><b>α · startup latency</b><p>Paid for each dependent communication round, even if the message is tiny.</p></div>
          <div><b>nβ · serialization time</b><p>Message bytes n multiplied by seconds per byte β.</p></div>
          <div><b>γ · reduction work</b><p>Time to read, add, and write tensor elements on the GPU.</p></div>
        </div>
        <p>
          Trees use few rounds and are attractive for small messages. Rings use
          more rounds but can divide large tensors into chunks and keep links
          busy. Hierarchical algorithms first communicate over fast NVLink
          paths inside a node, then use slower NIC links between nodes.
        </p>
        <div className="checkpoint-box">
          <b>Do not memorize “ring is best” or “tree is best.”</b>
          <p>
            Ask: How many dependent rounds? How many bytes cross the bottleneck
            link? Can chunks overlap? Which physical paths are shared? When does
            the last required rank arrive?
          </p>
        </div>
      </Chapter>

      <section className="primer-summary">
        <span>THE COMPLETE CAUSAL CHAIN</span>
        <div>
          <b>Different samples</b><i>→</i>
          <b>different local gradients</b><i>→</i>
          <b>replicas would diverge</b><i>→</i>
          <b>combine gradients</b><i>→</i>
          <b>deliver result to all ranks</b><i>→</i>
          <b>AllReduce</b>
        </div>
        <p>
          Collectives exist because distributed computation creates partial
          data with a predictable global ownership requirement. Everything
          later in this course—rings, trees, NCCL protocols, RDMA, ZeRO, FSDP,
          tensor parallelism, and expert routing—is a more sophisticated version
          of reasoning from partial data to the required global state.
        </p>
      </section>
    </div>
  );
}

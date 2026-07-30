# Collective Systems Lab

An interactive, semester-length course on distributed GPU collective
communication—from first principles through NCCL internals, AI parallelism,
networking, debugging, and thousand-GPU system design.

## What is included

- 46 progressive lessons across eight modules
- A step-by-step animator for 11 collectives
- An interactive latency/bandwidth performance model
- GPU, PCIe, NVSwitch, NUMA, and cluster topology exploration
- AI training communication timelines
- Python-to-production implementation ladders
- Exercises and an 18-minute video storyboard for every lesson
- Device-local progress tracking

## Local development

```bash
npm install
npm run dev
```

Open the local URL printed by the development server.

## Validation

```bash
npm run build
npm test
```

## GitHub Pages

Push this project to GitHub and enable **Settings → Pages → Source: GitHub
Actions**. The included workflow builds a static export and publishes it at:

```text
https://<github-user>.github.io/<repository>/
```

The workflow derives the repository subpath automatically.

<p align="center">
  <img src="./resources/icon.svg" alt="OpenDeploy" width="96" />
</p>

<h1 align="center">开达 OpenDeploy</h1>

> An open-source AI agent for ERP implementation consultants — making "a one-person delivery team" possible.

[English](./README.md) | [简体中文](./README.zh-CN.md)

---

Most "AI assistant tools" today look like this:

> **Consultant**: The client wants an xxx feature.
>
> **AI**: Sure, I'll write the Python plugin.
>
> **Consultant**: ...but the field needs to be created in the system first, and the approval flow edited too.
>
> **AI**: That part's on you.

**What OpenDeploy aims to do: the whole thing, done by AI.**

## Demo

<p align="center">
  <img src="./assets/wizard.gif" alt="OpenDeploy initial setup" width="720" />
  <br/><sub>Initial setup — configure your LLM provider</sub>
</p>

<p align="center">
  <img src="./assets/project.gif" alt="OpenDeploy create a project" width="720" />
  <br/><sub>Create a project — connect to Kingdee Cloud Cosmic V9</sub>
</p>

<p align="center">
  <img src="./assets/case.gif" alt="OpenDeploy real customization" width="720" />
  <br/><sub>Real customization end-to-end — business request to applied BOS extension</sub>
</p>

## Features

**LLM providers** (BYO API key): Claude · GPT · DeepSeek · Qwen · GLM · Kimi · Doubao · Hunyuan · MiniMax · Baichuan · Ollama (local)

**Kingdee Cloud Cosmic V9 customization** (BOS HTTP RPC end-to-end — never touches your database):

- Extension lifecycle — create / delete / list
- Fields — 12 types (text / number / amount / quantity / date / checkbox / combo / base-data / mnemonic / unit / formula / property-binding)
- Entry body — EntryEntity / TabPage / TabControl: create / delete / rename
- Python form plugins — batch register, output lands in the project directory
- Business rules — Calculate / GetInvStock / ...
- Custom operations + toolbar buttons
- Convert rules — extension + convert plugins
- Property grid — required / default value / row-number / org-field binding / entity required

**Knowledge base** (10 skills / 57 markdown files / 10,638 lines, pulled from GitHub with Gitee mirror fallback): implementation methodology + customization decision trees + BOS element references + customer-validated case studies

**Architecture**: zero self-hosted servers · credentials stay local (plaintext in `settings.json`, never reaches the renderer process) · single-consultant local tool

## Getting started

Requires Windows 10/11 + an LLM API key.

**Download the installer (recommended)**

[**👉 v0.1.0-alpha.1 installer**](https://github.com/qiaolei227/opendeploy/releases/latest) — grab `OpenDeploy-*-x64-setup.exe` and double-click to install.

**Local development**

```bash
pnpm install
pnpm dev
```

## Status

**v0.1.0-alpha.1 released** — internal preview for BOS customization consultants. Features / API / UX may still change.

- Target: Kingdee Cloud Cosmic V9 on-premise (Standard / Enterprise editions)
- Platform: Windows x64 only (macOS / Linux pending user feedback)
- 10 skills / 57 markdown files / 10,638 lines of industry knowledge

## License

MIT — see [LICENSE](./LICENSE)

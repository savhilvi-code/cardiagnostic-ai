from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_FILE = ROOT / "ARCHITECTURE_FRONTEND.md"

SKIP_DIRS = {
    ".git",
    ".github",
    "__pycache__",
    "node_modules",
    ".next",
    "dist",
    "build",
}

TEXT_EXTENSIONS = {".html", ".css", ".js", ".mjs", ".json", ".xml", ".md", ".txt"}
API_ROUTE_RE = re.compile(r"(?P<match>(?:https?://[^'\"\s)]+)?/(?:chat|history|search|health|telegram)\b[^'\"\s)]*)")
FETCH_RE = re.compile(r"\bfetch\s*\(")
AXIOS_RE = re.compile(r"\baxios(?:\s*\(|\.[a-zA-Z]+\s*\()")
SUPABASE_RE = re.compile(r"\b(createClient|supabase\.auth|supabase\.from\s*\()")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def iter_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.is_file():
            files.append(path)
    return sorted(files)


def project_files_by_suffix(suffixes: set[str]) -> list[Path]:
    return [path for path in iter_files() if path.suffix.lower() in suffixes]


def build_tree(files: list[Path]) -> str:
    tree: dict[str, dict] = {}
    for path in files:
        current = tree
        for part in path.relative_to(ROOT).parts:
            current = current.setdefault(part, {})

    lines = [f"- {ROOT.name}/"]

    def walk(node: dict[str, dict], depth: int) -> None:
        for name in sorted(node):
            suffix = "/" if node[name] else ""
            lines.append(f"{'  ' * depth}- {name}{suffix}")
            if node[name]:
                walk(node[name], depth + 1)

    walk(tree, 1)
    return "\n".join(lines)


def bullet_list(paths: list[Path]) -> str:
    if not paths:
        return "- Не найдено"
    return "\n".join(f"- `{rel(path)}`" for path in sorted(paths))


def scan_lines(patterns: list[tuple[str, re.Pattern[str]]]) -> dict[str, list[str]]:
    findings: dict[str, list[str]] = {}
    for path in project_files_by_suffix(TEXT_EXTENSIONS):
        try:
            lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        except OSError:
            continue

        for number, line in enumerate(lines, start=1):
            matches: list[str] = []
            for label, pattern in patterns:
                if pattern.search(line):
                    if label == "URL":
                        matches.extend(match.group("match") for match in pattern.finditer(line))
                    else:
                        matches.append(label)
            if matches:
                clean = line.strip()
                finding = f"`{rel(path)}:{number}` - {', '.join(sorted(set(matches)))}"
                if clean:
                    finding += f" - `{clean[:160]}`"
                findings.setdefault(rel(path), []).append(finding)
    return findings


def findings_list(findings: dict[str, list[str]]) -> str:
    rows = [item for _, items in sorted(findings.items()) for item in items]
    return "\n".join(f"- {row}" for row in rows) if rows else "- Не найдено"


def generate_markdown() -> str:
    all_files = iter_files()
    html_files = project_files_by_suffix({".html"})
    css_files = project_files_by_suffix({".css"})
    js_files = project_files_by_suffix({".js", ".mjs"})
    pages = sorted(path for path in all_files if path.is_relative_to(ROOT / "pages"))
    assets = sorted(path for path in all_files if path.is_relative_to(ROOT / "assets"))

    api_findings = scan_lines(
        [
            ("fetch(...)", FETCH_RE),
            ("axios(...)", AXIOS_RE),
            ("URL", API_ROUTE_RE),
        ]
    )
    supabase_findings = scan_lines(
        [
            ("createClient", re.compile(r"\bcreateClient\b")),
            ("supabase.auth", re.compile(r"\bsupabase\.auth\b")),
            ("supabase.from(...)", re.compile(r"\bsupabase\.from\s*\(")),
        ]
    )

    return f"""# Frontend Architecture

## Краткое описание

CarDiagnostic AI frontend - статический frontend-проект для сайта PULS. Он состоит из HTML-страниц, CSS-стилей и JavaScript-модулей, которые управляют интерфейсом, навигацией, авторизацией, Supabase-клиентом и запросами к backend FastAPI.

## Структура папок

```text
{build_tree(all_files)}
```

## HTML-страницы

{bullet_list(html_files)}

## CSS-файлы

{bullet_list(css_files)}

## JavaScript-файлы

{bullet_list(js_files)}

## Pages

{bullet_list(pages)}

## Assets

{bullet_list(assets)}

## API-вызовы к backend

{findings_list(api_findings)}

## Использование Supabase

{findings_list(supabase_findings)}

## Поток frontend-запроса

```mermaid
flowchart LR
    Browser[Browser] --> Frontend[Frontend HTML/CSS/JS]
    Frontend --> APIConfig[API Config]
    APIConfig --> Backend[Backend FastAPI]
    Backend --> Response[Response]
    Response --> UI[UI]
```
"""


def main() -> None:
    OUTPUT_FILE.write_text(generate_markdown(), encoding="utf-8")
    print(f"Updated {OUTPUT_FILE}")


if __name__ == "__main__":
    main()

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "deploy.yml"
README = ROOT / "README.md"
MAIN_RELEASE_GUARD = (
    "github.ref == 'refs/heads/main' && github.event_name != 'pull_request'"
)


def lines() -> list[str]:
    return WORKFLOW.read_text(encoding="utf-8").splitlines()


def unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def section(source: list[str], heading: str, indent: int = 0) -> list[str]:
    prefix = " " * indent
    marker = f"{prefix}{heading}:"
    start = source.index(marker) + 1
    result: list[str] = []
    for line in source[start:]:
        if line.strip() and len(line) - len(line.lstrip()) <= indent:
            break
        result.append(line)
    return result


def scalar(source: list[str], key: str) -> str:
    pattern = re.compile(rf"^\s*{re.escape(key)}:\s*(.+?)\s*$")
    for line in source:
        match = pattern.match(line)
        if match:
            return unquote(match.group(1))
    raise AssertionError(f"Missing {key!r} in section")


def steps(job: list[str]) -> list[dict[str, object]]:
    step_lines = section(job, "steps", indent=4)
    parsed: list[dict[str, object]] = []
    current: dict[str, object] | None = None
    in_with = False

    for line in step_lines:
        stripped = line.strip()
        if line.startswith("      - "):
            if current is not None:
                parsed.append(current)
            current = {"with": {}}
            in_with = False
            stripped = stripped[2:]
        elif current is None:
            continue
        elif line.startswith("        with:"):
            in_with = True
            continue
        elif not line.startswith("          "):
            in_with = False

        if not stripped or ":" not in stripped:
            continue
        key, value = stripped.split(":", 1)
        value = unquote(value.strip())
        if in_with and line.startswith("          "):
            current["with"][key] = value
        else:
            current[key] = value

    if current is not None:
        parsed.append(current)
    return parsed


class DeployWorkflowContract(unittest.TestCase):
    def setUp(self) -> None:
        self.assertTrue(WORKFLOW.is_file(), "deployment workflow must exist")
        self.source = lines()
        self.triggers = section(self.source, "on")
        self.jobs = section(self.source, "jobs")
        self.build = section(self.jobs, "build", indent=2)
        self.deploy = section(self.jobs, "deploy", indent=2)

    def test_runs_for_pull_requests_main_pushes_and_manual_dispatch(self) -> None:
        trigger_text = "\n".join(self.triggers)
        self.assertRegex(trigger_text, r"(?m)^  pull_request:\s*$")
        self.assertRegex(trigger_text, r"(?m)^  workflow_dispatch:\s*$")
        push = section(self.triggers, "push", indent=2)
        self.assertEqual(scalar(push, "branches"), "[main]")

    def test_validation_concurrency_is_ref_scoped_and_only_prs_are_cancelled(self) -> None:
        concurrency = section(self.source, "concurrency")
        self.assertEqual(
            scalar(concurrency, "group"),
            "ci-${{ github.workflow }}-${{ github.ref }}",
        )
        self.assertEqual(
            scalar(concurrency, "cancel-in-progress"),
            "${{ github.event_name == 'pull_request' }}",
        )

    def test_build_has_read_only_permissions_and_pinned_node_setup(self) -> None:
        permissions = section(self.build, "permissions", indent=4)
        self.assertEqual(scalar(permissions, "contents"), "read")

        build_steps = steps(self.build)
        self.assertEqual(build_steps[0].get("uses"), "actions/checkout@v7")
        setup = build_steps[1]
        self.assertEqual(setup.get("uses"), "actions/setup-node@v7")
        self.assertEqual(setup["with"], {"node-version": "24", "cache": "npm"})

    def test_build_checks_everything_before_uploading_dist(self) -> None:
        build_steps = steps(self.build)
        commands = [step.get("run") for step in build_steps if "run" in step]
        self.assertEqual(
            commands,
            [
                "npm ci",
                "npx playwright install --with-deps chromium",
                "npm run check",
                "npm test",
                "npm run build",
                "npm run test:e2e",
            ],
        )

        upload_index = next(
            index
            for index, step in enumerate(build_steps)
            if step.get("uses") == "actions/upload-pages-artifact@v5"
        )
        e2e_index = next(
            index
            for index, step in enumerate(build_steps)
            if step.get("run") == "npm run test:e2e"
        )
        upload = build_steps[upload_index]
        self.assertGreater(upload_index, e2e_index)
        self.assertEqual(upload.get("if"), MAIN_RELEASE_GUARD)
        self.assertEqual(upload["with"], {"path": "dist"})

    def test_deploy_is_gated_and_has_only_required_release_permissions(self) -> None:
        self.assertEqual(scalar(self.deploy, "if"), MAIN_RELEASE_GUARD)
        self.assertEqual(scalar(self.deploy, "needs"), "build")

        concurrency = section(self.deploy, "concurrency", indent=4)
        self.assertEqual(scalar(concurrency, "group"), "pages-production")
        self.assertEqual(scalar(concurrency, "cancel-in-progress"), "false")

        permissions = section(self.deploy, "permissions", indent=4)
        self.assertEqual(
            {line.strip() for line in permissions if line.strip()},
            {"contents: read", "pages: write", "id-token: write"},
        )

        environment = section(self.deploy, "environment", indent=4)
        self.assertEqual(scalar(environment, "name"), "github-pages")
        self.assertEqual(
            scalar(environment, "url"),
            "${{ steps.deployment.outputs.page_url }}",
        )

        deploy_steps = steps(self.deploy)
        self.assertEqual(len(deploy_steps), 1)
        self.assertEqual(deploy_steps[0].get("id"), "deployment")
        self.assertEqual(deploy_steps[0].get("uses"), "actions/deploy-pages@v5")

    def test_readme_explains_manual_release_ref_policy(self) -> None:
        readme = README.read_text(encoding="utf-8")
        self.assertIn(
            "Manual runs deploy only when dispatched from `main`; other selected refs run validation without uploading or deploying.",
            readme,
        )
        self.assertIn(
            "Pull request validation is isolated from release runs. Running releases are not canceled, and deployment jobs serialize through a shared production group; GitHub Actions may replace an older pending run when a newer run enters the same concurrency group.",
            readme,
        )
        self.assertNotIn("one release cannot cancel or race another", readme.lower())


if __name__ == "__main__":
    unittest.main()

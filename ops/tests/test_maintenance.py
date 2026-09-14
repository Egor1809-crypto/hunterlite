import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "backup", Path(__file__).parents[1] / "backup.py"
)
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class RetentionTests(unittest.TestCase):
    def test_retention_preserves_manual_partial_and_foreign_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in (
                "daily-20260901T020000Z",
                "daily-20260902T020000Z",
                "daily-20260903T020000Z",
                "manual-before-deploy",
            ):
                p = root / name
                p.mkdir()
                for file in ("manifest.json", "database.dump", "uploads.tar.gz"):
                    (p / file).touch()
            (root / ".daily-20260904T020000Z.partial").mkdir()
            (root / "daily-20260905T020000Z").mkdir()  # incomplete
            (root / "daily-20260801T020000Z").symlink_to(
                root / "manual-before-deploy", target_is_directory=True
            )
            self.assertEqual(
                [p.name for p in backup.expired_bundles(root, keep=2)],
                ["daily-20260901T020000Z"],
            )
            with self.assertRaises(ValueError):
                backup.expired_bundles(root, keep=0)

    def test_inventory_rejects_foreign_ownership_and_omits_secrets(self):
        import json
        from types import SimpleNamespace

        row = {
            "Config": {
                "Labels": {
                    "com.docker.compose.service": "api",
                    "com.docker.compose.project": "legalhunter",
                },
                "Env": ["SECRET=do-not-export"],
                "Image": "pinned-image",
            },
            "Image": "sha256:123",
            "Created": "today",
        }
        with patch.object(
            backup, "run", return_value=SimpleNamespace(stdout=json.dumps([row]))
        ):
            self.assertNotIn("SECRET", json.dumps(backup.inventory()))
        row["Config"]["Labels"]["com.docker.compose.project"] = "foreign"
        with patch.object(
            backup, "run", return_value=SimpleNamespace(stdout=json.dumps([row]))
        ):
            with self.assertRaises(RuntimeError):
                backup.inventory()

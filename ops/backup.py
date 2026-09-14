"""LegalHunter-only backup. Atomic bundles; keep 14 successful daily copies."""

import datetime as dt
import fcntl
import gzip
import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path("/opt/legalhunter/deployment")
SERVICES = ("postgres", "redis", "api", "web", "bot")


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def inventory():
    rows = json.loads(
        run(
            "docker",
            "inspect",
            *("legalhunter-" + s + "-1" for s in SERVICES),
            capture_output=True,
        ).stdout
    )
    result = {}
    for row in rows:
        labels = row["Config"]["Labels"]
        service = labels["com.docker.compose.service"]
        if (
            labels.get("com.docker.compose.project") != "legalhunter"
            or service not in SERVICES
        ):
            raise RuntimeError("Unexpected container ownership")
        # Never serialize container Env: it includes credentials.
        result[service] = {
            "image_id": row["Image"],
            "image_ref": row["Config"]["Image"],
            "created": row["Created"],
        }
    return result


def expired_bundles(root, keep=14):
    if keep < 1:
        raise ValueError("At least one backup must be kept")
    bundles = sorted(
        p
        for p in root.iterdir()
        if not p.is_symlink()
        and p.is_dir()
        and re.fullmatch(r"daily-\d{8}T\d{6}Z", p.name)
        and (p / "manifest.json").is_file()
        and (p / "database.dump").is_file()
        and (p / "uploads.tar.gz").is_file()
    )
    return bundles[:-keep]


def main():
    os.umask(0o077)
    if Path("/opt/legalhunter").resolve() != Path("/opt/legalhunter"):
        raise RuntimeError("Unexpected project path")
    root = ROOT / "backups"
    root.mkdir(parents=True, exist_ok=True)
    with (ROOT / "backup.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        versions = inventory()
        name = dt.datetime.now(dt.timezone.utc).strftime("daily-%Y%m%dT%H%M%SZ")
        pending = root / ("." + name + ".partial")
        pending.mkdir()
        try:
            with (pending / "database.dump").open("wb") as out:
                run(
                    "docker",
                    "exec",
                    "legalhunter-postgres-1",
                    "sh",
                    "-c",
                    'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc',
                    stdout=out,
                )
            with (pending / "database.dump").open("rb") as source:
                run(
                    "docker",
                    "exec",
                    "-i",
                    "legalhunter-postgres-1",
                    "pg_restore",
                    "--list",
                    stdin=source,
                    stdout=subprocess.DEVNULL,
                )
            # Includes current uploads even before the first persistent-volume migration.
            with gzip.open(pending / "uploads.tar.gz", "wb") as out:
                child = subprocess.Popen(
                    [
                        "docker",
                        "exec",
                        "legalhunter-api-1",
                        "tar",
                        "-C",
                        "/app/uploads",
                        "-cf",
                        "-",
                        ".",
                    ],
                    stdout=subprocess.PIPE,
                )
                try:
                    shutil.copyfileobj(child.stdout, out)
                finally:
                    child.stdout.close()
                    code = child.wait()
                if code:
                    raise RuntimeError("Upload backup failed")
            # Configuration backup stays private on this server, never in Git.
            for filename in ("prod.env", "release.env"):
                source = ROOT / filename
                if source.is_file():
                    shutil.copyfile(source, pending / filename)
            manifest = {"created_at": name, "services": versions, "sha256": {}}
            for p in pending.iterdir():
                with p.open("rb") as stream:
                    manifest["sha256"][p.name] = hashlib.file_digest(
                        stream, "sha256"
                    ).hexdigest()
            (pending / "manifest.json").write_text(
                json.dumps(manifest, indent=2) + "\n"
            )
            pending.rename(root / name)
        except BaseException:
            shutil.rmtree(pending)
            raise
        # Only our completed daily bundles. Manual/pre-release dumps are preserved.
        expired = expired_bundles(root)
        for p in expired:
            shutil.rmtree(p)
        print(
            json.dumps(
                {"ok": True, "backup": name, "removed_daily_bundles": len(expired)}
            )
        )


if __name__ == "__main__":
    main()

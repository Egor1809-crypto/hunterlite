# Stub: this module does not exist in the upstream Hunter888 repo.
# Referenced by app.services.llm (lazy import).


async def build_lorebook_system_prompt(*args, **kwargs) -> str:
    """Placeholder — lorebook module was never created upstream.

    ``async`` because the sole caller (llm.py) does ``await`` on it; a plain
    ``def`` returning str would raise TypeError on that await (previously
    swallowed by a try/except, silently disabling the lorebook branch).
    """
    return ""

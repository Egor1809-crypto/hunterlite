"""Guard the shared production DB budget, including bot and admin headroom."""

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.database import engine


def test_default_pool_fits_shared_postgres():
    # 2 API workers, dedicated bot (2 + 3), reserve 20 for migrations/admin.
    api_max = engine.pool.size() + engine.pool._max_overflow
    assert 2 * api_max + 5 + 20 <= 100


@pytest.mark.parametrize(
    "field,value", [("db_pool_size", 0), ("db_pool_size", -1), ("db_max_overflow", -1)]
)
def test_unbounded_pool_configuration_rejected(field, value):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{field: value})

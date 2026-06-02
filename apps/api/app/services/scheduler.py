"""
Cron-система автоматических напоминаний и эскалаций (Task X3).

ТЗ v2, разделы 3.3, 7.3:
- Проверка stale-клиентов каждые N минут (REMINDER_CHECK_INTERVAL_MIN)
- Автонапоминания менеджеру по таймаутам статусов
- Эскалация РОП при длительном бездействии
- Auto-lost для thinking > 30 дней
- SMS-напоминание клиенту за 24ч до консультации

Реализация: asyncio background task, запускается при старте FastAPI.
(APScheduler не нужен для одной периодической задачи.)
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.client import (
    ClientInteraction,
    ClientNotification,
    ClientStatus,
    InteractionType,
    ManagerReminder,
    NotificationChannel,
    NotificationStatus,
    RealClient,
    STATUS_TIMEOUTS,
)
from app.models.user import User
from app.services.client_domain import create_crm_interaction_with_event


logger = logging.getLogger(__name__)

# Интервал проверки (минуты) — из конфига или дефолт
CHECK_INTERVAL_MIN = 5


class ReminderScheduler:
    """
    Фоновая задача проверки клиентов и генерации напоминаний.

    Жизненный цикл:
    - start(): запускает бесконечный цикл
    - stop(): останавливает цикл
    - check_stale_clients(): одна итерация проверки

    Edge cases:
    - Двойная отправка: проверяем auto_generated + remind_at за сегодня
    - Рестарт сервера: при запуске проверяем пропущенные
    - Конкурентность: один экземпляр на процесс (singleton)
    """

    def __init__(self):
        self._task: asyncio.Task | None = None
        self._running = False

    def start(self) -> None:
        """Запустить фоновую задачу."""
        if self._task is not None:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("ReminderScheduler started (interval: %d min)", CHECK_INTERVAL_MIN)

    def stop(self) -> None:
        """Остановить фоновую задачу."""
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None
        logger.info("ReminderScheduler stopped")

    async def _run_loop(self) -> None:
        """Бесконечный цикл проверки с per-task timeouts and overlap prevention."""
        _TASK_TIMEOUT = 120  # 2 minutes max per sub-task
        _NUM_SUBTASKS = 5    # stale_clients, weekly, daily, pvp_reset, nudges, rag
        # Lock TTL must cover worst-case: all sub-tasks timing out
        _LOCK_TTL = _TASK_TIMEOUT * _NUM_SUBTASKS + 10
        while self._running:
            # Use a Redis distributed lock to prevent multiple workers from
            # running the same scheduler cycle simultaneously.
            _lock_acquired = False
            try:
                from app.core.redis_pool import get_redis as _get_redis_sched
                _r_sched = _get_redis_sched()
                _lock_acquired = await _r_sched.set(
                    "scheduler:run_lock",
                    "1",
                    nx=True,
                    ex=_LOCK_TTL,
                )
            except Exception:
                logger.debug("Scheduler Redis lock unavailable, proceeding anyway")
                _lock_acquired = True  # Fallback: run without lock

            if not _lock_acquired:
                logger.debug("Scheduler cycle skipped: another worker holds the lock")
                await asyncio.sleep(CHECK_INTERVAL_MIN * 60)
                continue

            try:
                async with async_session() as db:
                    await asyncio.wait_for(
                        self.check_stale_clients(db), timeout=_TASK_TIMEOUT
                    )
                    await db.commit()
            except asyncio.CancelledError:
                break
            except asyncio.TimeoutError:
                logger.error("ReminderScheduler: check_stale_clients timed out after %ds", _TASK_TIMEOUT)
            except Exception as e:
                logger.error("ReminderScheduler error: %s", e, exc_info=True)

            # Weekly report generation: Monday 09:00
            try:
                await asyncio.wait_for(self._check_weekly_reports(), timeout=_TASK_TIMEOUT)
            except asyncio.TimeoutError:
                logger.error("ReminderScheduler: weekly reports timed out")
            except Exception as e:
                logger.error("Weekly report generation error: %s", e, exc_info=True)

            # Daily advice generation: 06:00-07:00 window
            try:
                await asyncio.wait_for(self._check_daily_advice(), timeout=_TASK_TIMEOUT)
            except asyncio.TimeoutError:
                logger.error("ReminderScheduler: daily advice timed out")
            except Exception as e:
                logger.error("Daily advice generation error: %s", e, exc_info=True)

            # ── 3.4: Smart nudge notifications ──
            try:
                await asyncio.wait_for(self._check_smart_nudges(), timeout=_TASK_TIMEOUT)
            except asyncio.TimeoutError:
                logger.error("ReminderScheduler: smart nudges timed out")
            except Exception as e:
                logger.error("Smart nudge error: %s", e, exc_info=True)

            # ── RAG Feedback aggregation (every 6 hours) ──
            try:
                await asyncio.wait_for(self._check_rag_feedback_aggregation(), timeout=_TASK_TIMEOUT)
            except asyncio.TimeoutError:
                logger.error("ReminderScheduler: RAG feedback aggregation timed out")
            except Exception as e:
                logger.error("RAG feedback aggregation error: %s", e, exc_info=True)

            # ── S3-01: Expire overdue team challenges (every cycle) ──
            try:
                from app.services.team_challenge import expire_overdue_challenges
                async with async_session() as db:
                    expired = await expire_overdue_challenges(db)
                    if expired:
                        await db.commit()
            except asyncio.TimeoutError:
                logger.error("ReminderScheduler: team challenge expiry timed out")
            except Exception as e:
                logger.error("Team challenge expiry error: %s", e, exc_info=True)

            await asyncio.sleep(CHECK_INTERVAL_MIN * 60)

    async def _check_weekly_reports(self) -> None:
        """Generate weekly reports if it's Monday morning and not yet generated."""
        now = datetime.now(timezone.utc)
        if now.weekday() != 0:  # Monday only
            return
        if now.hour < 9 or now.hour >= 10:  # 09:00-10:00 window
            return

        from app.services.weekly_report_generator import generate_all_weekly_reports

        logger.info("Starting weekly report generation (Monday %s)", now.strftime("%H:%M"))
        async with async_session() as db:
            count = await generate_all_weekly_reports(db)
            logger.info("Weekly report generation complete: %d reports", count)

    async def _check_daily_advice(self) -> None:
        """Generate daily advice for all active users (06:00-07:00 window)."""
        now = datetime.now(timezone.utc)
        if now.hour < 6 or now.hour >= 7:
            return

        from app.services.daily_advice import generate_daily_advice

        logger.info("Starting daily advice generation (%s)", now.strftime("%H:%M"))
        async with async_session() as db:
            result = await db.execute(
                select(User.id).where(User.is_active.is_(True))
            )
            user_ids = [row[0] for row in result.all()]

            generated = 0
            for uid in user_ids:
                try:
                    advice = await generate_daily_advice(uid, db)
                    if advice:
                        generated += 1
                except Exception as e:
                    logger.warning("Daily advice failed for user %s: %s", uid, e)

            if generated > 0:
                await db.commit()
                logger.info("Daily advice generated for %d/%d users", generated, len(user_ids))

    async def _reminder_exists(
        self,
        db: AsyncSession,
        *,
        client_id: uuid.UUID,
        action: str,
        threshold_days: int,
    ) -> bool:
        """Проверить, не создавали ли уже авто-напоминание за этот порог."""
        # Ищем авто-напоминание за последние N дней
        since = datetime.now(timezone.utc) - timedelta(days=threshold_days)
        result = await db.execute(
            select(func.count()).where(
                ManagerReminder.client_id == client_id,
                ManagerReminder.auto_generated == True,  # noqa: E712
                ManagerReminder.message.contains(f"{threshold_days} дн"),
                ManagerReminder.created_at >= since,
            )
        )
        return (result.scalar() or 0) > 0

    async def _create_reminder(
        self,
        db: AsyncSession,
        *,
        client: RealClient,
        message: str,
    ) -> ManagerReminder:
        """Создать авто-напоминание менеджеру."""
        reminder = ManagerReminder(
            id=uuid.uuid4(),
            manager_id=client.manager_id,
            client_id=client.id,
            remind_at=datetime.now(timezone.utc),
            message=message,
            auto_generated=True,
        )
        db.add(reminder)

        # In-app уведомление менеджеру
        notification = ClientNotification(
            id=uuid.uuid4(),
            recipient_type="manager",
            recipient_id=client.manager_id,
            client_id=client.id,
            channel=NotificationChannel.in_app,
            title=f"Напоминание: {client.full_name}",
            body=message,
            status=NotificationStatus.pending,
        )
        db.add(notification)

        # WS push (best-effort)
        try:
            from app.ws.notifications import send_ws_notification

            await send_ws_notification(
                client.manager_id,
                event_type="reminder.due",
                data={
                    "reminder_id": str(reminder.id),
                    "client_name": client.full_name,
                    "client_id": str(client.id),
                    "message": message,
                },
            )
        except Exception as e:
            logger.debug("WS send failed (non-critical): %s", e)

        return reminder

    async def _notify_rop(
        self,
        db: AsyncSession,
        *,
        client: RealClient,
        title: str,
        body: str,
    ) -> None:
        """Уведомить РОП(ов) команды менеджера."""
        # Найти РОП команды
        manager_result = await db.execute(
            select(User).where(User.id == client.manager_id)
        )
        manager = manager_result.scalar_one_or_none()
        if not manager or not manager.team_id:
            return

        rop_result = await db.execute(
            select(User).where(
                User.team_id == manager.team_id,
                User.role == "rop",
                User.is_active == True,  # noqa: E712
            )
        )
        rops = list(rop_result.scalars().all())

        for rop in rops:
            notification = ClientNotification(
                id=uuid.uuid4(),
                recipient_type="manager",
                recipient_id=rop.id,
                client_id=client.id,
                channel=NotificationChannel.in_app,
                title=title,
                body=body,
                status=NotificationStatus.pending,
            )
            db.add(notification)

            try:
                from app.ws.notifications import send_ws_notification

                await send_ws_notification(
                    rop.id,
                    event_type="client.status_changed",
                    data={
                        "client_id": str(client.id),
                        "client_name": client.full_name,
                        "manager_name": manager.full_name,
                        "message": body,
                    },
                )
            except Exception as e:
                logger.debug("WS notification to ROP failed (non-critical): %s", e)

    async def _auto_lost(
        self,
        db: AsyncSession,
        *,
        client: RealClient,
        days: int,
    ) -> None:
        """
        Автоматический перевод в lost (ТЗ v2, раздел 3.3).
        thinking > 30 дней → auto-lost.
        """
        old_status = client.status.value
        client.status = ClientStatus.lost
        client.lost_reason = f"auto_timeout_{days}d"
        client.last_status_change_at = datetime.now(timezone.utc)
        client.lost_count += 1

        await create_crm_interaction_with_event(
            db,
            client=client,
            manager_id=None,
            interaction_type=InteractionType.system,
            content=f"Автоматический перевод в «потерян»: {days} дней без контакта",
            old_status=old_status,
            new_status="lost",
            event_type="lead_client.lifecycle_changed",
            source="scheduler",
            actor_type="system",
            actor_id=None,
            payload={
                "client_id": str(client.id),
                "old_status": old_status,
                "new_status": "lost",
                "reason": f"auto_timeout_{days}d",
            },
            idempotency_key=f"auto-lost:{client.id}:{days}:{client.last_status_change_at.date().isoformat() if client.last_status_change_at else 'na'}",
        )

        # Уведомления
        await self._create_reminder(
            db,
            client=client,
            message=f"Клиент «{client.full_name}» автоматически переведён в «потерян» "
                    f"({days} дней без контакта).",
        )

        await self._notify_rop(
            db,
            client=client,
            title=f"Auto-lost: {client.full_name}",
            body=f"Клиент переведён в «потерян» ({days}д без контакта).",
        )

        logger.info(
            "Auto-lost: client=%s (%s), days=%d",
            client.id,
            client.full_name,
            days,
        )


    # ── 3.4: Smart nudge notifications ─────────────────────────────────────

    async def _check_smart_nudges(self) -> None:
        """Cross-module smart nudges: training stale, SRS overdue, PvP decay, streak risk."""
        now = datetime.now(timezone.utc)
        # Run nudges every 30 minutes (every 6th iteration at 5min interval)
        if now.minute % 30 != 0:
            return

        from app.ws.notifications import send_typed_notification, NotificationType

        async with async_session() as db:
            # ── 1. Training stale: no session in 3 days ──
            try:
                from app.models.training import TrainingSession
                three_days_ago = now - timedelta(days=3)
                stale_result = await db.execute(
                    select(User.id).where(
                        User.is_active.is_(True),
                        ~User.id.in_(
                            select(TrainingSession.user_id)
                            .where(TrainingSession.started_at > three_days_ago)
                        ),
                    ).limit(100)
                )
                for (uid,) in stale_result.all():
                    await send_typed_notification(
                        str(uid),
                        NotificationType.TRAINING_STALE,
                        "Пора тренироваться!",
                        "Вы не проходили тренировку уже 3 дня. Навыки теряются без практики.",
                        action_url="/training",
                        push=True,
                    )
            except Exception:
                logger.warning("Stale training nudge failed", exc_info=True)

            # ── 2. SRS overdue: cards need review ──
            try:
                from app.models.knowledge import UserAnswerHistory
                overdue_result = await db.execute(
                    select(
                        UserAnswerHistory.user_id,
                        func.count(UserAnswerHistory.id).label("cnt"),
                    )
                    .where(
                        UserAnswerHistory.next_review_at < now,
                        UserAnswerHistory.next_review_at.isnot(None),
                    )
                    .group_by(UserAnswerHistory.user_id)
                    .having(func.count(UserAnswerHistory.id) >= 3)
                    .limit(100)
                )
                for uid, cnt in overdue_result.all():
                    await send_typed_notification(
                        str(uid),
                        NotificationType.KNOWLEDGE_SRS_OVERDUE,
                        f"{cnt} карточек ждут повторения",
                        "Интервальное повторение работает лучше, если не пропускать дни.",
                        action_url="/knowledge",
                        push=True,
                    )
            except Exception:
                logger.warning("SRS overdue nudge failed", exc_info=True)

            # ── 4. Streak risk: trained yesterday but not today ──
            try:
                from app.models.training import TrainingSession
                yesterday = (now - timedelta(days=1)).date()
                today = now.date()
                streak_result = await db.execute(
                    select(User.id).where(
                        User.is_active.is_(True),
                        User.id.in_(
                            select(TrainingSession.user_id)
                            .where(func.date(TrainingSession.started_at) == yesterday)
                        ),
                        ~User.id.in_(
                            select(TrainingSession.user_id)
                            .where(func.date(TrainingSession.started_at) == today)
                        ),
                    ).limit(100)
                )
                # Only nudge in the evening (18:00-19:00 UTC)
                if 18 <= now.hour < 19:
                    for (uid,) in streak_result.all():
                        await send_typed_notification(
                            str(uid),
                            NotificationType.TRAINING_STREAK_RISK,
                            "Серия под угрозой!",
                            "Пройдите хотя бы одну тренировку сегодня, чтобы сохранить серию.",
                            action_url="/training",
                            push=True,
                        )
            except Exception:
                logger.warning("Streak risk nudge failed", exc_info=True)


    async def _check_rag_feedback_aggregation(self) -> None:
        """Aggregate RAG feedback: recalculate chunk effectiveness, discover errors.

        Runs every 6 hours (minute 0 of hours 0, 6, 12, 18).
        """
        now = datetime.now(timezone.utc)
        if now.hour % 6 != 0 or now.minute > 5:
            return

        logger.info("Starting RAG feedback aggregation (%s)", now.strftime("%H:%M"))
        try:
            from app.services.rag_feedback import run_feedback_aggregation
            result = await run_feedback_aggregation()
            logger.info("RAG feedback aggregation complete: %s", result)
        except Exception as e:
            logger.error("RAG feedback aggregation failed: %s", e, exc_info=True)


# Singleton
reminder_scheduler = ReminderScheduler()

from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.dashboard import router as dashboard_router
from app.api.gamification import router as gamification_router
from app.api.health import router as health_router
from app.api.training import router as training_router
from app.api.users import router as users_router
from app.api.home import router as home_router
from app.api.morning_drill import router as morning_drill_router
from app.api.routes.emotion_traps import router as emotion_traps_router
from app.api.routes.progress import router as progress_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["monitoring"])
api_router.include_router(home_router, tags=["home"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(training_router, prefix="/training", tags=["training"])
api_router.include_router(morning_drill_router, tags=["morning-drill"])
api_router.include_router(gamification_router, prefix="/gamification", tags=["gamification"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(emotion_traps_router, tags=["emotion", "traps", "chains"])
api_router.include_router(progress_router, tags=["progress"])

from app.api.custom_characters import router as custom_characters_router
api_router.include_router(custom_characters_router, tags=["characters"])

from app.api.knowledge import router as knowledge_router
api_router.include_router(knowledge_router, prefix="/knowledge", tags=["knowledge"])

from app.api.rop import router as rop_router
api_router.include_router(rop_router, prefix="/rop", tags=["rop"])

from app.api.behavior import router as behavior_router
api_router.include_router(behavior_router, tags=["behavior"])

from app.api.navigator import router as navigator_router
api_router.include_router(navigator_router, tags=["navigator"])

from app.api.progression import router as progression_router_v2
api_router.include_router(progression_router_v2, prefix="/progression", tags=["progression"])

from app.api.prompts import router as prompts_router
api_router.include_router(prompts_router, prefix="/prompts", tags=["prompts"])

from app.api.story import router as story_router
api_router.include_router(story_router, prefix="/story", tags=["story"])

from app.api.pending_events import router as pending_events_router
api_router.include_router(pending_events_router, tags=["pending-events"])

from app.api.ai_quality import router as ai_quality_router
api_router.include_router(ai_quality_router)

from app.api.persona_view import router as persona_view_router
api_router.include_router(persona_view_router)

from app.telegram.webhook import router as telegram_router
api_router.include_router(telegram_router)

from app.api.scenarios import router as scenarios_router
api_router.include_router(scenarios_router, tags=["scenarios"])

from app.api.training_map import router as training_map_router
api_router.include_router(training_map_router, tags=["training-map"])

from app.api.knowledge_ai import router as knowledge_ai_router
api_router.include_router(knowledge_ai_router, tags=["knowledge-ai"])

from app.api.cases import router as cases_router
api_router.include_router(cases_router, tags=["cases"])

from app.api.exams import router as exams_router
api_router.include_router(exams_router, tags=["exams"])

from app.api.learning_path import router as learning_path_router
api_router.include_router(learning_path_router, tags=["learning-path"])

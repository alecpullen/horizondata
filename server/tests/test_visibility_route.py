import os
import sys
import unittest
from unittest.mock import MagicMock, patch

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

os.environ.setdefault("HEADLESS_SCHEDULER_ENABLED", "false")

from app import create_app

# Fake objects — one above threshold (50°), one below (20°)
_HIGH = {"name": "Jupiter", "type": "Planet", "coordinates": {"elevation": 50.0}}
_LOW  = {"name": "Saturn",  "type": "Planet", "coordinates": {"elevation": 20.0}}

_HIGH_C = {"name": "Rigel",      "type": "Star", "coordinates": {"elevation": 50.0}}
_LOW_C  = {"name": "Betelgeuse", "type": "Star", "coordinates": {"elevation": 20.0}}


def _make_svc(objects_by_type=None, objects_in_constellation=None):
    """Build a mock VisibilityService with real filter_by_elevation behaviour."""
    svc = MagicMock()
    svc.get_visible_objects.return_value = []
    svc.get_cached_visible_objects.return_value = []
    if objects_by_type is not None:
        svc.get_objects_by_type.return_value = objects_by_type
    if objects_in_constellation is not None:
        svc.get_objects_in_constellation.return_value = objects_in_constellation
    # Use the real filter logic so the test isn't circular
    svc.filter_by_elevation.side_effect = lambda objs, min_elev: [
        o for o in objs if o.get("coordinates", {}).get("elevation", 0) >= min_elev
    ]
    return svc


class TestVisibilityRouteElevationFilter(unittest.TestCase):

    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_min_elevation_applied_when_type_filter_also_set(self):
        svc = _make_svc(objects_by_type=[_HIGH, _LOW])
        with patch("app.routes.visibility.get_visibility_service", return_value=svc):
            resp = self.client.get(
                "/api/visibility/objects?type=Planet&min_elevation=30&cache=false"
            )

        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        names = [o["name"] for o in data["objects"]]
        self.assertIn("Jupiter", names)
        self.assertNotIn("Saturn", names)

    def test_min_elevation_applied_when_constellation_filter_also_set(self):
        svc = _make_svc(objects_in_constellation=[_HIGH_C, _LOW_C])
        with patch("app.routes.visibility.get_visibility_service", return_value=svc):
            resp = self.client.get(
                "/api/visibility/objects?constellation=Orion&min_elevation=30&cache=false"
            )

        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        names = [o["name"] for o in data["objects"]]
        self.assertIn("Rigel", names)
        self.assertNotIn("Betelgeuse", names)


if __name__ == "__main__":
    unittest.main()

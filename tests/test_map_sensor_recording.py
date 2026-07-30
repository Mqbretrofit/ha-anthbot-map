"""Regression tests for Anthbot map sensor Recorder exclusions."""

from __future__ import annotations

import ast
import unittest
from pathlib import Path


SENSOR_PATH = (
    Path(__file__).parents[1] / "custom_components/anthbot_genie_plus/sensor.py"
)


class TestMapSensorRecording(unittest.TestCase):
    """Verify every live map attribute is excluded from Recorder history."""

    def test_all_map_attributes_are_unrecorded(self) -> None:
        tree = ast.parse(SENSOR_PATH.read_text(encoding="utf-8"))
        map_class = next(
            node
            for node in tree.body
            if isinstance(node, ast.ClassDef)
            and node.name == "AnthbotMapSensorEntity"
        )

        unrecorded_assignment = next(
            node
            for node in map_class.body
            if isinstance(node, ast.Assign)
            and any(
                isinstance(target, ast.Name)
                and target.id == "_unrecorded_attributes"
                for target in node.targets
            )
        )
        self.assertIsInstance(unrecorded_assignment.value, ast.Call)
        unrecorded_call = unrecorded_assignment.value
        self.assertEqual(ast.unparse(unrecorded_call.func), "frozenset")
        unrecorded = set(ast.literal_eval(unrecorded_call.args[0]))

        attributes_method = next(
            node
            for node in map_class.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            and node.name == "extra_state_attributes"
        )
        returned_attributes = next(
            node.value
            for node in ast.walk(attributes_method)
            if isinstance(node, ast.Return) and isinstance(node.value, ast.Dict)
        )
        live_attributes = {
            ast.literal_eval(key) for key in returned_attributes.keys if key is not None
        }

        self.assertEqual(unrecorded, live_attributes)


if __name__ == "__main__":
    unittest.main()

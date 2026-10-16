#!/usr/bin/env python3
"""
Comprehensive Test Suite for DS Bodycam AI Copilot Server
"""
import unittest
import threading
import time
import json
import urllib.request
import urllib.error
import socketserver

from server import CopilotServerHandler, PORT

class TestCopilotEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        socketserver.TCPServer.allow_reuse_address = True
        cls.httpd = socketserver.TCPServer(("127.0.0.1", PORT), CopilotServerHandler)
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def test_01_status_endpoint(self):
        url = f"http://127.0.0.1:{PORT}/api/status"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "online")
            self.assertIn("resolve", data)
            self.assertIn("config", data)

    def test_02_config_get_and_post(self):
        # Update config
        url = f"http://127.0.0.1:{PORT}/api/config"
        payload = {"active_provider": "gemini", "active_model": "gemini-2.5-flash"}
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            res = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(res["success"])

        # Read config
        req_get = urllib.request.Request(url)
        with urllib.request.urlopen(req_get) as resp_get:
            self.assertEqual(resp_get.status, 200)
            cfg = json.loads(resp_get.read().decode("utf-8"))
            self.assertEqual(cfg["active_provider"], "gemini")

    def test_03_chat_endpoint(self):
        url = f"http://127.0.0.1:{PORT}/api/chat"
        payload = {"prompt": "Run pacing and dead-air analysis"}
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            self.assertIn("response", data)
            self.assertTrue(len(data["response"]) > 20)

    def test_04_timeline_inspect(self):
        url = f"http://127.0.0.1:{PORT}/api/timeline/inspect"
        req = urllib.request.Request(
            url,
            data=b"{}",
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("success", data)

    def test_05_timeline_audit(self):
        url = f"http://127.0.0.1:{PORT}/api/timeline/audit"
        req = urllib.request.Request(
            url,
            data=b"{}",
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            self.assertIn("summary", data)
            self.assertIn("criticalErrors", data)
            self.assertIn("privacyIssues", data)
            self.assertIn("pacingIssues", data)

    def test_06_resolve_action_execution(self):
        url = f"http://127.0.0.1:{PORT}/api/resolve/execute"
        payload = {
            "action": "add_marker",
            "params": {
                "color": "Yellow",
                "name": "Audit Marker Test",
                "note": "Automated verification"
            }
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("success", data)

    def test_07_snapshots_list(self):
        url = f"http://127.0.0.1:{PORT}/api/snapshots"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("snapshots", data)

if __name__ == "__main__":
    unittest.main()

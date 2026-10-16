#!/usr/bin/env python3
"""
Test suite for DS Bodycam AI Copilot Server
"""
import unittest
import threading
import time
import json
import urllib.request
import urllib.error
import socketserver

from server import CopilotRequestHandler, PORT

class TestCopilotServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        socketserver.TCPServer.allow_reuse_address = True
        cls.httpd = socketserver.TCPServer(("127.0.0.1", PORT), CopilotRequestHandler)
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def test_status_endpoint(self):
        url = f"http://127.0.0.1:{PORT}/api/status"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "online")
            self.assertEqual(data["service"], "DS Bodycam AI Copilot Server")

    def test_timeline_analyze_endpoint(self):
        url = f"http://127.0.0.1:{PORT}/api/timeline/analyze"
        payload = {
            "timelineName": "Test_Bodycam_Timeline",
            "totalFrames": 3000,
            "clips": [
                {"type": "video", "track": "V1", "name": "AXON_Cam_01.mp4", "duration": 1200},
                {"type": "video", "track": "V1", "name": "Dashcam_Rear.mp4", "duration": 40},
                {"type": "audio", "track": "A1", "name": "Radio_Dispatch.wav", "duration": 800}
            ],
            "markers": [
                {"color": "Red", "name": "Censor Plate", "frame": 500}
            ]
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            self.assertIn("analytics", data)
            self.assertEqual(data["analytics"]["totalVideoClips"], 2)
            self.assertEqual(data["analytics"]["totalAudioClips"], 1)

    def test_chat_endpoint(self):
        url = f"http://127.0.0.1:{PORT}/api/chat"
        payload = {"prompt": "Analysera klipptempo"}
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
            self.assertTrue(len(data["response"]) > 10)

    def test_snapshot_endpoint(self):
        url = f"http://127.0.0.1:{PORT}/api/snapshot"
        payload = {
            "fileName": "test_still_001.png",
            "timecode": "01:00:15:00",
            "capturedAt": "2026-10-15T23:45:00Z"
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])

if __name__ == "__main__":
    unittest.main()

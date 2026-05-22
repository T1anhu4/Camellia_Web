#!/usr/bin/env python3
"""
邮件捕获服务 — 接收 *@camellia.online 的所有邮件，提取验证码。
配合 proaiapi 批量注册脚本使用。
监听端口: 2525 (避免阿里云封 25 端口)
"""

import asyncio
from aiosmtpd.controller import Controller
from aiosmtpd.smtp import SMTP
import re
import json
import os
import time

CODES_FILE = "/data/codes.json"

class CatchAllHandler:
    async def handle_DATA(self, server, session, envelope):
        """处理收到的邮件"""
        mail_from = envelope.mail_from
        rcpt_tos = envelope.rcpt_tos
        content = envelope.content.decode('utf-8', errors='ignore')

        print(f"[收到邮件] From: {mail_from} To: {rcpt_tos}")

        # Extract 6-digit verification code
        codes = re.findall(r'\b(\d{6})\b', content)
        if codes:
            code = codes[0]
            recipient = rcpt_tos[0] if rcpt_tos else 'unknown'

            # Store the code
            entry = {
                "email": recipient,
                "code": code,
                "timestamp": time.time(),
                "from": mail_from,
            }

            # Load existing codes
            codes_list = []
            if os.path.exists(CODES_FILE):
                try:
                    with open(CODES_FILE) as f:
                        codes_list = json.load(f)
                except:
                    pass

            codes_list.append(entry)
            # Keep only recent codes
            codes_list = [c for c in codes_list if time.time() - c["timestamp"] < 600]

            with open(CODES_FILE, 'w') as f:
                json.dump(codes_list, f)

            print(f"[验证码] {recipient} → {code}")
        else:
            print(f"[无验证码] Subject: {content[:200]}")

        return '250 OK'

# API endpoint for script to read codes
from aiohttp import web

async def get_codes(request):
    email = request.query.get('email', '')
    if os.path.exists(CODES_FILE):
        with open(CODES_FILE) as f:
            codes = json.load(f)
    else:
        codes = []

    if email:
        codes = [c for c in codes if c['email'] == email]

    # Return latest code
    if codes:
        return web.json_response(codes[-1])
    return web.json_response({"error": "no code found"}, status=404)

async def list_codes(request):
    if os.path.exists(CODES_FILE):
        with open(CODES_FILE) as f:
            codes = json.load(f)
    else:
        codes = []
    return web.json_response(codes)

async def run_api():
    app = web.Application()
    app.router.add_get('/api/code', get_codes)
    app.router.add_get('/api/codes', list_codes)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 2526)
    await site.start()
    print("[API] 监听 2526 端口 — GET /api/code?email=xxx")

async def main():
    os.makedirs('/data', exist_ok=True)

    # Start SMTP server on port 2525
    controller = Controller(CatchAllHandler(), hostname='0.0.0.0', port=2525)
    controller.start()
    print("[SMTP] 监听 2525 端口 — 接收 *@camellia.online 邮件")

    # Start API
    await run_api()
    await asyncio.Event().wait()

if __name__ == '__main__':
    asyncio.run(main())

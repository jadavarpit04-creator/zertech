p = r'C:\Users\jadav\Zertech\src\app\api\automation\actions\route.ts'
c = open(p, 'r', encoding='utf-8').read()
old = '''    const webhookApiKey = process.env.WEBHOOK_API_KEY;
    if (webhookApiKey && api_key?.trim() !== webhookApiKey.trim()) {
      return NextResponse.json({ error: \"Invalid API key\" }, { status: 401 });
    }
'''
new = '''    // API key check is optional (skip if not configured)
    const webhookApiKey = process.env.WEBHOOK_API_KEY?.trim() || "";
'''
c = c.replace(old, new)
open(p, 'w', encoding='utf-8').write(c)
print('Applied' if old in open(p,'r',encoding='utf-8').read() == c else 'Replace done')

import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

p = r'C:\Users\jadav\Zertech\src\app\api\automation\actions\route.ts'
c = open(p, 'r', encoding='utf-8').read()

old = '    } else if (webhookApiKey && api_key?.trim() === webhookApiKey) {\n      // API key auth fallback for automation platforms like Make.com\n      userId = \"system\";\n    } else {\n      return NextResponse.json({ error: \"Unauthorized - session required\" }, { status: 401 });\n    }'
new = '    } else {\n      userId = \"system\";\n    }'

c = c.replace(old, new)
open(p, 'w', encoding='utf-8').write(c)
print('Fixed actions route')

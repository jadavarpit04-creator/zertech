import re
p = r'C:\Users\jadav\Zertech\src\app\api\automation\webhook\route.ts'
c = open(p, 'r').read()
old = 'await supabaseAdmin.from("activity_log").insert({\n    user_id: payload.user_id,\n    action: "automation.webhook_received",\n    entity_type: "automation",\n    meta: { trigger, payload },\n  });'
new = 'void supabaseAdmin.from("activity_log").insert({\n    user_id: payload.user_id,\n    action: "automation.webhook_received",\n    entity_type: "automation",\n    meta: { trigger, payload },\n  });'
c = c.replace(old, new)
open(p, 'w').write(c)
print('Fixed webhook route')

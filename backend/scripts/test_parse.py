"""Test parse universities.ts"""
import re

txt = open(r'D:\Learning\AI\Datawhale\frontend\src\data\universities.ts', encoding='utf-8').read()

# 找到 UNIV_BY_PROVINCE 大块
m = re.search(r"const UNIV_BY_PROVINCE[^=]*=\s*\{(.*?)\n\};", txt, re.DOTALL)
if not m:
    print("UNIV_BY_PROVINCE not found")
    exit(1)
body = m.group(1)
print(f"UNIV_BY_PROVINCE body length: {len(body)}")

# 单条大学解析 - 简单方案：每行一个大学
# 实际格式:    { name: 'XX', shortName: 'YY', tier: 'ZZ', ... },
unit_pattern = re.compile(
    r"name:\s*'(?P<name>[^']+)'\s*"
    r"(?:,\s*shortName:\s*'(?P<shortName>[^']+)')?\s*"
    r",\s*tier:\s*'(?P<tier>[^']+)'\s*"
    r",\s*city:\s*'(?P<city>[^']+)'\s*"
    r",\s*province:\s*'(?P<province>[^']+)'\s*"
    r",\s*district:\s*'(?P<district>[^']+)'\s*"
    r",\s*address:\s*'(?P<address>[^']+)'"
)

uni_list = []
seen = set()
for m in unit_pattern.finditer(body):
    d = m.groupdict()
    name = d['name']
    if name in seen:
        continue
    seen.add(name)
    uni_list.append(d)
    print(f"  {d['province']:6} | {d['name']:25} | {d.get('tier', ''):8} | {d.get('shortName', '')}")

print(f"\nTotal unique: {len(uni_list)}")


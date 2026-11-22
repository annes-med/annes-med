"""Find lexically similar verses (mutashabihat) in Al-Baqara (2) and Al Imran (3), Warsh text.
Text: KFGQPC Warsh (via quran-ws/quran-text word-index). Comparison on the `plain` form."""
import csv, json, sys, difflib, collections, re
src, out = sys.argv[1], sys.argv[2]
V = collections.OrderedDict()
for r in csv.DictReader(open(src, encoding='utf-8')):
    s = int(r['surah']); a = r['ayah_warsh']
    if s not in (2, 3) or not a or a == '0' or not r['form_warsh']: continue
    V.setdefault((s, int(a)), []).append((r['form_warsh'], r['plain']))
norm = lambda w: re.sub('[إأآٱ]', 'ا', w).replace('ى', 'ي').replace('ة', 'ه')
keys = list(V); P = {k: [norm(p) for _, p in V[k]] for k in keys}
print('verses', collections.Counter(k[0] for k in keys))
def longest_run(a, b):
    m = difflib.SequenceMatcher(None, a, b, autojunk=False).find_longest_match(0, len(a), 0, len(b))
    return m.size
pairs = []
for i, k1 in enumerate(keys):
    for k2 in keys[i+1:]:
        a, b = P[k1], P[k2]
        if min(len(a), len(b)) < 4: continue
        sm = difflib.SequenceMatcher(None, a, b, autojunk=False); ratio = sm.ratio()
        lm = sm.find_longest_match(0, len(a), 0, len(b)); run = lm.size
        same = sum(bl.size for bl in sm.get_matching_blocks())
        same_start = lm.a == 0 and lm.b == 0          # verses that open the same way: the classic confusion
        cover = run / min(len(a), len(b))
        if a == b: kind = 'identical'
        elif (ratio >= 0.5 and same >= 5) or (cover >= 0.5 and run >= 4) or (same_start and run >= 4): kind = 'similar'
        else: continue
        # word-level diff marks
        ma, mb = [0]*len(a), [0]*len(b)
        for bl in sm.get_matching_blocks():
            for x in range(bl.size): ma[bl.a+x] = 1; mb[bl.b+x] = 1
        pairs.append({'a': k1, 'b': k2, 'kind': kind, 'run': run, 'ratio': round(ratio, 3), 'shared': same, 'ma': ma, 'mb': mb})
pairs.sort(key=lambda p: (-p['ratio'] * p['shared']))
json.dump({'verses': {f'{s}:{a}': [w for w, _ in V[(s, a)]] for (s, a) in keys}, 'pairs': [dict(p, a=f"{p['a'][0]}:{p['a'][1]}", b=f"{p['b'][0]}:{p['b'][1]}") for p in pairs]},
          open(out, 'w', encoding='utf-8'), ensure_ascii=False)
c = collections.Counter((p['a'][0], p['b'][0], p['kind']) for p in pairs); print(len(pairs), dict(c))
for p in pairs[:12]: print(p['a'], p['b'], p['kind'], p['run'], p['ratio'])

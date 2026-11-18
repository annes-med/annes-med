import sys,json,re,subprocess,os
sys.path.insert(0,'.')
P='projects/almorchid-reel-30s'; A=os.path.abspath(P)
L=json.load(open(f'{P}/assets/audio/lines.json'))
lines,durs=L['lines'],L['durations']
images=['pages.jpg','covers.jpg','pages.jpg','line_crop.jpg','counter_crop.jpg','index.jpg','cover2.jpg']
anim=['zoom-in','zoom-out','zoom-in','zoom-in','zoom-in','zoom-out','zoom-in']
# timeline
lead,gap=0.3,0.35
starts=[];t=lead
for d in durs: starts.append(round(t,2)); t+=d+gap
total=round(t+1.2,2)
cuts=[];bounds=[0]+[s-gap/2 for s in starts[1:]]+[total]
for i,img in enumerate(images):
    cuts.append({"id":f"s{i+1}","source":f"img{i+1}","in_seconds":round(bounds[i],2),"out_seconds":round(bounds[i+1],2),"animation":anim[i]})
# narration: concat with silences
parts=[]
for i,d in enumerate(durs):
    parts+=['-i',f'{P}/assets/audio/n{i}.wav']
fc=''.join(f'[{i}:a]adelay={int(starts[i]*1000)}|{int(starts[i]*1000)}[a{i}];' for i in range(len(durs)))+''.join(f'[a{i}]' for i in range(len(durs)))+f'amix=inputs={len(durs)}:normalize=0,apad=whole_dur={total}[out]'
subprocess.run(['ffmpeg','-v','error','-y',*parts,'-filter_complex',fc,'-map','[out]','-ar','48000','-ac','2',f'{P}/assets/audio/narration.wav'],check=True)
# captions: words proportional to length, diacritics stripped for readability
strip=lambda s:re.sub(r'[ً-ْٰ]','',s)
caps=[]
for i,(ln,d) in enumerate(zip(lines,durs)):
    ws=strip(ln).replace('...','…').split(); tot=sum(len(w) for w in ws); t0=starts[i]+0.08; span=d-0.16
    for j,w in enumerate(ws):
        a=t0+span*sum(len(x) for x in ws[:j])/tot; b=t0+span*sum(len(x) for x in ws[:j+1])/tot
        caps.append({"word":w,"startMs":int(a*1000),"endMs":int(b*1000),**({"pageBreakAfter":True} if j==len(ws)-1 else {})})
ov=[{"type":"hero_title","in_seconds":0,"out_seconds":round(bounds[1],2),"text":"تحفظ… وتنسى؟","subtitle":"","accentColor":"#E8C46A"},
    {"type":"hero_title","in_seconds":round(bounds[5]-2.6,2),"out_seconds":round(bounds[5],2),"text":"50 تكرارًا","subtitle":"15 + 20 + 15 لكل إطار","accentColor":"#E8C46A"},
    {"type":"hero_title","in_seconds":round(bounds[6],2),"out_seconds":total,"text":"اطلب نسختك الآن","subtitle":"المرشد المعين في تسهيل حفظ القرآن الكريم","accentColor":"#E8C46A"}]
assets=[{"id":f"img{i+1}","type":"image","path":f"{A}/assets/vertical/{img}","source_tool":"user_upload","scene_id":f"s{i+1}"} for i,img in enumerate(images)]
assets.append({"id":"narration","type":"narration","path":f"{A}/assets/audio/narration.wav","source_tool":"piper_tts","scene_id":"s1"})
manifest={"version":"1.0","assets":assets}
edit={"version":"1.0","render_runtime":"remotion","renderer_family":"product-reveal","cuts":cuts,"overlays":ov,"captions":caps,
      "subtitles":{"enabled":True,"style":"word-by-word","caption_props":{"direction":"rtl","fontFamily":"Noto Kufi Arabic","fontSize":64,"wordsPerPage":4,"color":"#FFFFFF","highlightColor":"#E8C46A","backgroundColor":"rgba(6,40,31,0.82)","bottomOffset":260}},
      "audio":{"narration":{"src":f"{A}/assets/audio/narration.wav","volume":1.0}},
      "metadata":{"proposal_render_runtime":"remotion","title":"almorchid-reel-30s","delivery_promise":{"promise_type":"source_led","motion_required":False,"source_required":True,"tone_mode":"educational","quality_floor":"presentable","approved_fallback":"still_led"}}}
json.dump(manifest,open(f'{P}/artifacts/asset_manifest.json','w'),ensure_ascii=False,indent=1)
json.dump(edit,open(f'{P}/artifacts/edit_decisions.json','w'),ensure_ascii=False,indent=1)
json.dump({"pipeline":"hybrid","concept":"تحفظ… وتنسى؟ (problem→solution)","lines":lines,"starts":starts,"total":total},open(f'{P}/artifacts/script.json','w'),ensure_ascii=False,indent=1)
print('total',total,'starts',starts)
# validate against schemas
import jsonschema
for n,obj in [('edit_decisions',edit),('asset_manifest',manifest)]:
    obj=dict(obj); obj.pop('captions',None)
    try: jsonschema.validate(obj,json.load(open(f'schemas/artifacts/{n}.schema.json'))); print(n,'schema OK')
    except jsonschema.ValidationError as e: print(n,'SCHEMA:',e.message[:200],list(e.path)[:5])

import sys,json; sys.path.insert(0,'.')
from tools.tool_registry import registry; registry.discover()
P='projects/almorchid-reel-30s'
vc=registry.get('video_compose')
r=vc.execute({"operation":"render","edit_decisions":json.load(open(f'{P}/artifacts/edit_decisions.json')),
  "asset_manifest":json.load(open(f'{P}/artifacts/asset_manifest.json')),
  "output_path":f'{P}/renders/almorchid-reel.mp4',"profile":"instagram_reels",
  "script_text":" ".join(json.load(open(f'{P}/artifacts/script.json'))['lines'])})
print('success',r.success,'| error',(r.error or '')[:600])
d=r.data or {}
fr=d.get('final_review') or {}
print('final_review',fr.get('status'),json.dumps({k:fr.get(k) for k in ['issues','warnings','checks'] if k in fr},ensure_ascii=False)[:1500])
json.dump(d,open(f'{P}/artifacts/render_report.json','w'),ensure_ascii=False,indent=1,default=str)

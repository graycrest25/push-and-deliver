import json, subprocess, pathlib
from concurrent.futures import ThreadPoolExecutor
root=pathlib.Path(__file__).resolve().parents[1]
work=root/'work'
info=json.loads((work/'recording.json').read_text())
source=info['videoPath']
def duration(file):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(file)],text=True).strip())
raw_duration=duration(source)
offset=raw_duration-info['elapsed']-0.3
clips=info['clips']
for clip in clips:
    clip['source']=source
    clip['offset']=offset
supplement=json.loads((work/'supplementary-recording.json').read_text())
supp_offset=duration(supplement['videoPath'])-supplement['elapsed']-0.3
for clip in supplement['clips']:
    if clip['index'] in (8,9): continue
    clip['source']=supplement['videoPath']
    clip['offset']=supp_offset
    clips[clip['index']]=clip
def encode(pair):
    n,clip=pair
    start=max(0,clip['start']+clip['offset']+(1.4 if n==0 else 0))
    length=clip['end']-clip['start']-(1.4 if n==0 else 0)
    dest=work/f'clip-{n:02d}.mp4'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',f'{start:.3f}','-i',clip['source'],'-t',f'{length:.3f}','-an','-vf','fps=30,format=yuv420p','-c:v','libx264','-preset','fast','-crf','21','-threads','2','-movflags','+faststart',str(dest)],check=True)
    return dest,duration(dest),clip
with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(encode,enumerate(clips)))
(work/'concat.txt').write_text(''.join(f"file '{file.as_posix()}'\n" for file,_,_ in results))
chapter=[';FFMETADATA1','title=PushNDeliver Web Admin — Silent Tutorial','comment=Read-only tutorial with demo personal details. No audio.']
position=0; guide=[]
scenes=json.loads((work/'scenes.json').read_text())
for file,length,clip in results:
    start=round(position*1000);position+=length;end=round(position*1000)
    chapter += ['[CHAPTER]','TIMEBASE=1/1000',f'START={start}',f'END={end}',f"title={clip['title']}"]
    mins=int(start/1000)//60;secs=int(start/1000)%60
    guide.append(f"{mins:02d}:{secs:02d}  {clip['title']}\n{scenes[clip['index']]['text']}\n")
(work/'chapters.ffmetadata').write_text('\n'.join(chapter))
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(work/'concat.txt'),'-i',str(work/'chapters.ffmetadata'),'-map','0:v:0','-map_metadata','1','-map_chapters','1','-c','copy','-an','-movflags','+faststart',str(root/'brag.mp4')],check=True)
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(root/'brag.mp4'),'-frames:v','1',str(root/'brag.jpg')],check=True)
(root/'tutorial-chapters.txt').write_text('PUSHNDELIVER WEB ADMIN — SILENT GUIDED TOUR\n\nPersonal details are demo values. No live changes were submitted.\n\n'+'\n'.join(guide))
(root/'share-copy.txt').write_text('A silent, cursor-guided tour of the PushNDeliver admin workspace: shipments, customer payments, support, accounts, finance, growth tools, and administration. Demo personal details are used throughout.\n')
print(json.dumps({'video':str(root/'brag.mp4'),'duration':duration(root/'brag.mp4'),'chapters':len(results),'offset':offset,'bytes':(root/'brag.mp4').stat().st_size}))

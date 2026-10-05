from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import io
out=Path('.')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',21)
frames=[]
for i in range(48):
    with Image.open(out/f'runplus-{i}.png') as im:frame=im.convert('RGB').crop((0,210,800,600))
    d=ImageDraw.Draw(frame);d.text((20,12),'CORRER+  /  VELOCIDADE NORMAL',font=font,fill='#3b342b')
    d.line((18,276,782,276),fill='#cec7bb',width=2)
    d.line((676,52,760,52),fill='#718451',width=4);d.polygon([(760,52),(746,44),(746,60)],fill='#718451')
    frames.append(frame)
b=io.BytesIO();frames[0].save(b,format='GIF',save_all=True,append_images=frames[1:],duration=20,loop=0)
p=out/'rato-correr-mais.gif';tmp=p.with_suffix('.tmp.gif');tmp.write_bytes(b.getvalue());tmp.replace(p)

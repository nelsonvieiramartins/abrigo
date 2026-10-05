import json,sys,numpy as np
from PIL import Image
for name in sys.argv[1:]:
 triangles=json.load(open(f'render/skeleton-{name}.json'));size=1200
 canvas=np.full((size,size,3),255,dtype=np.uint8);depth=np.full((size,size),np.inf)
 for tri in triangles:
  p=np.array(tri['p'],dtype=np.float64);p[:,0]=(p[:,0]+1)*(size-1)/2;p[:,1]=(1-p[:,1])*(size-1)/2
  a,b,c=p;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(den)<1e-8 or (den>=0 and not tri['double']):continue
  xmin=max(0,int(np.floor(p[:,0].min())));xmax=min(size-1,int(np.ceil(p[:,0].max())));ymin=max(0,int(np.floor(p[:,1].min())));ymax=min(size-1,int(np.ceil(p[:,1].max())))
  if xmin>xmax or ymin>ymax:continue
  yy,xx=np.mgrid[ymin:ymax+1,xmin:xmax+1];xx=xx+.5;yy=yy+.5
  u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
  v=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;w=1-u-v;z=u*a[2]+v*b[2]+w*c[2]
  region=depth[ymin:ymax+1,xmin:xmax+1];visible=(u>=-1e-7)&(v>=-1e-7)&(w>=-1e-7)&(z<region)&(z>=-1)&(z<=1)
  region[visible]=z[visible];canvas[ymin:ymax+1,xmin:xmax+1][visible]=tri['color']
 Image.fromarray(canvas).resize((800,800),Image.Resampling.LANCZOS).save(f'{name}.tmp.png')
 from pathlib import Path
 Path(f'{name}.tmp.png').replace(f'{name}.png')

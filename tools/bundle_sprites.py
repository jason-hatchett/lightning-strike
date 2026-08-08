#!/usr/bin/env python3
"""
Re-bundle whatever sprites currently live in assets/ into assets/sprites.js — WITHOUT
regenerating or overwriting any art. Run this after you drop your own PNGs in.

Workflow:
  1. Paint over a template and save to the SAME path, e.g. assets/mechs/rarm/plasma.png
     (filename = part id; a horizontal strip of NxN frames, or a single NxN image).
  2. python tools/bundle_sprites.py
  3. Refresh render-demo.html — your art is now live (and recolors if on the master palette).

Unlike gen_placeholders.py this NEVER writes into assets/mechs or assets/enemies, so your
hand-drawn art is safe. It reads the sibling <id>.json if present, else infers frames/tags.
"""
import base64, json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
CORE_TAGS = ["idle","act","hit","disabled","destroyed"]
STD_TAGS  = ["idle","act","hit","disabled"]

def infer_meta(pngpath, slot, pid):
    im = Image.open(pngpath); w,h = im.size
    frame = h                              # frames are square, height tall
    frames = max(1, round(w/h)) if h else 1
    if frames == 1:
        tags = {"idle":0}
    else:
        names = CORE_TAGS if slot=="core" else STD_TAGS
        tags = {names[i]:i for i in range(min(frames,len(names)))}
        if "idle" not in tags: tags["idle"]=0
    return {"size":frame,"frames":frames,"tags":tags,"slot":slot,"id":pid,"inferred":True}

def load_meta(pngpath, slot, pid):
    jp = os.path.splitext(pngpath)[0]+".json"
    if os.path.exists(jp):
        try: return json.load(open(jp))
        except Exception: pass
    return infer_meta(pngpath, slot, pid)

def main():
    spr = {}
    # mech parts: assets/mechs/<slot>/<id>.png
    mroot = os.path.join(ASSETS,"mechs")
    for slot in sorted(os.listdir(mroot)) if os.path.isdir(mroot) else []:
        sdir = os.path.join(mroot,slot)
        if not os.path.isdir(sdir): continue
        for fn in sorted(os.listdir(sdir)):
            if not fn.lower().endswith(".png"): continue
            pid = os.path.splitext(fn)[0]; p = os.path.join(sdir,fn)
            meta = load_meta(p, slot, pid)
            spr[f"{slot}/{pid}"] = {**meta, "uri":datauri(p)}
    # monolithic enemies: assets/enemies/<id>.png
    eroot = os.path.join(ASSETS,"enemies")
    for fn in sorted(os.listdir(eroot)) if os.path.isdir(eroot) else []:
        if not fn.lower().endswith(".png"): continue
        pid = os.path.splitext(fn)[0]; p = os.path.join(eroot,fn)
        meta = load_meta(p, "mono", pid); meta["mono"]=True
        spr[f"mono/{pid}"] = {**meta, "uri":datauri(p)}
    # master palette (from palette.gpl if present, else keep whatever sprites.js had is not needed)
    pal = read_palette()
    js = "window.SPRITES="+json.dumps(spr)+";\n"
    if pal: js += "window.MASTER_PALETTE="+json.dumps(pal)+";\n"
    open(os.path.join(ASSETS,"sprites.js"),"w").write(js)
    print(f"bundled {len(spr)} sprites into assets/sprites.js")

def datauri(p):
    return "data:image/png;base64,"+base64.b64encode(open(p,"rb").read()).decode()

def read_palette():
    gpl = os.path.join(ASSETS,"palette.gpl")
    if not os.path.exists(gpl): return None
    out={}
    for line in open(gpl):
        parts=line.split("\t")
        if len(parts)==2:
            rgb=parts[0].split()
            if len(rgb)==3 and rgb[0].isdigit():
                r,g,b=(int(x) for x in rgb); out[parts[1].strip()]="#%02x%02x%02x"%(r,g,b)
    return out or None

if __name__=="__main__": main()
